@echo off
REM Windows批处理脚本 - 远程部署

setlocal enabledelayedexpansion

set HOST=162.14.114.224
set USER=root
set API_PATH=/www/wwwroot/zd-api.wenbita.cn

echo.
echo ===============================================
echo.
echo 🚀 开始远程部署中道商城系统...
echo.
echo ===============================================
echo.

REM 第1步：检查SSH工具
where ssh >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 未找到SSH工具，请先安装Git Bash或Windows Subsystem for Linux
    pause
    exit /b 1
)
echo ✅ SSH工具已找到

REM 第2步：上传配置文件
echo.
echo 📤 上传配置文件到服务器...
scp -O -o ConnectTimeout=10 -o StrictHostKeyChecking=no ecosystem.config.js %USER%@%HOST%:%API_PATH%/
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 配置文件上传失败
    pause
    exit /b 1
)
echo ✅ ecosystem.config.js 已上传

scp -O -o ConnectTimeout=10 -o StrictHostKeyChecking=no scripts\deploy-to-server.sh %USER%@%HOST%:%API_PATH%/
scp -O -o ConnectTimeout=10 -o StrictHostKeyChecking=no scripts\check-deploy.sh %USER%@%HOST%:%API_PATH%/
echo ✅ 脚本文件已上传

REM 第3步：在服务器上执行部署
echo.
echo ⚙️  在服务器上执行部署脚本...
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no %USER%@%HOST% ^
    "export HOME=/root && cd %API_PATH% && bash deploy-to-server.sh"

if %ERRORLEVEL% NEQ 0 (
    echo ❌ 部署失败
    pause
    exit /b 1
)

echo.
echo =========================================
echo ✨ 远程部署完成！
echo =========================================
echo.
echo 📍 常用命令:
echo    pm2 status      - 查看进程状态
echo    pm2 logs zd-api - 查看API日志
echo    pm2 restart zd-api - 重启服务
echo.
echo 🌐 服务地址:
echo    API服务: https://zd-api.wenbita.cn
echo    H5前端: https://zd-h5.wenbita.cn
echo    管理后台: https://zd-admin.wenbita.cn
echo.

pause
