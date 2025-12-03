# 检查API连接的数据库类型
param(
    [string]$ApiUrl = ""
)

function Write-Color {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

function Check-Database {
    # 检查本地开发环境
    Write-Color "`n========================================" "Cyan"
    Write-Color "检查本地开发环境 (localhost:3000)" "Cyan"
    Write-Color "========================================" "Cyan"

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/health/database" -TimeoutSec 3
        Write-Color "✓ 本地服务正在运行" "Green"
        Write-Color "数据库: $($response.data.database)" "Yellow"
        Write-Color "状态: $($response.data.status)" "Green"
        Write-Color "环境: 本地开发" "Blue"
    } catch {
        Write-Color "✗ 本地服务未运行" "Red"
    }

    # 检查生产服务器
    Write-Color "`n========================================" "Cyan"
    Write-Color "检查生产服务器 (zd-api.aierxin.com)" "Cyan"
    Write-Color "========================================" "Cyan"

    try {
        $response = Invoke-RestMethod -Uri "https://zd-api.aierxin.com/health/database" -TimeoutSec 5
        Write-Color "✓ 生产服务正在运行" "Green"
        Write-Color "数据库: $($response.data.database)" "Yellow"
        Write-Color "状态: $($response.data.status)" "Green"
        Write-Color "环境: 生产环境" "Red"
    } catch {
        Write-Color "✗ 生产服务无法访问" "Red"
    }

    # 检查本地生产模式
    Write-Color "`n========================================" "Cyan"
    Write-Color "检查本地生产模式 (localhost:3003)" "Cyan"
    Write-Color "========================================" "Cyan"

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3003/health/database" -TimeoutSec 3
        Write-Color "✓ 本地生产模式正在运行" "Green"
        Write-Color "数据库: $($response.data.database)" "Yellow"
        Write-Color "状态: $($response.data.status)" "Green"
        Write-Color "环境: 服务器同步模式" "Yellow"
    } catch {
        Write-Color "✗ 本地生产模式未运行" "Red"
    }

    # 环境配置检查
    Write-Color "`n========================================" "Cyan"
    Write-Color "当前环境配置文件检查" "Cyan"
    Write-Color "========================================" "Cyan"

    if (Test-Path ".env.local") {
        $content = Get-Content ".env.local"
        $nodeEnv = ($content | Where-Object { $_ -match "^NODE_ENV=" }) -split "=" | Select-Object -Last 1
        $dbHost = ($content | Where-Object { $_ -match "^DB_HOST=" }) -split "=" | Select-Object -Last 1
        $dbPort = ($content | Where-Object { $_ -match "^DB_PORT=" }) -split "=" | Select-Object -Last 1
        $dbName = ($content | Where-Object { $_ -match "^DB_NAME=" }) -split "=" | Select-Object -Last 1

        Write-Color "当前环境: $nodeEnv" "Blue"
        Write-Color "数据库地址: $dbHost`:$dbPort" "Yellow"
        Write-Color "数据库名: $dbName" "Yellow"
    } else {
        Write-Color "未找到 .env.local 配置文件" "Red"
    }

    # 提示
    Write-Color "`n========================================" "Cyan"
    Write-Color "如何切换环境" "Cyan"
    Write-Color "========================================" "Cyan"
    Write-Color "本地开发环境: npm run env:switch-local && npm run dev:local" "Gray"
    Write-Color "服务器同步环境: npm run env:switch-server && npm run dev:prod" "Gray"
}

# 执行检查
Check-Database