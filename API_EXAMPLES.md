# Telegram Webhook API 使用示例

## 认证

所有 API 都需要 Basic Auth 认证。

### 生成 Authorization Header

```bash
# 方法 1: 使用 base64
echo -n "admin:yourpassword" | base64
# 输出: YWRtaW46eW91cnBhc3N3b3Jk

# 方法 2: 使用 curl 的 -u 参数
curl -u admin:yourpassword 'https://your-domain.com/api/...'
```

## API 端点

### 1. 保存配置

**端点：** `POST /api/manage/sysConfig/others`

**用途：** 保存 Telegram Webhook 配置到 KV 存储

**请求：**
```bash
curl -X POST 'https://cloudflare-listhen.pages.dev/api/manage/sysConfig/others' \
  -u admin:yourpassword \
  -H 'Content-Type: application/json' \
  -d '{
    "telegramWebhook": {
      "enabled": true,
      "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
      "chatId": "-1003321158178",
      "webhookSecret": "my-secret-key-123"
    },
    "telemetry": {
      "enabled": true
    },
    "randomImageAPI": {
      "enabled": false,
      "allowedDir": ""
    },
    "cloudflareApiToken": {
      "CF_ZONE_ID": "",
      "CF_EMAIL": "",
      "CF_API_KEY": ""
    },
    "webDAV": {
      "enabled": false,
      "username": "",
      "password": ""
    }
  }'
```

**响应：**
```json
{
  "telegramWebhook": {
    "enabled": true,
    "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "-1003321158178",
    "webhookSecret": "my-secret-key-123",
    "lastUpdated": 1701857400000,
    "fixed": false
  },
  ...
}
```

### 2. 启用 Webhook（新增 - 推荐）

**端点：** `POST /api/manage/webhook/telegram?action=enable`

**用途：** 一键启用 Webhook，自动从 KV 读取配置并注册到 Telegram

**请求：**
```bash
# 使用默认 URL（当前域名 + /webhook/telegram）
curl -X POST 'https://cloudflare-listhen.pages.dev/api/manage/webhook/telegram?action=enable' \
  -u admin:yourpassword \
  -H 'Content-Type: application/json' \
  -d '{}'

# 或指定自定义 URL
curl -X POST 'https://cloudflare-listhen.pages.dev/api/manage/webhook/telegram?action=enable' \
  -u admin:yourpassword \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://custom-domain.com/webhook/telegram"
  }'
```

**响应（成功）：**
```json
{
  "success": true,
  "message": "Webhook enabled successfully",
  "webhookUrl": "https://cloudflare-listhen.pages.dev/webhook/telegram",
  "result": "Webhook was set"
}
```

**响应（失败 - 配置未保存）：**
```json
{
  "success": false,
  "error": "Bot token not configured. Please configure it first in \"Other Settings\"."
}
```

### 3. 获取 Webhook 状态

**端点：** `GET /api/manage/webhook/telegram`

**用途：** 查看当前 Webhook 状态和配置

**请求：**
```bash
curl -X GET 'https://cloudflare-listhen.pages.dev/api/manage/webhook/telegram' \
  -u admin:yourpassword
```

**响应：**
```json
{
  "success": true,
  "configured": true,
  "config": {
    "botToken": "12345***wxyz",
    "chatId": "-1003321158178",
    "webhookSecret": "***",
    "enabled": true
  },
  "webhook": {
    "url": "https://cloudflare-listhen.pages.dev/webhook/telegram",
    "hasCustomCertificate": false,
    "pendingUpdateCount": 0,
    "lastErrorDate": null,
    "lastErrorMessage": "",
    "maxConnections": 40,
    "allowedUpdates": ["channel_post"]
  }
}
```

### 4. 测试连接

**端点：** `GET /api/manage/webhook/telegram?action=test`

**用途：** 测试 Bot Token 和 Channel ID 是否有效

**请求：**
```bash
curl -X GET 'https://cloudflare-listhen.pages.dev/api/manage/webhook/telegram?action=test' \
  -u admin:yourpassword
```

**响应（成功）：**
```json
{
  "success": true,
  "test": "passed",
  "message": "Webhook configuration is valid",
  "botInfo": {
    "id": 7963296125,
    "username": "CloudPan_bot",
    "firstName": "CloudPan",
    "isBot": true
  },
  "chatInfo": {
    "id": -1003321158178,
    "title": "MCloudPan 我的网盘",
    "type": "channel"
  }
}
```

**响应（失败）：**
```json
{
  "success": false,
  "test": "failed",
  "error": "Invalid Bot Token: ..."
}
```

### 5. 禁用 Webhook

**端点：** `DELETE /api/manage/webhook/telegram`

**用途：** 禁用 Webhook，停止接收消息

**请求：**
```bash
curl -X DELETE 'https://cloudflare-listhen.pages.dev/api/manage/webhook/telegram' \
  -u admin:yourpassword
```

**响应：**
```json
{
  "success": true,
  "message": "Webhook deleted successfully",
  "result": "Webhook was deleted"
}
```

### 6. 运行诊断

**端点：** `GET /api/manage/webhook/diagnose`

**用途：** 全面诊断 Webhook 配置和状态

**请求：**
```bash
curl -X GET 'https://cloudflare-listhen.pages.dev/api/manage/webhook/diagnose' \
  -u admin:yourpassword
```

**响应：**
```json
{
  "timestamp": "2024-12-06T10:30:00.000Z",
  "checks": {
    "configExists": {
      "name": "配置存在检查",
      "passed": true,
      "details": {
        "enabled": true,
        "hasToken": true,
        "hasChatId": true,
        "hasSecret": true,
        "lastUpdated": 1701857400000
      }
    },
    "botToken": {
      "name": "Bot Token 有效性检查",
      "passed": true,
      "details": {
        "botId": 7963296125,
        "username": "CloudPan_bot",
        "firstName": "CloudPan",
        "isBot": true
      }
    },
    "chatId": {
      "name": "Chat ID 有效性检查",
      "passed": true,
      "details": {
        "chatId": -1003321158178,
        "title": "MCloudPan 我的网盘",
        "type": "channel"
      }
    },
    "webhookSecret": {
      "name": "Webhook Secret 检查",
      "passed": true,
      "details": {
        "length": 16,
        "masked": "my-***"
      }
    },
    "webhookEnabled": {
      "name": "Webhook 启用状态检查",
      "passed": true,
      "details": {
        "enabled": true
      }
    },
    "webhookInTelegram": {
      "name": "Telegram Webhook 状态检查",
      "passed": true,
      "details": {
        "url": "https://cloudflare-listhen.pages.dev/webhook/telegram",
        "pendingUpdateCount": 0,
        "allowedUpdates": ["channel_post"]
      }
    },
    "receivedFiles": {
      "name": "接收的文件检查",
      "passed": true,
      "details": {
        "count": 12,
        "message": "Found 12 imported files"
      }
    }
  },
  "summary": {
    "allChecksPassed": true,
    "totalChecks": 7,
    "passedChecks": 7,
    "status": "ready"
  },
  "recommendations": []
}
```

### 7. 查看接收日志

**端点：** `GET /api/manage/webhook/logs`

**用途：** 查看 Webhook 接收的文件日志

**请求：**
```bash
# 获取最近的日志
curl -X GET 'https://cloudflare-listhen.pages.dev/api/manage/webhook/logs' \
  -u admin:yourpassword

# 分页查询
curl -X GET 'https://cloudflare-listhen.pages.dev/api/manage/webhook/logs?page=1&limit=20' \
  -u admin:yourpassword
```

**响应：**
```json
{
  "success": true,
  "logs": [
    {
      "timestamp": "2024-12-06T10:25:00.000Z",
      "fileId": "webhook_imported/photo_123456.jpg",
      "fileName": "photo.jpg",
      "fileSize": 1024000,
      "status": "success",
      "message": "File imported successfully"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 10
}
```

## 完整工作流程

### 首次配置

```bash
# 步骤 1: 保存配置
curl -X POST 'https://your-domain.com/api/manage/sysConfig/others' \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -d '{
    "telegramWebhook": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID",
      "webhookSecret": "YOUR_SECRET"
    }
  }'

# 步骤 2: 测试连接
curl 'https://your-domain.com/api/manage/webhook/telegram?action=test' \
  -u admin:password

# 步骤 3: 启用 Webhook
curl -X POST 'https://your-domain.com/api/manage/webhook/telegram?action=enable' \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -d '{}'

# 步骤 4: 验证状态
curl 'https://your-domain.com/api/manage/webhook/telegram' \
  -u admin:password

# 步骤 5: 运行诊断
curl 'https://your-domain.com/api/manage/webhook/diagnose' \
  -u admin:password
```

### 禁用和重新启用

```bash
# 禁用
curl -X DELETE 'https://your-domain.com/api/manage/webhook/telegram' \
  -u admin:password

# 重新启用（无需重新配置）
curl -X POST 'https://your-domain.com/api/manage/webhook/telegram?action=enable' \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### 更新配置

```bash
# 更新配置
curl -X POST 'https://your-domain.com/api/manage/sysConfig/others' \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -d '{
    "telegramWebhook": {
      "enabled": true,
      "botToken": "NEW_BOT_TOKEN",
      "chatId": "NEW_CHAT_ID",
      "webhookSecret": "NEW_SECRET"
    }
  }'

# 重新启用以应用新配置
curl -X POST 'https://your-domain.com/api/manage/webhook/telegram?action=enable' \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## 使用脚本

### Linux/Mac

```bash
# 一键启用
./scripts/enable-telegram-webhook.sh cloudflare-listhen.pages.dev admin yourpassword

# 测试
./test-webhook-enable.sh cloudflare-listhen.pages.dev admin yourpassword
```

### Windows

```powershell
# 一键启用
.\scripts\enable-telegram-webhook.ps1 -Domain "cloudflare-listhen.pages.dev" -Username "admin" -Password "yourpassword"
```

## 故障排查

### 问题 1: 启用失败，提示 "Bot token not configured"

**原因：** 配置未保存

**解决：** 先调用保存配置 API

```bash
curl -X POST 'https://your-domain.com/api/manage/sysConfig/others' \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -d '{"telegramWebhook": {...}}'
```

### 问题 2: 启用成功但没有接收消息

**原因：** Bot 未加入频道或 Secret 不匹配

**排查：**
```bash
# 测试连接
curl 'https://your-domain.com/api/manage/webhook/telegram?action=test' \
  -u admin:password

# 运行诊断
curl 'https://your-domain.com/api/manage/webhook/diagnose' \
  -u admin:password
```

### 问题 3: Webhook URL 为空

**原因：** 从未调用启用 API

**解决：** 调用启用 API

```bash
curl -X POST 'https://your-domain.com/api/manage/webhook/telegram?action=enable' \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## 相关文档

- **快速启用指南**：`TELEGRAM_WEBHOOK_QUICKSTART.md`
- **技术实现**：`TELEGRAM_WEBHOOK_URL_FIX.md`
- **完整总结**：`TELEGRAM_WEBHOOK_FIX_SUMMARY.md`
