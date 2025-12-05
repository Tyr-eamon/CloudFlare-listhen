import { TelegramAPI } from '../../../utils/telegramAPI.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';

/**
 * Telegram Webhook 管理 API
 * 
 * GET: 获取当前 Webhook 状态和配置
 * POST: 注册/更新 Webhook URL 到 Telegram
 * DELETE: 取消注册 Webhook
 */

export async function onRequest(context) {
    const { request, env } = context;
    const db = getDatabase(env);

    try {
        // GET - 获取 Webhook 状态
        if (request.method === 'GET') {
            return await getWebhookStatus(db, env);
        }

        // POST - 注册/更新 Webhook
        if (request.method === 'POST') {
            return await registerWebhook(request, db, env);
        }

        // DELETE - 取消 Webhook
        if (request.method === 'DELETE') {
            return await deleteWebhook(db, env);
        }

        return new Response('Method not allowed', {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook management error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function getWebhookStatus(db, env) {
    try {
        // 从配置中获取 bot token
        const config = await getWebhookConfig(db, env);
        
        if (!config.botToken) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Bot token not configured',
                configured: false
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 创建 Telegram API 实例
        const telegramAPI = new TelegramAPI(config.botToken);
        
        // 获取 webhook 信息
        const webhookInfo = await telegramAPI.getWebhookInfo();

        if (!webhookInfo.ok) {
            return new Response(JSON.stringify({
                success: false,
                error: webhookInfo.description || 'Failed to get webhook info',
                configured: true
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 返回 webhook 状态
        return new Response(JSON.stringify({
            success: true,
            configured: true,
            config: {
                botToken: maskToken(config.botToken),
                chatId: config.chatId,
                webhookSecret: config.webhookSecret ? '***' : '',
                enabled: config.enabled
            },
            webhook: {
                url: webhookInfo.result.url || '',
                hasCustomCertificate: webhookInfo.result.has_custom_certificate || false,
                pendingUpdateCount: webhookInfo.result.pending_update_count || 0,
                lastErrorDate: webhookInfo.result.last_error_date || null,
                lastErrorMessage: webhookInfo.result.last_error_message || '',
                maxConnections: webhookInfo.result.max_connections || 40,
                allowedUpdates: webhookInfo.result.allowed_updates || []
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Get webhook status error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            configured: false
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function registerWebhook(request, db, env) {
    try {
        const body = await request.json();
        const { url, botToken, chatId, webhookSecret, enabled } = body;

        if (!url) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Webhook URL is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!botToken) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Bot token is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 创建 Telegram API 实例
        const telegramAPI = new TelegramAPI(botToken);

        // 设置 webhook
        const result = await telegramAPI.setWebhook(url, {
            secret_token: webhookSecret,
            allowed_updates: ['channel_post'],
            drop_pending_updates: true
        });

        if (!result.ok) {
            return new Response(JSON.stringify({
                success: false,
                error: result.description || 'Failed to set webhook'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 保存配置到 KV
        const config = {
            botToken: botToken,
            chatId: chatId || '',
            webhookSecret: webhookSecret || '',
            enabled: enabled !== false,
            lastUpdated: Date.now()
        };

        await db.put('manage@sysConfig@webhookConfig', JSON.stringify(config));

        return new Response(JSON.stringify({
            success: true,
            message: 'Webhook registered successfully',
            result: result.description || 'Webhook was set'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Register webhook error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function deleteWebhook(db, env) {
    try {
        // 从配置中获取 bot token
        const config = await getWebhookConfig(db, env);

        if (!config.botToken) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Bot token not configured'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 创建 Telegram API 实例
        const telegramAPI = new TelegramAPI(config.botToken);

        // 删除 webhook
        const result = await telegramAPI.deleteWebhook(true);

        if (!result.ok) {
            return new Response(JSON.stringify({
                success: false,
                error: result.description || 'Failed to delete webhook'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 更新配置，标记为禁用但保留配置信息
        config.enabled = false;
        config.lastUpdated = Date.now();
        await db.put('manage@sysConfig@webhookConfig', JSON.stringify(config));

        return new Response(JSON.stringify({
            success: true,
            message: 'Webhook deleted successfully',
            result: result.description || 'Webhook was deleted'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Delete webhook error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function getWebhookConfig(db, env) {
    try {
        const configStr = await db.get('manage@sysConfig@webhookConfig');
        if (configStr) {
            return JSON.parse(configStr);
        }
    } catch (error) {
        console.error('Failed to get webhook config from KV:', error);
    }

    // 如果 KV 中没有配置，尝试从环境变量中读取
    return {
        botToken: env.TELEGRAM_LISTENER_BOT_TOKEN || '',
        chatId: env.TELEGRAM_LISTENER_CHAT_ID || '',
        webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || '',
        enabled: false
    };
}

function maskToken(token) {
    if (!token || token.length < 10) return '***';
    return token.substring(0, 5) + '***' + token.substring(token.length - 5);
}
