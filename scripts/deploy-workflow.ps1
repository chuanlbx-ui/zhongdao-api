# 完整的开发到部署工作流脚本 (PowerShell版本)
# 流程: 本地开发 -> Git提交 -> 服务器部署

param(
    [string]$Step = "all"
)

# 颜色配置
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    White = "White"
}

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Colors.Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ 错误: $Message" -ForegroundColor $Colors.Red
    exit 1
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Colors.Yellow
}

# ===========================================
# 配置信息
# ===========================================
$Config = @{
    ServerIP = "220.163.107.50"
    ServerUser = "root"
    ServerPath = "/www/wwwroot/zd-api.aierxin.com"
    ApiDomain = "https://zd-api.aierxin.com"
    GitRepo = "https://github.com/chuanlbx-ui/zd-api.aierxin.com.git"
}

# ===========================================
# 显示使用说明
# ===========================================
function Show-Usage {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $Colors.White
    Write-Host "🚀 中道商城部署工作流" -ForegroundColor $Colors.White
    Write-Host "========================================" -ForegroundColor $Colors.White
    Write-Host ""
    Write-Host "使用方法:"
    Write-Host "  .\deploy-workflow.ps1 [步骤]"
    Write-Host ""
    Write-Host "可选步骤:"
    Write-Host "  all               - 执行完整流程（默认）"
    Write-Host "  commit            - 仅提交代码到Git"
    Write-Host "  deploy            - 仅部署到服务器"
    Write-Host "  status            - 查看当前状态"
    Write-Host "  setup             - 初始化设置"
    Write-Host ""
    Write-Host "完整流程包括:"
    Write-Host "  1. 切换到服务器同步环境"
    Write-Host "  2. 编译代码"
    Write-Host "  3. 提交到Git仓库"
    Write-Host "  4. 部署到生产服务器"
    Write-Host "  5. 验证部署结果"
    Write-Host ""
}

# ===========================================
# 检查Git状态
# ===========================================
function Check-GitStatus {
    Write-Log "检查Git状态..."

    # 检查是否有未提交的更改
    $status = git status --porcelain
    if ($status) {
        Write-Log "发现未提交的更改:"
        Write-Host $status
        Write-Host ""
        $confirm = Read-Host "是否继续？(y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Log "操作已取消"
            exit 0
        }
    }
}

# ===========================================
# 提交代码到Git
# ===========================================
function Commit-ToGit {
    Write-Log "准备提交代码到Git仓库..."

    # 确保在主分支
    $currentBranch = git rev-parse --abbrev-ref HEAD
    if ($currentBranch -ne "main") {
        Write-Log "切换到main分支..."
        try {
            git checkout main
        } catch {
            git checkout -b main
        }
    }

    # 拉取最新代码
    Write-Log "拉取最新代码..."
    git pull origin main 2>$null

    # 添加所有更改
    Write-Log "添加文件到暂存区..."
    git add .

    # 检查是否有内容需要提交
    $cachedChanges = git diff --cached --name-only
    if (-not $cachedChanges) {
        Write-Log "没有需要提交的更改"
        return
    }

    # 获取提交信息
    Write-Host ""
    $commitMsg = Read-Host "请输入提交信息（默认：更新代码）"
    if (-not $commitMsg) {
        $commitMsg = "更新代码 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }

    # 提交代码
    Write-Log "提交代码..."
    git commit -m $commitMsg

    # 推送到远程仓库
    Write-Log "推送到远程仓库..."
    git push origin main

    Write-Success "代码已成功提交到Git仓库"
    Write-Host "📝 查看仓库: $($Config.GitRepo)"
}

# ===========================================
# 部署到服务器
# ===========================================
function Deploy-ToServer {
    Write-Log "准备部署到生产服务器..."

    # 切换到服务器同步环境
    Write-Log "切换到服务器同步环境..."
    npm run env:switch-server

    # 编译代码
    Write-Log "编译TypeScript代码..."
    $buildProcess = Start-Process -FilePath "npm" -ArgumentList "run", "build" -NoNewWindow -PassThru -Wait
    if ($buildProcess.ExitCode -ne 0) {
        Write-Error "编译失败"
    }

    # 创建临时目录
    $tempDir = ".\temp-deploy-$(Get-Date -UFormat %s)"
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

    # 准备部署文件
    Write-Log "准备部署文件..."
    Copy-Item -Recurse -Force .\dist $tempDir\ -ErrorAction Stop
    Copy-Item -Force .\package.json $tempDir\ -ErrorAction Stop
    Copy-Item -Force .\package-lock.json $tempDir\ -ErrorAction Stop
    Copy-Item -Force .\.env.server-sync $tempDir\.env.production -ErrorAction Stop
    if (Test-Path .\ecosystem.config.js) {
        Copy-Item -Force .\ecosystem.config.js $tempDir\ -ErrorAction Stop
    }

    # 压缩文件
    Write-Log "压缩部署文件..."
    Set-Location $tempDir
    $compressResult = tar -czf "..\deploy-to-server.tar.gz" *
    Set-Location ..
    if ($LASTEXITCODE -ne 0) {
        Write-Error "压缩失败"
    }
    Write-Success "文件压缩完成"

    # 上传到服务器
    Write-Log "上传文件到服务器..."
    $uploadProcess = Start-Process -FilePath "scp" -ArgumentList "-o", "StrictHostKeyChecking=no", "deploy-to-server.tar.gz", "$($Config.ServerUser)@$($Config.ServerIP):/tmp/" -NoNewWindow -PassThru -Wait
    if ($uploadProcess.ExitCode -ne 0) {
        Write-Error "上传失败"
    }
    Write-Success "文件上传完成"

    # 创建部署命令脚本
    $deployCommands = @"
set -e
cd $($Config.ServerPath)

# 备份当前版本
if [ -d "dist" ]; then
    echo "备份当前版本..."
    mv dist dist.backup.`date +%Y%m%d_%H%M%S`
fi

# 解压新版本
echo "解压新版本..."
cd /tmp
tar -xzf deploy-to-server.tar.gz
cp -r dist $($Config.ServerPath)/
cp package.json $($Config.ServerPath)/
cp .env.production $($Config.ServerPath)/
if [ -f "ecosystem.config.js" ]; then
    cp ecosystem.config.js $($Config.ServerPath)/
fi

# 返回部署目录
cd $($Config.ServerPath)

# 安装依赖
echo "安装依赖..."
npm ci --only=production

# 停止现有服务
echo "停止现有服务..."
pm2 stop zd-api 2>/dev/null || true
pm2 delete zd-api 2>/dev/null || true

# 启动新服务
echo "启动新服务..."
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js --env production
else
    pm2 start dist/index.js --name zd-api --env production
fi

# 保存PM2配置
pm2 save

# 等待服务启动
sleep 5

# 检查服务状态
echo "检查服务状态..."
pm2 list

# 清理临时文件
rm -f /tmp/deploy-to-server.tar.gz
rm -rf /tmp/dist
echo "部署完成"
"@

    # 通过SSH执行部署命令
    Write-Log "在服务器上执行部署..."
    $deployCommands | ssh -o StrictHostKeyChecking=no $($Config.ServerUser)@$($Config.ServerIP) "bash -s"

    if ($LASTEXITCODE -eq 0) {
        Write-Success "服务器部署完成"
    } else {
        Write-Error "服务器部署失败"
    }

    # 清理本地临时文件
    Write-Log "清理本地临时文件..."
    Remove-Item -Force deploy-to-server.tar.gz -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

    Write-Success "部署成功完成"
}

# ===========================================
# 验证部署
# ===========================================
function Verify-Deployment {
    Write-Log "验证部署结果..."
    Start-Sleep -Seconds 5

    # 检查API是否可访问
    try {
        $response = Invoke-WebRequest -Uri "$($Config.ApiDomain)/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "API服务正常运行"
            Write-Host ""
            Write-Host "🌐 服务地址: $($Config.ApiDomain)"
            Write-Host "📖 API文档: $($Config.ApiDomain)/api-docs"
            Write-Host "📊 健康检查: $($Config.ApiDomain)/health"
        }
    } catch {
        Write-Warning "API服务可能未就绪，请检查服务器日志"
        Write-Host "查看日志命令: ssh $($Config.ServerUser)@$($Config.ServerIP) 'pm2 logs zd-api --lines 50'"
    }
}

# ===========================================
# 查看状态
# ===========================================
function Show-Status {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $Colors.White
    Write-Host "📊 当前状态" -ForegroundColor $Colors.White
    Write-Host "========================================" -ForegroundColor $Colors.White
    Write-Host ""

    # Git状态
    Write-Host "🔍 Git状态:" -ForegroundColor $Colors.White
    try {
        $remoteUrl = git config --get remote.origin.url
        Write-Host "  远程仓库: $remoteUrl"
        $currentBranch = git rev-parse --abbrev-ref HEAD
        Write-Host "  当前分支: $currentBranch"
        $lastCommit = git log -1 --oneline 2>$null
        if ($lastCommit) {
            Write-Host "  最新提交: $lastCommit"
        } else {
            Write-Host "  最新提交: （无提交记录）"
        }
    } catch {
        Write-Host "  Git状态：未初始化或错误"
    }
    Write-Host ""

    # 环境状态
    Write-Host "🌍 环境状态:" -ForegroundColor $Colors.White
    if (Test-Path .env.local) {
        $envContent = Get-Content .env.local | Where-Object { $_ -match "^NODE_ENV=" }
        if ($envContent) {
            $nodeEnv = ($envContent -split "=")[1]
            Write-Host "  当前环境: $nodeEnv"
        }
        try {
            $dbHost = (Select-String -Path .env.local -Pattern "^DB_HOST=" -ErrorAction SilentlyContinue).Line -split "=" | Select-Object -Last 1
            $dbPort = (Select-String -Path .env.local -Pattern "^DB_PORT=" -ErrorAction SilentlyContinue).Line -split "=" | Select-Object -Last 1
            if ($dbHost -and $dbPort) {
                Write-Host "  数据库: $dbHost`:$dbPort"
            }
        } catch {
            Write-Host "  数据库: 未配置"
        }
    } else {
        Write-Host "  未配置环境文件"
    }
    Write-Host ""

    # 服务器状态
    Write-Host "🖥️  服务器状态:" -ForegroundColor $Colors.White
    Write-Host "  API地址: $($Config.ApiDomain)"
    try {
        $response = Invoke-WebRequest -Uri "$($Config.ApiDomain)/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "  服务状态: ✅ 正常运行"
        }
    } catch {
        Write-Host "  服务状态: ❌ 无法访问"
    }
}

# ===========================================
# 初始化设置
# ===========================================
function Setup-Project {
    Write-Log "初始化项目设置..."

    # 初始化Git仓库（如果需要）
    if (-not (Test-Path .git)) {
        Write-Log "初始化Git仓库..."
        git init
        git remote add origin $Config.GitRepo
    }

    # 创建.gitignore（如果不存在）
    if (-not (Test-Path .gitignore)) {
        Write-Log "创建.gitignore文件..."
        if (Test-Path .gitignore.example) {
            Copy-Item .gitignore.example .gitignore
        }
    }

    # 检查是否有提交
    try {
        git rev-parse --verify HEAD 2>$null | Out-Null
    } catch {
        Write-Log "创建首次提交..."
        git add .
        git commit -m "Initial commit: 项目初始化"
        try {
            git push -u origin main
        } catch {
            Write-Log "（请手动推送首次提交）"
        }
    }

    Write-Success "初始化完成"
}

# ===========================================
# 主函数
# ===========================================
function Main {
    switch ($Step.ToLower()) {
        "all" {
            Show-Usage
            Write-Host ""
            $confirm = Read-Host "确认执行完整部署流程？(y/N)"
            if ($confirm -ne "y" -and $confirm -ne "Y") {
                Write-Log "操作已取消"
                exit 0
            }
            Check-GitStatus
            Commit-ToGit
            Deploy-ToServer
            Verify-Deployment
        }
        "commit" {
            Commit-ToGit
        }
        "deploy" {
            Deploy-ToServer
            Verify-Deployment
        }
        "status" {
            Show-Status
        }
        "setup" {
            Setup-Project
        }
        "help" {
            Show-Usage
        }
        default {
            Write-Error "未知命令: $Step。使用 'help' 查看使用说明"
        }
    }
}

# 执行主函数
Main