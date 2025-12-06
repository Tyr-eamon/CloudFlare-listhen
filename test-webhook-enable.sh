#!/bin/bash

# Telegram Webhook 启用测试脚本
# 用于本地测试或手动验证

# 配置
DOMAIN="${1:-localhost:8080}"
USERNAME="${2:-admin}"
PASSWORD="${3:-admin}"
USE_HTTPS="${4:-false}"

if [ "$USE_HTTPS" = "true" ]; then
    PROTOCOL="https"
else
    PROTOCOL="http"
fi

API_BASE="${PROTOCOL}://${DOMAIN}"
AUTH=$(echo -n "${USERNAME}:${PASSWORD}" | base64)

echo "========================================="
echo "  Telegram Webhook 启用测试"
echo "========================================="
echo "API Base: ${API_BASE}"
echo "Username: ${USERNAME}"
echo ""

# 测试 1: 检查配置
echo "📋 测试 1: 检查配置..."
curl -s -X GET "${API_BASE}/api/manage/sysConfig/others" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json" \
    | jq '.telegramWebhook' || echo "配置 API 调用失败"
echo ""

# 测试 2: 获取 Webhook 状态
echo "📊 测试 2: 获取 Webhook 状态..."
curl -s -X GET "${API_BASE}/api/manage/webhook/telegram" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json" \
    | jq '.' || echo "状态 API 调用失败"
echo ""

# 测试 3: 测试连接
echo "🔌 测试 3: 测试连接..."
curl -s -X GET "${API_BASE}/api/manage/webhook/telegram?action=test" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json" \
    | jq '.' || echo "测试 API 调用失败"
echo ""

# 测试 4: 启用 Webhook（需要确认）
read -p "是否执行启用 Webhook 测试? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 测试 4: 启用 Webhook..."
    curl -s -X POST "${API_BASE}/api/manage/webhook/telegram?action=enable" \
        -H "Authorization: Basic ${AUTH}" \
        -H "Content-Type: application/json" \
        -d '{}' \
        | jq '.' || echo "启用 API 调用失败"
    echo ""
    
    # 再次检查状态
    echo "📊 验证: 再次检查 Webhook 状态..."
    curl -s -X GET "${API_BASE}/api/manage/webhook/telegram" \
        -H "Authorization: Basic ${AUTH}" \
        -H "Content-Type: application/json" \
        | jq '.webhook.url' || echo "状态 API 调用失败"
else
    echo "已跳过启用测试"
fi

echo ""
echo "========================================="
echo "  测试完成"
echo "========================================="
