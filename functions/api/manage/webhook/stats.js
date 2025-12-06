import { getDatabase } from '../../../utils/databaseAdapter.js';
import { readIndex } from '../../../utils/indexManager.js';

/**
 * Webhook 统计 API
 * 
 * GET: 获取 Webhook 导入的文件统计信息
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

        // 从索引中获取 Webhook 导入的文件
        const result = await readIndex(context, {
            channel: 'TelegramNew',
            start: 0,
            count: limit,
        });

        // 获取总数
        const totalResult = await readIndex(context, {
            channel: 'TelegramNew',
            countOnly: true
        });

        // 转换文件格式
        const recentFiles = result.files ? result.files.map(file => ({
            id: file.id,
            fileName: file.metadata.FileName,
            fileSize: file.metadata.FileSize,
            timeStamp: file.metadata.TimeStamp,
            directory: file.metadata.Directory || '',
            messageId: file.metadata.MessageId || '',
            mimeType: file.metadata.MimeType || ''
        })) : [];

        return new Response(JSON.stringify({
            success: true,
            stats: {
                totalImported: totalResult.totalCount || 0,
                recentFiles: recentFiles,
                indexLastUpdated: result.indexLastUpdated || Date.now()
            }
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
