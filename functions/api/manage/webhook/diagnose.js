import { getDatabase } from '../../../utils/databaseAdapter.js';
import { TelegramAPI } from '../../../utils/telegramAPI.js';

/**
 * Webhook 诊断 API
 * 诊断 Webhook 配置和连接问题
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
        const diagnostics = {
            timestamp: new Date().toISOString(),
            checks: {}
        };

        // 1. 检查配置是否存在
        diagnostics.checks.configExists = {
            name: '配置存在检查',
            passed: false,
            details: {}
        };

        let config = null;
        try {
            const configStr = await db.get('manage@sysConfig@webhookConfig');
            if (configStr) {
                config = JSON.parse(configStr);
                diagnostics.checks.configExists.passed = true;
                diagnostics.checks.configExists.details = {
                    enabled: config.enabled,
                    hasToken: !!config.botToken,
                    hasChatId: !!config.chatId,
                    hasSecret: !!config.webhookSecret,
                    lastUpdated: config.lastUpdated
                };
            } else {
                diagnostics.checks.configExists.details.message = 'No configuration found in KV';
                // 检查环境变量
                if (env.TELEGRAM_LISTENER_BOT_TOKEN) {
                    diagnostics.checks.configExists.details.message = 'Configuration found in environment variables';
                    config = {
                        botToken: env.TELEGRAM_LISTENER_BOT_TOKEN,
                        chatId: env.TELEGRAM_LISTENER_CHAT_ID || '',
                        webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || '',
                        enabled: true,
                        source: 'environment'
                    };
                }
            }
        } catch (error) {
            diagnostics.checks.configExists.details.error = error.message;
        }

        // 2. 检查 Bot Token 有效性
        diagnostics.checks.botToken = {
            name: 'Bot Token 有效性检查',
            passed: false,
            details: {}
        };

        if (config && config.botToken) {
            try {
                const telegramAPI = new TelegramAPI(config.botToken);
                const meResult = await telegramAPI.getMe();
                if (meResult.ok) {
                    diagnostics.checks.botToken.passed = true;
                    diagnostics.checks.botToken.details = {
                        botId: meResult.result.id,
                        username: meResult.result.username,
                        firstName: meResult.result.first_name,
                        isBot: meResult.result.is_bot
                    };
                } else {
                    diagnostics.checks.botToken.details.error = meResult.description || 'Unknown error';
                }
            } catch (error) {
                diagnostics.checks.botToken.details.error = error.message;
            }
        } else {
            diagnostics.checks.botToken.details.message = 'Bot token not configured';
        }

        // 3. 检查 Chat ID 有效性
        diagnostics.checks.chatId = {
            name: 'Chat ID 有效性检查',
            passed: false,
            details: {}
        };

        if (config && config.botToken && config.chatId) {
            try {
                const telegramAPI = new TelegramAPI(config.botToken);
                const chatResult = await telegramAPI.getChat(config.chatId);
                if (chatResult.ok) {
                    diagnostics.checks.chatId.passed = true;
                    diagnostics.checks.chatId.details = {
                        chatId: chatResult.result.id,
                        title: chatResult.result.title || '',
                        type: chatResult.result.type
                    };
                } else {
                    diagnostics.checks.chatId.details.error = chatResult.description || 'Unknown error';
                }
            } catch (error) {
                diagnostics.checks.chatId.details.error = error.message;
            }
        } else {
            diagnostics.checks.chatId.details.message = 'Chat ID not configured or Bot token unavailable';
        }

        // 4. 检查 Webhook Secret
        diagnostics.checks.webhookSecret = {
            name: 'Webhook Secret 检查',
            passed: false,
            details: {}
        };

        if (config && config.webhookSecret) {
            diagnostics.checks.webhookSecret.passed = true;
            diagnostics.checks.webhookSecret.details = {
                length: config.webhookSecret.length,
                masked: config.webhookSecret.substring(0, 3) + '***'
            };
        } else {
            diagnostics.checks.webhookSecret.details.message = 'Webhook secret not configured';
        }

        // 5. 检查 Webhook 启用状态
        diagnostics.checks.webhookEnabled = {
            name: 'Webhook 启用状态检查',
            passed: config && config.enabled,
            details: {
                enabled: config ? config.enabled : false
            }
        };

        // 6. 检查 Telegram 中的 Webhook 状态
        diagnostics.checks.webhookInTelegram = {
            name: 'Telegram Webhook 状态检查',
            passed: false,
            details: {}
        };

        if (config && config.botToken) {
            try {
                const telegramAPI = new TelegramAPI(config.botToken);
                const webhookInfo = await telegramAPI.getWebhookInfo();
                if (webhookInfo.ok) {
                    const webhook = webhookInfo.result;
                    diagnostics.checks.webhookInTelegram.passed = !!webhook.url;
                    diagnostics.checks.webhookInTelegram.details = {
                        url: webhook.url || 'Not set',
                        hasCustomCertificate: webhook.has_custom_certificate || false,
                        pendingUpdateCount: webhook.pending_update_count || 0,
                        lastErrorDate: webhook.last_error_date || null,
                        lastErrorMessage: webhook.last_error_message || '',
                        maxConnections: webhook.max_connections || 40,
                        allowedUpdates: webhook.allowed_updates || []
                    };
                } else {
                    diagnostics.checks.webhookInTelegram.details.error = webhookInfo.description || 'Unknown error';
                }
            } catch (error) {
                diagnostics.checks.webhookInTelegram.details.error = error.message;
            }
        } else {
            diagnostics.checks.webhookInTelegram.details.message = 'Bot token not configured';
        }

        // 7. 检查接收的文件数量
        diagnostics.checks.receivedFiles = {
            name: '接收的文件检查',
            passed: true,
            details: {}
        };

        try {
            const allFiles = await db.list({
                prefix: 'webhook_imported/'
            });
            const count = allFiles && allFiles.keys ? allFiles.keys.length : 0;
            diagnostics.checks.receivedFiles.details = {
                count: count,
                message: count > 0 ? `Found ${count} imported files` : 'No imported files yet'
            };
        } catch (error) {
            diagnostics.checks.receivedFiles.details.error = error.message;
        }

        // 总体诊断结果
        const allPassed = Object.values(diagnostics.checks).every(check => check.passed);
        diagnostics.summary = {
            allChecksPassed: allPassed,
            totalChecks: Object.keys(diagnostics.checks).length,
            passedChecks: Object.values(diagnostics.checks).filter(check => check.passed).length,
            status: allPassed ? 'ready' : 'needs_attention'
        };

        // 生成建议
        diagnostics.recommendations = [];
        if (!diagnostics.checks.configExists.passed) {
            diagnostics.recommendations.push('配置未找到。请在"其他设置"中配置 Bot Token、Chat ID 和 Webhook Secret。');
        }
        if (!diagnostics.checks.botToken.passed) {
            diagnostics.recommendations.push('Bot Token 无效。请检查 Token 是否正确，或者 Token 是否已过期。');
        }
        if (!diagnostics.checks.chatId.passed) {
            diagnostics.recommendations.push('Chat ID 无效或 Bot 未加入该频道。请确认 Chat ID 正确，并将 Bot 添加到频道中。');
        }
        if (!diagnostics.checks.webhookSecret.passed) {
            diagnostics.recommendations.push('未设置 Webhook Secret。为了安全起见，建议设置一个 Secret。');
        }
        if (!diagnostics.checks.webhookEnabled.passed) {
            diagnostics.recommendations.push('Webhook 已禁用。请在配置中启用 Webhook。');
        }
        if (!diagnostics.checks.webhookInTelegram.passed) {
            diagnostics.recommendations.push('Webhook 未在 Telegram 中注册。请点击"启用 Webhook"按钮进行注册。');
        }

        return new Response(JSON.stringify(diagnostics), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook diagnosis error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
