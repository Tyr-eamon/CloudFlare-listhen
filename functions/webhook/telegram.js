/**
 * Telegram Webhook Endpoint
 * 
 * This endpoint handles incoming webhook updates from Telegram bots to automatically
 * capture files uploaded to private channels.
 * 
 * Required Environment Variables:
 * - TELEGRAM_WEBHOOK_SECRET: Secret token for webhook validation
 * - TELEGRAM_LISTENER_BOT_TOKEN: Bot token for the listener bot (used for file downloads)
 * - TELEGRAM_LISTENER_CHAT_ID: Chat ID of the channel to monitor
 * 
 * Endpoint: POST /webhook/telegram
 * 
 * Supported media types:
 * - photo: Generates filename photo_YYYYMMDD_HHMMSS.jpg
 * - document: Uses original filename or generates document_YYYYMMDD_HHMMSS.bin
 * - video: Generates filename video_YYYYMMDD_HHMMSS.mp4
 * - audio: Generates filename audio_YYYYMMDD_HHMMSS.mp3
 * - animation: Generates filename animation_YYYYMMDD_HHMMSS.gif
 */

import { createResponse } from "../utils/uploadTools";
import { getDatabase } from '../utils/databaseAdapter.js';
import { addFileToIndex } from "../utils/indexManager.js";

export async function onRequest(context) {
    const { request, env } = context;

    // 只接受 POST 请求
    if (request.method !== 'POST') {
        return createResponse('Method not allowed', { status: 405 });
    }

    try {
        // 验证 webhook secret
        const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('TELEGRAM_WEBHOOK_SECRET not configured');
            return createResponse('Webhook secret not configured', { status: 500 });
        }

        const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (secretToken !== webhookSecret) {
            console.error('Invalid webhook secret');
            return createResponse('Unauthorized', { status: 403 });
        }

        // 解析请求体
        const update = await request.json();
        console.log('Received Telegram update:', JSON.stringify(update, null, 2));

        // 检查是否为频道消息
        const channelPost = update.channel_post;
        if (!channelPost) {
            return createResponse(JSON.stringify({
                status: 200,
                message: 'No channel post'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 获取频道信息
        const chatId = channelPost.chat.id.toString();
        const messageId = channelPost.message_id;
        const date = channelPost.date * 1000; // 转换为毫秒

        // 检查是否为监听的频道
        const listenerChatId = env.TELEGRAM_LISTENER_CHAT_ID;
        if (!listenerChatId || chatId !== listenerChatId) {
            console.log(`Chat ${chatId} not monitored, skipping`);
            return createResponse(JSON.stringify({
                status: 200,
                message: 'Chat not monitored'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 解析文件信息
        let fileInfo = null;
        let fileName = null;

        if (channelPost.photo) {
            // 处理照片
            const largestPhoto = channelPost.photo[channelPost.photo.length - 1];
            fileInfo = {
                file_id: largestPhoto.file_id,
                file_size: largestPhoto.file_size,
                file_unique_id: largestPhoto.file_unique_id,
                mime_type: 'image/jpeg'
            };
            fileName = generateFileName('photo', new Date(date), 'jpg');
        } else if (channelPost.document) {
            // 处理文档
            fileInfo = {
                file_id: channelPost.document.file_id,
                file_size: channelPost.document.file_size,
                file_unique_id: channelPost.document.file_unique_id,
                file_name: channelPost.document.file_name,
                mime_type: channelPost.document.mime_type
            };
            const ext = getFileExtension(channelPost.document.file_name, channelPost.document.mime_type);
            fileName = channelPost.document.file_name || generateFileName('document', new Date(date), ext);
        } else if (channelPost.video) {
            // 处理视频
            fileInfo = {
                file_id: channelPost.video.file_id,
                file_size: channelPost.video.file_size,
                file_unique_id: channelPost.video.file_unique_id,
                mime_type: channelPost.video.mime_type
            };
            fileName = generateFileName('video', new Date(date), 'mp4');
        } else if (channelPost.audio) {
            // 处理音频
            fileInfo = {
                file_id: channelPost.audio.file_id,
                file_size: channelPost.audio.file_size,
                file_unique_id: channelPost.audio.file_unique_id,
                mime_type: channelPost.audio.mime_type,
                file_name: channelPost.audio.title || channelPost.audio.file_name
            };
            fileName = channelPost.audio.title || channelPost.audio.file_name || generateFileName('audio', new Date(date), 'mp3');
        } else if (channelPost.animation) {
            // 处理动画 (GIF)
            fileInfo = {
                file_id: channelPost.animation.file_id,
                file_size: channelPost.animation.file_size,
                file_unique_id: channelPost.animation.file_unique_id,
                mime_type: channelPost.animation.mime_type || 'image/gif'
            };
            fileName = generateFileName('animation', new Date(date), 'gif');
        }

        if (!fileInfo) {
            return createResponse(JSON.stringify({
                status: 200,
                message: 'No supported media'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 生成唯一的文件ID
        const fileId = `tg_webhook_${chatId}_${messageId}_${fileInfo.file_unique_id}`;

        // 构建元数据
        const metadata = {
            FileName: fileName,
            FileSize: (fileInfo.file_size / 1024 / 1024).toFixed(2),
            TgFileId: fileInfo.file_id,
            TgChatId: chatId,
            TgBotToken: env.TELEGRAM_LISTENER_BOT_TOKEN,
            Channel: "TelegramNew",
            Directory: "webhook_imported/",
            TimeStamp: date,
            IsWebhookImport: true,
            MessageId: messageId,
            OriginalFileName: fileInfo.file_name || '',
            MimeType: fileInfo.mime_type,
            UploadIP: "webhook",
            UploadAddress: "Telegram Webhook",
            ListType: "None",
            Label: "None",
            Tags: []
        };

        // 存储到数据库
        const db = getDatabase(env);
        try {
            await db.put(fileId, "", {
                metadata: metadata,
            });
            console.log(`Successfully stored file ${fileId} to database`);
        } catch (error) {
            console.error('Failed to store to database:', error);
            throw error;
        }

        // 添加到索引
        try {
            await addFileToIndex(context, fileId, metadata);
            console.log(`Successfully added file ${fileId} to index`);
        } catch (indexError) {
            console.error('Failed to add to index:', indexError);
            // 即使索引失败也继续，不影响主要功能
        }

        // 返回成功响应
        return createResponse(JSON.stringify({
            status: 200,
            message: "OK",
            fileId: fileId,
            fileName: fileName
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('Webhook processing error:', error);
        
        // 即使出错也返回 200，避免 Telegram 重试轰炸
        return createResponse(JSON.stringify({
            status: 200,
            message: "Error processed but accepted"
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

// 生成文件名
function generateFileName(type, date, extension) {
    const dateStr = String(date.getFullYear()) + 
                   String(date.getMonth() + 1).padStart(2, '0') + 
                   String(date.getDate()).padStart(2, '0');
    const timeStr = String(date.getHours()).padStart(2, '0') + 
                   String(date.getMinutes()).padStart(2, '0') + 
                   String(date.getSeconds()).padStart(2, '0');
    
    return `${type}_${dateStr}_${timeStr}.${extension}`;
}

// 获取文件扩展名
function getFileExtension(fileName, mimeType) {
    if (fileName && fileName.includes('.')) {
        return fileName.split('.').pop().toLowerCase();
    }
    
    // 根据MIME类型推断扩展名
    const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'application/pdf': 'pdf',
        'text/plain': 'txt'
    };
    
    return mimeToExt[mimeType] || 'bin';
}