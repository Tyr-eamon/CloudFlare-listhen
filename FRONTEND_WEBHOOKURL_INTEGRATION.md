# 前端集成：Webhook URL 可编辑功能

本文档提供前端集成 webhookUrl 可编辑功能的完整指南。

## 概述

后端已完全支持 webhookUrl 字段的保存、读取和修改。前端需要添加输入界面来让用户编辑这个字段。

## 前端仓库

前端代码在独立仓库：[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)

## 需要修改的文件

假设前端使用 Vue/Quasar 框架，需要修改"系统设置"中的"其他设置"页面。

### 1. 数据模型

在组件的 data 或 ref 中添加 webhookUrl 字段：

```javascript
// 使用 Vue 3 Composition API
import { ref, onMounted } from 'vue'

const webhookConfig = ref({
  enabled: false,
  botToken: '',
  chatId: '',
  webhookSecret: '',
  webhookUrl: '',  // 新增字段
  lastUpdated: null
})

// 或使用 Vue 2 Options API
data() {
  return {
    webhookConfig: {
      enabled: false,
      botToken: '',
      chatId: '',
      webhookSecret: '',
      webhookUrl: '',  // 新增字段
      lastUpdated: null
    }
  }
}
```

### 2. 表单界面

在"Telegram Webhook 配置"部分添加输入框：

```vue
<template>
  <q-card class="q-mb-md">
    <q-card-section>
      <div class="text-h6">Telegram Webhook 配置</div>
    </q-card-section>

    <q-card-section>
      <!-- Bot Token -->
      <q-input
        v-model="webhookConfig.botToken"
        label="Bot Token *"
        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        outlined
        dense
        type="password"
        class="q-mb-md"
      >
        <template v-slot:prepend>
          <q-icon name="key" />
        </template>
        <template v-slot:hint>
          从 @BotFather 获取的 Bot Token
        </template>
      </q-input>

      <!-- Chat ID -->
      <q-input
        v-model="webhookConfig.chatId"
        label="Chat ID *"
        placeholder="-1001234567890"
        outlined
        dense
        class="q-mb-md"
      >
        <template v-slot:prepend>
          <q-icon name="chat" />
        </template>
        <template v-slot:hint>
          Telegram 频道或群组的 Chat ID（必须以 -100 开头）
        </template>
      </q-input>

      <!-- Webhook Secret -->
      <q-input
        v-model="webhookConfig.webhookSecret"
        label="Webhook Secret"
        placeholder="your-secret-token"
        outlined
        dense
        type="password"
        class="q-mb-md"
      >
        <template v-slot:prepend>
          <q-icon name="lock" />
        </template>
        <template v-slot:hint>
          用于验证 Webhook 请求的密钥（可选但推荐）
        </template>
      </q-input>

      <!-- Webhook URL - 新增 -->
      <q-input
        v-model="webhookConfig.webhookUrl"
        label="Webhook URL"
        :placeholder="defaultWebhookUrl"
        outlined
        dense
        class="q-mb-md"
      >
        <template v-slot:prepend>
          <q-icon name="link" />
        </template>
        <template v-slot:hint>
          Telegram 将向此 URL 发送消息。留空使用默认值：{{ defaultWebhookUrl }}
        </template>
        <template v-slot:append>
          <q-btn
            flat
            dense
            icon="content_copy"
            @click="copyToClipboard(webhookConfig.webhookUrl || defaultWebhookUrl)"
          >
            <q-tooltip>复制 URL</q-tooltip>
          </q-btn>
        </template>
      </q-input>

      <!-- 状态显示 -->
      <q-banner
        v-if="webhookConfig.enabled"
        rounded
        class="bg-positive text-white q-mb-md"
      >
        <template v-slot:avatar>
          <q-icon name="check_circle" color="white" />
        </template>
        Webhook 已启用
        <div class="text-caption" v-if="webhookConfig.lastUpdated">
          最后更新: {{ formatDate(webhookConfig.lastUpdated) }}
        </div>
      </q-banner>

      <!-- 操作按钮 -->
      <div class="row q-gutter-sm">
        <q-btn
          color="primary"
          label="保存设置"
          @click="saveWebhookConfig"
          :loading="saving"
          icon="save"
        />
        <q-btn
          color="secondary"
          label="测试连接"
          @click="testWebhookConnection"
          :loading="testing"
          icon="wifi"
          :disable="!webhookConfig.botToken || !webhookConfig.chatId"
        />
        <q-btn
          v-if="!webhookConfig.enabled"
          color="positive"
          label="启用 Webhook"
          @click="enableWebhook"
          :loading="enabling"
          icon="power_settings_new"
          :disable="!webhookConfig.botToken || !webhookConfig.chatId"
        />
        <q-btn
          v-else
          color="negative"
          label="禁用 Webhook"
          @click="disableWebhook"
          :loading="disabling"
          icon="power_off"
        />
      </div>
    </q-card-section>
  </q-card>
</template>
```

### 3. 计算默认 URL

```javascript
import { computed } from 'vue'

// 计算默认的 Webhook URL
const defaultWebhookUrl = computed(() => {
  return `${window.location.origin}/webhook/telegram`
})

// 或使用 Vue 2
computed: {
  defaultWebhookUrl() {
    return `${window.location.origin}/webhook/telegram`
  }
}
```

### 4. 加载配置

```javascript
const loading = ref(false)

async function loadWebhookConfig() {
  loading.value = true
  try {
    const response = await fetch('/api/manage/sysConfig/others', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load configuration')
    }

    const settings = await response.json()
    
    // 更新 webhookConfig，包括 webhookUrl
    webhookConfig.value = {
      enabled: settings.telegramWebhook.enabled || false,
      botToken: settings.telegramWebhook.botToken || '',
      chatId: settings.telegramWebhook.chatId || '',
      webhookSecret: settings.telegramWebhook.webhookSecret || '',
      webhookUrl: settings.telegramWebhook.webhookUrl || '',  // 读取 webhookUrl
      lastUpdated: settings.telegramWebhook.lastUpdated || null
    }

    console.log('Webhook configuration loaded:', webhookConfig.value)
  } catch (error) {
    console.error('Failed to load webhook config:', error)
    showNotification('negative', '加载配置失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 组件挂载时加载配置
onMounted(() => {
  loadWebhookConfig()
})
```

### 5. 保存配置

```javascript
const saving = ref(false)

async function saveWebhookConfig() {
  // 验证必填字段
  if (!webhookConfig.value.botToken) {
    showNotification('warning', '请输入 Bot Token')
    return
  }
  
  if (!webhookConfig.value.chatId) {
    showNotification('warning', '请输入 Chat ID')
    return
  }

  // 验证 webhookUrl 格式（如果填写了）
  if (webhookConfig.value.webhookUrl) {
    try {
      const url = new URL(webhookConfig.value.webhookUrl)
      if (url.protocol !== 'https:') {
        showNotification('warning', 'Webhook URL 必须使用 HTTPS 协议')
        return
      }
    } catch (error) {
      showNotification('warning', 'Webhook URL 格式不正确')
      return
    }
  }

  saving.value = true
  try {
    const response = await fetch('/api/manage/sysConfig/others', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      },
      body: JSON.stringify({
        telegramWebhook: {
          botToken: webhookConfig.value.botToken,
          chatId: webhookConfig.value.chatId,
          webhookSecret: webhookConfig.value.webhookSecret,
          webhookUrl: webhookConfig.value.webhookUrl,  // 包含 webhookUrl
          enabled: webhookConfig.value.enabled
        }
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save configuration')
    }

    const result = await response.json()
    
    // 更新本地配置
    webhookConfig.value = {
      enabled: result.telegramWebhook.enabled,
      botToken: result.telegramWebhook.botToken,
      chatId: result.telegramWebhook.chatId,
      webhookSecret: result.telegramWebhook.webhookSecret,
      webhookUrl: result.telegramWebhook.webhookUrl,  // 更新 webhookUrl
      lastUpdated: result.telegramWebhook.lastUpdated
    }

    showNotification('positive', '配置保存成功！')
    
    // 如果启用了 Webhook，提示用户
    if (webhookConfig.value.enabled) {
      showNotification('info', 'Webhook 已自动启用')
    }
  } catch (error) {
    console.error('Failed to save webhook config:', error)
    showNotification('negative', '保存配置失败: ' + error.message)
  } finally {
    saving.value = false
  }
}
```

### 6. 启用 Webhook

```javascript
const enabling = ref(false)

async function enableWebhook() {
  enabling.value = true
  try {
    const response = await fetch('/api/manage/webhook/telegram?action=enable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      },
      body: JSON.stringify({
        // 如果想使用自定义 URL，可以传入 url 参数
        // url: webhookConfig.value.webhookUrl
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to enable webhook')
    }

    const result = await response.json()
    
    // 更新状态
    webhookConfig.value.enabled = true
    webhookConfig.value.webhookUrl = result.webhookUrl  // 更新实际使用的 URL

    showNotification('positive', 'Webhook 启用成功！')
    console.log('Webhook URL:', result.webhookUrl)
    
    // 重新加载配置
    await loadWebhookConfig()
  } catch (error) {
    console.error('Failed to enable webhook:', error)
    showNotification('negative', '启用 Webhook 失败: ' + error.message)
  } finally {
    enabling.value = false
  }
}
```

### 7. 测试连接

```javascript
const testing = ref(false)

async function testWebhookConnection() {
  testing.value = true
  try {
    const response = await fetch('/api/manage/webhook/telegram?action=test', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      }
    })

    const result = await response.json()

    if (result.success) {
      showNotification('positive', '连接测试成功！')
      console.log('Bot Info:', result.botInfo)
      console.log('Chat Info:', result.chatInfo)
    } else {
      showNotification('negative', '连接测试失败: ' + result.error)
    }
  } catch (error) {
    console.error('Failed to test connection:', error)
    showNotification('negative', '连接测试失败: ' + error.message)
  } finally {
    testing.value = false
  }
}
```

### 8. 禁用 Webhook

```javascript
const disabling = ref(false)

async function disableWebhook() {
  disabling.value = true
  try {
    const response = await fetch('/api/manage/webhook/telegram', {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to disable webhook')
    }

    const result = await response.json()
    
    // 更新状态
    webhookConfig.value.enabled = false

    showNotification('positive', 'Webhook 已禁用')
    
    // 重新加载配置
    await loadWebhookConfig()
  } catch (error) {
    console.error('Failed to disable webhook:', error)
    showNotification('negative', '禁用 Webhook 失败: ' + error.message)
  } finally {
    disabling.value = false
  }
}
```

### 9. 辅助函数

```javascript
// 复制到剪贴板
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('positive', '已复制到剪贴板')
  }).catch(err => {
    console.error('Failed to copy:', err)
    showNotification('negative', '复制失败')
  })
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

// 显示通知
function showNotification(type, message) {
  // 使用 Quasar Notify
  Notify.create({
    type: type,
    message: message,
    position: 'top',
    timeout: 3000
  })
}
```

## 完整示例（Vue 3 Composition API）

```vue
<template>
  <q-page padding>
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Telegram Webhook 配置</div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="webhookConfig.botToken"
          label="Bot Token *"
          placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
          outlined
          dense
          type="password"
          class="q-mb-md"
        >
          <template v-slot:prepend>
            <q-icon name="key" />
          </template>
        </q-input>

        <q-input
          v-model="webhookConfig.chatId"
          label="Chat ID *"
          placeholder="-1001234567890"
          outlined
          dense
          class="q-mb-md"
        >
          <template v-slot:prepend>
            <q-icon name="chat" />
          </template>
        </q-input>

        <q-input
          v-model="webhookConfig.webhookSecret"
          label="Webhook Secret"
          placeholder="your-secret-token"
          outlined
          dense
          type="password"
          class="q-mb-md"
        >
          <template v-slot:prepend>
            <q-icon name="lock" />
          </template>
        </q-input>

        <q-input
          v-model="webhookConfig.webhookUrl"
          label="Webhook URL"
          :placeholder="defaultWebhookUrl"
          outlined
          dense
          class="q-mb-md"
        >
          <template v-slot:prepend>
            <q-icon name="link" />
          </template>
          <template v-slot:hint>
            留空使用默认值：{{ defaultWebhookUrl }}
          </template>
          <template v-slot:append>
            <q-btn
              flat
              dense
              icon="content_copy"
              @click="copyToClipboard(webhookConfig.webhookUrl || defaultWebhookUrl)"
            />
          </template>
        </q-input>

        <div class="row q-gutter-sm">
          <q-btn
            color="primary"
            label="保存设置"
            @click="saveWebhookConfig"
            :loading="saving"
            icon="save"
          />
          <q-btn
            color="secondary"
            label="测试连接"
            @click="testWebhookConnection"
            :loading="testing"
            icon="wifi"
          />
          <q-btn
            v-if="!webhookConfig.enabled"
            color="positive"
            label="启用 Webhook"
            @click="enableWebhook"
            :loading="enabling"
            icon="power_settings_new"
          />
          <q-btn
            v-else
            color="negative"
            label="禁用 Webhook"
            @click="disableWebhook"
            :loading="disabling"
            icon="power_off"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Notify } from 'quasar'

const webhookConfig = ref({
  enabled: false,
  botToken: '',
  chatId: '',
  webhookSecret: '',
  webhookUrl: '',
  lastUpdated: null
})

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const enabling = ref(false)
const disabling = ref(false)

const username = ref('admin')
const password = ref('password')

const defaultWebhookUrl = computed(() => {
  return `${window.location.origin}/webhook/telegram`
})

async function loadWebhookConfig() {
  loading.value = true
  try {
    const response = await fetch('/api/manage/sysConfig/others', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      }
    })

    if (!response.ok) throw new Error('Failed to load configuration')

    const settings = await response.json()
    webhookConfig.value = settings.telegramWebhook || {}
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: '加载配置失败: ' + error.message
    })
  } finally {
    loading.value = false
  }
}

async function saveWebhookConfig() {
  if (!webhookConfig.value.botToken || !webhookConfig.value.chatId) {
    Notify.create({ type: 'warning', message: '请填写必填字段' })
    return
  }

  saving.value = true
  try {
    const response = await fetch('/api/manage/sysConfig/others', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      },
      body: JSON.stringify({
        telegramWebhook: webhookConfig.value
      })
    })

    if (!response.ok) throw new Error('Failed to save configuration')

    const result = await response.json()
    webhookConfig.value = result.telegramWebhook

    Notify.create({ type: 'positive', message: '配置保存成功！' })
  } catch (error) {
    Notify.create({ type: 'negative', message: '保存失败: ' + error.message })
  } finally {
    saving.value = false
  }
}

async function enableWebhook() {
  enabling.value = true
  try {
    const response = await fetch('/api/manage/webhook/telegram?action=enable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error)
    }

    const result = await response.json()
    webhookConfig.value.enabled = true
    webhookConfig.value.webhookUrl = result.webhookUrl

    Notify.create({ type: 'positive', message: 'Webhook 启用成功！' })
    await loadWebhookConfig()
  } catch (error) {
    Notify.create({ type: 'negative', message: '启用失败: ' + error.message })
  } finally {
    enabling.value = false
  }
}

async function testWebhookConnection() {
  testing.value = true
  try {
    const response = await fetch('/api/manage/webhook/telegram?action=test', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      }
    })

    const result = await response.json()

    if (result.success) {
      Notify.create({ type: 'positive', message: '连接测试成功！' })
    } else {
      Notify.create({ type: 'negative', message: '测试失败: ' + result.error })
    }
  } catch (error) {
    Notify.create({ type: 'negative', message: '测试失败: ' + error.message })
  } finally {
    testing.value = false
  }
}

async function disableWebhook() {
  disabling.value = true
  try {
    const response = await fetch('/api/manage/webhook/telegram', {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${btoa(username.value + ':' + password.value)}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error)
    }

    webhookConfig.value.enabled = false
    Notify.create({ type: 'positive', message: 'Webhook 已禁用' })
    await loadWebhookConfig()
  } catch (error) {
    Notify.create({ type: 'negative', message: '禁用失败: ' + error.message })
  } finally {
    disabling.value = false
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    Notify.create({ type: 'positive', message: '已复制到剪贴板' })
  })
}

onMounted(() => {
  loadWebhookConfig()
})
</script>
```

## 注意事项

1. **URL 验证**：前端应验证 webhookUrl 必须是 HTTPS 协议
2. **默认值处理**：如果用户不填写 webhookUrl，后端会自动使用默认值
3. **错误处理**：妥善处理网络错误和 API 错误
4. **用户提示**：保存成功后提示用户配置已启用
5. **状态同步**：操作后重新加载配置以保持状态同步

## 测试清单

- [ ] 输入框能正常显示和编辑
- [ ] 保存配置后能正确保存 webhookUrl
- [ ] 刷新页面后显示保存的 webhookUrl
- [ ] 修改 webhookUrl 后能正确更新
- [ ] 留空 webhookUrl 时使用默认值
- [ ] 启用 Webhook 时使用配置的 URL
- [ ] 禁用 Webhook 后配置保留
- [ ] 错误情况下有适当的提示

## 相关文档

- [WEBHOOKURL_EDITABLE_FIX.md](WEBHOOKURL_EDITABLE_FIX.md) - 后端修复说明
- [TELEGRAM_WEBHOOK_UI_INTEGRATION.md](TELEGRAM_WEBHOOK_UI_INTEGRATION.md) - 原UI集成指南
- [WEBHOOK_API_DOCUMENTATION.md](WEBHOOK_API_DOCUMENTATION.md) - API 文档
