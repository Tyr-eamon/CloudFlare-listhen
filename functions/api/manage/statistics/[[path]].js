import { readIndex } from '../../../utils/indexManager.js';

/**
 * 目录统计 API
 * 
 * GET: 获取指定目录的文件统计信息
 * 
 * Path parameters:
 * - path: 目录路径（如 "webhook_imported"）
 * 
 * Query parameters:
 * - byType: 是否按文件类型统计（默认 false）
 * - bySize: 是否统计按大小范围（默认 false）
 */

export async function onRequest(context) {
    const { request, params } = context;

    if (request.method !== 'GET') {
        return new Response('Method not allowed', {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const url = new URL(request.url);
        
        // 解析路径参数
        let dir = decodeURIComponent(params.path || '').split(',').join('/');
        if (dir && !dir.endsWith('/')) {
            dir = dir + '/';
        }

        const byType = url.searchParams.get('byType') === 'true';
        const bySize = url.searchParams.get('bySize') === 'true';

        // 从索引中获取指定目录的所有文件
        const result = await readIndex(context, {
            directory: dir,
            start: 0,
            count: -1,
        });

        const files = result.files ? [...result.files] : [];

        // 基础统计
        const stats = {
            totalFiles: files.length,
            totalSizeMB: 0,
            oldestFile: null,
            newestFile: null,
            filesByType: {},
            fileBySizeRange: {
                small: { count: 0, label: '< 1 MB' },
                medium: { count: 0, label: '1-10 MB' },
                large: { count: 0, label: '10-100 MB' },
                veryLarge: { count: 0, label: '> 100 MB' }
            }
        };

        // 遍历文件计算统计
        files.forEach(file => {
            const fileSize = parseFloat(file.metadata?.FileSize) || 0;
            stats.totalSizeMB += fileSize;

            // 按类型统计
            if (byType) {
                const mimeType = file.metadata?.MimeType || 'unknown';
                const type = mimeType.split('/')[0] || 'unknown';
                if (!stats.filesByType[type]) {
                    stats.filesByType[type] = { count: 0, size: 0 };
                }
                stats.filesByType[type].count++;
                stats.filesByType[type].size += fileSize;
            }

            // 按大小范围统计
            if (bySize) {
                if (fileSize < 1) {
                    stats.fileBySizeRange.small.count++;
                } else if (fileSize < 10) {
                    stats.fileBySizeRange.medium.count++;
                } else if (fileSize < 100) {
                    stats.fileBySizeRange.large.count++;
                } else {
                    stats.fileBySizeRange.veryLarge.count++;
                }
            }

            // 时间范围
            const timeStamp = file.metadata?.TimeStamp;
            if (timeStamp) {
                if (!stats.oldestFile || timeStamp < stats.oldestFile.timeStamp) {
                    stats.oldestFile = {
                        id: file.id,
                        fileName: file.metadata?.FileName,
                        timeStamp: timeStamp,
                        timeFormatted: new Date(timeStamp).toISOString()
                    };
                }
                if (!stats.newestFile || timeStamp > stats.newestFile.timeStamp) {
                    stats.newestFile = {
                        id: file.id,
                        fileName: file.metadata?.FileName,
                        timeStamp: timeStamp,
                        timeFormatted: new Date(timeStamp).toISOString()
                    };
                }
            }
        });

        stats.totalSizeFormatted = formatFileSize(stats.totalSizeMB);
        
        // 移除空的统计对象
        if (!byType) {
            delete stats.filesByType;
        } else {
            // 为每个类型添加格式化的大小
            Object.keys(stats.filesByType).forEach(type => {
                stats.filesByType[type].sizeFormatted = formatFileSize(stats.filesByType[type].size);
            });
        }

        if (!bySize) {
            delete stats.fileBySizeRange;
        }

        return new Response(JSON.stringify({
            success: true,
            directory: dir || '/',
            stats: stats,
            indexLastUpdated: result.indexLastUpdated || Date.now()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Statistics API error:', error);
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
