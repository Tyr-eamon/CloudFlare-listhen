# Ticket 修复总结：webhookUrl 可编辑功能

## Ticket 信息

**标题**: 修复 webhookUrl 无法修改的问题

**描述**: 修复 Telegram Webhook 配置中 webhookUrl 字段无法修改的问题，使用户能够自定义 Webhook URL，并在保存配置后自动启用 Webhook。

## 问题分析

### 原问题
1. `webhookUrl` 字段虽然存在但用户无法修改
2. 前端没有提供编辑界面
3. 后端 API 不支持保存 `webhookUrl` 的更改
4. 保存配置后 Webhook 未自动启用

### 根本原因
- 后端 `/functions/api/manage/sysConfig/others.js` 在保存配置时没有处理 `webhookUrl` 字段
- 后端 `/functions/api/manage/webhook/telegram.js` 在启用 Webhook 时没有使用配置中保存的 `webhookUrl`
- 配置结构中缺少 `webhookUrl` 字段的定义
- 默认 `enabled` 状态为 `false`，用户需要额外操作才能启用

## 修复方案

### 后端修复

#### 1. `/functions/api/manage/sysConfig/others.js`

**修改点 1**: 保存配置时添加 `webhookUrl` 字段支持
- **位置**: 第 34-40 行
- **修改**: 
  ```javascript
  const webhookConfig = {
      enabled: settings.telegramWebhook.enabled ?? true,  // 改为默认启用
      botToken: settings.telegramWebhook.botToken || '',
      chatId: settings.telegramWebhook.chatId || '',
      webhookSecret: settings.telegramWebhook.webhookSecret || '',
      webhookUrl: settings.telegramWebhook.webhookUrl || '',  // 新增
      lastUpdated: Date.now()
  }
  ```

**修改点 2**: 读取配置时返回 `webhookUrl` 字段
- **位置**: 第 105-113 行
- **修改**: 
  ```javascript
  settings.telegramWebhook = {
      enabled: webhookConfig.enabled ?? false,
      botToken: webhookConfig.botToken || env.TELEGRAM_LISTENER_BOT_TOKEN || '',
      chatId: webhookConfig.chatId || env.TELEGRAM_LISTENER_CHAT_ID || '',
      webhookSecret: webhookConfig.webhookSecret || env.TELEGRAM_WEBHOOK_SECRET || '',
      webhookUrl: webhookConfig.webhookUrl || '',  // 新增
      lastUpdated: webhookConfig.lastUpdated || null,
      fixed: false,
  }
  ```

#### 2. `/functions/api/manage/webhook/telegram.js`

**修改点 1**: `enableWebhook` 函数使用配置中的 webhookUrl
- **位置**: 第 158、182-183 行
- **修改**: 
  ```javascript
  // 确定 Webhook URL：优先使用提供的URL，其次使用配置中的URL，最后使用默认URL
  const webhookUrl = providedUrl || config.webhookUrl || `${new URL(request.url).origin}/webhook/telegram`;
  
  // ...
  
  // 更新配置，标记为已启用，并保存使用的 webhookUrl
  config.enabled = true;
  config.webhookUrl = webhookUrl;  // 保存实际使用的 webhookUrl
  config.lastUpdated = Date.now();
  ```

**修改点 2**: `registerWebhook` 函数保存 webhookUrl
- **位置**: 第 254-261 行
- **修改**: 
  ```javascript
  const config = {
      botToken: botToken,
      chatId: chatId || '',
      webhookSecret: webhookSecret || '',
      webhookUrl: url || '',  // 新增
      enabled: enabled !== false,
      lastUpdated: Date.now()
  };
  ```

**修改点 3**: `getWebhookStatus` 函数返回 webhookUrl
- **位置**: 第 96-101 行
- **修改**: 
  ```javascript
  config: {
      botToken: maskToken(config.botToken),
      chatId: config.chatId,
      webhookSecret: config.webhookSecret ? '***' : '',
      webhookUrl: config.webhookUrl || '',  // 新增
      enabled: config.enabled
  }
  ```

### 前端集成指南

由于前端代码在独立仓库 [MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)，需要在前端添加以下功能：

1. **添加 webhookUrl 输入框**
   - 在"Telegram Webhook 配置"表单中添加
   - 提供占位符显示默认 URL
   - 添加复制按钮方便用户复制

2. **保存时包含 webhookUrl**
   - 在发送到后端的数据中包含 `webhookUrl` 字段
   - 验证 URL 格式（必须是 HTTPS）

3. **显示保存的 webhookUrl**
   - 读取配置时显示保存的 `webhookUrl` 值
   - 如果为空，显示默认值

详细的前端集成代码请参考 [FRONTEND_WEBHOOKURL_INTEGRATION.md](FRONTEND_WEBHOOKURL_INTEGRATION.md)

## 新增文件

1. **WEBHOOKURL_EDITABLE_FIX.md**
   - 完整的修复说明文档
   - 包含 API 使用示例
   - 包含配置结构说明
   - 包含测试步骤

2. **FRONTEND_WEBHOOKURL_INTEGRATION.md**
   - 前端集成完整指南
   - 包含 Vue/Quasar 代码示例
   - 包含完整的组件实现
   - 包含测试清单

3. **test-webhookurl-editable.sh**
   - 自动化测试脚本
   - 测试保存、读取、修改功能
   - 验证所有 API 端点

## 修改的文件

1. **functions/api/manage/sysConfig/others.js**
   - 添加 webhookUrl 字段的保存和读取逻辑
   - 修改默认 enabled 状态为 true

2. **functions/api/manage/webhook/telegram.js**
   - enableWebhook 使用配置中的 webhookUrl
   - registerWebhook 保存 webhookUrl
   - getWebhookStatus 返回 webhookUrl

## 配置结构

### 更新后的配置结构

**KV 键**: `manage@sysConfig@webhookConfig`

**配置 JSON**:
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

### 字段说明

- `enabled`: Webhook 是否启用（保存配置时默认为 true）
- `botToken`: Telegram Bot Token
- `chatId`: Telegram 频道或群组 ID
- `webhookSecret`: Webhook 验证密钥
- **`webhookUrl`**: Webhook URL（新增，可自定义）
- `lastUpdated`: 最后更新时间戳

## API 变更

### 保存配置 API

**端点**: `POST /api/manage/sysConfig/others`

**新增支持的字段**: `webhookUrl`

**请求示例**:
```json
{
  "telegramWebhook": {
    "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "-1001234567890",
    "webhookSecret": "your-secret-token",
    "webhookUrl": "https://custom-domain.com/webhook/telegram"
  }
}
```

**响应示例**:
```json
{
  "telegramWebhook": {
    "enabled": true,
    "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "-1001234567890",
    "webhookSecret": "your-secret-token",
    "webhookUrl": "https://custom-domain.com/webhook/telegram",
    "lastUpdated": 1701857400000,
    "fixed": false
  }
}
```

### 读取配置 API

**端点**: `GET /api/manage/sysConfig/others`

**新增返回字段**: `telegramWebhook.webhookUrl`

### 启用 Webhook API

**端点**: `POST /api/manage/webhook/telegram?action=enable`

**行为变更**: 
- 优先使用提供的 `url` 参数
- 其次使用配置中保存的 `webhookUrl`
- 最后使用默认 URL
- 成功后保存实际使用的 URL 到配置

### 获取状态 API

**端点**: `GET /api/manage/webhook/telegram`

**新增返回字段**: `config.webhookUrl`

## 工作流程

### 用户操作流程

1. 用户打开"系统设置" -> "其他设置"
2. 在"Telegram Webhook 配置"部分填写：
   - Bot Token
   - Chat ID
   - Webhook Secret
   - **Webhook URL**（可自定义或留空使用默认值）
3. 点击"保存设置"
   - 配置保存到 KV
   - `enabled` 自动设为 `true`
4. （可选）点击"启用 Webhook"
   - 系统使用配置的 webhookUrl
   - 调用 Telegram API 注册 Webhook
5. Telegram 开始向配置的 URL 发送消息
6. 文件自动导入到 `webhook_imported` 文件夹

### URL 优先级

启用 Webhook 时的 URL 选择优先级：

1. **API 参数**：`POST /api/manage/webhook/telegram?action=enable` 的 `url` 参数
2. **配置中的 URL**：从 KV 读取的 `webhookUrl`
3. **默认 URL**：`当前域名 + /webhook/telegram`

## 测试验证

### 使用测试脚本

```bash
# 给脚本添加执行权限
chmod +x test-webhookurl-editable.sh

# 运行测试
./test-webhookurl-editable.sh localhost:8080 admin password
```

### 手动测试步骤

1. **测试保存功能**
   ```bash
   curl -X POST http://localhost:8080/api/manage/sysConfig/others \
     -H "Content-Type: application/json" \
     -H "Authorization: Basic $(echo -n 'admin:password' | base64)" \
     -d '{
       "telegramWebhook": {
         "botToken": "test-token",
         "chatId": "-100123456",
         "webhookSecret": "secret",
         "webhookUrl": "https://test.com/webhook/telegram"
       }
     }'
   ```

2. **测试读取功能**
   ```bash
   curl -X GET http://localhost:8080/api/manage/sysConfig/others \
     -H "Authorization: Basic $(echo -n 'admin:password' | base64)"
   ```

3. **测试修改功能**
   - 使用不同的 webhookUrl 再次调用保存 API
   - 验证返回的配置包含新的 URL

4. **测试启用功能**
   ```bash
   curl -X POST http://localhost:8080/api/manage/webhook/telegram?action=enable \
     -H "Content-Type: application/json" \
     -H "Authorization: Basic $(echo -n 'admin:password' | base64)" \
     -d '{}'
   ```

## 验收标准

- [x] **后端支持 webhookUrl 字段**
  - [x] 保存配置时接收 webhookUrl
  - [x] 读取配置时返回 webhookUrl
  - [x] 启用 Webhook 时使用 webhookUrl
  - [x] 获取状态时返回 webhookUrl

- [x] **保存配置后自动启用**
  - [x] 默认 enabled 状态改为 true
  - [x] 保存后返回 enabled: true

- [ ] **前端界面支持**（需要前端仓库修改）
  - [ ] 添加 webhookUrl 输入框
  - [ ] 输入框可编辑
  - [ ] 保存时包含 webhookUrl
  - [ ] 显示保存的 webhookUrl

- [x] **URL 优先级正确**
  - [x] API 参数 > 配置中的 URL > 默认 URL

- [x] **向后兼容**
  - [x] 不影响现有配置
  - [x] 空 webhookUrl 时使用默认值

## 注意事项

1. **前端修改必需**：本次修复只完成了后端部分，前端需要在独立仓库中添加输入界面

2. **HTTPS 要求**：Telegram 要求 Webhook URL 必须使用 HTTPS 协议

3. **URL 验证**：前端应验证用户输入的 URL 格式是否正确

4. **向后兼容**：如果配置中没有 webhookUrl，系统会自动生成默认值

5. **默认启用**：保存配置后 `enabled` 自动设为 `true`，但仍需点击"启用 Webhook"按钮来调用 Telegram API

## 相关文档

- [WEBHOOKURL_EDITABLE_FIX.md](WEBHOOKURL_EDITABLE_FIX.md) - 完整修复说明
- [FRONTEND_WEBHOOKURL_INTEGRATION.md](FRONTEND_WEBHOOKURL_INTEGRATION.md) - 前端集成指南
- [TELEGRAM_WEBHOOK_QUICKSTART.md](TELEGRAM_WEBHOOK_QUICKSTART.md) - 快速启用指南
- [TELEGRAM_WEBHOOK_URL_FIX.md](TELEGRAM_WEBHOOK_URL_FIX.md) - 原URL修复说明
- [TELEGRAM_WEBHOOK_TROUBLESHOOTING.md](TELEGRAM_WEBHOOK_TROUBLESHOOTING.md) - 故障排查指南
- [WEBHOOK_API_DOCUMENTATION.md](WEBHOOK_API_DOCUMENTATION.md) - API 完整文档

## 后续工作

1. **前端集成**：在 [Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub) 仓库添加 webhookUrl 输入界面
2. **端到端测试**：前端集成完成后进行完整的端到端测试
3. **文档更新**：更新用户文档，说明如何自定义 Webhook URL
4. **示例更新**：更新示例代码和截图

## 总结

本次修复完全实现了 webhookUrl 字段的后端支持，包括：

✅ webhookUrl 可以保存到配置  
✅ webhookUrl 可以从配置读取  
✅ webhookUrl 可以修改更新  
✅ 保存配置后自动启用（enabled: true）  
✅ 启用 Webhook 时优先使用配置的 URL  
✅ 获取状态时返回配置的 URL  
✅ 向后兼容，不影响现有功能  
✅ 完整的文档和测试脚本  

前端集成后，用户将能够完全自定义 Webhook URL，实现更灵活的部署配置。
