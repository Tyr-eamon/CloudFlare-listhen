#!/bin/bash

# Telegram Webhook 一键启用脚本
# 用法: ./enable-telegram-webhook.sh <your-domain> <admin-username> <admin-password>

set -e

DOMAIN=${1:-"cloudflare-listhen.pages.dev"}
USERNAME=${2:-""}
PASSWORD=${3:-""}

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
    echo "❌ 错误: 缺少管理员凭据"
    echo "用法: $0 <domain> <username> <password>"
    echo "示例: $0 cloudflare-listhen.pages.dev admin mypassword"
    exit 1
fi

API_BASE="https://${DOMAIN}"
AUTH=$(echo -n "${USERNAME}:${PASSWORD}" | base64)

echo "========================================="
echo "  Telegram Webhook 启用脚本"
echo "========================================="
echo ""
echo "🔗 域名: ${DOMAIN}"
echo "👤 用户: ${USERNAME}"
echo ""

# 1. 检查配置
echo "📋 步骤 1/4: 检查配置..."
CONFIG_RESPONSE=$(curl -s -X GET "${API_BASE}/api/manage/sysConfig/others" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json")

BOT_TOKEN=$(echo "$CONFIG_RESPONSE" | grep -o '"botToken":"[^"]*"' | cut -d'"' -f4)
CHAT_ID=$(echo "$CONFIG_RESPONSE" | grep -o '"chatId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
    echo "❌ 错误: 配置不完整"
    echo "   请先在后台 '其他设置' 中配置 Bot Token 和 Channel ID"
    exit 1
fi

echo "✅ 配置已找到"
echo "   Bot Token: ${BOT_TOKEN:0:10}..."
echo "   Chat ID: ${CHAT_ID}"
echo ""

# 2. 测试连接
echo "🔌 步骤 2/4: 测试连接..."
TEST_RESPONSE=$(curl -s -X GET "${API_BASE}/api/manage/webhook/telegram?action=test" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json")

TEST_SUCCESS=$(echo "$TEST_RESPONSE" | grep -o '"success":[^,}]*' | cut -d':' -f2)

if [ "$TEST_SUCCESS" != "true" ]; then
    echo "⚠️  警告: 连接测试失败"
    echo "$TEST_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4
    echo ""
    read -p "是否继续启用 Webhook? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 1
    fi
else
    echo "✅ 连接测试通过"
    BOT_INFO=$(echo "$TEST_RESPONSE" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
    CHAT_INFO=$(echo "$TEST_RESPONSE" | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
    echo "   Bot: @${BOT_INFO}"
    echo "   频道: ${CHAT_INFO}"
fi
echo ""

# 3. 检查当前 Webhook 状态
echo "🔍 步骤 3/4: 检查当前状态..."
STATUS_RESPONSE=$(curl -s -X GET "${API_BASE}/api/manage/webhook/telegram" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json")

CURRENT_URL=$(echo "$STATUS_RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
PENDING_COUNT=$(echo "$STATUS_RESPONSE" | grep -o '"pendingUpdateCount":[0-9]*' | cut -d':' -f2)

if [ -n "$CURRENT_URL" ]; then
    echo "ℹ️  当前 Webhook URL: ${CURRENT_URL}"
    echo "⚠️  将被覆盖为: ${API_BASE}/webhook/telegram"
    read -p "是否继续? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 1
    fi
else
    echo "ℹ️  当前 Webhook URL: (未设置)"
fi

if [ -n "$PENDING_COUNT" ] && [ "$PENDING_COUNT" -gt 0 ]; then
    echo "📨 待处理消息: ${PENDING_COUNT} 条"
fi
echo ""

# 4. 启用 Webhook
echo "🚀 步骤 4/4: 启用 Webhook..."
WEBHOOK_URL="${API_BASE}/webhook/telegram"

ENABLE_RESPONSE=$(curl -s -X POST "${API_BASE}/api/manage/webhook/telegram?action=enable" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"${WEBHOOK_URL}\"}")

ENABLE_SUCCESS=$(echo "$ENABLE_RESPONSE" | grep -o '"success":[^,}]*' | cut -d':' -f2)

if [ "$ENABLE_SUCCESS" = "true" ]; then
    echo "✅ Webhook 启用成功！"
    echo ""
    echo "========================================="
    echo "  配置信息"
    echo "========================================="
    echo "Webhook URL: ${WEBHOOK_URL}"
    echo "Bot Token: ${BOT_TOKEN:0:10}..."
    echo "Chat ID: ${CHAT_ID}"
    echo ""
    echo "🎉 现在可以在 Telegram 频道中上传文件了！"
    echo "📁 文件将自动导入到 webhook_imported 文件夹"
    echo ""
    echo "查看日志: ${API_BASE}/api/manage/webhook/logs"
    echo "查看诊断: ${API_BASE}/api/manage/webhook/diagnose"
    echo "========================================="
else
    echo "❌ Webhook 启用失败"
    ERROR_MSG=$(echo "$ENABLE_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "错误: ${ERROR_MSG}"
    exit 1
fi
