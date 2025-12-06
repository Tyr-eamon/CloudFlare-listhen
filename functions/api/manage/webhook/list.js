import { readIndex } from '../../../utils/indexManager.js';

/**
 * Webhook 导入文件列表 API
 * 
 * GET: 获取 Webhook 导入的文件列表，带有过滤和排序选项
 * 
 * Query parameters:
 * - start: 起始位置（默认 0）
 * - count: 返回数量，-1 表示全部（默认 50）
 * - sort: 排序方式 - "recent" (默认，按导入时间降序) | "size" (按大小降序) | "name" (按文件名升序)
 * - search: 搜索关键字（匹配文件名）
 * - mimeType: 按 MIME 类型过滤（如 "image", "video", "audio", "document"）
 */

export async function onRequest(context) {
    const { request } = context;

    if (request.method !== 'GET') {
        return new Response('Method not allowed', {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const url = new URL(request.url);
        let start = parseInt(url.searchParams.get('start'), 10) || 0;
        let count = parseInt(url.searchParams.get('count'), 10) || 50;
        const sort = url.searchParams.get('sort') || 'recent';
        const search = url.searchParams.get('search') || '';
        const mimeType = url.searchParams.get('mimeType') || '';

        // 从索引中获取 webhook_imported 目录中的所有文件
        const result = await readIndex(context, {
            directory: 'webhook_imported/',
            search,
            start: 0,  // 先获取所有，然后在内存中排序
            count: -1, // 获取全部
        });

        let files = result.files ? [...result.files] : [];

        // 过滤 MIME 类型
        if (mimeType) {
            files = files.filter(file => {
                const mime = file.metadata?.MimeType || '';
                if (mimeType === 'image') return mime.startsWith('image/');
                if (mimeType === 'video') return mime.startsWith('video/');
                if (mimeType === 'audio') return mime.startsWith('audio/');
                if (mimeType === 'document') return !mime.startsWith('image/') && !mime.startsWith('video/') && !mime.startsWith('audio/');
                return mime.includes(mimeType);
            });
        }

        // 排序
        switch (sort) {
            case 'size':
                files.sort((a, b) => {
                    const sizeA = parseFloat(a.metadata?.FileSize) || 0;
                    const sizeB = parseFloat(b.metadata?.FileSize) || 0;
                    return sizeB - sizeA;
                });
                break;
            case 'name':
                files.sort((a, b) => {
                    const nameA = (a.metadata?.FileName || a.id).toLowerCase();
                    const nameB = (b.metadata?.FileName || b.id).toLowerCase();
                    return nameA.localeCompare(nameB);
                });
                break;
            case 'recent':
            default:
                files.sort((a, b) => {
                    const timeA = a.metadata?.TimeStamp || 0;
                    const timeB = b.metadata?.TimeStamp || 0;
                    return timeB - timeA;
                });
        }

        // 计算总数
        const totalCount = files.length;

        // 应用分页
        if (count === -1) {
            // 返回所有
        } else {
            const end = Math.min(start + count, files.length);
            files = files.slice(start, end);
        }

        // 转换文件格式
        const compatibleFiles = files.map(file => ({
            id: file.id,
            name: file.id,
            fileName: file.metadata?.FileName || '',
            fileSize: file.metadata?.FileSize || 0,
            fileSizeFormatted: formatFileSize(file.metadata?.FileSize || 0),
            timeStamp: file.metadata?.TimeStamp || 0,
            importTime: new Date(file.metadata?.TimeStamp || 0).toISOString(),
            mimeType: file.metadata?.MimeType || '',
            originalFileName: file.metadata?.OriginalFileName || '',
            messageId: file.metadata?.MessageId || '',
            directory: file.metadata?.Directory || 'webhook_imported/',
            isWebhookImport: true,
            source: 'Webhook',
            tags: file.metadata?.Tags || [],
            metadata: {
                ...file.metadata,
                IsWebhookImport: true
            }
        }));

        return new Response(JSON.stringify({
            success: true,
            files: compatibleFiles,
            totalCount: totalCount,
            returnedCount: compatibleFiles.length,
            pagination: {
                start: start,
                count: count === -1 ? totalCount : count,
                total: totalCount
            },
            sort: sort,
            indexLastUpdated: result.indexLastUpdated || Date.now()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook list error:', error);
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
