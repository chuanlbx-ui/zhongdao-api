#!/usr/bin/env powershell
# 远程部署脚本 (PowerShell)

param(
    [string]$Host = "162.14.114.224",
    [string]$User = "root",
    [string]$ApiPath = "/www/wwwroot/zd-api.wenbita.cn"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 开始远程部署中道商城系统..." -ForegroundColor Cyan
Write-Host ""

# 第1步：上传ecosystem.config.js
Write-Host "📤 上传配置文件到服务器..." -ForegroundColor Blue
scp -O -o ConnectTimeout=10 -o StrictHostKeyChecking=no ecosystem.config.js ${User}@${Host}:${ApiPath}/
scp -O -o ConnectTimeout=10 -o StrictHostKeyChecking=no scripts/deploy-to-server.sh ${User}@${Host}:${ApiPath}/
scp -O -o ConnectTimeout=10 -o StrictHostKeyChecking=no scripts/check-deploy.sh ${User}@${Host}:${ApiPath}/
Write-Host "✅ 配置文件已上传" -ForegroundColor Green
Write-Host ""

# 第2步：在服务器上执行部署脚本
Write-Host "⚙️  在服务器上执行部署脚本..." -ForegroundColor Blue
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${User}@${Host} @"
export HOME=/root
cd ${ApiPath}
bash deploy-to-server.sh
"@

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✨ 远程部署完成！" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 常用命令:" -ForegroundColor Yellow
Write-Host "  npm run remote:status      - 查看部署状态"
Write-Host "  npm run remote:logs        - 查看实时日志"
Write-Host "  npm run remote:restart     - 重启API服务"
Write-Host ""
Write-Host "🌐 服务地址:" -ForegroundColor Yellow
Write-Host "  API服务: https://zd-api.wenbita.cn"
Write-Host "  H5前端: https://zd-h5.wenbita.cn"
Write-Host "  管理后台: https://zd-admin.wenbita.cn"
Write-Host ""
