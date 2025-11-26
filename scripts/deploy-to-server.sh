#!/bin/bash
# 部署脚本 - 直接在服务器上执行

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

# 设置HOME环境变量
export HOME=/root

log "🚀 开始部署中道商城系统..."
echo ""

# ========== API服务部署 ==========
log "========== 部署API服务 (zd-api) =========="
API_PATH="/www/wwwroot/zd-api.wenbita.cn"

if [ ! -d "$API_PATH" ]; then
    error "API服务路径不存在: $API_PATH"
fi

cd "$API_PATH"
log "进入目录: $API_PATH"

# 检查是否需要git pull
if [ -d ".git" ]; then
    log "拉取最新代码..."
    git pull origin main || warning "Git拉取失败，继续使用本地代码"
fi

log "安装依赖..."
npm ci --only=production || error "依赖安装失败"
success "依赖安装完成"

log "编译TypeScript..."
npm run build || error "编译失败"
success "编译完成"

# ========== H5前端部署 ==========
log "========== 部署H5前端 (zd-h5) =========="
H5_PATH="/www/wwwroot/zd-h5.wenbita.cn"

if [ -d "$H5_PATH" ]; then
    cd "$H5_PATH"
    log "进入目录: $H5_PATH"
    
    if [ -d ".git" ]; then
        log "拉取最新代码..."
        git pull origin main || warning "Git拉取失败"
    fi
    
    if [ -f "package.json" ]; then
        log "安装H5依赖..."
        npm ci --only=production || warning "H5依赖安装失败"
        
        log "构建H5项目..."
        npm run build || warning "H5构建失败"
        success "H5构建完成"
    fi
else
    warning "H5前端路径不存在: $H5_PATH，跳过"
fi

# ========== 管理后台部署 ==========
log "========== 部署管理后台 (zd-admin) =========="
ADMIN_PATH="/www/wwwroot/zd-admin.wenbita.cn"

if [ -d "$ADMIN_PATH" ]; then
    cd "$ADMIN_PATH"
    log "进入目录: $ADMIN_PATH"
    
    if [ -d ".git" ]; then
        log "拉取最新代码..."
        git pull origin main || warning "Git拉取失败"
    fi
    
    if [ -f "package.json" ]; then
        log "安装管理后台依赖..."
        npm ci --only=production || warning "管理后台依赖安装失败"
        
        log "构建管理后台..."
        npm run build || warning "管理后台构建失败"
        success "管理后台构建完成"
    fi
else
    warning "管理后台路径不存在: $ADMIN_PATH，跳过"
fi

# ========== PM2配置和启动 ==========
log "========== 配置PM2进程管理 =========="

# 设置HOME环境变量（永久化）
log "设置HOME环境变量..."
if ! grep -q "export HOME=/root" /root/.bashrc; then
    echo "export HOME=/root" >> /root/.bashrc
fi
if ! grep -q "export HOME=/root" /etc/profile; then
    echo "export HOME=/root" >> /etc/profile
fi
source /root/.bashrc
success "HOME环境变量已设置"

# 停止现有PM2进程
log "停止现有PM2进程..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
success "现有进程已停止"

# 检查ecosystem.config.js
if [ ! -f "$API_PATH/ecosystem.config.js" ]; then
    error "ecosystem.config.js文件不存在，请先将文件复制到 $API_PATH"
fi

# 启动PM2
log "启动PM2应用..."
cd "$API_PATH"
pm2 start ecosystem.config.js --env production || error "PM2启动失败"
success "PM2应用已启动"

# 保存PM2配置
log "保存PM2配置..."
pm2 save || warning "PM2配置保存失败"
success "PM2配置已保存"

# 设置开机自启
log "设置开机自启..."
pm2 startup systemd -u root --hp /root 2>/dev/null || warning "开机自启设置失败"
pm2 save 2>/dev/null || true
success "开机自启已配置"

# ========== 验证部署 ==========
log "========== 验证部署结果 =========="

sleep 3

log "显示PM2进程状态..."
pm2 list
echo ""

log "检查API服务健康状态..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    success "API服务正常运行"
else
    warning "API服务可能未就绪，查看日志: pm2 logs zd-api"
fi

echo ""
echo "========================================="
echo "✨ 部署完成！"
echo "========================================="
echo ""
echo "📊 常用命令:"
echo "  pm2 status              - 查看进程状态"
echo "  pm2 logs zd-api         - 查看API日志"
echo "  pm2 logs zd-h5          - 查看H5日志"
echo "  pm2 logs zd-admin       - 查看后台日志"
echo "  pm2 restart zd-api      - 重启API服务"
echo "  pm2 stop zd-api         - 停止API服务"
echo "  pm2 monit               - 监控资源使用"
echo ""
echo "🌐 服务地址:"
echo "  API服务: https://zd-api.wenbita.cn"
echo "  H5前端: https://zd-h5.wenbita.cn"
echo "  管理后台: https://zd-admin.wenbita.cn"
echo ""
