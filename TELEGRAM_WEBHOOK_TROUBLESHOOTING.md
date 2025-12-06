# Telegram Webhook 故障排查指南

本文档提供了诊断和修复 Telegram Webhook 功能的详细步骤。

## 问题症状

### 1. 启用开关无法打开
- 用户无法在"其他设置"中启用 Telegram Webhook
- 按钮点击无反应或显示错误

### 2. Webhook 没有接收文件
- 文件上传到 Telegram 频道后没有出现在 `webhook_imported` 文件夹
- 导入的文件列表为空

## 诊断步骤

### 第一步：使用诊断 API

使用诊断 API 获取完整的配置检查报告：

```bash
curl -X GET "https://your-domain.com/api/manage/webhook/diagnose" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)"
```

**响应示例：**
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
        "botId": 1234567890,
        "username": "my_bot",
        "firstName": "MyBot",
        "isBot": true
      }
    },
    "chatId": {
      "name": "Chat ID 有效性检查",
      "passed": true,
      "details": {
        "chatId": -1003321158178,
        "title": "My Channel",
        "type": "supergroup"
      }
    },
    "webhookSecret": {
      "name": "Webhook Secret 检查",
      "passed": true,
      "details": {
        "length": 32,
        "masked": "my_***"
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
        "url": "https://your-domain.com/webhook/telegram",
        "hasCustomCertificate": false,
        "pendingUpdateCount": 0,
        "lastErrorDate": null,
        "lastErrorMessage": "",
        "maxConnections": 40,
        "allowedUpdates": ["channel_post"]
      }
    },
    "receivedFiles": {
      "name": "接收的文件检查",
      "passed": true,
      "details": {
        "count": 5,
        "message": "Found 5 imported files"
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

### 第二步：测试连接

测试 Bot Token 和 Chat ID 的有效性：

```bash
curl -X GET "https://your-domain.com/api/manage/webhook/telegram?action=test" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)"
```

**响应示例（成功）：**
```json
{
  "success": true,
  "test": "passed",
  "message": "Webhook configuration is valid",
  "botInfo": {
    "id": 1234567890,
    "username": "my_bot",
    "firstName": "MyBot",
    "isBot": true
  },
  "chatInfo": {
    "id": -1003321158178,
    "title": "My Channel",
    "type": "supergroup"
  }
}
```

**响应示例（失败）：**
```json
{
  "success": false,
  "error": "Invalid Bot Token",
  "test": "failed"
}
```

### 第三步：检查接收的文件

查看最近接收的 Webhook 导入文件：

```bash
curl -X GET "https://your-domain.com/api/manage/webhook/logs?limit=20&offset=0" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)"
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "limit": 20,
    "offset": 0,
    "count": 5,
    "files": [
      {
        "id": "webhook_imported/tg_webhook_-1003321158178_12345_AgAC...",
        "fileName": "photo_20241206_103022.jpg",
        "fileSize": "2.35",
        "mimeType": "image/jpeg",
        "timeStamp": 1701857422000,
        "messageId": "12345",
        "originalFileName": ""
      },
      // ... more files
    ]
  }
}
```

## 常见问题和解决方案

### 问题 1: "Bot token not configured"
**原因**: 未在配置中设置 Bot Token  
**解决方案**:
1. 获取您的 Telegram Bot Token（从 @BotFather 获取）
2. 在管理界面中进入"其他设置"
3. 输入 Bot Token、Chat ID 和 Webhook Secret
4. 点击保存
5. 点击"启用 Webhook"

### 问题 2: "Invalid Bot Token"
**原因**: Bot Token 格式错误或已过期  
**解决方案**:
1. 确认 Token 格式正确（通常是 `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`）
2. 在 @BotFather 中验证 Token 是否仍然有效
3. 必要时重新生成新的 Token
4. 重新输入 Token 并保存

### 问题 3: "Invalid Chat ID or Bot is not member"
**原因**: Chat ID 错误或 Bot 未加入频道  
**解决方案**:
1. 确认 Chat ID 格式正确（通常是 `-1001234567890`）
2. 确保 Bot 已被添加到频道中
3. 确保 Bot 有权接收频道消息（检查频道权限设置）
4. 如果是私密频道，确保 Bot 是管理员或成员

### 问题 4: 配置保存后仍然看不到已保存的值
**原因**: 前端缓存或配置未被正确返回  
**解决方案**:
1. 刷新页面
2. 清除浏览器缓存
3. 检查浏览器开发者工具中的网络请求，确认 POST 请求返回了正确的数据

### 问题 5: 发送文件到频道后没有自动导入
**原因**: Webhook 未在 Telegram 中正确注册，或 URL 不可访问  
**解决方案**:
1. 使用诊断 API 检查 Webhook 是否已在 Telegram 中注册
2. 确保您的域名可以从外网访问
3. 检查 Webhook URL 是否正确（应该是 `https://your-domain.com/webhook/telegram`）
4. 验证 Webhook Secret 是否一致
5. 检查服务器日志中是否有错误信息

### 问题 6: Webhook 接收文件但文件没有出现在 webhook_imported 文件夹
**原因**: 可能是索引更新失败或数据库写入失败  
**解决方案**:
1. 检查服务器日志中的错误信息
2. 使用 Webhook Logs API 检查文件是否被接收
3. 检查 KV 数据库是否有足够的配额

## 高级诊断

### 查看完整的服务器日志

如果以上步骤仍未解决问题，请查看 Cloudflare Pages 的实时日志：

1. 登录 Cloudflare 控制面板
2. 进入您的 Pages 项目
3. 点击"Functions"选项卡
4. 查看实时日志
5. 向 `/webhook/telegram` 和 `/api/manage/webhook/*` 端点发送请求并观察日志输出

### 检查 KV 配置

确保 KV 命名空间已正确绑定：

```bash
# 检查 KV 中的配置
curl -X GET "https://your-domain.com/api/manage/sysConfig/others" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" | jq .telegramWebhook
```

## 功能验证清单

使用以下清单验证 Webhook 功能是否完整工作：

- [ ] 在"其他设置"中输入 Bot Token、Chat ID 和 Webhook Secret
- [ ] 成功保存配置
- [ ] 使用诊断 API 验证所有检查都通过
- [ ] 使用测试 API 验证连接有效
- [ ] 在 Telegram 频道中上传一张照片
- [ ] 几秒钟后，文件应出现在 `webhook_imported` 文件夹
- [ ] 可以在管理界面中看到导入的文件
- [ ] 可以重命名导入的文件
- [ ] 可以下载导入的文件

## 性能优化提示

如果您的 Webhook 接收大量文件：

1. **批量处理**: 考虑将文件批量导入而不是逐个处理
2. **缓存优化**: 使用 CDN 缓存加速文件访问
3. **错误处理**: 实现重试机制处理暂时的网络故障

## 安全建议

1. **定期更换 Secret**: 每隔一段时间更换 Webhook Secret
2. **限制访问**: 只允许 Telegram 的 IP 地址访问 Webhook 端点
3. **监控异常**: 监控异常的请求频率
4. **日志审计**: 保存所有 Webhook 请求的日志用于审计

## 获取支持

如果问题仍未解决：

1. 收集诊断信息：
   - 诊断 API 的完整输出
   - 最近的 Webhook 日志
   - 浏览器控制台的错误信息
   - 服务器日志中的错误信息

2. 联系技术支持并提供上述信息

## 相关文件

- `/webhook/telegram` - Webhook 接收端点
- `/api/manage/webhook/telegram` - Webhook 管理 API
- `/api/manage/webhook/diagnose` - 诊断 API
- `/api/manage/webhook/logs` - 日志查看 API
- `/api/manage/sysConfig/others` - 系统配置 API
