import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache } from "../../../utils/purgeCache";
import { moveFileInIndex } from "../../../utils/indexManager.js";
import { getDatabase } from '../../../utils/databaseAdapter.js';

/**
 * 文件重命名 API
 * 
 * 支持重命名文件（包括 Webhook 导入的文件）
 * 与 move 不同，rename 只改变文件名，不改变目录路径
 */

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    const url = new URL(request.url);

    // 读取新文件名参数
    const newName = url.searchParams.get('newName');
    if (!newName) {
        return new Response(JSON.stringify({
            success: false,
            error: 'New filename is required'
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // 解码params.path
        params.path = decodeURIComponent(params.path);
        const fileId = params.path.split(',').join('/');
        
        // 提取目录路径和旧文件名
        const pathParts = fileId.split('/');
        const oldFileName = pathParts.pop();
        const directory = pathParts.join('/');
        
        // 构建新的文件ID
        const newFileId = directory ? `${directory}/${newName}` : newName;
        
        if (fileId === newFileId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'New filename is the same as the old one'
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const cdnUrl = `https://${url.hostname}/file/${fileId}`;

        const success = await renameFile(env, fileId, newFileId, newName, cdnUrl, url);
        if (!success) {
            throw new Error('Rename file failed');
        } else {
            // 从索引中删除旧文件，并添加新文件
            waitUntil(moveFileInIndex(context, fileId, newFileId));
        }

        return new Response(JSON.stringify({
            success: true,
            fileId: fileId,
            newFileId: newFileId,
            newName: newName
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function renameFile(env, fileId, newFileId, newName, cdnUrl, url) {
    try {
        const db = getDatabase(env);

        // 读取文件信息
        const img = await db.getWithMetadata(fileId);
        
        if (!img || !img.metadata) {
            throw new Error('File not found');
        }

        // 更新文件名元数据
        img.metadata.FileName = newName;

        // 如果是R2渠道的图片，需要重命名R2中对应的图片
        if (img.metadata?.Channel === 'CloudflareR2') {
            const R2DataBase = env.img_r2;

            // 获取原文件内容
            const object = await R2DataBase.get(fileId);
            if (!object) {
                throw new Error('R2 Object Not Found');
            }

            // 复制到新位置
            await R2DataBase.put(newFileId, object.body);

            // 删除旧文件
            await R2DataBase.delete(fileId);
        }

        // S3 渠道的图片，需要重命名S3中对应的图片
        if (img.metadata?.Channel === 'S3') {
            const { success, newKey, error } = await renameS3File(img, newFileId);
            if (success) {
                // 更新 metadata
                img.metadata.S3FileKey = newFileId;

                const s3ServerDomain = img.metadata.S3Endpoint.replace(/https?:\/\//, "");
                img.metadata.S3Location = `https://${img.metadata.S3BucketName}.${s3ServerDomain}/${newKey}`;
            } else {
                throw new Error(`Failed to rename S3 file: ${error}`);
            }
        }

        // TelegramNew 渠道（Webhook导入的文件）支持重命名
        // 这些文件存储在 Telegram 中，通过 TgFileId 访问，只需更新元数据即可
        if (img.metadata?.Channel === 'TelegramNew') {
            // TelegramNew 渠道只需要更新元数据中的 FileName
            // 文件实际内容仍然通过 TgFileId 从 Telegram 获取
            console.log(`Renaming TelegramNew file: ${fileId} -> ${newFileId}`);
        }

        // 旧版 Telegram 渠道和 Telegraph 渠道不支持重命名
        if (img.metadata?.Channel === 'Telegram' || img.metadata?.Channel === 'Telegraph') {
            throw new Error(`Channel ${img.metadata.Channel} does not support renaming`);
        }

        // 更新KV存储
        await db.put(newFileId, img.value, { metadata: img.metadata });
        await db.delete(fileId);

        // 清除CDN缓存
        await purgeCFCache(env, cdnUrl);

        // 清除randomFileList API缓存
        try {
            const cache = caches.default;
            const nullResponse = new Response(null, {
                headers: { 'Cache-Control': 'max-age=0' },
            });

            const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
            await cache.put(`${url.origin}/api/randomFileList?dir=${normalizedFolder}`, nullResponse);
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }

        return true;
    } catch (e) {
        console.error('Rename file failed:', e);
        return false;
    }
}

async function renameS3File(img, newFileId) {
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
        // 复制文件到新位置
        await s3Client.send(new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `/${bucketName}/${oldKey}`,
            Key: newKey,
        }));

        // 复制成功后，删除旧文件
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldKey,
        }));

        return { success: true, newKey };
    } catch (error) {
        console.error("S3 Rename Failed:", error);
        return { success: false, error: error.message };
    }
}
