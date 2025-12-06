# Telegram Webhook 快速启用指南

## 问题症状

- ✅ 已在后台配置 Bot Token 和 Channel ID
- ✅ 测试连接显示配置正确
- ❌ Webhook URL 为空
- ❌ Telegram 频道上传文件后没有反应

## 快速修复（3 种方法）

### 方法 1：使用一键脚本（推荐）

#### Linux/Mac 用户

```bash
cd /path/to/project
./scripts/enable-telegram-webhook.sh cloudflare-listhen.pages.dev admin yourpassword
```

#### Windows 用户

```powershell
cd C:\path\to\project
.\scripts\enable-telegram-webhook.ps1 -Domain "cloudflare-listhen.pages.dev" -Username "admin" -Password "yourpassword"
```

**执行后会自动：**
1. ✅ 检查配置是否完整
2. ✅ 测试 Bot Token 和 Channel ID
3. ✅ 显示当前 Webhook 状态
4. ✅ 启用 Webhook
5. ✅ 显示配置摘要

### 方法 2：使用 curl 命令

**步骤 1：保存配置**（如果还没保存）

```bash
curl -X POST 'https://cloudflare-listhen.pages.dev/api/manage/sysConfig/others' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQ=' \
  -H 'Content-Type: application/json' \
  -d '{
    "telegramWebhook": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "-1003321158178",
      "webhookSecret": "YOUR_SECRET"
    }
  }'
```

**步骤 2：启用 Webhook**

```bash
curl -X POST 'https://cloudflare-listhen.pages.dev/api/manage/webhook/telegram?action=enable' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQ=' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**步骤 3：验证状态**

```bash
curl 'https://cloudflare-listhen.pages.dev/api/manage/webhook/telegram' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQ='
```

应该看到：
```json
{
  "success": true,
  "webhook": {
    "url": "https://cloudflare-listhen.pages.dev/webhook/telegram",  // ✅ 不再为空
    "pendingUpdateCount": 0
  }
}
```

### 方法 3：通过前端界面（需要前端支持）

1. 登录管理后台
2. 进入"其他设置"
3. 配置 Telegram Webhook：
   - Bot Token: `YOUR_BOT_TOKEN`
   - Channel ID: `-1003321158178`
   - Webhook Secret: `YOUR_SECRET`
4. 点击"保存设置"
5. **点击"启用 Webhook"按钮**（新增功能）
6. 等待提示"Webhook 启用成功"

## 验证是否成功

### 检查 1：Webhook 状态

访问诊断页面：
```bash
curl 'https://cloudflare-listhen.pages.dev/api/manage/webhook/diagnose' \
  -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQ='
```

应该看到：
```json
{
  "checks": {
    "webhookInTelegram": {
      "passed": true,  // ✅ 应该是 true
      "details": {
        "url": "https://cloudflare-listhen.pages.dev/webhook/telegram"  // ✅ 不再是空
      }
    }
  }
}
```

### 检查 2：上传文件测试

1. 在 Telegram 频道中上传一张图片
2. 等待 3-5 秒
3. 检查日志：
   ```bash
   curl 'https://cloudflare-listhen.pages.dev/api/manage/webhook/logs' \
     -H 'Authorization: Basic YWRtaW46cGFzc3dvcmQ='
   ```
4. 应该看到新的日志记录

### 检查 3：查看导入的文件

访问管理后台的文件列表，筛选 `webhook_imported` 文件夹，应该能看到刚上传的文件。

## 常见问题

### Q1: 启用失败，提示 "Bot token not configured"

**A:** 需要先在"其他设置"中保存配置，然后再启用 Webhook。

```bash
# 先保存配置
curl -X POST 'https://your-domain.com/api/manage/sysConfig/others' \
  -H 'Authorization: Basic ...' \
  -H 'Content-Type: application/json' \
  -d '{"telegramWebhook": {...}}'

# 然后启用
curl -X POST 'https://your-domain.com/api/manage/webhook/telegram?action=enable' \
  -H 'Authorization: Basic ...' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Q2: 启用成功但没有接收到消息

**可能原因：**
1. Bot 没有加入频道：确保 Bot 已被添加为频道管理员
2. Webhook Secret 不匹配：检查保存的 Secret 是否正确
3. 网络问题：Telegram 无法访问你的域名

**排查方法：**
```bash
# 1. 测试连接
curl 'https://your-domain.com/api/manage/webhook/telegram?action=test' \
  -H 'Authorization: Basic ...'

# 2. 查看诊断
curl 'https://your-domain.com/api/manage/webhook/diagnose' \
  -H 'Authorization: Basic ...'

# 3. 查看 Webhook 接收日志（如果有）
curl 'https://your-domain.com/api/manage/webhook/logs' \
  -H 'Authorization: Basic ...'
```

### Q3: 有 5 条待处理消息怎么办？

这些是之前上传的文件，Webhook 启用后会自动接收。

如果想清除这些待处理消息（不接收）：
```bash
# 禁用 Webhook
curl -X DELETE 'https://your-domain.com/api/manage/webhook/telegram' \
  -H 'Authorization: Basic ...'

# 重新启用（这次会清除待处理消息）
# 需要修改后端代码，将 drop_pending_updates 设置为 true
```

### Q4: 如何禁用 Webhook？

```bash
curl -X DELETE 'https://your-domain.com/api/manage/webhook/telegram' \
  -H 'Authorization: Basic ...'
```

禁用后，配置仍然保留在 KV 中，可以随时重新启用。

### Q5: 如何更改 Webhook URL？

如果使用自定义域名：
```bash
curl -X POST 'https://your-domain.com/api/manage/webhook/telegram?action=enable' \
  -H 'Authorization: Basic ...' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://custom-domain.com/webhook/telegram"}'
```

## Authorization Header 生成

如果不知道如何生成 `Authorization: Basic ...` header：

```bash
# 方法 1: 使用 echo 和 base64
echo -n "admin:yourpassword" | base64
# 输出: YWRtaW46eW91cnBhc3N3b3Jk

# 方法 2: 使用 curl 的 -u 参数
curl -u admin:yourpassword 'https://your-domain.com/api/manage/webhook/telegram'
```

## 技术细节

**新增 API 端点：**
```
POST /api/manage/webhook/telegram?action=enable
```

**工作流程：**
1. 从 KV 读取 `manage@sysConfig@webhookConfig`
2. 验证配置完整性（botToken, chatId）
3. 调用 Telegram API `setWebhook` 注册 URL
4. 更新 KV 配置（标记 `enabled: true`）
5. 返回成功响应

**与旧 API 的区别：**
- 旧 API: `POST /api/manage/webhook/telegram` - 需要完整参数
- 新 API: `POST /api/manage/webhook/telegram?action=enable` - 从 KV 读取配置

## 联系支持

如果以上方法都无法解决问题，请提供以下信息：
1. 诊断报告（`/api/manage/webhook/diagnose` 的完整输出）
2. 错误消息
3. 浏览器控制台日志（如果使用前端）

## 相关文档

- 完整修复说明：`TELEGRAM_WEBHOOK_URL_FIX.md`
- 前端集成指南：`TELEGRAM_WEBHOOK_UI_INTEGRATION.md`
- 故障排查指南：`TELEGRAM_WEBHOOK_TROUBLESHOOTING.md`
