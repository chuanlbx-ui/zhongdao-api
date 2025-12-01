#!/bin/bash

# 精简部署脚本 - 只上传必要文件
# 目标：将594MB项目压缩到80MB以内

set -e

# 配置变量
REMOTE_SERVER="root@162.14.114.224"
REMOTE_PATH="/www/wwwroot/zd-api.wenbita.cn"
LOCAL_PROJECT="./"
DEPLOY_PACKAGE="zhongdao-mall-deploy-$(date +%Y%m%d_%H%M%S).tar.gz"
TEMP_DIR="/tmp/zhongdao-deploy"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# 创建临时目录
prepare_temp_dir() {
    log "准备临时部署目录..."

    rm -rf $TEMP_DIR
    mkdir -p $TEMP_DIR

    log "临时目录创建完成: $TEMP_DIR"
}

# 复制必要文件
copy_essential_files() {
    log "复制必要文件..."

    # 源代码
    cp -r src/ $TEMP_DIR/

    # 构建文件
    if [ -d "dist" ]; then
        cp -r dist/ $TEMP_DIR/
    fi

    # 数据库相关
    cp -r prisma/ $TEMP_DIR/

    # 部署脚本
    mkdir -p $TEMP_DIR/scripts/
    cp scripts/server-optimization.sh $TEMP_DIR/scripts/ 2>/dev/null || true
    cp scripts/mysql-optimization.sh $TEMP_DIR/scripts/ 2>/dev/null || true
    cp scripts/quick-health-check.sh $TEMP_DIR/scripts/ 2>/dev/null || true

    # 配置文件
    cp package*.json $TEMP_DIR/
    cp ecosystem.config.js $TEMP_DIR/ 2>/dev/null || true
    cp ecosystem.config.js.optimized $TEMP_DIR/ 2>/dev/null || true
    cp tsconfig.json $TEMP_DIR/
    cp .env.production $TEMP_DIR/

    # 文档文件（可选）
    cp README.md $TEMP_DIR/ 2>/dev/null || true
    cp CLAUDE.md $TEMP_DIR/ 2>/dev/null || true

    # 创建部署说明
    cat > $TEMP_DIR/DEPLOY_INFO.txt << EOF
# 部署信息
部署时间: $(date)
Git提交: $(git rev-parse --short HEAD 2>/dev/null || echo "Unknown")
分支: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "Unknown")

# 部署包内容
- src/: 源代码目录
- dist/: 构建后的文件（如果存在）
- prisma/: 数据库配置和种子
- scripts/: 部署和优化脚本
- package*.json: 项目配置
- ecosystem.config.js: PM2配置
- .env.production: 生产环境配置模板

# 部署后需要执行
1. cd $REMOTE_PATH
2. npm install --production
3. npm run build  # 如果没有dist目录
4. npm run db:generate
5. pm2 restart zd-api  # 或 pm2 start ecosystem.config.js
EOF

    log "必要文件复制完成"
}

# 创建部署包
create_deployment_package() {
    log "创建部署包..."

    # 进入临时目录并打包
    cd $TEMP_DIR
    tar -czf "../$DEPLOY_PACKAGE" .

    # 显示包大小
    PACKAGE_SIZE=$(du -sh "../$DEPLOY_PACKAGE" | cut -f1)

    log "部署包创建完成: $DEPLOY_PACKAGE (大小: $PACKAGE_SIZE)"

    # 返回原目录
    cd - > /dev/null
}

# 上传部署包
upload_package() {
    log "上传部署包到服务器..."

    # 上传压缩包
    scp "../$DEPLOY_PACKAGE" $REMOTE_SERVER:/tmp/

    log "部署包上传完成"
}

# 远程部署
remote_deploy() {
    log "在远程服务器执行部署..."

    ssh $REMOTE_SERVER << EOF
set -e

echo "=== 开始远程部署 ==="

# 进入项目目录
cd $REMOTE_PATH

# 创建备份
BACKUP_DIR="/var/backups/zhongdao-mall/\$(date +%Y%m%d)"
mkdir -p \$BACKUP_DIR
if [ -d "src" ]; then
    tar -czf "\$BACKUP_DIR/backup_before_deploy_\$(date +%H%M%S).tar.gz" src dist prisma package*.json ecosystem.config.js .env* 2>/dev/null || true
fi

echo "备份完成"

# 停止现有服务
if pm2 list | grep -q "zd-api"; then
    echo "停止现有服务..."
    pm2 stop zd-api || true
fi

# 清理旧文件（保留重要配置）
echo "清理旧文件..."
rm -rf src/ dist/ prisma/ scripts/ 2>/dev/null || true
rm -f package*.json ecosystem.config.js tsconfig.json 2>/dev/null || true
rm -f .env* README.md CLAUDE.md DEPLOY_INFO.txt 2>/dev/null || true

# 解压部署包
echo "解压部署包..."
tar -xzf /tmp/$DEPLOY_PACKAGE

# 清理临时文件
rm -f /tmp/$DEPLOY_PACKAGE

# 设置权限
chown -R root:root . 2>/dev/null || true
chmod +x scripts/*.sh 2>/dev/null || true

echo "文件解压完成"

# 安装依赖（如果需要）
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "安装依赖..."
    npm ci --production
fi

# 构建项目（如果没有dist目录）
if [ ! -d "dist" ]; then
    echo "构建项目..."
    npm run build
fi

# 生成Prisma客户端
echo "生成Prisma客户端..."
if [ -f ".env.production" ]; then
    export DATABASE_URL=\$(grep DATABASE_URL .env.production | cut -d'=' -f2-)
fi
npm run db:generate

# 使用优化的PM2配置
if [ -f "ecosystem.config.js.optimized" ]; then
    cp ecosystem.config.js.optimized ecosystem.config.js
    echo "使用优化的PM2配置"
fi

# 启动服务
echo "启动应用服务..."
pm2 start ecosystem.config.js || pm2 restart zd-api

# 保存PM2配置
pm2 save

# 等待服务启动
sleep 10

# 健康检查
echo "执行健康检查..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API服务健康检查通过"
else
    echo "⚠️ API服务健康检查失败，请检查日志"
fi

echo "=== 远程部署完成 ==="
EOF

    if [ $? -eq 0 ]; then
        log "远程部署成功"
    else
        error "远程部署失败"
        exit 1
    fi
}

# 清理本地临时文件
cleanup() {
    log "清理本地临时文件..."

    rm -rf $TEMP_DIR
    rm -f "../$DEPLOY_PACKAGE"

    log "清理完成"
}

# 显示部署结果
show_result() {
    log "部署完成！"

    echo ""
    echo "📊 部署信息:"
    echo "  服务器: $REMOTE_SERVER"
    echo "  部署路径: $REMOTE_PATH"
    echo "  部署包: $DEPLOY_PACKAGE"

    echo ""
    echo "🔗 访问地址:"
    echo "  API服务: http://162.14.114.224:3000"
    echo "  健康检查: http://162.14.114.224:3000/health"
    echo "  性能监控: http://162.14.114.224:9090"

    echo ""
    echo "🔧 管理命令:"
    echo "  ssh $REMOTE_SERVER"
    echo "  cd $REMOTE_PATH"
    echo "  pm2 list"
    echo "  pm2 logs zd-api"

    echo ""
    echo "📱 验证部署:"
    echo "  curl http://162.14.114.224:3000/health"
}

# 主函数
main() {
    log "开始精简部署..."
    echo "目标：将594MB项目精简上传"
    echo ""

    # 检查必要条件
    if [ ! -d "src" ]; then
        error "源代码目录不存在"
        exit 1
    fi

    if [ ! -f "package.json" ]; then
        error "package.json不存在"
        exit 1
    fi

    # 执行部署步骤
    prepare_temp_dir
    copy_essential_files
    create_deployment_package
    upload_package
    remote_deploy
    cleanup
    show_result

    log "🎉 精简部署完成！"
}

# 错误处理
trap 'error "部署过程中发生错误"; cleanup; exit 1' ERR

# 运行主函数
main "$@"