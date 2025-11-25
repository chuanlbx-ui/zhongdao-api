#!/bin/bash
# 中道商城快速启动脚本 - 一键搭建完整开发环境

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="中道商城系统"
PROJECT_VERSION="1.0.0"

# 显示Banner
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    $PROJECT_NAME                      ║"
    echo "║                      快速启动工具                         ║"
    echo "║                     Version: $PROJECT_VERSION                     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${PURPLE}[STEP]${NC} $1"; }

# 检查系统要求
check_requirements() {
    log_step "检查系统要求..."

    local missing_requirements=()

    # 检查Node.js
    if ! command -v node &> /dev/null; then
        missing_requirements+=("Node.js >= 18.0.0")
    else
        local node_version=$(node -v | cut -d'v' -f2)
        local major_version=$(echo $node_version | cut -d'.' -f1)
        if [[ $major_version -lt 18 ]]; then
            missing_requirements+=("Node.js版本过低，当前: $node_version，需要: >= 18.0.0")
        fi
    fi

    # 检查npm
    if ! command -v npm &> /dev/null; then
        missing_requirements+=("npm")
    fi

    # 检查Git
    if ! command -v git &> /dev/null; then
        missing_requirements+=("Git")
    fi

    # 检查Docker（可选）
    if ! command -v docker &> /dev/null; then
        log_warning "Docker未安装，将使用本地数据库"
    else
        if ! command -v docker-compose &> /dev/null; then
            missing_requirements+=("Docker Compose")
        fi
    fi

    # 检查缺失的要求
    if [[ ${#missing_requirements[@]} -gt 0 ]]; then
        log_error "缺少以下依赖："
        for req in "${missing_requirements[@]}"; do
            echo "  - $req"
        done
        echo ""
        echo "请安装缺少的依赖后重新运行此脚本"
        exit 1
    fi

    log_success "系统要求检查通过"
}

# 检查项目状态
check_project_status() {
    log_step "检查项目状态..."

    # 检查是否在项目根目录
    if [[ ! -f "package.json" ]]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi

    # 检查依赖是否已安装
    if [[ ! -d "node_modules" ]]; then
        log_info "项目依赖未安装，将自动安装"
        INSTALL_DEPS=true
    else
        log_info "项目依赖已安装"
        INSTALL_DEPS=false
    fi

    # 检查环境配置
    if [[ ! -f ".env.development" ]]; then
        log_info "开发环境配置不存在，将自动创建"
        CREATE_ENV=true
    else
        log_info "开发环境配置已存在"
        CREATE_ENV=false
    fi

    log_success "项目状态检查完成"
}

# 安装项目依赖
install_dependencies() {
    if [[ "$INSTALL_DEPS" == true ]]; then
        log_step "安装项目依赖..."

        # 清理可能存在的依赖
        if [[ -d "node_modules" ]]; then
            rm -rf node_modules
        fi

        # 安装依赖
        npm install

        if [[ $? -eq 0 ]]; then
            log_success "依赖安装完成"
        else
            log_error "依赖安装失败"
            exit 1
        fi
    fi
}

# 创建环境配置
create_environment_config() {
    if [[ "$CREATE_ENV" == true ]]; then
        log_step "创建环境配置..."

        # 创建开发环境配置
        if [[ ! -f ".env.development" ]]; then
            cp .env.example .env.development

            # 更新开发环境配置
            sed -i.bak 's/NODE_ENV=.*/NODE_ENV=development/' .env.development
            sed -i.bak 's/DB_PORT=.*/DB_PORT=3307/' .env.development
            sed -i.bak 's/REDIS_PORT=.*/REDIS_PORT=6380/' .env.development
            sed -i.bak 's/LOG_LEVEL=.*/LOG_LEVEL=debug/' .env.development

            rm .env.development.bak
            log_success "开发环境配置已创建"
        fi

        # 创建必要的目录
        mkdir -p logs/{dev,test,staging,prod}
        mkdir -p uploads/{dev,test,staging,prod}
        mkdir -p backups/{dev,test,staging,prod}
        mkdir -p certs/{dev,prod}

        log_success "目录结构已创建"
    fi
}

# 设置数据库
setup_database() {
    log_step "设置数据库..."

    # 生成Prisma客户端
    log_info "生成Prisma客户端..."
    npx prisma generate

    # 检查是否使用Docker
    if command -v docker-compose &> /dev/null; then
        log_info "使用Docker启动数据库..."

        # 启动开发数据库
        docker-compose -f docker-compose.dev.yml up -d mysql redis

        # 等待数据库启动
        log_info "等待数据库启动..."
        sleep 15

        # 检查数据库连接
        local max_attempts=10
        local attempt=1

        while [ $attempt -le $max_attempts ]; do
            if mysql -h localhost -P 3307 -u dev_user -pdev_password_123 -e "SELECT 1" >/dev/null 2>&1; then
                log_success "数据库连接成功"
                break
            fi

            if [[ $attempt -eq $max_attempts ]]; then
                log_error "数据库连接失败"
                exit 1
            fi

            log_info "等待数据库启动... ($attempt/$max_attempts)"
            sleep 5
            ((attempt++))
        done
    else
        log_warning "Docker未安装，请手动配置MySQL数据库"
        log_info "数据库配置要求："
        echo "  - 主机: localhost"
        echo "  - 端口: 3306"
        echo "  - 数据库: zhongdao_mall_dev"
        echo "  - 用户名: dev_user"
        echo "  - 密码: dev_password_123"
        echo ""
        read -p "数据库已配置完成？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "请先配置数据库，然后重新运行脚本"
            exit 1
        fi
    fi

    # 运行数据库迁移
    log_info "执行数据库迁移..."
    export NODE_ENV=development
    npx prisma migrate dev --name init

    if [[ $? -eq 0 ]]; then
        log_success "数据库设置完成"
    else
        log_error "数据库迁移失败"
        exit 1
    fi
}

# 构建项目
build_project() {
    log_step "构建项目..."

    # TypeScript编译检查
    log_info "检查TypeScript编译..."
    npx tsc --noEmit

    if [[ $? -ne 0 ]]; then
        log_error "TypeScript编译检查失败"
        exit 1
    fi

    # 构建项目
    log_info "构建项目..."
    npm run build

    if [[ $? -eq 0 ]]; then
        log_success "项目构建完成"
    else
        log_error "项目构建失败"
        exit 1
    fi
}

# 运行测试
run_tests() {
    log_step "运行测试..."

    # 运行单元测试
    if [[ -d "tests" ]] || [[ -f "*.test.ts" ]]; then
        npm test

        if [[ $? -eq 0 ]]; then
            log_success "测试通过"
        else
            log_warning "测试失败，但继续启动"
        fi
    else
        log_info "未找到测试文件，跳过测试"
    fi
}

# 启动开发服务器
start_dev_server() {
    log_step "启动开发服务器..."

    # 导出环境变量
    export NODE_ENV=development
    source .env.development

    # 启动服务器
    log_info "启动开发服务器..."
    npm run dev &

    # 等待服务器启动
    sleep 5

    # 健康检查
    log_info "执行健康检查..."
    local max_attempts=10
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_success "开发服务器启动成功！"
            break
        fi

        if [[ $attempt -eq $max_attempts ]]; then
            log_error "开发服务器启动失败"
            exit 1
        fi

        log_info "等待服务器启动... ($attempt/$max_attempts)"
        sleep 3
        ((attempt++))
    done
}

# 显示启动后信息
show_startup_info() {
    echo ""
    echo -e "${GREEN}🎉 中道商城系统启动成功！${NC}"
    echo ""
    echo "==================== 服务信息 ===================="
    echo -e "🌐 API服务: ${BLUE}http://localhost:3000${NC}"
    echo -e "📊 健康检查: ${BLUE}http://localhost:3000/health${NC}"
    echo -e "📚 API文档: ${BLUE}http://localhost:3000/api-docs${NC}"
    echo ""

    if command -v docker-compose &> /dev/null; then
        echo "==================== 数据库服务 =================="
        echo -e "🗄️ MySQL: ${BLUE}localhost:3307${NC}"
        echo -e "🔴 Redis: ${BLUE}localhost:6380${NC}"
        echo -e "🛠️ 管理界面: ${BLUE}http://localhost:8080${NC} (Adminer)"
        echo ""
    fi

    echo "==================== 开发工具 ===================="
    echo -e "🎨 Prisma Studio: ${BLUE}npx prisma studio${NC}"
    echo -e "🧪 运行测试: ${BLUE}npm test${NC}"
    echo -e "📏 代码检查: ${BLUE}npm run lint${NC}"
    echo -e "🔄 重启服务: ${BLUE}npm run dev${NC}"
    echo ""

    echo "==================== 环境管理 ===================="
    echo -e "🔄 切换环境: ${BLUE}./scripts/env-manager.sh switch <env>${NC}"
    echo -e "📊 查看状态: ${BLUE}./scripts/env-manager.sh status${NC}"
    echo -e "📦 初始化环境: ${BLUE}./scripts/env-manager.sh init <env>${NC}"
    echo ""

    echo "==================== 有用命令 ===================="
    echo "查看日志:         tail -f logs/app-dev.log"
    echo "数据库管理:       npx prisma studio"
    echo "生成迁移:         npx prisma migrate dev --name <name>"
    echo "重置数据库:       npx prisma migrate reset"
    echo ""
    echo "=================================================="
    echo -e "${CYAN}开始愉快的开发吧！ 🚀${NC}"
    echo ""
}

# 错误处理
handle_error() {
    log_error "启动过程中发生错误"
    echo ""
    echo "请检查："
    echo "1. 系统依赖是否完整安装"
    echo "2. 网络连接是否正常"
    echo "3. 端口是否被占用"
    echo ""
    echo "如需帮助，请查看日志或联系开发团队"
    exit 1
}

# 设置错误处理
trap handle_error ERR

# 主函数
main() {
    show_banner

    # 交互式选择
    if [[ "${1:-}" != "--auto" ]]; then
        echo "请选择启动模式："
        echo "1. 完整启动 (推荐首次使用)"
        echo "2. 快速启动 (跳过测试和构建检查)"
        echo "3. 仅启动服务 (假设环境已配置)"
        echo ""
        read -p "请输入选择 (1-3): " -n 1 -r
        echo ""

        case $REPLY in
            1) MODE="full" ;;
            2) MODE="quick" ;;
            3) MODE="service" ;;
            *)
                log_error "无效选择"
                exit 1
                ;;
        esac
    else
        MODE="full"
    fi

    # 根据模式执行相应流程
    case $MODE in
        "full")
            check_requirements
            check_project_status
            install_dependencies
            create_environment_config
            setup_database
            build_project
            run_tests
            start_dev_server
            ;;
        "quick")
            check_requirements
            check_project_status
            install_dependencies
            create_environment_config
            setup_database
            start_dev_server
            ;;
        "service")
            start_dev_server
            ;;
    esac

    show_startup_info
}

# 检查是否以root用户运行
if [[ $EUID -eq 0 ]]; then
    log_warning "不建议以root用户运行此脚本"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 执行主函数
main "$@"