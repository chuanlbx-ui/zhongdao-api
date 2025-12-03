# 简化版部署脚本 (PowerShell)

param(
    [string]$Step = "all"
)

# 颜色配置
function Write-ColorOutput($Message, $Color = "White") {
    Write-Host $Message -ForegroundColor $Color
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
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "中道商城部署工具" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput ""
    Write-ColorOutput "使用方法:" "Yellow"
    Write-ColorOutput "  .\deploy-simple.ps1 [步骤]"
    Write-ColorOutput ""
    Write-ColorOutput "可选步骤:" "Yellow"
    Write-ColorOutput "  commit    - 仅提交代码到Git"
    Write-ColorOutput "  deploy    - 仅部署到服务器"
    Write-ColorOutput "  status    - 查看当前状态"
    Write-ColorOutput "  all       - 执行完整流程（默认）"
    Write-ColorOutput ""
}

# ===========================================
# 提交代码到Git
# ===========================================
function Commit-ToGit {
    Write-ColorOutput "[INFO] 准备提交代码到Git仓库..." "Blue"

    # 检查是否有更改
    $status = git status --porcelain
    if (-not $status) {
        Write-ColorOutput "[INFO] 没有需要提交的更改" "Yellow"
        return
    }

    Write-ColorOutput "[INFO] 发现以下更改:" "Yellow"
    Write-Host $status

    # 添加所有更改
    git add .

    # 获取提交信息
    Write-Host ""
    $commitMsg = Read-Host "请输入提交信息（默认：更新代码）"
    if (-not $commitMsg) {
        $commitMsg = "更新代码 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }

    # 提交并推送
    git commit -m $commitMsg
    git push origin main

    Write-ColorOutput "[SUCCESS] 代码已成功提交到Git仓库" "Green"
    Write-ColorOutput "[INFO] 仓库地址: $($Config.GitRepo)" "Blue"
}

# ===========================================
# 部署到服务器
# ===========================================
function Deploy-ToServer {
    Write-ColorOutput "[INFO] 准备部署到生产服务器..." "Blue"

    # 切换环境
    Write-ColorOutput "[INFO] 切换到服务器同步环境..." "Blue"
    npm run env:switch-server

    # 编译代码
    Write-ColorOutput "[INFO] 编译TypeScript代码..." "Blue"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "[ERROR] 编译失败" "Red"
        exit 1
    }

    # 使用现有的同步脚本
    Write-ColorOutput "[INFO] 执行服务器同步..." "Blue"
    npm run sync:server

    Write-ColorOutput "[SUCCESS] 部署完成" "Green"
}

# ===========================================
# 验证部署
# ===========================================
function Verify-Deployment {
    Write-ColorOutput "[INFO] 验证部署结果..." "Blue"
    Start-Sleep -Seconds 5

    try {
        $response = Invoke-WebRequest -Uri "$($Config.ApiDomain)/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "[SUCCESS] API服务正常运行" "Green"
            Write-ColorOutput "[INFO] 服务地址: $($Config.ApiDomain)" "Blue"
            Write-ColorOutput "[INFO] API文档: $($Config.ApiDomain)/api-docs" "Blue"
        }
    } catch {
        Write-ColorOutput "[WARNING] API服务可能未就绪" "Yellow"
        Write-ColorOutput "[INFO] 请手动检查服务器状态" "Blue"
    }
}

# ===========================================
# 查看状态
# ===========================================
function Show-Status {
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "当前状态" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput ""

    # Git状态
    Write-ColorOutput "Git状态:" "Yellow"
    try {
        $remoteUrl = git config --get remote.origin.url
        Write-Host "  远程仓库: $remoteUrl"
        $currentBranch = git rev-parse --abbrev-ref HEAD
        Write-Host "  当前分支: $currentBranch"
        $status = git status --porcelain
        if ($status) {
            Write-Host "  状态: 有未提交的更改" -ForegroundColor Red
        } else {
            Write-Host "  状态: 工作区干净" -ForegroundColor Green
        }
    } catch {
        Write-Host "  Git状态: 未初始化或错误" -ForegroundColor Red
    }

    Write-ColorOutput ""
    Write-ColorOutput "环境状态:" "Yellow"
    if (Test-Path .env.local) {
        $nodeEnv = (Select-String -Path .env.local -Pattern "^NODE_ENV=" -ErrorAction SilentlyContinue)
        if ($nodeEnv) {
            Write-Host "  当前环境: $($nodeEnv.Line)"
        }
    } else {
        Write-Host "  未配置环境文件"
    }

    Write-ColorOutput ""
    Write-ColorOutput "服务器状态:" "Yellow"
    Write-Host "  API地址: $($Config.ApiDomain)"
    try {
        $response = Invoke-WebRequest -Uri "$($Config.ApiDomain)/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "  服务状态: 正常运行" -ForegroundColor Green
        }
    } catch {
        Write-Host "  服务状态: 无法访问" -ForegroundColor Red
    }
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
                Write-ColorOutput "[INFO] 操作已取消" "Yellow"
                exit 0
            }
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
        "help" {
            Show-Usage
        }
        default {
            Write-ColorOutput "[ERROR] 未知命令: $Step。使用 'help' 查看使用说明" "Red"
        }
    }
}

# 执行主函数
Main