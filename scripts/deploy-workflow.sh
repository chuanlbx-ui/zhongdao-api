#!/bin/bash
# 完整的开发到部署工作流脚本
# 流程: 本地开发 -> Git提交 -> 服务器部署

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ 错误: $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# ===========================================
# 配置信息
# ===========================================
SERVER_IP="220.163.107.50"
SERVER_USER="root"
SERVER_PATH="/www/wwwroot/zd-api.aierxin.com"
API_DOMAIN="https://zd-api.aierxin.com"
GIT_REPO="https://github.com/chuanlbx-ui/zd-api.aierxin.com.git"

# ===========================================
# 显示使用说明
# ===========================================
show_usage() {
    echo ""
    echo "========================================"
    echo "🚀 中道商城部署工作流"
    echo "========================================"
    echo ""
    echo "使用方法:"
    echo "  $0 [步骤]"
    echo ""
    echo "可选步骤:"
    echo "  all               - 执行完整流程（默认）"
    echo "  commit            - 仅提交代码到Git"
    echo "  deploy            - 仅部署到服务器"
    echo "  status            - 查看当前状态"
    echo "  setup             - 初始化设置"
    echo ""
    echo "完整流程包括:"
    echo "  1. 切换到服务器同步环境"
    echo "  2. 编译代码"
    echo "  3. 提交到Git仓库"
    echo "  4. 部署到生产服务器"
    echo "  5. 验证部署结果"
    echo ""
}

# ===========================================
# 检查Git状态
# ===========================================
check_git_status() {
    log "检查Git状态..."

    # 检查是否有未提交的更改
    if [[ -n $(git status --porcelain) ]]; then
        log "发现未提交的更改:"
        git status --short
        echo ""
        read -p "是否继续？(y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            log "操作已取消"
            exit 0
        fi
    fi
}

# ===========================================
# 提交代码到Git
# ===========================================
commit_to_git() {
    log "准备提交代码到Git仓库..."

    # 确保在主分支
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$current_branch" != "main" ]; then
        log "切换到main分支..."
        git checkout main || git checkout -b main
    fi

    # 拉取最新代码
    log "拉取最新代码..."
    git pull origin main || log "（首次提交，忽略pull错误）"

    # 添加所有更改
    log "添加文件到暂存区..."
    git add .

    # 检查是否有内容需要提交
    if git diff --cached --quiet; then
        log "没有需要提交的更改"
        return
    fi

    # 获取提交信息
    echo ""
    read -p "请输入提交信息（默认：更新代码）: " commit_msg
    if [ -z "$commit_msg" ]; then
        commit_msg="更新代码 - $(date +'%Y-%m-%d %H:%M:%S')"
    fi

    # 提交代码
    log "提交代码..."
    git commit -m "$commit_msg"

    # 推送到远程仓库
    log "推送到远程仓库..."
    git push origin main

    success "代码已成功提交到Git仓库"
    echo "📝 查看仓库: $GIT_REPO"
}

# ===========================================
# 部署到服务器
# ===========================================
deploy_to_server() {
    log "准备部署到生产服务器..."

    # 切换到服务器同步环境
    log "切换到服务器同步环境..."
    npm run env:switch-server

    # 编译代码
    log "编译TypeScript代码..."
    npm run build || error "编译失败"

    # 创建临时目录
    TEMP_DIR="./temp-deploy-$(date +%s)"
    mkdir -p "$TEMP_DIR"

    # 准备部署文件
    log "准备部署文件..."
    cp -r dist "$TEMP_DIR/"
    cp package.json "$TEMP_DIR/"
    cp package-lock.json "$TEMP_DIR/"
    cp .env.server-sync "$TEMP_DIR/.env.production"
    cp ecosystem.config.js "$TEMP_DIR/" 2>/dev/null || true

    # 压缩文件
    log "压缩部署文件..."
    cd "$TEMP_DIR"
    tar -czf "../deploy-to-server.tar.gz" .
    cd ..
    success "文件压缩完成"

    # 上传到服务器
    log "上传文件到服务器..."
    scp -o StrictHostKeyChecking=no deploy-to-server.tar.gz $SERVER_USER@$SERVER_IP:/tmp/ || error "上传失败"
    success "文件上传完成"

    # 在服务器上执行部署
    log "在服务器上执行部署..."
    ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << 'EOF'
set -e

# 进入部署目录
cd /www/wwwroot/zd-api.aierxin.com

# 备份当前版本
if [ -d "dist" ]; then
    echo "备份当前版本..."
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# 解压新版本
echo "解压新版本..."
cd /tmp
tar -xzf deploy-to-server.tar.gz
cp -r dist /www/wwwroot/zd-api.aierxin.com/
cp package.json /www/wwwroot/zd-api.aierxin.com/
cp .env.production /www/wwwroot/zd-api.aierxin.com/
if [ -f "ecosystem.config.js" ]; then
    cp ecosystem.config.js /www/wwwroot/zd-api.aierxin.com/
fi

# 返回部署目录
cd /www/wwwroot/zd-api.aierxin.com

# 安装依赖（仅生产依赖）
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

EOF

    if [ $? -eq 0 ]; then
        success "服务器部署完成"
    else
        error "服务器部署失败"
    fi

    # 清理本地临时文件
    log "清理本地临时文件..."
    rm -f deploy-to-server.tar.gz
    rm -rf "$TEMP_DIR"

    success "部署成功完成"
}

# ===========================================
# 验证部署
# ===========================================
verify_deployment() {
    log "验证部署结果..."
    sleep 5

    # 检查API是否可访问
    if curl -s "$API_DOMAIN/health" > /dev/null 2>&1; then
        success "API服务正常运行"
        echo ""
        echo "🌐 服务地址: $API_DOMAIN"
        echo "📖 API文档: $API_DOMAIN/api-docs"
        echo "📊 健康检查: $API_DOMAIN/health"
    else
        warning "API服务可能未就绪，请检查服务器日志"
        echo "查看日志命令: ssh $SERVER_USER@$SERVER_IP 'pm2 logs zd-api'"
    fi
}

# ===========================================
# 查看状态
# ===========================================
show_status() {
    echo ""
    echo "========================================"
    echo "📊 当前状态"
    echo "========================================"
    echo ""

    # Git状态
    echo "🔍 Git状态:"
    echo "  远程仓库: $(git config --get remote.origin.url)"
    echo "  当前分支: $(git rev-parse --abbrev-ref HEAD)"
    echo "  最新提交: $(git log -1 --oneline 2>/dev/null || echo '（无提交记录）')"
    echo ""

    # 环境状态
    echo "🌍 环境状态:"
    if [ -f ".env.local" ]; then
        echo "  当前环境: $(grep NODE_ENV .env.local | cut -d'=' -f2 || echo 'unknown')"
        echo "  数据库: $(grep DB_HOST .env.local | cut -d'=' -f2):$(grep DB_PORT .env.local | cut -d'=' -f2)"
    else
        echo "  未配置环境文件"
    fi
    echo ""

    # 服务器状态
    echo "🖥️  服务器状态:"
    echo "  API地址: $API_DOMAIN"
    if curl -s "$API_DOMAIN/health" > /dev/null 2>&1; then
        echo "  服务状态: ✅ 正常运行"
    else
        echo "  服务状态: ❌ 无法访问"
    fi
}

# ===========================================
# 初始化设置
# ===========================================
setup_project() {
    log "初始化项目设置..."

    # 初始化Git仓库（如果需要）
    if [ ! -d ".git" ]; then
        log "初始化Git仓库..."
        git init
        git remote add origin $GIT_REPO
    fi

    # 创建.gitignore（如果不存在）
    if [ ! -f ".gitignore" ]; then
        log "创建.gitignore文件..."
        cp .gitignore.example .gitignore 2>/dev/null || true
    fi

    # 首次提交
    if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
        log "创建首次提交..."
        git add .
        git commit -m "Initial commit: 项目初始化"
        git push -u origin main || log "（请手动推送首次提交）"
    fi

    success "初始化完成"
}

# ===========================================
# 主函数
# ===========================================
main() {
    # 解析命令行参数
    case "${1:-all}" in
        "all")
            show_usage
            echo ""
            read -p "确认执行完整部署流程？(y/N): " confirm
            if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
                log "操作已取消"
                exit 0
            fi
            check_git_status
            commit_to_git
            deploy_to_server
            verify_deployment
            ;;
        "commit")
            commit_to_git
            ;;
        "deploy")
            deploy_to_server
            verify_deployment
            ;;
        "status")
            show_status
            ;;
        "setup")
            setup_project
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            error "未知命令: $1。使用 'help' 查看使用说明"
            ;;
    esac
}

# 执行主函数
main "$@"