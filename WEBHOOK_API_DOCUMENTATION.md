# Webhook Management API Documentation

本文档介绍了 Telegram Webhook 管理和文件重命名相关的 API 端点。

## 目录

1. [Webhook 管理 API](#webhook-管理-api)
2. [Webhook 统计 API](#webhook-统计-api)
3. [文件重命名 API](#文件重命名-api)
4. [系统配置 API](#系统配置-api)

---

## Webhook 管理 API

### 端点: `/api/manage/webhook/telegram`

此端点用于管理 Telegram Bot Webhook 的注册、查询和删除。

#### 1. 获取 Webhook 状态 (GET)

获取当前 Telegram Bot Webhook 的配置和状态。

**请求方法:** `GET`

**请求示例:**
```bash
curl -X GET https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic [credentials]"
```

**响应示例:**
```json
{
  "success": true,
  "configured": true,
  "config": {
    "botToken": "12345***67890",
    "chatId": "-1001234567890",
    "webhookSecret": "***",
    "enabled": true
  },
  "webhook": {
    "url": "https://your-domain.com/webhook/telegram",
    "hasCustomCertificate": false,
    "pendingUpdateCount": 0,
    "lastErrorDate": null,
    "lastErrorMessage": "",
    "maxConnections": 40,
    "allowedUpdates": ["channel_post"]
  }
}
```

**响应字段说明:**
- `success`: 请求是否成功
- `configured`: Bot Token 是否已配置
- `config`: 当前保存的配置（敏感信息已脱敏）
- `webhook`: Telegram 返回的 Webhook 详细信息

#### 2. 注册/更新 Webhook (POST)

向 Telegram 注册或更新 Webhook URL。

**请求方法:** `POST`

**请求体:**
```json
{
  "url": "https://your-domain.com/webhook/telegram",
  "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
  "chatId": "-1001234567890",
  "webhookSecret": "my-secret-token-12345",
  "enabled": true
}
```

**请求示例:**
```bash
curl -X POST https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic [credentials]" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook/telegram",
    "botToken": "YOUR_BOT_TOKEN",
    "chatId": "-1001234567890",
    "webhookSecret": "YOUR_SECRET",
    "enabled": true
  }'
```

**响应示例:**
```json
{
  "success": true,
  "message": "Webhook registered successfully",
  "result": "Webhook was set"
}
```

**字段说明:**
- `url`: Webhook 端点 URL（必填）
- `botToken`: Telegram Bot Token（必填）
- `chatId`: 要监听的频道 Chat ID（可选）
- `webhookSecret`: 用于验证 Webhook 请求的密钥（可选但推荐）
- `enabled`: 是否启用（可选，默认 true）

**重要说明:**
- Webhook 会自动配置为只接收 `channel_post` 更新
- 会自动删除待处理的历史更新 (`drop_pending_updates: true`)
- 配置会保存到 KV 的 `manage@sysConfig@webhookConfig` 键中

#### 3. 删除 Webhook (DELETE)

取消注册 Telegram Bot Webhook。

**请求方法:** `DELETE`

**请求示例:**
```bash
curl -X DELETE https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic [credentials]"
```

**响应示例:**
```json
{
  "success": true,
  "message": "Webhook deleted successfully",
  "result": "Webhook was deleted"
}
```

---

## Webhook 统计 API

### 端点: `/api/manage/webhook/stats`

获取通过 Webhook 导入的文件统计信息。

**请求方法:** `GET`

**查询参数:**
- `limit`: 返回的最近文件数量（默认: 10）

**请求示例:**
```bash
curl -X GET "https://your-domain.com/api/manage/webhook/stats?limit=20" \
  -H "Authorization: Basic [credentials]"
```

**响应示例:**
```json
{
  "success": true,
  "stats": {
    "totalImported": 156,
    "recentFiles": [
      {
        "id": "webhook_imported/photo_20231205_143022.jpg",
        "fileName": "photo_20231205_143022.jpg",
        "fileSize": "2.35",
        "timeStamp": 1701784222000,
        "directory": "webhook_imported/",
        "messageId": "12345",
        "mimeType": "image/jpeg"
      }
    ],
    "indexLastUpdated": 1701784222000
  }
}
```

**响应字段说明:**
- `totalImported`: 通过 Webhook 导入的文件总数
- `recentFiles`: 最近导入的文件列表
- `indexLastUpdated`: 索引最后更新时间戳

---

## 文件重命名 API

### 端点: `/api/manage/rename/[[path]]`

重命名已导入的文件（包括 Webhook 导入的文件）。

**请求方法:** `GET`

**URL 参数:**
- `path`: 文件 ID（路径中的部分，用逗号分隔的路径会自动转换为斜杠）

**查询参数:**
- `newName`: 新文件名（必填）

**请求示例:**
```bash
# 重命名文件
curl -X GET "https://your-domain.com/api/manage/rename/webhook_imported,photo_20231205_143022.jpg?newName=vacation_beach.jpg" \
  -H "Authorization: Basic [credentials]"
```

**响应示例:**
```json
{
  "success": true,
  "fileId": "webhook_imported/photo_20231205_143022.jpg",
  "newFileId": "webhook_imported/vacation_beach.jpg",
  "newName": "vacation_beach.jpg"
}
```

**支持的存储渠道:**
- `TelegramNew`: Webhook 导入的 Telegram 文件
- `CloudflareR2`: Cloudflare R2 存储
- `S3`: S3 兼容存储

**不支持的渠道:**
- `Telegram`: 旧版 Telegram 上传
- `Telegraph`: Telegraph 存储

**错误响应示例:**
```json
{
  "success": false,
  "error": "New filename is required"
}
```

---

## 系统配置 API

### 端点: `/api/manage/sysConfig/others`

管理系统其他设置，包括 Telegram Webhook 配置。

#### 1. 获取配置 (GET)

**请求方法:** `GET`

**请求示例:**
```bash
curl -X GET https://your-domain.com/api/manage/sysConfig/others \
  -H "Authorization: Basic [credentials]"
```

**响应示例:**
```json
{
  "telemetry": {
    "enabled": true,
    "fixed": false
  },
  "randomImageAPI": {
    "enabled": false,
    "allowedDir": "",
    "fixed": false
  },
  "cloudflareApiToken": {
    "CF_ZONE_ID": "",
    "CF_EMAIL": "",
    "CF_API_KEY": "",
    "fixed": false
  },
  "webDAV": {
    "enabled": false,
    "username": "",
    "password": "",
    "fixed": false
  },
  "telegramWebhook": {
    "enabled": true,
    "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "-1001234567890",
    "webhookSecret": "my-secret-token",
    "lastUpdated": 1701784222000,
    "fixed": false
  }
}
```

#### 2. 保存配置 (POST)

**请求方法:** `POST`

**请求体:** 同上述 GET 响应格式

**请求示例:**
```bash
curl -X POST https://your-domain.com/api/manage/sysConfig/others \
  -H "Authorization: Basic [credentials]" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramWebhook": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "-1001234567890",
      "webhookSecret": "YOUR_SECRET"
    },
    "webDAV": {
      "enabled": false,
      "username": "",
      "password": ""
    }
  }'
```

**重要说明:**
- `telegramWebhook` 配置会单独保存到 `manage@sysConfig@webhookConfig`
- 其他配置保存到 `manage@sysConfig@others`
- 保存时会自动添加 `lastUpdated` 时间戳

---

## 环境变量

以下环境变量用于 Webhook 功能：

### Telegram Webhook 配置
- `TELEGRAM_WEBHOOK_SECRET`: Webhook 验证密钥（用于验证来自 Telegram 的请求）
- `TELEGRAM_LISTENER_BOT_TOKEN`: Listener Bot Token（用于下载文件）
- `TELEGRAM_LISTENER_CHAT_ID`: 监听的频道 Chat ID

**注意:** 这些环境变量可以通过系统配置 API 在后台管理界面中配置，配置会保存到 KV 中。

---

## 完整工作流程示例

### 1. 配置 Webhook

```bash
# 步骤 1: 保存 Telegram Webhook 配置
curl -X POST https://your-domain.com/api/manage/sysConfig/others \
  -H "Authorization: Basic admin:password" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramWebhook": {
      "enabled": true,
      "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
      "chatId": "-1001234567890",
      "webhookSecret": "my-secret-token-12345"
    }
  }'

# 步骤 2: 注册 Webhook 到 Telegram
curl -X POST https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic admin:password" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook/telegram",
    "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "-1001234567890",
    "webhookSecret": "my-secret-token-12345",
    "enabled": true
  }'

# 步骤 3: 验证 Webhook 状态
curl -X GET https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic admin:password"
```

### 2. 监控导入的文件

```bash
# 查看 Webhook 统计
curl -X GET "https://your-domain.com/api/manage/webhook/stats?limit=10" \
  -H "Authorization: Basic admin:password"
```

### 3. 重命名导入的文件

```bash
# 重命名文件
curl -X GET "https://your-domain.com/api/manage/rename/webhook_imported,photo_20231205_143022.jpg?newName=vacation_2023.jpg" \
  -H "Authorization: Basic admin:password"
```

### 4. 取消 Webhook

```bash
# 删除 Webhook
curl -X DELETE https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic admin:password"
```

---

## 错误处理

所有 API 端点都会返回标准的错误响应格式：

```json
{
  "success": false,
  "error": "Error message description"
}
```

常见错误代码：
- `400`: 请求参数错误
- `401`: 未授权（需要身份验证）
- `403`: 禁止访问
- `404`: 资源未找到
- `405`: 方法不允许
- `500`: 服务器内部错误

---

## 安全建议

1. **保护敏感信息**: 永远不要在日志或公开响应中暴露完整的 Bot Token
2. **使用 HTTPS**: Webhook URL 必须使用 HTTPS
3. **设置 Secret Token**: 强烈推荐设置 `webhookSecret` 来验证请求
4. **限制访问**: 使用 Basic Auth 或 API Token 保护管理端点
5. **定期检查**: 定期检查 Webhook 状态，确保正常运行
6. **监控错误**: 关注 `lastErrorMessage` 和 `pendingUpdateCount` 字段

---

## 前端集成指南

### 后台管理界面应包含以下元素:

#### Webhook 配置区域
- [ ] Bot Token 输入框
- [ ] Chat ID 输入框  
- [ ] Webhook Secret 输入框
- [ ] 启用/禁用开关
- [ ] 「保存配置」按钮

#### Webhook 操作区域
- [ ] 「注册 Webhook」按钮
- [ ] 「查看状态」按钮
- [ ] 「取消 Webhook」按钮
- [ ] 当前状态显示（已连接/错误/待注册）

#### 统计信息区域
- [ ] 导入文件总数显示
- [ ] 最近导入的文件列表
- [ ] 每个文件的重命名按钮
- [ ] 错误信息显示（如果有）

#### 建议的 UI 流程:
1. 用户在配置区域输入 Bot Token、Chat ID 和 Secret
2. 点击「保存配置」，调用 `/api/manage/sysConfig/others` POST
3. 点击「注册 Webhook」，调用 `/api/manage/webhook/telegram` POST
4. 点击「查看状态」，调用 `/api/manage/webhook/telegram` GET 并显示详细信息
5. 在统计区域，定期调用 `/api/manage/webhook/stats` 刷新数据
6. 文件列表中每项旁边显示重命名按钮，点击后调用 `/api/manage/rename/[path]`

---

## 测试建议

### 1. 测试 Webhook 注册
```bash
# 使用测试 Bot Token 注册
curl -X POST https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic admin:password" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook/telegram",
    "botToken": "TEST_BOT_TOKEN",
    "webhookSecret": "test-secret"
  }'
```

### 2. 测试 Webhook 接收
```bash
# 手动发送测试消息到 Telegram 频道
# Webhook 端点会自动接收并处理
```

### 3. 测试文件重命名
```bash
# 先获取文件列表
curl -X GET "https://your-domain.com/api/manage/list?channel=TelegramNew" \
  -H "Authorization: Basic admin:password"

# 然后重命名其中一个文件
curl -X GET "https://your-domain.com/api/manage/rename/[fileId]?newName=new_name.jpg" \
  -H "Authorization: Basic admin:password"
```

---

## 故障排查

### Webhook 注册失败
- 检查 Bot Token 是否有效
- 确认 Webhook URL 使用 HTTPS
- 检查 Telegram Bot 权限

### 文件未导入
- 检查 `TELEGRAM_WEBHOOK_SECRET` 是否正确配置
- 检查 `TELEGRAM_LISTENER_CHAT_ID` 是否匹配
- 查看 Cloudflare Workers 日志

### 文件重命名失败
- 确认文件存在且可访问
- 检查存储渠道是否支持重命名
- 查看错误消息了解具体原因

---

## 版本信息

- **API 版本**: 1.0.0
- **最后更新**: 2024-12-05
- **兼容性**: Cloudflare Pages Functions

---

更多信息请参考项目主 README.md 文件。
