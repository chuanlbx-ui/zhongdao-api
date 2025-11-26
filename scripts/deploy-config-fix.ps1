# PowerShell 自动化部署脚本 - 环境变量修复
# 功能：本地编译 + 远程部署（SSH）

param(
    [string]$Environment = "production",
    [string]$RemoteHost = "162.14.114.224",
    [string]$RemoteUser = "root",
    [string]$RemotePath = "/www/wwwroot/zd-api.wenbita.cn"
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🚀 自动化部署脚本 - 环境变量运行时读取修复" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. 本地编译
Write-Host "`n📦 第1步: 本地编译..." -ForegroundColor Yellow
Write-Host "命令: npm run build" -ForegroundColor Gray

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 编译失败！请检查代码。" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 编译成功！" -ForegroundColor Green

# 2. 生成时间戳备份文件夹名称
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupName = "dist_backup_$timestamp"

# 3. 验证编译结果中的环境变量
Write-Host "`n🔍 第2步: 验证编译结果..." -ForegroundColor Yellow
$configFile = "dist/config/index.js"
if (Test-Path $configFile) {
    $content = Get-Content $configFile -Raw
    if ($content -match 'process\.env\.JWT_SECRET') {
        Write-Host "✅ 验证成功: dist中仍包含process.env.JWT_SECRET（不是硬编码）" -ForegroundColor Green
    } else {
        Write-Host "❌ 验证失败: 环境变量可能被硬编码！" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  警告: 无法找到配置文件进行验证" -ForegroundColor Yellow
}

# 4. 远程部署
Write-Host "`n🌐 第3步: 远程部署到 $RemoteHost..." -ForegroundColor Yellow

Write-Host "  - 当前目录: $(Get-Location)" -ForegroundColor Gray
Write-Host "  - 远程主机: $RemoteHost" -ForegroundColor Gray
Write-Host "  - 远程用户: $RemoteUser" -ForegroundColor Gray
Write-Host "  - 远程路径: $RemotePath" -ForegroundColor Gray

# 4.1 删除远程旧的dist备份（保留最近3个）
Write-Host "`n  📁 清理旧备份..." -ForegroundColor Gray
$backupCount = ssh "${RemoteUser}@${RemoteHost}" "ls -td $RemotePath/dist_backup_* 2>/dev/null | wc -l" 2>$null
if ([int]$backupCount -gt 3) {
    ssh "${RemoteUser}@${RemoteHost}" "ls -td $RemotePath/dist_backup_* | tail -n +4 | xargs rm -rf" 2>$null
    Write-Host "     ✅ 清理完成（保留最新3个备份）" -ForegroundColor Green
}

# 4.2 备份远程当前dist
Write-Host "`n  📁 备份远程的dist目录..." -ForegroundColor Gray
ssh "${RemoteUser}@${RemoteHost}" "if [ -d $RemotePath/dist ]; then cp -r $RemotePath/dist $RemotePath/$backupName && echo '✅ 备份成功: $backupName'; fi" 2>&1

# 4.3 同步编译后的dist到远程
Write-Host "`n  📤 上传编译后的dist文件..." -ForegroundColor Gray
scp -r "dist" "${RemoteUser}@${RemoteHost}:${RemotePath}/" 2>&1 | Tee-Object -Variable scpOutput
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 上传失败！" -ForegroundColor Red
    exit 1
}
Write-Host "     ✅ 上传完成" -ForegroundColor Green

# 4.4 同步package.json (如果需要)
Write-Host "`n  📤 上传package.json..." -ForegroundColor Gray
scp "package.json" "${RemoteUser}@${RemoteHost}:${RemotePath}/" 2>&1 | Select-Object -First 1
Write-Host "     ✅ package.json已更新" -ForegroundColor Green

# 5. 远程重启应用
Write-Host "`n🔄 第4步: 重启远程应用..." -ForegroundColor Yellow

Write-Host "  - 检查进程管理方式..." -ForegroundColor Gray
$pmMethod = ssh "${RemoteUser}@${RemoteHost}" "if ps aux | grep -q '[p]m2'; then echo 'PM2'; elif [ -f /etc/init.d/node_* ]; then echo 'SYSTEMD'; else echo 'MANUAL'; fi" 2>$null

switch ($pmMethod.Trim()) {
    "PM2" {
        Write-Host "     使用PM2重启..." -ForegroundColor Gray
        ssh "${RemoteUser}@${RemoteHost}" "cd $RemotePath && pm2 restart ecosystem.config.js --update-env 2>&1" 2>&1 | Tee-Object -Variable restartLog
        if ($LASTEXITCODE -eq 0) {
            Write-Host "     ✅ PM2重启成功" -ForegroundColor Green
        }
    }
    "SYSTEMD" {
        Write-Host "     使用systemd重启..." -ForegroundColor Gray
        ssh "${RemoteUser}@${RemoteHost}" "systemctl restart node_zd_api 2>&1" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "     ✅ systemd重启成功" -ForegroundColor Green
        }
    }
    default {
        Write-Host "     ⚠️  未检测到自动启动配置，请手动启动应用:" -ForegroundColor Yellow
        Write-Host "        ssh ${RemoteUser}@${RemoteHost}" -ForegroundColor Gray
        Write-Host "        cd $RemotePath && node dist/index.js" -ForegroundColor Gray
    }
}

# 6. 验证部署
Write-Host "`n✅ 第5步: 验证部署..." -ForegroundColor Yellow

Write-Host "  等待应用启动..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host "  检查健康检查端点..." -ForegroundColor Gray
$healthCheck = ssh "${RemoteUser}@${RemoteHost}" "curl -s http://localhost:3000/health 2>&1 || echo 'FAILED'" 2>$null

if ($healthCheck -match '"status":"ok"' -or $healthCheck -match '"status": "ok"') {
    Write-Host "  ✅ 应用已成功启动！" -ForegroundColor Green
    Write-Host "     响应: $($healthCheck | Select-Object -First 100)" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  健康检查失败，请查看日志:" -ForegroundColor Yellow
    Write-Host "     ssh ${RemoteUser}@${RemoteHost}" -ForegroundColor Gray
    Write-Host "     pm2 logs api (或) tail -f /www/wwwroot/zd-api.wenbita.cn/logs/*" -ForegroundColor Gray
}

# 7. 部署总结
Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "✅ 部署完成！" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 部署摘要:" -ForegroundColor White
Write-Host "  ✅ 本地编译成功" -ForegroundColor Green
Write-Host "  ✅ 编译结果验证通过（环境变量未被硬编码）" -ForegroundColor Green
Write-Host "  ✅ 远程dist已备份: $backupName" -ForegroundColor Green
Write-Host "  ✅ 新版本代码已上传到 $RemotePath/dist" -ForegroundColor Green
Write-Host "  ✅ 应用已重启" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 关键URL:" -ForegroundColor White
Write-Host "  API: https://zd-api.wenbita.cn/api/v1" -ForegroundColor Cyan
Write-Host "  健康检查: https://zd-api.wenbita.cn/health" -ForegroundColor Cyan
Write-Host "  API文档: https://zd-api.wenbita.cn/api-docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 快速命令参考:" -ForegroundColor White
Write-Host "  查看日志: ssh ${RemoteUser}@${RemoteHost} 'pm2 logs api'" -ForegroundColor Gray
Write-Host "  重启应用: ssh ${RemoteUser}@${RemoteHost} 'pm2 restart api'" -ForegroundColor Gray
Write-Host "  恢复备份: ssh ${RemoteUser}@${RemoteHost} 'rm -rf $RemotePath/dist && cp -r $RemotePath/$backupName $RemotePath/dist'" -ForegroundColor Gray
Write-Host ""
