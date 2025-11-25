#!/bin/bash

# 中道商城前端自动部署脚本
# 支持Vercel和静态服务器部署

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# 显示帮助信息
show_help() {
    cat << EOF
中道商城前端自动部署脚本

用法: $0 [选项] <项目名称> <部署目标>

项目名称:
  h5      - H5移动端前端
  admin   - 管理后台
  all     - 所有前端项目

部署目标:
  vercel  - 部署到Vercel
  static  - 部署到静态服务器
  docker  - 构建Docker镜像

选项:
  -h, --help     显示帮助信息
  -e, --env      指定环境 (development|production, 默认: production)
  -v, --verbose  详细输出
  -d, --dry-run  仅测试构建，不实际部署

示例:
  $0 h5 vercel              # 部署H5到Vercel
  $0 admin static          # 部署管理后台到静态服务器
  $0 all vercel -e staging  # 部署所有项目到Vercel预发布环境
  $0 h5 docker --dry-run   # 测试H5 Docker构建

EOF
}

# 解析命令行参数
PROJECT=""
TARGET=""
ENVIRONMENT="production"
VERBOSE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        h5|admin|all)
            PROJECT="$1"
            shift
            ;;
        vercel|static|docker)
            TARGET="$1"
            shift
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查参数
if [[ -z "$PROJECT" || -z "$TARGET" ]]; then
    log_error "请指定项目名称和部署目标"
    show_help
    exit 1
fi

# 项目路径配置
declare -A PROJECT_PATHS=(
    ["h5"]="/d/wwwroot/zhongdao-H5"
    ["admin"]="/d/wwwroot/zhongdao-admin"
)

declare -A PROJECT_NAMES=(
    ["h5"]="H5移动端前端"
    ["admin"]="管理后台"
)

# 环境变量检查
check_environment() {
    local project_path="$1"
    local project_name="$2"

    log "检查 $project_name 环境配置..."

    # 检查 .env 文件
    local env_file="$project_path/.env.$ENVIRONMENT"
    if [[ ! -f "$env_file" ]]; then
        log_error "环境配置文件不存在: $env_file"
        return 1
    fi

    # 检查关键环境变量
    if grep -q "VITE_API_BASE_URL" "$env_file"; then
        log_success "API_BASE_URL 已配置"
    else
        log_warning "API_BASE_URL 未配置"
    fi

    return 0
}

# 项目结构检查
check_project_structure() {
    local project_path="$1"
    local project_name="$2"

    log "检查 $project_name 项目结构..."

    local required_files=("package.json" "src/App.tsx" "src/main.tsx")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$project_path/$file" ]]; then
            log_error "缺少必要文件: $file"
            return 1
        fi
    done

    log_success "项目结构检查通过"
    return 0
}

# 依赖检查和安装
check_dependencies() {
    local project_path="$1"
    local project_name="$2"

    log "检查 $project_name 依赖..."

    cd "$project_path"

    # 检查 node_modules
    if [[ ! -d "node_modules" ]]; then
        log "安装依赖..."
        npm install
        if [[ $? -ne 0 ]]; then
            log_error "依赖安装失败"
            return 1
        fi
    fi

    log_success "依赖检查通过"
    return 0
}

# 构建项目
build_project() {
    local project_path="$1"
    local project_name="$2"

    log "构建 $project_name..."

    cd "$project_path"

    # 清理旧的构建文件
    if [[ -d "dist" ]]; then
        rm -rf dist
    fi

    # 构建项目
    if [[ "$VERBOSE" == true ]]; then
        npm run build
    else
        npm run build > /dev/null 2>&1
    fi

    if [[ $? -ne 0 ]]; then
        log_error "构建失败"
        return 1
    fi

    # 检查构建结果
    if [[ ! -f "dist/index.html" ]]; then
        log_error "构建产物不完整"
        return 1
    fi

    # 计算构建大小
    local total_size=$(du -sh dist | cut -f1)
    log_success "构建成功 (大小: $total_size)"

    return 0
}

# 部署到Vercel
deploy_to_vercel() {
    local project_path="$1"
    local project_name="$2"

    log "部署 $project_name 到Vercel..."

    cd "$project_path"

    # 检查Vercel CLI
    if ! command -v vercel &> /dev/null; then
        log_error "Vercel CLI未安装"
        return 1
    fi

    # 部署
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "干运行模式: 跳过实际部署"
        return 0
    fi

    if [[ "$ENVIRONMENT" == "production" ]]; then
        vercel --prod
    else
        vercel
    fi

    if [[ $? -eq 0 ]]; then
        log_success "Vercel部署成功"
        return 0
    else
        log_error "Vercel部署失败"
        return 1
    fi
}

# 部署到静态服务器
deploy_to_static() {
    local project_path="$1"
    local project_name="$2"

    log "部署 $project_name 到静态服务器..."

    # 服务器配置（需要用户根据实际情况修改）
    local SERVER_USER="your_user"
    local SERVER_HOST="your_server.com"
    local SERVER_PATH="/var/www/$project_name"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "干运行模式: 跳过实际部署"
        return 0
    fi

    # 使用rsync同步文件
    rsync -avz --delete "$project_path/dist/" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"

    if [[ $? -eq 0 ]]; then
        log_success "静态服务器部署成功"
        return 0
    else
        log_error "静态服务器部署失败"
        return 1
    fi
}

# 构建Docker镜像
build_docker_image() {
    local project_path="$1"
    local project_name="$2"

    log "构建 $project_name Docker镜像..."

    cd "$project_path"

    # 检查Dockerfile
    if [[ ! -f "Dockerfile" ]]; then
        log_warning "Dockerfile不存在，创建默认Dockerfile"
        create_default_dockerfile "$project_name"
    fi

    # 构建镜像
    local image_name="zhongdao-$project_name"
    local image_tag="${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "干运行模式: 跳过实际构建"
        log "将要构建: $image_name:$image_tag"
        return 0
    fi

    docker build -t "$image_name:$image_tag" .

    if [[ $? -eq 0 ]]; then
        log_success "Docker镜像构建成功: $image_name:$image_tag"

        # 标记为latest
        docker tag "$image_name:$image_tag" "$image_name:latest"

        return 0
    else
        log_error "Docker镜像构建失败"
        return 1
    fi
}

# 创建默认Dockerfile
create_default_dockerfile() {
    local project_name="$1"

    cat > Dockerfile << EOF
# 多阶段构建
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建结果
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制nginx配置
RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files \$uri \$uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

    log_success "已创建默认Dockerfile"
}

# 部署单个项目
deploy_project() {
    local project="$1"

    local project_path="${PROJECT_PATHS[$project]}"
    local project_name="${PROJECT_NAMES[$project]}"

    if [[ -z "$project_path" ]]; then
        log_error "未知项目: $project"
        return 1
    fi

    log "开始部署 $project_name..."

    # 检查项目路径
    if [[ ! -d "$project_path" ]]; then
        log_error "项目路径不存在: $project_path"
        return 1
    fi

    # 执行部署步骤
    check_environment "$project_path" "$project_name" || return 1
    check_project_structure "$project_path" "$project_name" || return 1
    check_dependencies "$project_path" "$project_name" || return 1
    build_project "$project_path" "$project_name" || return 1

    # 根据目标进行部署
    case "$TARGET" in
        vercel)
            deploy_to_vercel "$project_path" "$project_name" || return 1
            ;;
        static)
            deploy_to_static "$project_path" "$project_name" || return 1
            ;;
        docker)
            build_docker_image "$project_path" "$project_name" || return 1
            ;;
        *)
            log_error "未知部署目标: $TARGET"
            return 1
            ;;
    esac

    log_success "$project_name 部署完成"
    return 0
}

# 主函数
main() {
    log "开始中道商城前端部署..."
    log "项目: $PROJECT, 目标: $TARGET, 环境: $ENVIRONMENT"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "干运行模式 - 不会执行实际部署"
    fi

    # 统计结果
    local success_count=0
    local total_count=0

    # 部署项目
    if [[ "$PROJECT" == "all" ]]; then
        for proj in "h5" "admin"; do
            total_count=$((total_count + 1))
            if deploy_project "$proj"; then
                success_count=$((success_count + 1))
            fi
        done
    else
        total_count=1
        if deploy_project "$PROJECT"; then
            success_count=1
        fi
    fi

    # 输出结果
    log "==============================================="
    log "部署结果统计"
    log "==============================================="
    log "总项目数: $total_count"
    log "成功: $success_count"
    log "失败: $((total_count - success_count))"

    if [[ $success_count -eq $total_count ]]; then
        log_success "🎉 所有项目部署成功！"
        exit 0
    else
        log_error "❌ 部分项目部署失败"
        exit 1
    fi
}

# 运行主函数
main