# Telegram Webhook 自动导入功能

## 概述

CloudFlare-ImgBed 现已支持通过 Telegram Webhook 自动导入频道中的文件。当文件上传到指定的 Telegram 频道时，系统会自动捕获并导入到图床中，无需手动上传。

## 主要功能

### ✅ 自动导入
- 实时监听 Telegram 频道消息
- 自动捕获照片、文档、视频、音频、动画等多种媒体类型
- 生成唯一文件 ID 并存储元数据
- 自动添加到索引，立即在管理面板中可见

### ✅ Webhook 管理
- **注册 Webhook**: 通过 API 一键注册 Webhook 到 Telegram
- **查看状态**: 实时查看 Webhook 连接状态和错误信息
- **取消 Webhook**: 随时取消 Webhook 注册
- **配置管理**: 通过后台界面管理 Bot Token、Chat ID 和密钥

### ✅ 文件管理
- **重命名**: 支持修改导入文件的名称
- **统计信息**: 查看导入文件总数和最近导入的文件
- **完整生命周期**: 导入的文件支持所有常规操作（移动、删除、标签等）

## 快速开始

### 1. 准备工作

#### 创建 Telegram Bot
1. 在 Telegram 中找到 @BotFather
2. 发送 `/newbot` 创建新机器人
3. 按照提示设置机器人名称
4. 保存获得的 Bot Token（格式：`1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`）

#### 创建频道并获取 Chat ID
1. 创建一个 Telegram 频道（私有或公开均可）
2. 将创建的 Bot 添加为频道管理员
3. 获取频道的 Chat ID（格式：`-1001234567890`）
   - 方法1: 使用 @userinfobot
   - 方法2: 发送消息到频道后通过 `https://api.telegram.org/bot<TOKEN>/getUpdates` 查看

### 2. 配置 Webhook

#### 方式一：通过后台管理界面（推荐）

1. 登录管理后台
2. 进入「系统设置」→「其他设置」或「Webhook」标签
3. 填写配置信息：
   - **Bot Token**: 从 BotFather 获得的 Token
   - **Chat ID**: 频道的 Chat ID
   - **Webhook Secret**: 自定义的验证密钥（建议使用随机字符串）
4. 点击「保存配置」
5. 点击「注册 Webhook」
6. 查看状态确认连接成功

#### 方式二：通过环境变量

在 Cloudflare Pages 设置中添加以下环境变量：
```
TELEGRAM_LISTENER_BOT_TOKEN=你的Bot Token
TELEGRAM_LISTENER_CHAT_ID=你的频道Chat ID
TELEGRAM_WEBHOOK_SECRET=你的验证密钥
```

然后通过 API 注册 Webhook：
```bash
curl -X POST https://your-domain.com/api/manage/webhook/telegram \
  -H "Authorization: Basic admin:password" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook/telegram",
    "botToken": "你的Bot Token",
    "chatId": "你的Chat ID",
    "webhookSecret": "你的验证密钥"
  }'
```

### 3. 测试导入

1. 在配置的 Telegram 频道中发送任意图片、文件或视频
2. 稍等片刻后在管理面板中查看「文件列表」
3. 导入的文件会自动出现在 `webhook_imported/` 目录下
4. 文件可以通过 `/file/` 端点访问

## API 端点

### Webhook 管理
- `GET /api/manage/webhook/telegram` - 获取 Webhook 状态
- `POST /api/manage/webhook/telegram` - 注册/更新 Webhook
- `DELETE /api/manage/webhook/telegram` - 取消 Webhook

### 统计信息
- `GET /api/manage/webhook/stats` - 获取导入文件统计

### 文件操作
- `GET /api/manage/rename/[fileId]?newName=xxx` - 重命名文件
- `GET /api/manage/list?channel=TelegramNew` - 列出 Webhook 导入的文件

详细的 API 文档请查看 [WEBHOOK_API_DOCUMENTATION.md](./WEBHOOK_API_DOCUMENTATION.md)

## 支持的媒体类型

| 类型 | 说明 | 生成文件名格式 |
|------|------|----------------|
| 照片 (photo) | JPEG/PNG 图片 | `photo_YYYYMMDD_HHMMSS.jpg` |
| 文档 (document) | 任意文件 | 原文件名或 `document_YYYYMMDD_HHMMSS.bin` |
| 视频 (video) | MP4 等视频文件 | `video_YYYYMMDD_HHMMSS.mp4` |
| 音频 (audio) | MP3 等音频文件 | `audio_YYYYMMDD_HHMMSS.mp3` |
| 动画 (animation) | GIF 动图 | `animation_YYYYMMDD_HHMMSS.gif` |

## 元数据

导入的文件包含以下元数据：
- `FileName`: 文件名
- `FileSize`: 文件大小（MB）
- `TgFileId`: Telegram 文件 ID
- `TgChatId`: 频道 Chat ID
- `Channel`: "TelegramNew"（标识为 Webhook 导入）
- `Directory`: "webhook_imported/"
- `IsWebhookImport`: true
- `MessageId`: Telegram 消息 ID
- `MimeType`: 文件 MIME 类型
- `TimeStamp`: 上传时间戳

## 注意事项

### 安全性
- ✅ Webhook 使用 `X-Telegram-Bot-Api-Secret-Token` 头部验证请求来源
- ✅ 只接受来自配置的频道的消息
- ✅ 建议使用强随机字符串作为 Webhook Secret
- ✅ 管理 API 需要身份验证（Basic Auth 或 API Token）

### 限制
- 📋 只监听 `channel_post` 类型的更新（频道消息）
- 📋 不监听私聊消息或群组消息
- 📋 首次注册 Webhook 会清空待处理的历史更新
- 📋 Telegram Bot API 文件大小限制为 20MB（普通 Bot）或 2GB（Premium Bot）

### 故障排查
如果文件没有自动导入，请检查：
1. ✔️ Bot 是否被添加为频道管理员
2. ✔️ Bot Token 和 Chat ID 是否正确
3. ✔️ Webhook Secret 是否匹配
4. ✔️ Webhook 状态是否正常（通过「查看状态」按钮）
5. ✔️ 查看 Cloudflare Workers 日志获取详细错误信息

## 后台管理界面集成

建议在后台管理面板的「其他设置」或新增「Webhook」标签页中添加以下功能模块：

### 配置区域
```
┌─────────────────────────────────────┐
│ Telegram Webhook 配置              │
├─────────────────────────────────────┤
│ Bot Token:                          │
│ [____________________________]      │
│                                     │
│ Chat ID:                            │
│ [____________________________]      │
│                                     │
│ Webhook Secret:                     │
│ [____________________________]      │
│                                     │
│ [ ✓ ] 启用 Webhook                  │
│                                     │
│ [保存配置]                          │
└─────────────────────────────────────┘
```

### 状态区域
```
┌─────────────────────────────────────┐
│ Webhook 状态                        │
├─────────────────────────────────────┤
│ 状态: ● 已连接                      │
│ URL: https://xxx.com/webhook/...    │
│ 待处理更新: 0                       │
│ 最后错误: 无                        │
│                                     │
│ [查看状态] [注册Webhook] [取消]     │
└─────────────────────────────────────┘
```

### 统计区域
```
┌─────────────────────────────────────┐
│ 导入统计                            │
├─────────────────────────────────────┤
│ 总导入文件: 156                     │
│                                     │
│ 最近导入:                           │
│ • photo_20231205.jpg (2.3MB)        │
│   [重命名] [查看] [删除]            │
│ • video_20231204.mp4 (15.2MB)       │
│   [重命名] [查看] [删除]            │
│ • document_20231203.pdf (1.5MB)     │
│   [重命名] [查看] [删除]            │
│                                     │
│ [刷新] [查看全部]                   │
└─────────────────────────────────────┘
```

## 完整工作流程

```
1. 用户上传文件到 Telegram 频道
   ↓
2. Telegram 发送 Webhook 请求到 /webhook/telegram
   ↓
3. 验证请求签名（Secret Token）
   ↓
4. 解析消息并提取文件信息
   ↓
5. 生成唯一文件 ID 和元数据
   ↓
6. 存储到 KV 数据库
   ↓
7. 添加到索引
   ↓
8. 文件立即在管理面板中可见
   ↓
9. 可通过 /file/[fileId] 访问文件
```

## 相关文档

- [完整 API 文档](./WEBHOOK_API_DOCUMENTATION.md) - 详细的 API 端点说明和示例
- [主项目文档](https://cfbed.sanyue.de) - CloudFlare-ImgBed 完整文档
- [Telegram Bot API](https://core.telegram.org/bots/api) - Telegram 官方文档

## 技术细节

### 存储方式
- 文件实际存储在 Telegram 服务器上
- KV 中只存储元数据和 `TgFileId`
- 下载时通过 Telegram Bot API 获取文件内容
- 支持流式传输和 Range 请求

### 索引集成
- 导入的文件自动添加到索引系统
- 支持按目录、频道、标签等筛选
- 支持全文搜索文件名
- 与现有文件管理功能完全集成

### 性能优化
- 异步处理索引更新
- CDN 缓存支持
- 错误时返回 200 状态避免 Telegram 重试轰炸
- 支持协作点防止 Worker 超时

## 更新日志

### v1.0.0 (2024-12-05)
- ✨ 新增 Telegram Webhook 自动导入功能
- ✨ 新增 Webhook 管理 API
- ✨ 新增文件重命名功能
- ✨ 新增导入统计 API
- ✨ 扩展 TelegramAPI 工具类
- 📝 添加完整的 API 文档

---

如有问题或建议，请提交 [Issue](https://github.com/MarSeventh/CloudFlare-ImgBed/issues) 或查看[常见问题](https://cfbed.sanyue.de)。
