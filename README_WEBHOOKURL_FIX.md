# Webhook URL 可编辑功能修复

## 快速概览

本次修复使 Telegram Webhook 配置中的 `webhookUrl` 字段完全可编辑，用户可以自定义 Webhook URL，并在保存配置后自动启用 Webhook。

## 修复内容

### 后端修复 ✅

1. **配置保存**: 支持保存 `webhookUrl` 字段
2. **配置读取**: 返回保存的 `webhookUrl` 字段
3. **自动启用**: 保存配置后 `enabled` 自动设为 `true`
4. **URL 优先级**: 启用时按优先级使用 URL（API 参数 > 配置 > 默认）
5. **状态获取**: 获取状态时返回配置的 `webhookUrl`

### 前端集成 ⏳

前端代码在独立仓库 [MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)，需要添加 `webhookUrl` 输入框。

详细集成指南请参考 [FRONTEND_WEBHOOKURL_INTEGRATION.md](FRONTEND_WEBHOOKURL_INTEGRATION.md)

## 修改的文件

### 后端

- `functions/api/manage/sysConfig/others.js`
  - 添加 `webhookUrl` 字段支持
  - 默认 `enabled` 改为 `true`

- `functions/api/manage/webhook/telegram.js`
  - `enableWebhook` 使用配置中的 URL
  - `registerWebhook` 保存 URL
  - `getWebhookStatus` 返回 URL

## 新增的文件

### 文档

- `WEBHOOKURL_EDITABLE_FIX.md` - 完整修复说明
- `FRONTEND_WEBHOOKURL_INTEGRATION.md` - 前端集成指南
- `TICKET_FIX_SUMMARY.md` - 修复总结
- `IMPLEMENTATION_CHECKLIST.md` - 实现清单
- `README_WEBHOOKURL_FIX.md` - 本文件

### 测试

- `test-webhookurl-editable.sh` - 自动化测试脚本

## 配置结构

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

## 使用方法

### 1. 保存配置（包含自定义 URL）

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

### 2. 启用 Webhook（使用配置的 URL）

```bash
curl -X POST https://your-domain.com/api/manage/webhook/telegram?action=enable \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
  -d '{}'
```

### 3. 获取 Webhook 状态

```bash
curl -X GET https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)"
```

## 测试

运行自动化测试脚本：

```bash
chmod +x test-webhookurl-editable.sh
./test-webhookurl-editable.sh localhost:8080 admin password
```

## 工作流程

1. 用户配置 Bot Token、Chat ID、Webhook Secret、**Webhook URL**
2. 点击"保存设置" → 配置保存，`enabled` 自动设为 `true`
3. （可选）点击"启用 Webhook" → 使用配置的 URL 调用 Telegram API
4. Telegram 开始向配置的 URL 发送消息
5. 文件自动导入到 `webhook_imported` 文件夹

## URL 优先级

启用 Webhook 时的 URL 选择优先级：

1. **API 参数**: `POST /api/manage/webhook/telegram?action=enable` 的 `url` 参数
2. **配置中的 URL**: 从 KV 读取的 `webhookUrl`
3. **默认 URL**: `当前域名 + /webhook/telegram`

## API 变更

### POST /api/manage/sysConfig/others

**新增支持**: `telegramWebhook.webhookUrl` 字段

**默认行为**: `telegramWebhook.enabled` 默认为 `true`

### GET /api/manage/sysConfig/others

**新增返回**: `telegramWebhook.webhookUrl` 字段

### POST /api/manage/webhook/telegram?action=enable

**行为变更**: 优先使用配置中的 `webhookUrl`

### GET /api/manage/webhook/telegram

**新增返回**: `config.webhookUrl` 字段

## 验收标准

- [x] webhookUrl 可以保存
- [x] webhookUrl 可以读取
- [x] webhookUrl 可以修改
- [x] 保存配置后自动启用
- [x] 启用时使用配置的 URL
- [x] 获取状态时返回 URL
- [ ] 前端界面支持（待实现）

## 文档

- **完整修复说明**: [WEBHOOKURL_EDITABLE_FIX.md](WEBHOOKURL_EDITABLE_FIX.md)
- **前端集成指南**: [FRONTEND_WEBHOOKURL_INTEGRATION.md](FRONTEND_WEBHOOKURL_INTEGRATION.md)
- **修复总结**: [TICKET_FIX_SUMMARY.md](TICKET_FIX_SUMMARY.md)
- **实现清单**: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)

## 注意事项

1. **HTTPS 要求**: Telegram 要求 Webhook URL 必须使用 HTTPS
2. **前端集成必需**: 需要在前端仓库添加输入界面
3. **向后兼容**: 不影响现有配置，空 URL 时使用默认值
4. **URL 验证**: 前端应验证 URL 格式

## 下一步

1. ✅ 后端修复完成
2. ⏳ 前端添加输入界面
3. ⏳ 运行集成测试
4. ⏳ 端到端验证
5. ⏳ 部署到生产环境

## 支持

如有问题，请参考：

- [Telegram Webhook 快速启动指南](TELEGRAM_WEBHOOK_QUICKSTART.md)
- [Telegram Webhook 故障排查](TELEGRAM_WEBHOOK_TROUBLESHOOTING.md)
- [Webhook API 文档](WEBHOOK_API_DOCUMENTATION.md)

## 许可

与主项目相同的许可证。
