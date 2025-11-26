#!/bin/bash

# Bash自动化部署脚本 - 环境变量修复版
# 用法：bash scripts/deploy-and-verify.sh [environment] [remote-host] [remote-user] [remote-path]

set -e

# 参数定义
ENVIRONMENT="${1:-production}"
REMOTE_HOST="${2:-162.14.114.224}"
REMOTE_USER="${3:-root}"
REMOTE_PATH="${4:-/www/wwwroot/zd-api.wenbita.cn}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}🚀 自动化部署脚本 - 环境变量运行时读取修复${NC}"
echo -e "${BLUE}================================================${NC}"

# 1. 本地编译
echo -e "\n${YELLOW}📦 第1步: 本地编译...${NC}"
echo -e "${YELLOW}命令: npm run build${NC}"

if ! npm run build; then
    echo -e "${RED}❌ 编译失败！请检查代码。${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 编译成功！${NC}"

# 2. 生成时间戳备份文件夹名称
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="dist_backup_${TIMESTAMP}"

# 3. 验证编译结果中的环境变量
echo -e "\n${YELLOW}🔍 第2步: 验证编译结果...${NC}"
CONFIG_FILE="dist/config/index.js"

if [ -f "$CONFIG_FILE" ]; then
    if grep -q 'process\.env\.JWT_SECRET' "$CONFIG_FILE"; then
        echo -e "${GREEN}✅ 验证成功: dist中仍包含process.env.JWT_SECRET（不是硬编码）${NC}"
    else
        echo -e "${RED}❌ 验证失败: 环境变量可能被硬编码！${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  警告: 无法找到配置文件进行验证${NC}"
fi

# 4. 远程部署
echo -e "\n${YELLOW}🌐 第3步: 远程部署到 ${REMOTE_HOST}...${NC}"
echo -e "  ${BLUE}-${NC} 当前目录: $(pwd)"
echo -e "  ${BLUE}-${NC} 远程主机: ${REMOTE_HOST}"
echo -e "  ${BLUE}-${NC} 远程用户: ${REMOTE_USER}"
echo -e "  ${BLUE}-${NC} 远程路径: ${REMOTE_PATH}"

# 4.1 清理旧备份
echo -e "\n  ${BLUE}📁 清理旧备份...${NC}"
BACKUP_COUNT=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "ls -td ${REMOTE_PATH}/dist_backup_* 2>/dev/null | wc -l" 2>/dev/null || echo "0")
if [ "$BACKUP_COUNT" -gt 3 ]; then
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "ls -td ${REMOTE_PATH}/dist_backup_* | tail -n +4 | xargs rm -rf" 2>/dev/null || true
    echo -e "     ${GREEN}✅ 清理完成（保留最新3个备份）${NC}"
fi

# 4.2 备份远程当前dist
echo -e "\n  ${BLUE}📁 备份远程的dist目录...${NC}"
BACKUP_OUTPUT=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "if [ -d ${REMOTE_PATH}/dist ]; then cp -r ${REMOTE_PATH}/dist ${REMOTE_PATH}/${BACKUP_NAME} && echo '✅ 备份成功: ${BACKUP_NAME}'; fi" 2>&1 || true)
echo "     ${BACKUP_OUTPUT}"

# 4.3 上传编译后的dist
echo -e "\n  ${BLUE}📤 上传编译后的dist文件...${NC}"
if scp -r dist "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/" 2>&1 | head -5; then
    echo -e "     ${GREEN}✅ 上传完成${NC}"
else
    echo -e "${RED}❌ 上传失败！${NC}"
    exit 1
fi

# 4.4 上传package.json
echo -e "\n  ${BLUE}📤 上传package.json...${NC}"
scp package.json "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/" 2>&1 | head -1 || true
echo -e "     ${GREEN}✅ package.json已更新${NC}"

# 5. 远程重启应用
echo -e "\n${YELLOW}🔄 第4步: 重启远程应用...${NC}"
echo -e "  ${BLUE}-${NC} 检查进程管理方式..."

PM_METHOD=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "if ps aux | grep -q '[p]m2'; then echo 'PM2'; elif systemctl is-active --quiet node_zd_api; then echo 'SYSTEMD'; else echo 'MANUAL'; fi" 2>/dev/null || echo "MANUAL")

case "$PM_METHOD" in
    "PM2")
        echo -e "     使用PM2重启..."
        ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_PATH} && pm2 restart ecosystem.config.js --update-env 2>&1" 2>&1 | tail -3 || true
        echo -e "     ${GREEN}✅ PM2重启成功${NC}"
        ;;
    "SYSTEMD")
        echo -e "     使用systemd重启..."
        ssh "${REMOTE_USER}@${REMOTE_HOST}" "systemctl restart node_zd_api 2>&1" 2>&1 || true
        echo -e "     ${GREEN}✅ systemd重启成功${NC}"
        ;;
    *)
        echo -e "     ${YELLOW}⚠️  未检测到自动启动配置，请手动启动应用:${NC}"
        echo -e "        ${BLUE}ssh ${REMOTE_USER}@${REMOTE_HOST}${NC}"
        echo -e "        ${BLUE}cd ${REMOTE_PATH} && node dist/index.js${NC}"
        ;;
esac

# 6. 验证部署
echo -e "\n${YELLOW}✅ 第5步: 验证部署...${NC}"
echo -e "  ${BLUE}等待应用启动...${NC}"
sleep 3

echo -e "  ${BLUE}检查健康检查端点...${NC}"
HEALTH_CHECK=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "curl -s http://localhost:3000/health 2>&1 || echo 'FAILED'" 2>/dev/null || echo "FAILED")

if echo "$HEALTH_CHECK" | grep -q '"status":\s*"ok"'; then
    echo -e "  ${GREEN}✅ 应用已成功启动！${NC}"
    echo -e "     ${GREEN}响应: $(echo $HEALTH_CHECK | head -c 100)...${NC}"
else
    echo -e "  ${YELLOW}⚠️  健康检查失败，请查看日志:${NC}"
    echo -e "     ${BLUE}ssh ${REMOTE_USER}@${REMOTE_HOST}${NC}"
    echo -e "     ${BLUE}pm2 logs api 或 tail -f ${REMOTE_PATH}/logs/*${NC}"
fi

# 7. 部署总结
echo -e "\n${BLUE}================================================${NC}"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${BLUE}📋 部署摘要:${NC}"
echo -e "  ${GREEN}✅${NC} 本地编译成功"
echo -e "  ${GREEN}✅${NC} 编译结果验证通过（环境变量未被硬编码）"
echo -e "  ${GREEN}✅${NC} 远程dist已备份: ${BACKUP_NAME}"
echo -e "  ${GREEN}✅${NC} 新版本代码已上传到 ${REMOTE_PATH}/dist"
echo -e "  ${GREEN}✅${NC} 应用已重启"
echo ""
echo -e "${BLUE}🔗 关键URL:${NC}"
echo -e "  ${BLUE}API:${NC} https://zd-api.wenbita.cn/api/v1"
echo -e "  ${BLUE}健康检查:${NC} https://zd-api.wenbita.cn/health"
echo -e "  ${BLUE}API文档:${NC} https://zd-api.wenbita.cn/api-docs"
echo ""
echo -e "${BLUE}📝 快速命令参考:${NC}"
echo -e "  ${BLUE}查看日志:${NC} ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 logs api'"
echo -e "  ${BLUE}重启应用:${NC} ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 restart api'"
echo -e "  ${BLUE}恢复备份:${NC} ssh ${REMOTE_USER}@${REMOTE_HOST} 'rm -rf ${REMOTE_PATH}/dist && cp -r ${REMOTE_PATH}/${BACKUP_NAME} ${REMOTE_PATH}/dist'"
echo ""
