#!/bin/bash
# 本地代码同步到服务器部署脚本
# 用于将本地编译后的代码上传到生产服务器

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
SERVER_USER="root"  # 如果不是root用户，请修改
SERVER_PATH="/www/wwwroot/zd-api.aierxin.com"
API_DOMAIN="https://zd-api.aierxin.com"

# 检查必要文件
log "检查必要文件..."
if [ ! -f ".env.server-sync" ]; then
    error "未找到 .env.server-sync 配置文件"
fi

# 确认部署
echo ""
echo "========================================="
echo "🚀 准备部署到生产服务器"
echo "========================================="
echo "服务器地址: $SERVER_IP"
echo "部署路径: $SERVER_PATH"
echo "API域名: $API_DOMAIN"
echo ""
read -p "确认部署？(y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    log "部署已取消"
    exit 0
fi

# 切换到服务器同步环境
log "切换到服务器同步环境..."
cp .env.server-sync .env.local
success "环境配置已切换"

# 编译代码
log "编译TypeScript代码..."
npm run build || error "编译失败"
success "编译完成"

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

# 创建部署目录
if [ ! -d "/www/wwwroot/zd-api.aierxin.com" ]; then
    mkdir -p /www/wwwroot/zd-api.aierxin.com
    echo "创建部署目录: /www/wwwroot/zd-api.aierxin.com"
fi

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

# 验证部署
log "验证部署结果..."
sleep 5

# 检查API是否可访问
if curl -s "$API_DOMAIN/health" > /dev/null 2>&1; then
    success "API服务正常运行"
else
    warning "API服务可能未就绪，请检查服务器日志"
    echo "查看日志命令: ssh $SERVER_USER@$SERVER_IP 'pm2 logs zd-api'"
fi

echo ""
echo "========================================="
echo "✨ 部署完成！"
echo "========================================="
echo ""
echo "📊 常用命令:"
echo "  ssh $SERVER_USER@$SERVER_IP 'pm2 status'     - 查看进程状态"
echo "  ssh $SERVER_USER@$SERVER_IP 'pm2 logs zd-api' - 查看API日志"
echo "  ssh $SERVER_USER@$SERVER_IP 'pm2 restart zd-api' - 重启API服务"
echo ""
echo "🌐 服务地址: $API_DOMAIN"
echo "📖 API文档: $API_DOMAIN/api-docs"
echo ""