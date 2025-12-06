import { purgeCFCache } from "../../../utils/purgeCache.js";
import { batchRemoveFilesFromIndex, batchMoveFilesInIndex } from "../../../utils/indexManager.js";
import { getDatabase } from "../../../utils/databaseAdapter.js";
import { S3Client, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";

/**
 * Batch File Management API
 * 
 * DELETE: Batch delete files
 * POST: Batch rename files or batch move files
 * 
 * Request body format for DELETE:
 * {
 *   fileIds: ["file1", "file2", ...],
 *   action: "delete" | "move" | "rename"
 * }
 * 
 * Request body format for move:
 * {
 *   fileIds: ["file1", "file2", ...],
 *   action: "move",
 *   dist: "target/directory"
 * }
 * 
 * Request body format for rename:
 * {
 *   fileIds: ["file1", "file2", ...],
 *   action: "rename",
 *   prefix: "prefix_",  // optional
 *   suffix: "_suffix",  // optional
 *   replacePattern: "old",  // optional - text to replace
 *   replaceWith: "new"  // optional - replacement text
 * }
 */
export async function onRequest(context) {
    const {
        request,
        env,
        waitUntil,
        params,
    } = context;

    const url = new URL(request.url);

    if (request.method !== 'DELETE' && request.method !== 'POST') {
        return new Response(JSON.stringify({
            error: 'Method not allowed',
            allowedMethods: ['DELETE', 'POST']
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { fileIds = [], action = 'delete' } = body;

        // Validate fileIds
        if (!Array.isArray(fileIds) || fileIds.length === 0) {
            return new Response(JSON.stringify({
                error: 'Invalid fileIds',
                message: 'fileIds must be a non-empty array of file identifiers'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Handle batch delete
        if (request.method === 'DELETE' || action === 'delete') {
            return await batchDeleteFiles(context, fileIds, url, waitUntil);
        }

        // Handle batch move
        if (action === 'move') {
            const { dist } = body;
            if (!dist) {
                return new Response(JSON.stringify({
                    error: 'Missing parameter',
                    message: 'dist (destination directory) is required for move action'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return await batchMoveFiles(context, fileIds, dist, url, waitUntil);
        }

        // Handle batch rename
        if (action === 'rename') {
            return await batchRenameFiles(context, fileIds, body, url, waitUntil);
        }

        return new Response(JSON.stringify({
            error: 'Invalid action',
            message: 'Action must be one of: delete, move, rename'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in batch file management:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function batchDeleteFiles(context, fileIds, url, waitUntil) {
    const { env } = context;
    const db = getDatabase(env);
    
    const results = {
        success: true,
        total: fileIds.length,
        deleted: 0,
        errors: []
    };

    const deletedFiles = [];

    for (const fileId of fileIds) {
        try {
            const img = await db.getWithMetadata(fileId);
            
            if (!img || !img.metadata) {
                results.errors.push({
                    fileId: fileId,
                    error: 'File not found'
                });
                continue;
            }

            // Handle R2 deletion
            if (img.metadata?.Channel === 'CloudflareR2') {
                const R2DataBase = env.img_r2;
                await R2DataBase.delete(fileId);
            }

            // Handle S3 deletion
            if (img.metadata?.Channel === 'S3') {
                await deleteS3File(img);
            }

            // Delete from database
            await db.delete(fileId);

            // Clear CDN cache
            const cdnUrl = `https://${url.hostname}/file/${fileId}`;
            waitUntil(purgeCFCache(env, cdnUrl));

            deletedFiles.push(fileId);
            results.deleted++;

        } catch (error) {
            results.errors.push({
                fileId: fileId,
                error: error.message
            });
        }
    }

    // Batch update index
    if (deletedFiles.length > 0) {
        waitUntil(batchRemoveFilesFromIndex(context, deletedFiles));
    }

    if (results.errors.length > 0) {
        results.success = false;
    }

    return new Response(JSON.stringify(results), {
        status: results.success ? 200 : 207,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function batchMoveFiles(context, fileIds, dist, url, waitUntil) {
    const { env } = context;
    const db = getDatabase(env);

    const normalizedDist = dist
        .replace(/^\/+/, '')
        .replace(/\/{2,}/g, '/')
        .replace(/\/$/, '');

    const results = {
        success: true,
        total: fileIds.length,
        moved: 0,
        errors: [],
        movedFiles: []
    };

    const moveOperations = [];

    for (const fileId of fileIds) {
        try {
            const img = await db.getWithMetadata(fileId);
            
            if (!img || !img.metadata) {
                results.errors.push({
                    fileId: fileId,
                    error: 'File not found'
                });
                continue;
            }

            const fileName = fileId.split('/').pop();
            const newFileId = normalizedDist === '' ? fileName : `${normalizedDist}/${fileName}`;

            if (fileId === newFileId) {
                results.errors.push({
                    fileId: fileId,
                    error: 'Source and destination are the same'
                });
                continue;
            }

            // Handle R2 move
            if (img.metadata?.Channel === 'CloudflareR2') {
                const R2DataBase = env.img_r2;
                const object = await R2DataBase.get(fileId);
                if (object) {
                    await R2DataBase.put(newFileId, object.body);
                    await R2DataBase.delete(fileId);
                }
            }

            // Handle S3 move
            if (img.metadata?.Channel === 'S3') {
                await moveS3File(img, newFileId);
                img.metadata.S3FileKey = newFileId;
            }

            // Update directory metadata
            const DirectoryPath = newFileId.split('/').slice(0, -1).join('/') === '' 
                ? '' 
                : newFileId.split('/').slice(0, -1).join('/') + '/';
            img.metadata.Directory = DirectoryPath;

            // Update database
            await db.put(newFileId, img.value, { metadata: img.metadata });
            await db.delete(fileId);

            // Clear CDN cache
            const cdnUrl = `https://${url.hostname}/file/${fileId}`;
            waitUntil(purgeCFCache(env, cdnUrl));

            moveOperations.push({
                originalFileId: fileId,
                newFileId: newFileId
            });

            results.movedFiles.push({
                from: fileId,
                to: newFileId
            });
            results.moved++;

        } catch (error) {
            results.errors.push({
                fileId: fileId,
                error: error.message
            });
        }
    }

    // Batch update index
    if (moveOperations.length > 0) {
        waitUntil(batchMoveFilesInIndex(context, moveOperations));
    }

    if (results.errors.length > 0) {
        results.success = false;
    }

    return new Response(JSON.stringify(results), {
        status: results.success ? 200 : 207,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function batchRenameFiles(context, fileIds, body, url, waitUntil) {
    const { env } = context;
    const db = getDatabase(env);
    const { prefix = '', suffix = '', replacePattern = '', replaceWith = '' } = body;

    const results = {
        success: true,
        total: fileIds.length,
        renamed: 0,
        errors: [],
        renamedFiles: []
    };

    for (const fileId of fileIds) {
        try {
            const img = await db.getWithMetadata(fileId);
            
            if (!img || !img.metadata) {
                results.errors.push({
                    fileId: fileId,
                    error: 'File not found'
                });
                continue;
            }

            // Extract directory and filename
            const pathParts = fileId.split('/');
            const oldFileName = pathParts.pop();
            const directory = pathParts.join('/');

            // Generate new filename
            let newFileName = oldFileName;
            
            // Apply pattern replacement if provided
            if (replacePattern && replaceWith) {
                newFileName = newFileName.replace(new RegExp(replacePattern, 'g'), replaceWith);
            }

            // Apply prefix
            if (prefix) {
                newFileName = prefix + newFileName;
            }

            // Apply suffix (before extension)
            if (suffix) {
                const lastDotIndex = newFileName.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    const nameWithoutExt = newFileName.substring(0, lastDotIndex);
                    const ext = newFileName.substring(lastDotIndex);
                    newFileName = nameWithoutExt + suffix + ext;
                } else {
                    newFileName = newFileName + suffix;
                }
            }

            const newFileId = directory ? `${directory}/${newFileName}` : newFileName;

            if (fileId === newFileId) {
                results.errors.push({
                    fileId: fileId,
                    error: 'New filename is the same as old'
                });
                continue;
            }

            // Update filename in metadata
            img.metadata.FileName = newFileName;

            // Handle R2 rename
            if (img.metadata?.Channel === 'CloudflareR2') {
                const R2DataBase = env.img_r2;
                const object = await R2DataBase.get(fileId);
                if (object) {
                    await R2DataBase.put(newFileId, object.body);
                    await R2DataBase.delete(fileId);
                }
            }

            // Handle S3 rename
            if (img.metadata?.Channel === 'S3') {
                await renameS3File(img, newFileId);
                img.metadata.S3FileKey = newFileId;
            }

            // Update database
            await db.put(newFileId, img.value, { metadata: img.metadata });
            await db.delete(fileId);

            // Clear CDN cache
            const cdnUrl = `https://${url.hostname}/file/${fileId}`;
            waitUntil(purgeCFCache(env, cdnUrl));

            results.renamedFiles.push({
                from: fileId,
                to: newFileId,
                newFileName: newFileName
            });
            results.renamed++;

        } catch (error) {
            results.errors.push({
                fileId: fileId,
                error: error.message
            });
        }
    }

    if (results.errors.length > 0) {
        results.success = false;
    }

    return new Response(JSON.stringify(results), {
        status: results.success ? 200 : 207,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function deleteS3File(img) {
    const s3Client = new S3Client({
        region: img.metadata?.S3Region || "auto",
        endpoint: img.metadata?.S3Endpoint,
        credentials: {
            accessKeyId: img.metadata?.S3AccessKeyId,
            secretAccessKey: img.metadata?.S3SecretAccessKey
        },
        forcePathStyle: img.metadata?.S3PathStyle || false
    });

    const bucketName = img.metadata?.S3BucketName;
    const key = img.metadata?.S3FileKey;

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        }));
        return true;
    } catch (error) {
        console.error("S3 Delete Failed:", error);
        throw error;
    }
}

async function moveS3File(img, newFileId) {
    const s3Client = new S3Client({
        region: img.metadata?.S3Region || "auto",
        endpoint: img.metadata?.S3Endpoint,
        credentials: {
            accessKeyId: img.metadata?.S3AccessKeyId,
            secretAccessKey: img.metadata?.S3SecretAccessKey
        },
        forcePathStyle: img.metadata?.S3PathStyle || false
    });

    const bucketName = img.metadata?.S3BucketName;
    const oldKey = img.metadata?.S3FileKey;
    const newKey = newFileId;

    try {
         await s3Client.send(new CopyObjectCommand({
             Bucket: bucketName,
             CopySource: `/${bucketName}/${oldKey}`,
             Key: newKey,
         }));

         await s3Client.send(new DeleteObjectCommand({
             Bucket: bucketName,
             Key: oldKey,
         }));

        return { success: true, newKey };
    } catch (error) {
        console.error("S3 Move Failed:", error);
        throw error;
    }
}

async function renameS3File(img, newFileId) {
    return moveS3File(img, newFileId);
}
