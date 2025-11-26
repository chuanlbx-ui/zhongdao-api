#!/bin/bash
# 检查部署状态脚本

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}       🔍 部署状态检查${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# 检查HOME环境变量
echo -e "${BLUE}1️⃣  环境变量检查:${NC}"
echo "   HOME=$HOME"
echo ""

# 检查PM2
echo -e "${BLUE}2️⃣  PM2状态:${NC}"
pm2 list || echo "   ❌ PM2未安装"
echo ""

# 检查API服务
echo -e "${BLUE}3️⃣  API服务检查:${NC}"
if [ -f "/www/wwwroot/zd-api.wenbita.cn/dist/index.js" ]; then
    echo "   ✅ dist/index.js 存在"
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "   ✅ API服务正常运行"
    else
        echo "   ⚠️  API服务未响应"
    fi
else
    echo "   ❌ dist/index.js 不存在"
fi
echo ""

# 检查H5前端
echo -e "${BLUE}4️⃣  H5前端检查:${NC}"
if [ -d "/www/wwwroot/zd-h5.wenbita.cn/dist" ]; then
    echo "   ✅ H5构建文件存在"
else
    echo "   ⚠️  H5构建文件不存在"
fi
echo ""

# 检查管理后台
echo -e "${BLUE}5️⃣  管理后台检查:${NC}"
if [ -d "/www/wwwroot/zd-admin.wenbita.cn/dist" ]; then
    echo "   ✅ 管理后台构建文件存在"
else
    echo "   ⚠️  管理后台构建文件不存在"
fi
echo ""

# 显示最近日志
echo -e "${BLUE}6️⃣  最近日志 (最后10行):${NC}"
pm2 logs --lines 10 --nostream 2>/dev/null || echo "   无日志"
echo ""

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}检查完成${NC}"
echo -e "${BLUE}=========================================${NC}"
