@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo 中道商城API系统稳定性验证脚本
echo ============================================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Node.js未安装或未添加到PATH
    echo 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

:: 显示Node.js版本
echo [信息] Node.js版本:
node --version
echo.

:: 检查API服务器是否运行
echo [检查] 验证API服务器状态...
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] API服务器未运行或不可访问
    echo.
    echo 尝试启动API服务器...
    start "API Server" cmd /k "npm run dev"
    echo.
    echo 等待服务器启动...
    timeout /t 10 /nobreak >nul

    :: 再次检查
    curl -s http://localhost:3000/health >nul 2>&1
    if %errorlevel% neq 0 (
        echo [错误] 无法连接到API服务器
        echo 请确保服务器在 http://localhost:3000 运行
        pause
        exit /b 1
    )
)

echo [成功] API服务器运行正常
echo.

:: 运行快速稳定性测试
echo ============================================================
echo 执行快速稳定性测试...
echo ============================================================
echo.

node quick-stability-test.js

if %errorlevel% equ 0 (
    echo.
    echo ============================================================
    echo [成功] 稳定性测试通过！
    echo ============================================================
    echo.
    echo 报告文件:
    echo   - quick-stability-report.json
    echo   - quick-stability-report.html
    echo.
    choice /c YN /m "是否打开HTML报告？"
    if !errorlevel! equ 1 (
        start quick-stability-report.html
    )
) else (
    echo.
    echo ============================================================
    echo [警告] 稳定性测试未完全通过
    echo ============================================================
    echo.
    echo 请查看测试结果并优化系统性能
    echo.
    pause
)

:: 询问是否运行完整测试
echo.
choice /c YN /m "是否运行完整的性能基准测试？"
if !errorlevel! equ 1 (
    echo.
    echo ============================================================
    echo 执行性能基准测试...
    echo ============================================================
    echo.

    :: 检查TypeScript
    where tsc >nul 2>&1
    if %errorlevel% neq 0 (
        echo [信息] 安装TypeScript...
        npm install -g typescript
    )

    :: 编译并运行
    npx tsc performance-benchmark.ts --target es2020 --module commonjs --esModuleInterop true
    node performance-benchmark.js
)

echo.
echo ============================================================
echo 测试完成
echo ============================================================
pause