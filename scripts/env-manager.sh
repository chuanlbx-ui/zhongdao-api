#!/bin/bash
# 环境管理脚本 - 一键切换开发/测试/生产环境

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "中道商城环境管理工具"
    echo ""
    echo "用法: $0 [命令] [参数]"
    echo ""
    echo "命令:"
    echo "  switch <env>     切换到指定环境"
    echo "  status           显示当前环境状态"
    echo "  init <env>       初始化指定环境"
    echo "  backup <env>     备份指定环境"
    echo "  restore <env>    恢复指定环境"
    echo "  sync <src> <dst> 同步环境数据"
    echo "  help             显示此帮助信息"
    echo ""
    echo "环境:"
    echo "  dev, development  开发环境"
    echo "  test, testing    测试环境"
    echo "  staging          预发布环境"
    echo "  prod, production 生产环境"
    echo ""
    echo "示例:"
    echo "  $0 switch dev        # 切换到开发环境"
    echo "  $0 status             # 查看当前状态"
    echo "  $0 sync prod dev      # 同步生产数据到开发环境"
}

# 获取环境名称
get_env_name() {
    case $1 in
        dev|development) echo "development" ;;
        test|testing) echo "testing" ;;
        staging) echo "staging" ;;
        prod|production) echo "production" ;;
        *) echo "unknown" ;;
    esac
}

# 检查环境是否存在
check_env_exists() {
    local env_name=$(get_env_name $1)
    if [[ "$env_name" == "unknown" ]]; then
        log_error "未知的环境: $1"
        return 1
    fi

    if [[ ! -f ".env.$env_name" ]]; then
        log_error "环境配置文件不存在: .env.$env_name"
        return 1
    fi

    return 0
}

# 停止当前环境服务
stop_current_services() {
    log_info "停止当前环境服务..."

    # 停止Node.js进程
    if pgrep -f "node.*app.ts" > /dev/null; then
        pkill -f "node.*app.ts"
        log_success "Node.js服务已停止"
    fi

    # 停止Docker服务
    if command -v docker-compose &> /dev/null; then
        docker-compose down 2>/dev/null || true
        log_success "Docker服务已停止"
    fi
}

# 启动环境服务
start_services() {
    local env_name=$(get_env_name $1)
    log_info "启动 $env_name 环境服务..."

    # 导出环境变量
    export NODE_ENV=$env_name
    if [[ -f ".env.$env_name" ]]; then
        set -a
        source .env.$env_name
        set +a
    fi

    case $env_name in
        development)
            # 启动开发环境
            log_info "启动开发数据库服务..."
            docker-compose -f docker-compose.dev.yml up -d mysql redis

            log_info "等待数据库启动..."
            sleep 10

            log_info "启动开发服务器..."
            npm run dev &
            ;;
        testing|staging)
            # 启动测试/预发布环境
            log_info "启动 $env_name 环境..."
            docker-compose -f docker-compose.staging.yml up -d --build
            ;;
        production)
            # 启动生产环境
            log_warning "即将启动生产环境"
            read -p "确认继续？(y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker-compose -f docker-compose.prod.yml up -d --build
            else
                log_info "已取消启动"
                return 1
            fi
            ;;
    esac

    log_success "服务启动完成"
}

# 执行健康检查
health_check() {
    local env_name=$(get_env_name $1)
    log_info "执行健康检查..."

    local max_attempts=30
    local attempt=1
    local port=3000

    # 根据环境调整端口
    case $env_name in
        development) port=3000 ;;
        testing) port=3001 ;;
        staging) port=3002 ;;
        production) port=3000 ;;
    esac

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:$port/health > /dev/null 2>&1; then
            log_success "健康检查通过 ($port端口)"
            return 0
        fi

        log_info "等待服务启动... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done

    log_error "健康检查失败"
    return 1
}

# 切换环境
switch_environment() {
    local target_env=$(get_env_name $1)

    if ! check_env_exists $target_env; then
        return 1
    fi

    log_info "切换到环境: $target_env"

    # 1. 备份当前环境
    local current_env=${NODE_ENV:-development}
    if [[ "$current_env" != "$target_env" ]]; then
        backup_environment $current_env
    fi

    # 2. 停止当前服务
    stop_current_services

    # 3. 启动目标环境
    start_services $target_env

    # 4. 健康检查
    if health_check $target_env; then
        log_success "环境切换完成: $target_env"

        # 显示环境信息
        show_environment_info $target_env
    else
        log_error "环境切换失败"
        return 1
    fi
}

# 显示环境状态
show_status() {
    local current_env=${NODE_ENV:-development}

    echo "==================== 环境状态 ===================="
    echo "当前环境: $current_env"
    echo "时间: $(date)"
    echo ""

    # 检查配置文件
    echo "配置文件:"
    for env in development testing staging production; do
        if [[ -f ".env.$env" ]]; then
            echo "  ✓ .env.$env"
        else
            echo "  ✗ .env.$env (缺失)"
        fi
    done
    echo ""

    # 检查服务状态
    echo "服务状态:"

    # Node.js服务
    if pgrep -f "node.*app.ts" > /dev/null; then
        echo "  ✓ Node.js API服务 (PID: $(pgrep -f "node.*app.ts"))"
    else
        echo "  ✗ Node.js API服务 (未运行)"
    fi

    # Docker服务
    if command -v docker-compose &> /dev/null; then
        echo "  Docker容器:"
        docker-compose ps 2>/dev/null || echo "    无运行的容器"
    fi
    echo ""

    # 检查端口占用
    echo "端口占用:"
    for port in 3000 3001 3002 3306 3307 6379 6380; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "  ✓ $port 端口已占用"
        else
            echo "  - $port 端口空闲"
        fi
    done
    echo "=================================================="
}

# 显示环境信息
show_environment_info() {
    local env_name=$(get_env_name $1)

    echo "==================== 环境信息 ===================="
    echo "环境: $env_name"
    echo "数据库: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
    echo "Redis: ${REDIS_HOST}:${REDIS_PORT}"
    echo "API地址: http://localhost:${PORT:-3000}"

    if [[ "$env_name" == "development" ]]; then
        echo ""
        echo "开发工具:"
        echo "  Prisma Studio: npx prisma studio"
        echo "  管理界面: http://localhost:8080 (Adminer)"
    fi
    echo "=================================================="
}

# 初始化环境
init_environment() {
    local env_name=$(get_env_name $1)

    if ! check_env_exists $env_name; then
        return 1
    fi

    log_info "初始化环境: $env_name"

    # 1. 创建必要目录
    mkdir -p logs uploads backups

    # 2. 复制环境配置
    if [[ ! -f ".env.$env_name" ]]; then
        cp .env.example .env.$env_name
        log_info "已创建环境配置文件: .env.$env_name"
        log_warning "请根据需要修改配置文件"
    fi

    # 3. 安装依赖
    log_info "安装项目依赖..."
    npm install

    # 4. 生成Prisma客户端
    log_info "生成数据库客户端..."
    npx prisma generate

    # 5. 运行数据库迁移
    log_info "执行数据库迁移..."
    export NODE_ENV=$env_name
    npx prisma migrate deploy

    log_success "环境初始化完成: $env_name"
}

# 备份环境
backup_environment() {
    local env_name=$(get_env_name $1)
    local backup_dir="backups/$env_name"
    local timestamp=$(date +%Y%m%d_%H%M%S)

    log_info "备份环境: $env_name"

    # 创建备份目录
    mkdir -p $backup_dir

    # 备份配置文件
    if [[ -f ".env.$env_name" ]]; then
        cp .env.$env_name "$backup_dir/env_$timestamp"
        log_info "配置文件已备份"
    fi

    # 备份数据库（非开发环境）
    if [[ "$env_name" != "development" ]]; then
        log_info "备份数据库..."
        export NODE_ENV=$env_name
        ./scripts/backup-database.sh $env_name
    fi

    log_success "环境备份完成: $backup_dir"
}

# 同步环境数据
sync_environments() {
    local src_env=$(get_env_name $1)
    local dst_env=$(get_env_name $2)

    if [[ "$src_env" == "unknown" || "$dst_env" == "unknown" ]]; then
        log_error "无效的环境名称"
        return 1
    fi

    log_warning "即将同步数据: $src_env → $dst_env"
    read -p "确认继续？(y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "已取消同步"
        return 1
    fi

    # 执行同步
    ./scripts/sync-database.sh $src_env $dst_env
}

# 主函数
main() {
    case ${1:-help} in
        switch)
            if [[ -z ${2:-} ]]; then
                log_error "请指定目标环境"
                show_help
                exit 1
            fi
            switch_environment $2
            ;;
        status)
            show_status
            ;;
        init)
            if [[ -z ${2:-} ]]; then
                log_error "请指定要初始化的环境"
                show_help
                exit 1
            fi
            init_environment $2
            ;;
        backup)
            if [[ -z ${2:-} ]]; then
                log_error "请指定要备份的环境"
                show_help
                exit 1
            fi
            backup_environment $2
            ;;
        restore)
            log_warning "恢复功能待实现"
            ;;
        sync)
            if [[ -z ${2:-} || -z ${3:-} ]]; then
                log_error "请指定源环境和目标环境"
                show_help
                exit 1
            fi
            sync_environments $2 $3
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 检查是否在项目根目录
if [[ ! -f "package.json" ]]; then
    log_error "请在项目根目录运行此脚本"
    exit 1
fi

# 执行主函数
main "$@"