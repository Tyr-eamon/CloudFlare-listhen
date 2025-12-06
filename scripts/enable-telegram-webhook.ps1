# Telegram Webhook 一键启用脚本 (PowerShell)
# 用法: .\enable-telegram-webhook.ps1 -Domain "cloudflare-listhen.pages.dev" -Username "admin" -Password "mypassword"

param(
    [Parameter(Mandatory=$true)]
    [string]$Domain,
    
    [Parameter(Mandatory=$true)]
    [string]$Username,
    
    [Parameter(Mandatory=$true)]
    [string]$Password
)

$ErrorActionPreference = "Stop"

$ApiBase = "https://$Domain"
$Credentials = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($Username):$($Password)"))
$Headers = @{
    "Authorization" = "Basic $Credentials"
    "Content-Type" = "application/json"
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Telegram Webhook 启用脚本" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 域名: $Domain" -ForegroundColor White
Write-Host "👤 用户: $Username" -ForegroundColor White
Write-Host ""

# 1. 检查配置
Write-Host "📋 步骤 1/4: 检查配置..." -ForegroundColor Yellow
try {
    $ConfigResponse = Invoke-RestMethod -Uri "$ApiBase/api/manage/sysConfig/others" -Method Get -Headers $Headers
    
    $BotToken = $ConfigResponse.telegramWebhook.botToken
    $ChatId = $ConfigResponse.telegramWebhook.chatId
    
    if ([string]::IsNullOrEmpty($BotToken) -or [string]::IsNullOrEmpty($ChatId)) {
        Write-Host "❌ 错误: 配置不完整" -ForegroundColor Red
        Write-Host "   请先在后台 '其他设置' 中配置 Bot Token 和 Channel ID" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ 配置已找到" -ForegroundColor Green
    Write-Host "   Bot Token: $($BotToken.Substring(0, [Math]::Min(10, $BotToken.Length)))..." -ForegroundColor Gray
    Write-Host "   Chat ID: $ChatId" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ 错误: 无法获取配置 - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. 测试连接
Write-Host "🔌 步骤 2/4: 测试连接..." -ForegroundColor Yellow
try {
    $TestResponse = Invoke-RestMethod -Uri "$ApiBase/api/manage/webhook/telegram?action=test" -Method Get -Headers $Headers
    
    if ($TestResponse.success -eq $true) {
        Write-Host "✅ 连接测试通过" -ForegroundColor Green
        if ($TestResponse.botInfo) {
            Write-Host "   Bot: @$($TestResponse.botInfo.username)" -ForegroundColor Gray
        }
        if ($TestResponse.chatInfo) {
            Write-Host "   频道: $($TestResponse.chatInfo.title)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  警告: 连接测试失败 - $($TestResponse.error)" -ForegroundColor Yellow
        $Continue = Read-Host "是否继续启用 Webhook? (y/N)"
        if ($Continue -ne "y" -and $Continue -ne "Y") {
            Write-Host "已取消" -ForegroundColor Yellow
            exit 1
        }
    }
    Write-Host ""
} catch {
    Write-Host "⚠️  警告: 无法测试连接 - $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# 3. 检查当前 Webhook 状态
Write-Host "🔍 步骤 3/4: 检查当前状态..." -ForegroundColor Yellow
try {
    $StatusResponse = Invoke-RestMethod -Uri "$ApiBase/api/manage/webhook/telegram" -Method Get -Headers $Headers
    
    $CurrentUrl = $StatusResponse.webhook.url
    $PendingCount = $StatusResponse.webhook.pendingUpdateCount
    
    if (![string]::IsNullOrEmpty($CurrentUrl)) {
        Write-Host "ℹ️  当前 Webhook URL: $CurrentUrl" -ForegroundColor Cyan
        Write-Host "⚠️  将被覆盖为: $ApiBase/webhook/telegram" -ForegroundColor Yellow
        $Continue = Read-Host "是否继续? (y/N)"
        if ($Continue -ne "y" -and $Continue -ne "Y") {
            Write-Host "已取消" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "ℹ️  当前 Webhook URL: (未设置)" -ForegroundColor Cyan
    }
    
    if ($PendingCount -gt 0) {
        Write-Host "📨 待处理消息: $PendingCount 条" -ForegroundColor Cyan
    }
    Write-Host ""
} catch {
    Write-Host "⚠️  警告: 无法获取状态 - $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# 4. 启用 Webhook
Write-Host "🚀 步骤 4/4: 启用 Webhook..." -ForegroundColor Yellow
try {
    $WebhookUrl = "$ApiBase/webhook/telegram"
    $Body = @{
        url = $WebhookUrl
    } | ConvertTo-Json
    
    $EnableResponse = Invoke-RestMethod -Uri "$ApiBase/api/manage/webhook/telegram?action=enable" -Method Post -Headers $Headers -Body $Body
    
    if ($EnableResponse.success -eq $true) {
        Write-Host "✅ Webhook 启用成功！" -ForegroundColor Green
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host "  配置信息" -ForegroundColor Cyan
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host "Webhook URL: $WebhookUrl" -ForegroundColor White
        Write-Host "Bot Token: $($BotToken.Substring(0, [Math]::Min(10, $BotToken.Length)))..." -ForegroundColor White
        Write-Host "Chat ID: $ChatId" -ForegroundColor White
        Write-Host ""
        Write-Host "🎉 现在可以在 Telegram 频道中上传文件了！" -ForegroundColor Green
        Write-Host "📁 文件将自动导入到 webhook_imported 文件夹" -ForegroundColor Green
        Write-Host ""
        Write-Host "查看日志: $ApiBase/api/manage/webhook/logs" -ForegroundColor Gray
        Write-Host "查看诊断: $ApiBase/api/manage/webhook/diagnose" -ForegroundColor Gray
        Write-Host "=========================================" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Webhook 启用失败: $($EnableResponse.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Webhook 启用失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
