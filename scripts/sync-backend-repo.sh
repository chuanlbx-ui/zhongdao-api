#!/bin/bash

# 中道商城后端API自动同步脚本
# 同步服务器端代码与GitHub仓库

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# 配置
PROJECT_NAME="中道商城后端API"
# 自动检测项目路径，如果脚本在项目目录内运行则使用当前目录
if [[ -f "package.json" && -d "src" && -d "prisma" ]]; then
    PROJECT_PATH="$(pwd)"
else
    PROJECT_PATH="/d/wwwroot/zhongdao-mall"
fi
GITHUB_REPO="https://github.com/chuanlbx-ui/zhondao-mall.git"
BRANCH="main"

# 检查Git仓库状态
check_git_status() {
    log "检查Git仓库状态..."

    cd "$PROJECT_PATH"

    if [ ! -d ".git" ]; then
        log_warning "Git仓库未初始化，开始初始化..."
        git init
        git remote add origin "$GITHUB_REPO"
        git branch -M main
        log_success "Git仓库初始化完成"
    else
        log_success "Git仓库已存在"
    fi

    # 检查远程仓库地址
    local current_remote=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ -z "$current_remote" ]]; then
        log_warning "远程仓库origin不存在，添加中..."
        git remote add origin "$GITHUB_REPO"
        log_success "远程仓库origin已添加"
    elif [[ "$current_remote" != "$GITHUB_REPO" ]]; then
        log_warning "远程仓库地址不匹配，更新中..."
        git remote set-url origin "$GITHUB_REPO"
        log_success "远程仓库地址已更新"
    fi
}

# 检查本地更改
check_local_changes() {
    cd "$PROJECT_PATH"

    local has_changes=$(git status --porcelain 2>/dev/null | wc -l)
    if [ "$has_changes" -gt 0 ]; then
        log_warning "发现本地更改，准备提交..."
        return 0
    else
        log_success "没有本地更改"
        return 1
    fi
}

# 提交本地更改
commit_local_changes() {
    cd "$PROJECT_PATH"

    log "添加文件到暂存区..."
    git add .

    log "创建提交..."
    git commit -m "chore: 自动同步服务器端更改

🔄 同步内容
- 服务器端配置更新
- 生产环境优化
- 安全修复和改进
- 性能优化调整

同步时间: $(date)
服务器: $(hostname)

🤖 Generated with Auto Sync Script

Co-Authored-By: AutoSync <noreply@system>"

    if [ $? -eq 0 ]; then
        log_success "本地更改提交成功"
        return 0
    else
        log_error "本地更改提交失败"
        return 1
    fi
}

# 拉取远程更新
pull_remote_changes() {
    cd "$PROJECT_PATH"

    log "从远程仓库拉取最新更改..."

    # 先获取远程信息
    git fetch origin

    # 检查是否有新提交
    local local_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
    local remote_commit=$(git rev-parse origin/$BRANCH 2>/dev/null || echo "")

    if [[ "$local_commit" == "$remote_commit" ]]; then
        log_success "本地已是最新版本，无需拉取"
        return 0
    fi

    log "发现远程更新，开始拉取..."

    # 拉取更改
    if git pull origin $BRANCH; then
        log_success "远程更改拉取成功"

        # 检查是否有提交历史来进行差异比较
        local has_prev_commit=$(git rev-parse HEAD~1 2>/dev/null || echo "")

        if [ -n "$has_prev_commit" ]; then
            # 检查是否需要重新安装依赖
            if [ -f "package.json" ] && [ -n "$(git diff HEAD~1 HEAD --name-only package.json package-lock.json 2>/dev/null)" ]; then
                log "检测到依赖文件更改，重新安装依赖..."
                npm install
                log_success "依赖重新安装完成"
            fi

            # 检查是否需要重新生成Prisma客户端
            if [ -n "$(git diff HEAD~1 HEAD --name-only prisma/schema.prisma 2>/dev/null)" ]; then
                log "检测到数据库schema更改，重新生成客户端..."
                npm run db:generate
                log_success "Prisma客户端重新生成完成"
            fi

            # 检查是否需要重启服务
            if [ -n "$(git diff HEAD~1 HEAD --name-only src/ 2>/dev/null)" ]; then
                log_warning "检测到源代码更改，可能需要重启服务"
                pm2 restart zhongdao-mall-api || log_warning "PM2服务重启失败，请手动重启"
            fi
        else
            log "首次拉取，检查项目文件状态..."
            # 检查关键文件是否存在来决定是否需要安装依赖
            if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
                log "检测到缺少依赖，重新安装..."
                npm install
                log_success "依赖安装完成"
            fi

            # 检查是否需要生成Prisma客户端
            if [ -f "prisma/schema.prisma" ] && [ ! -d "node_modules/.prisma" ]; then
                log "检测到缺少Prisma客户端，重新生成..."
                npm run db:generate
                log_success "Prisma客户端生成完成"
            fi
        fi

        return 0
    else
        log_error "远程更改拉取失败"
        return 1
    fi
}

# 推送本地更改
push_local_changes() {
    cd "$PROJECT_PATH"

    log "推送本地更改到远程仓库..."

    if git push origin $BRANCH; then
        log_success "本地更改推送成功"
        return 0
    else
        log_error "本地更改推送失败"
        return 1
    fi
}

# 备份重要文件
backup_important_files() {
    local backup_dir="$PROJECT_PATH/backups/$(date +%Y%m%d_%H%M%S)"

    log "创建重要文件备份到 $backup_dir"

    mkdir -p "$backup_dir"

    # 备份环境配置文件
    [ -f ".env" ] && cp ".env" "$backup_dir/"
    [ -f ".env.production" ] && cp ".env.production" "$backup_dir/"

    # 备份数据库配置
    [ -f "prisma/schema.prisma" ] && cp "prisma/schema.prisma" "$backup_dir/"

    # 备份配置文件
    [ -f "tsconfig.json" ] && cp "tsconfig.json" "$backup_dir/"
    [ -f "package.json" ] && cp "package.json" "$backup_dir/"

    log_success "重要文件备份完成"
}

# 检查服务状态
check_service_status() {
    log "检查服务状态..."

    # 检查PM2进程
    if command -v pm2 &> /dev/null; then
        local api_status=$(pm2 list | grep "zhongdao-mall-api" | grep "online" | wc -l)
        if [ "$api_status" -gt 0 ]; then
            log_success "API服务运行正常"
        else
            log_warning "API服务未运行"
        fi
    fi

    # 检查端口
    if netstat -tuln | grep -q ":3000 "; then
        log_success "端口3000已被占用"
    else
        log_warning "端口3000未被占用"
    fi

    # 检查健康检查端点
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        log_success "健康检查端点响应正常"
    else
        log_warning "健康检查端点无响应"
    fi
}

# 显示Git状态摘要
show_git_summary() {
    cd "$PROJECT_PATH"

    log "Git状态摘要:"
    echo "==============================================="

    # 分支信息
    log "当前分支: $(git branch --show-current)"

    # 最后提交
    local last_commit=$(git log -1 --oneline 2>/dev/null || echo "无提交记录")
    log "最后提交: $last_commit"

    # 远程信息
    log "远程仓库: $(git remote get-url origin 2>/dev/null || echo "未配置")"

    # 状态信息
    local status_info=$(git status --short 2>/dev/null || echo "无法获取状态")
    if [ -n "$status_info" ]; then
        log "文件状态: "
        echo "$status_info"
    else
        log "文件状态: 工作区干净"
    fi

    echo "==============================================="
}

# 主函数
main() {
    log "开始同步 $PROJECT_NAME..."
    log "项目路径: $PROJECT_PATH"
    log "GitHub仓库: $GITHUB_REPO"
    log "==============================================="

    # 检查项目路径
    if [ ! -d "$PROJECT_PATH" ]; then
        log_error "项目路径不存在: $PROJECT_PATH"
        exit 1
    fi

    # 备份重要文件
    backup_important_files

    # 检查Git仓库状态
    check_git_status

    # 同步主循环
    local sync_needed=1
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ] && [ $sync_needed -eq 1 ]; do
        log "同步尝试 $attempt/$max_attempts"

        # 拉取远程更改
        if ! pull_remote_changes; then
            log_error "拉取远程更改失败，尝试 $attempt/$max_attempts"
            attempt=$((attempt + 1))
            sleep 5
            continue
        fi

        # 检查是否有本地更改需要推送
        if check_local_changes; then
            if commit_local_changes; then
                if ! push_local_changes; then
                    log_error "推送本地更改失败，尝试 $attempt/$max_attempts"
                    attempt=$((attempt + 1))
                    sleep 5
                    continue
                fi
            else
                log_error "提交本地更改失败，尝试 $attempt/$max_attempts"
                attempt=$((attempt + 1))
                sleep 5
                continue
            fi
        else
            sync_needed=0
        fi

        attempt=$((attempt + 1))
    done

    if [ $sync_needed -eq 0 ]; then
        log_success "同步完成"
    else
        log_error "同步失败，已达到最大尝试次数"
    fi

    # 显示Git状态
    show_git_summary

    # 检查服务状态
    check_service_status

    # 清理旧备份（保留最近7天）
    find "$PROJECT_PATH/backups" -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true

    log "同步任务完成！"
}

# 脚本入口
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

exit 0