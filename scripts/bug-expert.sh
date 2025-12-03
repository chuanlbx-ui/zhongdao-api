#!/bin/bash

# BUG修复专家快速启动脚本
# 用于快速诊断和修复中道商城系统问题

echo "🔧 中道商城系统 BUG修复专家"
echo "================================"

# 检查当前环境
echo "📍 当前环境信息："
echo "Node.js版本: $(node -v)"
echo "NPM版本: $(npm -v)"
echo "当前目录: $(pwd)"
echo "环境变量: NODE_ENV=${NODE_ENV:-development}"

# 检查服务状态
echo ""
echo "🔍 服务状态检查："

# 检查本地开发服务
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ 本地API服务运行正常 (端口3000)"
else
    echo "❌ 本地API服务未运行"
fi

# 检查生产环境服务
if curl -s http://localhost:3003/health > /dev/null 2>&1; then
    echo "✅ 生产API服务运行正常 (端口3003)"
else
    echo "❌ 生产API服务未运行"
fi

# 检查数据库连接
echo ""
echo "🗄️ 数据库连接检查："

# 检查本地数据库
DATABASE_URL_LOCAL="mysql://root:mysql_qwe333666@220.163.107.50:14306/zhongdao_mall"
if node -e "
const mysql = require('mysql2');
const connection = mysql.createConnection('$DATABASE_URL_LOCAL');
connection.connect((err) => {
  if (err) {
    console.log('❌ 远程数据库连接失败:', err.code);
    process.exit(1);
  } else {
    console.log('✅ 远程数据库连接正常');
    connection.end();
  }
});
" 2>/dev/null; then
    echo "✅ 数据库连接验证完成"
else
    echo "❌ 数据库连接验证失败"
fi

# 显示常用诊断命令
echo ""
echo "🛠️ 常用诊断命令："
echo "1. 查看应用日志:     pm2 logs zd-api"
echo "2. 重启应用服务:     pm2 restart zd-api"
echo "3. 检查数据库状态:   npm run db:validate"
echo "4. 查看API文档:      http://localhost:3000/api-docs"
echo "5. 健康检查:         curl http://localhost:3000/health"

# 显示BUG修复专家位置
echo ""
echo "📚 BUG修复专家配置文件："
echo "📄 详细说明: .ai-agents/bug-fix-expert.md"

# 交互式菜单
echo ""
echo "请选择操作："
echo "1. 查看实时日志"
echo "2. 重启所有服务"
echo "3. 运行数据库诊断"
echo "4. 切换到本地环境"
echo "5. 切换到服务器环境"
echo "6. 打开BUG修复专家文档"
echo "0. 退出"

read -p "请输入选项 (0-6): " choice

case $choice in
    1)
        echo "📋 显示实时日志..."
        pm2 logs zd-api
        ;;
    2)
        echo "🔄 重启所有服务..."
        pm2 restart all
        ;;
    3)
        echo "🔍 运行数据库诊断..."
        npm run db:validate
        npm run db:stats
        ;;
    4)
        echo "🏠 切换到本地环境..."
        npm run env:switch-local
        echo "✅ 已切换到本地环境，请重启服务"
        ;;
    5)
        echo "☁️ 切换到服务器环境..."
        npm run env:switch-server
        echo "✅ 已切换到服务器环境，请重启服务"
        ;;
    6)
        echo "📖 打开BUG修复专家文档..."
        if command -v code &> /dev/null; then
            code .ai-agents/bug-fix-expert.md
        elif command -v notepad &> /dev/null; then
            notepad .ai-agents\bug-fix-expert.md
        else
            cat .ai-agents/bug-fix-expert.md
        fi
        ;;
    0)
        echo "👋 退出"
        exit 0
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "✅ 操作完成！"