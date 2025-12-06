# Telegram Webhook 前端集成指南

本文档提供了前端开发者需要实现的 Telegram Webhook 管理界面的完整指南。

## 功能概述

前端需要实现以下功能：

1. **配置面板**：输入和保存 Bot Token、Chat ID、Webhook Secret
2. **启用/禁用开关**：启用或禁用 Webhook
3. **连接测试**：测试配置是否有效
4. **诊断面板**：显示系统诊断信息
5. **文件列表**：显示最近接收的导入文件
6. **状态显示**：显示 Webhook 连接状态

## API 端点概览

| 端点 | 方法 | 功能 | 返回数据 |
|------|------|------|---------|
| `/api/manage/sysConfig/others` | GET | 获取所有系统配置 | `{ telegramWebhook, ... }` |
| `/api/manage/sysConfig/others` | POST | 保存系统配置 | `{ telegramWebhook, ... }` |
| `/api/manage/webhook/telegram` | GET | 获取 Webhook 状态 | 当前状态和配置 |
| `/api/manage/webhook/telegram?action=test` | GET | 测试连接 | 测试结果 |
| `/api/manage/webhook/telegram` | POST | 注册/更新 Webhook | 成功或错误信息 |
| `/api/manage/webhook/telegram` | DELETE | 删除 Webhook | 成功或错误信息 |
| `/api/manage/webhook/diagnose` | GET | 获取诊断信息 | 完整诊断报告 |
| `/api/manage/webhook/logs` | GET | 获取接收的文件日志 | 文件列表 |
| `/api/manage/webhook/stats` | GET | 获取统计信息 | 导入统计 |

## 前端组件结构

### 1. 配置表单组件

```vue
<template>
  <div class="telegram-webhook-config">
    <!-- Bot Token 输入 -->
    <el-form-item label="Bot Token">
      <el-input
        v-model="config.botToken"
        type="password"
        placeholder="输入您的 Telegram Bot Token"
        show-password
      />
      <small>从 @BotFather 获取您的 Bot Token</small>
    </el-form-item>

    <!-- Chat ID 输入 -->
    <el-form-item label="频道 ID">
      <el-input
        v-model="config.chatId"
        placeholder="输入频道 ID（例如：-1001234567890）"
      />
      <small>从频道详情或使用诊断工具获取</small>
    </el-form-item>

    <!-- Webhook Secret 输入 -->
    <el-form-item label="Webhook Secret">
      <el-input
        v-model="config.webhookSecret"
        type="password"
        placeholder="输入 Webhook 验证密钥（可选但推荐）"
        show-password
      />
      <small>用于验证 Webhook 请求的来源安全性</small>
    </el-form-item>

    <!-- 按钮组 -->
    <el-form-item>
      <el-button
        type="primary"
        @click="saveConfig"
        :loading="saving"
      >
        保存配置
      </el-button>
      <el-button @click="testConnection" :loading="testing">
        测试连接
      </el-button>
      <el-button @click="showDiagnostics">
        诊断
      </el-button>
    </el-form-item>
  </div>
</template>

<script>
export default {
  data() {
    return {
      config: {
        botToken: '',
        chatId: '',
        webhookSecret: '',
        enabled: false
      },
      saving: false,
      testing: false
    }
  },
  methods: {
    async loadConfig() {
      try {
        const response = await fetch('/api/manage/sysConfig/others', {
          headers: { 'Authorization': 'Basic ' + this.getBasicAuth() }
        });
        const data = await response.json();
        this.config = data.telegramWebhook;
      } catch (error) {
        this.$message.error('加载配置失败：' + error.message);
      }
    },

    async saveConfig() {
      this.saving = true;
      try {
        const response = await fetch('/api/manage/sysConfig/others', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + this.getBasicAuth(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            telegramWebhook: this.config
          })
        });
        const data = await response.json();
        this.$message.success('配置已保存');
        this.config = data.telegramWebhook;
      } catch (error) {
        this.$message.error('保存配置失败：' + error.message);
      } finally {
        this.saving = false;
      }
    },

    async testConnection() {
      this.testing = true;
      try {
        const response = await fetch('/api/manage/webhook/telegram?action=test', {
          headers: { 'Authorization': 'Basic ' + this.getBasicAuth() }
        });
        const data = await response.json();
        
        if (data.success) {
          this.$message.success(
            `连接成功！\\nBot: @${data.botInfo.username}\\nChannel: ${data.chatInfo.title}`
          );
        } else {
          this.$message.error('连接失败：' + data.error);
        }
      } catch (error) {
        this.$message.error('测试失败：' + error.message);
      } finally {
        this.testing = false;
      }
    },

    async showDiagnostics() {
      this.$emit('show-diagnostics');
    },

    getBasicAuth() {
      // 实现 Basic Auth 编码
      return btoa(username + ':' + password);
    }
  },
  mounted() {
    this.loadConfig();
  }
}
</script>
```

### 2. 启用/禁用开关组件

```vue
<template>
  <div class="webhook-toggle">
    <el-switch
      v-model="config.enabled"
      @change="handleToggle"
      :loading="loading"
      active-color="#13ce66"
      inactive-color="#ff4949"
    />
    <span class="status-text">
      {{ config.enabled ? '已启用' : '已禁用' }}
    </span>
  </div>
</template>

<script>
export default {
  data() {
    return {
      config: { enabled: false },
      loading: false
    }
  },
  methods: {
    async handleToggle() {
      this.loading = true;
      try {
        if (this.config.enabled) {
          // 启用 Webhook - 需要先注册到 Telegram
          const webhookUrl = `${window.location.origin}/webhook/telegram`;
          const response = await fetch('/api/manage/webhook/telegram', {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + this.getBasicAuth(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: webhookUrl,
              botToken: this.config.botToken,
              chatId: this.config.chatId,
              webhookSecret: this.config.webhookSecret,
              enabled: true
            })
          });
          const data = await response.json();
          
          if (data.success) {
            this.$message.success('Webhook 已启用');
          } else {
            this.$message.error('启用失败：' + data.error);
            this.config.enabled = false;
          }
        } else {
          // 禁用 Webhook
          const response = await fetch('/api/manage/webhook/telegram', {
            method: 'DELETE',
            headers: { 'Authorization': 'Basic ' + this.getBasicAuth() }
          });
          const data = await response.json();
          
          if (data.success) {
            this.$message.success('Webhook 已禁用');
          } else {
            this.$message.error('禁用失败：' + data.error);
            this.config.enabled = true;
          }
        }
      } catch (error) {
        this.$message.error('操作失败：' + error.message);
        this.config.enabled = !this.config.enabled;
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>
```

### 3. 诊断面板组件

```vue
<template>
  <div class="diagnostics-panel">
    <el-card title="Webhook 诊断" v-loading="loading">
      <div class="summary">
        <h3>诊断摘要</h3>
        <p>状态: {{ summary.status }}</p>
        <p>通过检查: {{ summary.passedChecks }} / {{ summary.totalChecks }}</p>
      </div>

      <el-divider></el-divider>

      <div class="checks">
        <div 
          v-for="(check, key) in checks" 
          :key="key"
          :class="['check-item', { passed: check.passed, failed: !check.passed }]"
        >
          <el-icon :class="{ success: check.passed, error: !check.passed }">
            <component :is="check.passed ? 'Check' : 'Close'" />
          </el-icon>
          <span class="check-name">{{ check.name }}</span>
          <span class="check-status">{{ check.passed ? '✓' : '✗' }}</span>
          
          <div v-if="check.details" class="check-details">
            <pre>{{ JSON.stringify(check.details, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <el-divider v-if="recommendations.length > 0"></el-divider>

      <div v-if="recommendations.length > 0" class="recommendations">
        <h3>建议</h3>
        <el-alert
          v-for="(rec, index) in recommendations"
          :key="index"
          :title="rec"
          type="warning"
          show-icon
          style="margin-bottom: 10px"
        />
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      diagnostics: null,
      checks: {},
      summary: {},
      recommendations: []
    }
  },
  methods: {
    async loadDiagnostics() {
      this.loading = true;
      try {
        const response = await fetch('/api/manage/webhook/diagnose', {
          headers: { 'Authorization': 'Basic ' + this.getBasicAuth() }
        });
        this.diagnostics = await response.json();
        this.checks = this.diagnostics.checks;
        this.summary = this.diagnostics.summary;
        this.recommendations = this.diagnostics.recommendations;
      } catch (error) {
        this.$message.error('加载诊断信息失败：' + error.message);
      } finally {
        this.loading = false;
      }
    },

    getBasicAuth() {
      return btoa(username + ':' + password);
    }
  },
  mounted() {
    this.loadDiagnostics();
  }
}
</script>

<style scoped>
.check-item {
  padding: 10px;
  margin-bottom: 10px;
  border-left: 4px solid #ddd;
  background: #f5f5f5;
}

.check-item.passed {
  border-left-color: #67c23a;
}

.check-item.failed {
  border-left-color: #f56c6c;
}

.check-details {
  margin-top: 10px;
  padding: 10px;
  background: white;
  border-radius: 4px;
  overflow-x: auto;
}

.check-details pre {
  margin: 0;
  font-size: 12px;
}
</style>
```

### 4. 文件列表组件

```vue
<template>
  <div class="webhook-files">
    <el-card title="最近导入的文件" v-loading="loading">
      <el-table :data="files" stripe>
        <el-table-column prop="fileName" label="文件名" width="250" />
        <el-table-column prop="fileSize" label="大小" width="100" />
        <el-table-column prop="mimeType" label="类型" width="150" />
        <el-table-column prop="timeStamp" label="导入时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.timeStamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="downloadFile(row.id)">下载</el-button>
            <el-button size="small" type="danger" @click="deleteFile(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @change="loadFiles"
      />
    </el-card>
  </div>
</template>

<script>
export default {
  data() {
    return {
      files: [],
      total: 0,
      currentPage: 1,
      pageSize: 20,
      loading: false
    }
  },
  methods: {
    async loadFiles() {
      this.loading = true;
      try {
        const offset = (this.currentPage - 1) * this.pageSize;
        const response = await fetch(
          `/api/manage/webhook/logs?limit=${this.pageSize}&offset=${offset}`,
          { headers: { 'Authorization': 'Basic ' + this.getBasicAuth() } }
        );
        const data = await response.json();
        this.files = data.data.files;
        this.total = data.data.total;
      } catch (error) {
        this.$message.error('加载文件列表失败：' + error.message);
      } finally {
        this.loading = false;
      }
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString();
    },

    downloadFile(fileId) {
      window.location.href = `/file/${fileId}`;
    },

    async deleteFile(fileId) {
      if (!confirm('确定要删除此文件吗？')) return;
      
      try {
        // 调用删除 API
        await fetch(`/api/manage/delete/${fileId}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Basic ' + this.getBasicAuth() }
        });
        this.$message.success('文件已删除');
        this.loadFiles();
      } catch (error) {
        this.$message.error('删除失败：' + error.message);
      }
    },

    getBasicAuth() {
      return btoa(username + ':' + password);
    }
  },
  mounted() {
    this.loadFiles();
  }
}
</script>
```

### 5. 完整页面集成

```vue
<template>
  <div class="telegram-webhook-page">
    <h1>Telegram Webhook 管理</h1>

    <!-- 配置部分 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>Webhook 配置</span>
          <el-tag 
            :type="config.enabled ? 'success' : 'info'"
          >
            {{ config.enabled ? '已启用' : '已禁用' }}
          </el-tag>
        </div>
      </template>

      <el-form label-width="150px">
        <!-- 配置表单 -->
        <TelegramWebhookConfig 
          :config.sync="config"
          @save="saveConfig"
        />

        <el-divider></el-divider>

        <!-- 启用/禁用开关 -->
        <el-form-item label="启用状态">
          <WebhookToggle 
            :config.sync="config"
            @change="updateStatus"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 诊断部分 -->
    <DiagnosticsPanel />

    <!-- 文件列表 -->
    <WebhookFilesList />
  </div>
</template>

<script>
import TelegramWebhookConfig from './components/TelegramWebhookConfig.vue'
import WebhookToggle from './components/WebhookToggle.vue'
import DiagnosticsPanel from './components/DiagnosticsPanel.vue'
import WebhookFilesList from './components/WebhookFilesList.vue'

export default {
  components: {
    TelegramWebhookConfig,
    WebhookToggle,
    DiagnosticsPanel,
    WebhookFilesList
  },
  data() {
    return {
      config: {
        botToken: '',
        chatId: '',
        webhookSecret: '',
        enabled: false
      }
    }
  },
  methods: {
    async saveConfig() {
      // 保存逻辑由子组件处理
    },

    async updateStatus() {
      // 更新状态由子组件处理
    }
  }
}
</script>

<style scoped>
.telegram-webhook-page {
  padding: 20px;
}

.config-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
```

## 实现建议

### 1. 错误处理
- 所有 API 调用都应该有 try-catch 错误处理
- 显示用户友好的错误提示
- 在诊断面板中显示详细的错误信息

### 2. 加载状态
- 在加载数据时显示加载动画
- 禁用按钮以防止重复提交
- 显示操作进度

### 3. 表单验证
- 验证 Bot Token 格式
- 验证 Chat ID 格式
- 在保存前进行基本验证

### 4. 实时状态更新
- 启用 Webhook 后自动刷新诊断信息
- 定期检查 Webhook 连接状态
- 显示最后的同步时间

### 5. 用户反馈
- 使用通知提示用户操作结果
- 在诊断面板中显示具体的建议
- 提供帮助文档链接

## 测试场景

1. **配置流程**
   - 输入有效的 Bot Token、Chat ID 和 Secret
   - 点击"保存配置"
   - 验证配置被正确保存
   - 刷新页面确认配置仍然存在

2. **启用流程**
   - 点击启用开关
   - 系统调用 Telegram API 注册 Webhook
   - 显示成功提示
   - 诊断面板显示"已连接"

3. **文件接收**
   - 在 Telegram 频道上传文件
   - 等待几秒
   - 刷新文件列表
   - 验证文件出现在列表中

4. **诊断和故障排查**
   - 打开诊断面板
   - 验证所有检查项
   - 查看建议和错误信息
   - 根据建议进行修复

## 相关资源

- [Telegram Bot API 文档](https://core.telegram.org/bots/api)
- [Element Plus 文档](https://element-plus.org/)
- [Vue 3 文档](https://vuejs.org/)
