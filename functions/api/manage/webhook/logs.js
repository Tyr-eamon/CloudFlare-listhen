import { getDatabase } from '../../../utils/databaseAdapter.js';

/**
 * Webhook 日志 API
 * 获取最近接收的 Webhook 消息日志
 */

export async function onRequest(context) {
    const { request, env } = context;
    const db = getDatabase(env);

    if (request.method !== 'GET') {
        return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // 从 KV 中获取所有 webhook_imported 的文件
        const files = [];
        const allFiles = await db.list({
            prefix: 'webhook_imported/',
            limit: limit + offset
        });

        if (allFiles && allFiles.keys) {
            for (let i = offset; i < Math.min(offset + limit, allFiles.keys.length); i++) {
                const key = allFiles.keys[i];
                if (key.metadata) {
                    files.push({
                        id: key.name,
                        fileName: key.metadata.FileName || '',
                        fileSize: key.metadata.FileSize || '',
                        mimeType: key.metadata.MimeType || '',
                        timeStamp: key.metadata.TimeStamp || 0,
                        messageId: key.metadata.MessageId || '',
                        originalFileName: key.metadata.OriginalFileName || ''
                    });
                }
            }
        }

        // 按时间戳倒序排序（最新的首先）
        files.sort((a, b) => b.timeStamp - a.timeStamp);

        return new Response(JSON.stringify({
            success: true,
            data: {
                total: allFiles.keys ? allFiles.keys.length : 0,
                limit: limit,
                offset: offset,
                count: files.length,
                files: files
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook logs error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
