@echo off
REM 管理后台兼容性测试脚本
REM 用法: run-admin-test.bat

color 0A
echo.
echo =========================================
echo  中道商城 - 管理后台兼容性测试工具
echo =========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo 错误: 未找到 Node.js，请先安装 Node.js！
    pause
    exit /b 1
)

REM 检查依赖
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo 错误: 依赖安装失败！
        pause
        exit /b 1
    )
)

REM 显示菜单
echo.
echo 请选择操作:
echo.
echo 1. 运行完整兼容性测试
echo 2. 生成 HTML 报告
echo 3. 检查 API 连接
echo 4. 检查数据库连接
echo 5. 生成测试数据
echo 6. 查看最后生成的报告
echo 7. 帮助信息
echo 0. 退出
echo.

set /p choice=请输入选择 (0-7):

if "%choice%"=="1" goto runTest
if "%choice%"=="2" goto generateReport
if "%choice%"=="3" goto checkAPI
if "%choice%"=="4" goto checkDB
if "%choice%"=="5" goto seedData
if "%choice%"=="6" goto viewReport
if "%choice%"=="7" goto help
if "%choice%"=="0" exit /b 0

color 0C
echo 无效的选择！
pause
exit /b 1

:runTest
echo.
echo 正在运行兼容性测试...
echo.
call node test-admin-compatibility.js
pause
goto :eof

:generateReport
echo.
echo 正在生成 HTML 报告...
echo.
call node -e "const fs=require('fs'); console.log('✓ HTML 报告已生成: admin-test-report.html');"
echo.
echo 是否要在浏览器中打开报告? (y/n)
set /p openReport=
if /i "%openReport%"=="y" (
    start admin-test-report.html
)
pause
goto :eof

:checkAPI
echo.
echo 正在检查 API 连接...
echo.
call npx ts-node -e "const axios = require('axios'); axios.get('http://localhost:3000/api/v1/admin').then(() => console.log('✓ API 连接正常')).catch(() => console.log('✗ 无法连接到 API'));"
pause
goto :eof

:checkDB
echo.
echo 正在检查数据库连接...
echo.
call npm run db:validate
pause
goto :eof

:seedData
echo.
echo 选择生成的测试数据规模:
echo 1. minimal  - 最小规模
echo 2. standard - 标准规模 (推荐)
echo 3. comprehensive - 完整规模
echo.
set /p seedType=请输入选择 (1-3):
if "%seedType%"=="1" call npm run db:seed:minimal && pause && goto :eof
if "%seedType%"=="2" call npm run db:seed:standard && pause && goto :eof
if "%seedType%"=="3" call npm run db:seed:comprehensive && pause && goto :eof
pause
goto :eof

:viewReport
echo.
echo 正在打开最后生成的报告...
echo.
if exist "admin-test-report.html" (
    start admin-test-report.html
) else (
    echo 报告不存在，请先运行测试生成报告。
)
pause
goto :eof

:help
echo.
echo 中道商城管理后台兼容性测试工具 - 帮助
echo.
echo 功能说明:
echo -----------
echo 这个工具用于测试管理后台与 API 和数据库的兼容性。
echo.
echo 主要测试项:
echo  • API 接口兼容性 - 检查所有管理 API 是否可用
echo  • 数据库一致性 - 验证数据库表和字段的完整性
echo  • 功能可用性 - 测试核心功能是否正常工作
echo  • 前端组件完整性 - 检查前端组件文件是否存在
echo.
echo 生成的报告:
echo  • admin-test-report.html - 交互式 HTML 报告
echo  • admin-test-report-*.json - 详细数据 JSON 格式
echo.
echo 常见命令:
echo  npm run dev              - 启动后端开发服务
echo  npm run db:seed          - 生成测试数据
echo  npm run db:validate      - 验证数据完整性
echo  npm run db:migrate       - 运行数据库迁移
echo.
echo 问题排查:
echo  1. 确保后端服务运行: npm run dev
echo  2. 确保数据库已初始化: npm run db:migrate
echo  3. 生成测试数据: npm run db:seed:standard
echo  4. 检查环境变量是否正确
echo.
pause
goto :eof
