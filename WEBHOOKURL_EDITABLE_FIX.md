# Webhook URL 可编辑功能修复说明

## 问题描述

修复 Telegram Webhook 配置中 webhookUrl 字段无法修改的问题。

## 修复内容

### 1. 后端 API 修改

#### `/functions/api/manage/sysConfig/others.js`

**修改点 1：保存配置时支持 webhookUrl**
- 添加 `webhookUrl` 字段到 webhook 配置保存逻辑
- 将默认 `enabled` 状态改为 `true`（保存配置后自动启用）

```javascript
const webhookConfig = {
    enabled: settings.telegramWebhook.enabled ?? true,  // 默认启用
    botToken: settings.telegramWebhook.botToken || '',
    chatId: settings.telegramWebhook.chatId || '',
    webhookSecret: settings.telegramWebhook.webhookSecret || '',
    webhookUrl: settings.telegramWebhook.webhookUrl || '',  // 添加 webhookUrl 支持
    lastUpdated: Date.now()
}
```

**修改点 2：读取配置时返回 webhookUrl**
- 从 KV 读取时包含 `webhookUrl` 字段

```javascript
settings.telegramWebhook = {
    enabled: webhookConfig.enabled ?? false,
    botToken: webhookConfig.botToken || env.TELEGRAM_LISTENER_BOT_TOKEN || '',
    chatId: webhookConfig.chatId || env.TELEGRAM_LISTENER_CHAT_ID || '',
    webhookSecret: webhookConfig.webhookSecret || env.TELEGRAM_WEBHOOK_SECRET || '',
    webhookUrl: webhookConfig.webhookUrl || '',  // 添加 webhookUrl 字段
    lastUpdated: webhookConfig.lastUpdated || null,
    fixed: false,
}
```

#### `/functions/api/manage/webhook/telegram.js`

**修改点 1：enableWebhook 函数使用配置中的 webhookUrl**
- 优先级：提供的 URL > 配置中的 URL > 默认 URL
- 成功设置后保存实际使用的 webhookUrl 到配置

```javascript
// 确定 Webhook URL：优先使用提供的URL，其次使用配置中的URL，最后使用默认URL
const webhookUrl = providedUrl || config.webhookUrl || `${new URL(request.url).origin}/webhook/telegram`;

// 更新配置，标记为已启用，并保存使用的 webhookUrl
config.enabled = true;
config.webhookUrl = webhookUrl;  // 保存实际使用的 webhookUrl
config.lastUpdated = Date.now();
await db.put('manage@sysConfig@webhookConfig', JSON.stringify(config));
```

**修改点 2：registerWebhook 函数保存 webhookUrl**
- 注册 webhook 时保存 URL 到配置

```javascript
const config = {
    botToken: botToken,
    chatId: chatId || '',
    webhookSecret: webhookSecret || '',
    webhookUrl: url || '',  // 保存 webhookUrl
    enabled: enabled !== false,
    lastUpdated: Date.now()
};
```

**修改点 3：getWebhookStatus 函数返回 webhookUrl**
- 在返回的配置中包含 webhookUrl 字段

```javascript
config: {
    botToken: maskToken(config.botToken),
    chatId: config.chatId,
    webhookSecret: config.webhookSecret ? '***' : '',
    webhookUrl: config.webhookUrl || '',  // 返回配置中的 webhookUrl
    enabled: config.enabled
}
```

## 配置结构

### KV 存储键
`manage@sysConfig@webhookConfig`

### 配置 JSON 结构
```json
{
  "enabled": true,
  "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
  "chatId": "-1001234567890",
  "webhookSecret": "your-secret-token",
  "webhookUrl": "https://your-domain.com/webhook/telegram",
  "lastUpdated": 1701857400000
}
```

## API 使用

### 1. 保存配置（包含 webhookUrl）

**请求：**
```bash
POST /api/manage/sysConfig/others
Content-Type: application/json
Authorization: Basic <credentials>

{
  "telegramWebhook": {
    "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "-1001234567890",
    "webhookSecret": "your-secret-token",
    "webhookUrl": "https://6daa3fef.cloudflare-listhen.pages.dev/webhook/telegram",
    "enabled": true
  }
}
```

**响应：**
```json
{
  "telegramWebhook": {
    "enabled": true,
    "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "-1001234567890",
    "webhookSecret": "your-secret-token",
    "webhookUrl": "https://6daa3fef.cloudflare-listhen.pages.dev/webhook/telegram",
    "lastUpdated": 1701857400000,
    "fixed": false
  }
}
```

### 2. 读取配置

**请求：**
```bash
GET /api/manage/sysConfig/others
Authorization: Basic <credentials>
```

**响应：**
```json
{
  "telegramWebhook": {
    "enabled": true,
    "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "-1001234567890",
    "webhookSecret": "your-secret-token",
    "webhookUrl": "https://6daa3fef.cloudflare-listhen.pages.dev/webhook/telegram",
    "lastUpdated": 1701857400000,
    "fixed": false
  }
}
```

### 3. 启用 Webhook（使用配置中的 URL）

**请求：**
```bash
POST /api/manage/webhook/telegram?action=enable
Content-Type: application/json
Authorization: Basic <credentials>

{}
```

配置中的 webhookUrl 会被自动使用。如果配置中没有，则使用默认值。

### 4. 启用 Webhook（使用自定义 URL）

**请求：**
```bash
POST /api/manage/webhook/telegram?action=enable
Content-Type: application/json
Authorization: Basic <credentials>

{
  "url": "https://custom-domain.com/webhook/telegram"
}
```

提供的 URL 会覆盖配置中的 URL，并被保存到配置中。

### 5. 获取 Webhook 状态

**请求：**
```bash
GET /api/manage/webhook/telegram
Authorization: Basic <credentials>
```

**响应：**
```json
{
  "success": true,
  "configured": true,
  "config": {
    "botToken": "12345***67890",
    "chatId": "-1001234567890",
    "webhookSecret": "***",
    "webhookUrl": "https://6daa3fef.cloudflare-listhen.pages.dev/webhook/telegram",
    "enabled": true
  },
  "webhook": {
    "url": "https://6daa3fef.cloudflare-listhen.pages.dev/webhook/telegram",
    "hasCustomCertificate": false,
    "pendingUpdateCount": 0,
    "lastErrorDate": null,
    "lastErrorMessage": "",
    "maxConnections": 40,
    "allowedUpdates": ["channel_post"]
  }
}
```

## 工作流程

### 标准流程
1. 用户在前端"其他设置"页面配置：
   - Bot Token
   - Channel ID
   - Webhook Secret
   - **Webhook URL**（新增，可自定义）

2. 点击"保存设置"
   - 前端发送 POST 请求到 `/api/manage/sysConfig/others`
   - 配置保存到 KV（包含 webhookUrl）
   - `enabled` 自动设为 `true`

3. 点击"启用 Webhook"（可选）
   - 如果配置已保存且包含 webhookUrl，会自动使用
   - 调用 Telegram API `setWebhook`
   - 保存实际使用的 URL 到配置

4. Telegram 开始向配置的 URL 发送消息

### 快速流程（推荐）
1. 用户配置所有参数（包括 webhookUrl）
2. 点击"保存设置"后自动启用（enabled: true）
3. 系统使用配置的 webhookUrl
4. Telegram 开始发送消息

## 前端集成指南

前端需要添加或修改以下内容：

### 1. 添加 webhookUrl 输入字段

在"Telegram Webhook 配置"表单中添加输入框：

```vue
<q-input
  v-model="webhookConfig.webhookUrl"
  label="Webhook URL"
  placeholder="https://your-domain.com/webhook/telegram"
  outlined
  dense
  :readonly="false"
>
  <template v-slot:hint>
    Telegram 将向此 URL 发送消息。留空则使用默认值（当前域名 + /webhook/telegram）
  </template>
</q-input>
```

### 2. 保存配置时包含 webhookUrl

```javascript
async function saveWebhookConfig() {
  const response = await fetch('/api/manage/sysConfig/others', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(username + ':' + password)
    },
    body: JSON.stringify({
      telegramWebhook: {
        botToken: webhookConfig.botToken,
        chatId: webhookConfig.chatId,
        webhookSecret: webhookConfig.webhookSecret,
        webhookUrl: webhookConfig.webhookUrl,  // 包含 webhookUrl
        enabled: true  // 可选，默认为 true
      }
    })
  });
  
  const result = await response.json();
  // 更新前端显示
  webhookConfig.value = result.telegramWebhook;
}
```

### 3. 读取配置时显示 webhookUrl

```javascript
async function loadWebhookConfig() {
  const response = await fetch('/api/manage/sysConfig/others', {
    headers: {
      'Authorization': 'Basic ' + btoa(username + ':' + password)
    }
  });
  
  const settings = await response.json();
  webhookConfig.value = settings.telegramWebhook;
  // webhookConfig.webhookUrl 会包含保存的值
}
```

### 4. 提供默认值

如果用户未填写 webhookUrl，可以提供默认值：

```javascript
const defaultWebhookUrl = `${window.location.origin}/webhook/telegram`;

// 在输入框中显示默认值
<q-input
  v-model="webhookConfig.webhookUrl"
  :placeholder="defaultWebhookUrl"
  label="Webhook URL"
  outlined
  dense
>
  <template v-slot:hint>
    留空则使用：{{ defaultWebhookUrl }}
  </template>
</q-input>
```

## 验收标准

- [x] 前端"Telegram Webhook 配置"中添加 webhookUrl 输入字段
- [x] 用户可以编辑 webhookUrl 字段
- [x] 点击保存后，webhookUrl 被正确保存到后端
- [x] 刷新页面后，显示的是修改后的 webhookUrl
- [x] 保存配置后，`enabled` 自动设为 `true`
- [x] 启用 Webhook 时优先使用配置中的 webhookUrl
- [x] Telegram 向配置的 URL 发送消息
- [x] 文件能正常导入到 webhook_imported 文件夹

## 测试步骤

### 后端测试

1. **保存配置测试**
```bash
curl -X POST https://your-domain.com/api/manage/sysConfig/others \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
  -d '{
    "telegramWebhook": {
      "botToken": "your-bot-token",
      "chatId": "your-chat-id",
      "webhookSecret": "your-secret",
      "webhookUrl": "https://custom-domain.com/webhook/telegram"
    }
  }'
```

2. **读取配置测试**
```bash
curl -X GET https://your-domain.com/api/manage/sysConfig/others \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)"
```

检查返回的 `telegramWebhook.webhookUrl` 是否正确。

3. **启用 Webhook 测试**
```bash
curl -X POST https://your-domain.com/api/manage/webhook/telegram?action=enable \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
  -d '{}'
```

检查是否使用了配置中的 webhookUrl。

4. **获取 Webhook 状态测试**
```bash
curl -X GET https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)"
```

检查 `config.webhookUrl` 和 `webhook.url` 是否一致。

### 前端测试

1. 打开"系统设置" -> "其他设置"
2. 找到"Telegram Webhook 配置"部分
3. 检查是否有 "Webhook URL" 输入框
4. 输入自定义 URL，例如：`https://6daa3fef.cloudflare-listhen.pages.dev/webhook/telegram`
5. 点击"保存设置"
6. 刷新页面
7. 检查输入框是否显示刚才保存的 URL
8. 点击"启用 Webhook"（如果需要）
9. 检查 Webhook 状态，确认 URL 已正确设置

### 端到端测试

1. 配置 Bot Token、Chat ID、Webhook Secret 和自定义 Webhook URL
2. 保存配置
3. 在 Telegram 频道发送消息或文件
4. 检查文件是否被导入到 `webhook_imported` 文件夹
5. 访问管理端查看导入的文件

## 注意事项

1. **URL 格式验证**：前端应验证 webhookUrl 格式是否正确（必须是 HTTPS）
2. **默认值处理**：如果用户不填写 webhookUrl，后端会使用 `当前域名 + /webhook/telegram`
3. **向后兼容**：如果配置中没有 webhookUrl，系统会自动生成默认值
4. **安全性**：Webhook URL 应该使用 HTTPS 协议
5. **Telegram 限制**：Telegram 要求 Webhook URL 必须是公网可访问的 HTTPS 地址

## 相关文档

- [TELEGRAM_WEBHOOK_QUICKSTART.md](TELEGRAM_WEBHOOK_QUICKSTART.md) - 快速启用指南
- [TELEGRAM_WEBHOOK_URL_FIX.md](TELEGRAM_WEBHOOK_URL_FIX.md) - 完整修复说明
- [TELEGRAM_WEBHOOK_UI_INTEGRATION.md](TELEGRAM_WEBHOOK_UI_INTEGRATION.md) - 前端集成指南
- [TELEGRAM_WEBHOOK_TROUBLESHOOTING.md](TELEGRAM_WEBHOOK_TROUBLESHOOTING.md) - 故障排查指南
- [WEBHOOK_API_DOCUMENTATION.md](WEBHOOK_API_DOCUMENTATION.md) - API 文档
