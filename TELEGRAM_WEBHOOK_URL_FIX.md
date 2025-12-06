# Telegram Webhook URL 配置修复

## 问题描述

用户已经在"其他设置"中配置了：
- Bot Token ✅
- Channel ID ✅  
- Webhook Secret ✅

但 Telegram 侧的 Webhook URL 仍然为空，导致无法接收消息。

## 根本原因

`/api/manage/sysConfig/others` API 只保存配置到 KV，但**从未调用 Telegram API 的 `setWebhook` 方法**来注册 Webhook URL。

## 修复方案

### 1. 新增 API 端点（已实现）

**启用 Webhook**
```
POST /api/manage/webhook/telegram?action=enable
Content-Type: application/json

{
  "url": "https://cloudflare-listhen.pages.dev/webhook/telegram"  // 可选，不提供则自动使用当前域名
}
```

**响应**
```json
{
  "success": true,
  "message": "Webhook enabled successfully",
  "webhookUrl": "https://cloudflare-listhen.pages.dev/webhook/telegram",
  "result": "Webhook was set"
}
```

### 2. 工作流程

1. 用户在"其他设置"中配置 Bot Token、Channel ID、Webhook Secret
2. 点击"保存设置"，配置保存到 KV
3. **用户点击"启用 Webhook"按钮**（新增）
4. 调用 `POST /api/manage/webhook/telegram?action=enable`
5. 后端从 KV 读取配置，调用 Telegram API 注册 Webhook URL
6. Telegram 开始向该 URL 发送消息

### 3. 与现有 API 的兼容性

| API | 用途 | 使用场景 |
|-----|------|----------|
| `POST /api/manage/webhook/telegram` | 完整注册（需要所有参数） | 高级用户、批量配置 |
| `POST /api/manage/webhook/telegram?action=enable` | 简化启用（从 KV 读取配置） | 普通用户、一键启用 |
| `DELETE /api/manage/webhook/telegram` | 禁用 Webhook | 暂停接收消息 |
| `GET /api/manage/webhook/telegram` | 获取状态 | 查看 Webhook 状态 |
| `GET /api/manage/webhook/telegram?action=test` | 测试连接 | 验证配置是否正确 |

### 4. 前端集成示例

#### 方式 A：在"其他设置"页面添加"启用 Webhook"按钮

```vue
<template>
  <el-form-item label="Webhook 状态">
    <div>
      <el-tag :type="webhookEnabled ? 'success' : 'info'">
        {{ webhookEnabled ? '已启用' : '未启用' }}
      </el-tag>
      <el-button 
        v-if="!webhookEnabled" 
        type="primary" 
        size="small"
        :loading="enabling"
        @click="enableWebhook"
        style="margin-left: 10px">
        启用 Webhook
      </el-button>
      <el-button 
        v-else
        type="warning" 
        size="small"
        :loading="disabling"
        @click="disableWebhook"
        style="margin-left: 10px">
        禁用 Webhook
      </el-button>
    </div>
  </el-form-item>
</template>

<script>
export default {
  data() {
    return {
      webhookEnabled: false,
      enabling: false,
      disabling: false
    }
  },
  methods: {
    async checkWebhookStatus() {
      try {
        const response = await fetch('/api/manage/webhook/telegram');
        const data = await response.json();
        if (data.success && data.webhook) {
          this.webhookEnabled = !!data.webhook.url;
        }
      } catch (error) {
        console.error('Failed to check webhook status:', error);
      }
    },
    
    async enableWebhook() {
      // 先保存配置
      await this.saveSettings();
      
      // 然后启用 Webhook
      this.enabling = true;
      try {
        const response = await fetch('/api/manage/webhook/telegram?action=enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})  // 使用默认 URL
        });
        
        const data = await response.json();
        if (data.success) {
          this.$message.success(`Webhook 已启用！URL: ${data.webhookUrl}`);
          this.webhookEnabled = true;
        } else {
          this.$message.error('启用失败: ' + data.error);
        }
      } catch (error) {
        this.$message.error('启用失败: ' + error.message);
      } finally {
        this.enabling = false;
      }
    },
    
    async disableWebhook() {
      this.disabling = true;
      try {
        const response = await fetch('/api/manage/webhook/telegram', {
          method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
          this.$message.success('Webhook 已禁用');
          this.webhookEnabled = false;
        } else {
          this.$message.error('禁用失败: ' + data.error);
        }
      } catch (error) {
        this.$message.error('禁用失败: ' + error.message);
      } finally {
        this.disabling = false;
      }
    }
  },
  
  mounted() {
    this.checkWebhookStatus();
  }
}
</script>
```

#### 方式 B：保存设置后自动提示启用

```javascript
async saveSettings() {
  // 保存配置
  const response = await fetch('/api/manage/sysConfig/others', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(this.settings)
  });
  
  if (response.ok) {
    this.$message.success('设置已保存');
    
    // 如果配置了 Telegram Webhook，询问是否启用
    if (this.settings.telegramWebhook.botToken && 
        this.settings.telegramWebhook.chatId) {
      this.$confirm('检测到 Telegram Webhook 配置，是否立即启用？', '提示', {
        confirmButtonText: '启用',
        cancelButtonText: '稍后',
        type: 'info'
      }).then(() => {
        this.enableWebhook();
      }).catch(() => {
        // 用户选择稍后
      });
    }
  }
}
```

### 5. 测试步骤

1. **配置参数**：在"其他设置"中填写 Bot Token、Channel ID、Webhook Secret
2. **保存配置**：点击"保存设置"
3. **启用 Webhook**：
   ```bash
   curl -X POST 'https://your-domain.com/api/manage/webhook/telegram?action=enable' \
     -H 'Authorization: Basic ...' \
     -H 'Content-Type: application/json' \
     -d '{}'
   ```
4. **验证状态**：
   ```bash
   curl 'https://your-domain.com/api/manage/webhook/telegram' \
     -H 'Authorization: Basic ...'
   ```
   应该看到 `webhook.url` 不再为空

5. **测试接收**：在 Telegram 频道上传文件，检查是否被接收

### 6. 待处理消息

Telegram 目前有 5 个待处理的消息（`pendingUpdateCount: 5`）。

当 Webhook URL 成功注册后，这些待处理的消息会自动发送到 Webhook 端点。

如果想要清除这些待处理的消息（不接收），可以在启用时设置 `drop_pending_updates: true`（当前默认为 `false`，会保留这些消息）。

### 7. 诊断工具

使用诊断 API 检查配置状态：
```bash
curl 'https://your-domain.com/api/manage/webhook/diagnose' \
  -H 'Authorization: Basic ...'
```

检查项目：
- ✅ 配置是否存在
- ✅ Bot Token 是否有效
- ✅ Channel ID 是否有效
- ✅ Webhook Secret 是否设置
- ✅ Webhook 是否启用（本地）
- ❌ **Webhook URL 是否在 Telegram 注册**（修复后会变成 ✅）
- ✅ 接收的文件数量

## 优势

1. **用户友好**：配置和启用分离，用户可以先测试配置，确认无误后再启用
2. **灵活性**：支持多次启用/禁用，无需重新配置参数
3. **自动化**：自动从 KV 读取配置，无需重复输入
4. **安全性**：使用已保存的 Webhook Secret 进行验证
5. **向后兼容**：不影响现有的完整注册 API

## 总结

修复后，用户只需要：
1. 在"其他设置"配置 Bot Token、Channel ID、Webhook Secret
2. 点击"启用 Webhook"按钮
3. 等待 Telegram 开始发送消息

无需手动输入 Webhook URL，系统自动使用当前域名。
