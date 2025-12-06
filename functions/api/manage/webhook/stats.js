import { getDatabase } from '../../../utils/databaseAdapter.js';
import { readIndex } from '../../../utils/indexManager.js';

/**
 * Webhook 统计 API
 * 
 * GET: 获取 Webhook 导入的文件统计信息
 * 
 * Query parameters:
 * - limit: 最近文件列表的数量（默认 10）
 * - includeTotal: 是否包含总统计（默认 true）
 */

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'GET') {
        return new Response('Method not allowed', {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit'), 10) || 10;
        const includeTotal = url.searchParams.get('includeTotal') !== 'false';

        // 从索引中获取 Webhook 导入的文件（按最近时间排序）
        const result = await readIndex(context, {
            directory: 'webhook_imported/',
            start: 0,
            count: limit,
        });

        // 获取总数和存储统计
        const totalResult = await readIndex(context, {
            directory: 'webhook_imported/',
            countOnly: true
        });

        // 计算总存储空间
        let totalSize = 0;
        let oldestTimestamp = null;
        let newestTimestamp = null;

        const recentFiles = result.files ? result.files.map(file => {
            const fileSize = parseFloat(file.metadata.FileSize) || 0;
            totalSize += fileSize;
            
            const timeStamp = file.metadata.TimeStamp;
            if (timeStamp) {
                if (!newestTimestamp || timeStamp > newestTimestamp) {
                    newestTimestamp = timeStamp;
                }
                if (!oldestTimestamp || timeStamp < oldestTimestamp) {
                    oldestTimestamp = timeStamp;
                }
            }

            return {
                id: file.id,
                fileName: file.metadata.FileName,
                fileSize: file.metadata.FileSize,
                fileSizeFormatted: formatFileSize(file.metadata.FileSize),
                timeStamp: file.metadata.TimeStamp,
                importTime: new Date(file.metadata.TimeStamp).toISOString(),
                directory: file.metadata.Directory || 'webhook_imported/',
                messageId: file.metadata.MessageId || '',
                mimeType: file.metadata.MimeType || '',
                originalFileName: file.metadata.OriginalFileName || ''
            };
        }) : [];

        // 构建响应
        const stats = {
            totalImported: totalResult.totalCount || 0,
            totalSizeMB: parseFloat(totalSize.toFixed(2)),
            totalSizeFormatted: formatFileSize(totalSize),
            recentFiles: recentFiles,
            indexLastUpdated: result.indexLastUpdated || Date.now(),
        };

        // 如果包含时间范围信息
        if (newestTimestamp) {
            stats.lastImportTime = newestTimestamp;
            stats.lastImportTimeFormatted = new Date(newestTimestamp).toISOString();
        }

        if (oldestTimestamp) {
            stats.firstImportTime = oldestTimestamp;
            stats.firstImportTimeFormatted = new Date(oldestTimestamp).toISOString();
        }

        return new Response(JSON.stringify({
            success: true,
            stats: stats
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook stats error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

function formatFileSize(sizeMB) {
    const size = parseFloat(sizeMB) || 0;
    if (size < 1) {
        return (size * 1024).toFixed(2) + ' KB';
    } else if (size < 1024) {
        return size.toFixed(2) + ' MB';
    } else {
        return (size / 1024).toFixed(2) + ' GB';
    }
}
