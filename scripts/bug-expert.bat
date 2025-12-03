@echo off
chcp 65001 >nul
title 中道商城系统 BUG修复专家

echo 🔧 中道商城系统 BUG修复专家
echo ================================

echo 📍 当前环境信息：
node -v
echo Node.js版本
npm -v
echo NPM版本
echo 当前目录: %CD%
echo 环境变量: NODE_ENV=%NODE_ENV%

echo.
echo 🔍 服务状态检查：

rem 检查本地开发服务
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 本地API服务运行正常 ^端口3000^
) else (
    echo ❌ 本地API服务未运行
)

rem 检查生产环境服务
curl -s http://localhost:3003/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 生产API服务运行正常 ^端口3003^
) else (
    echo ❌ 生产API服务未运行
)

echo.
echo 🗄️ 数据库连接检查：
rem 简化的数据库检查提示
echo ℹ️ 运行 'npm run db:validate' 进行详细检查

echo.
echo 🛠️ 常用诊断命令：
echo 1. 查看应用日志:     pm2 logs zd-api
echo 2. 重启应用服务:     pm2 restart zd-api
echo 3. 检查数据库状态:   npm run db:validate
echo 4. 查看API文档:      http://localhost:3000/api-docs
echo 5. 健康检查:         curl http://localhost:3000/health

echo.
echo 📚 BUG修复专家配置文件：
echo 📄 详细说明: .ai-agents\bug-fix-expert.md

echo.
echo 请选择操作：
echo 1. 查看实时日志
echo 2. 重启所有服务
echo 3. 运行数据库诊断
echo 4. 切换到本地环境
echo 5. 切换到服务器环境
echo 6. 打开BUG修复专家文档
echo 0. 退出

set /p choice=请输入选项 (0-6):

if "%choice%"=="1" (
    echo 📋 显示实时日志...
    pm2 logs zd-api
    goto end
)

if "%choice%"=="2" (
    echo 🔄 重启所有服务...
    pm2 restart all
    goto end
)

if "%choice%"=="3" (
    echo 🔍 运行数据库诊断...
    npm run db:validate
    npm run db:stats
    goto end
)

if "%choice%"=="4" (
    echo 🏠 切换到本地环境...
    npm run env:switch-local
    echo ✅ 已切换到本地环境，请重启服务
    goto end
)

if "%choice%"=="5" (
    echo ☁️ 切换到服务器环境...
    npm run env:switch-server
    echo ✅ 已切换到服务器环境，请重启服务
    goto end
)

if "%choice%"=="6" (
    echo 📖 打开BUG修复专家文档...
    if exist "C:\Program Files\Microsoft VS Code\Code.exe" (
        "C:\Program Files\Microsoft VS Code\Code.exe" .ai-agents\bug-fix-expert.md
    ) else if exist "C:\Program Files (x86)\Notepad++\notepad++.exe" (
        "C:\Program Files (x86)\Notepad++\notepad++.exe" .ai-agents\bug-fix-expert.md
    ) else (
        notepad .ai-agents\bug-fix-expert.md
    )
    goto end
)

if "%choice%"=="0" (
    echo 👋 退出
    exit /b 0
)

echo ❌ 无效选项

:end
echo.
echo ✅ 操作完成！
pause