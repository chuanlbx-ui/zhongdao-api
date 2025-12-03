# 中道商城系统 BUG修复快速参考

## 🔧 快速诊断命令

### 1. 服务状态检查
```bash
# 检查API服务状态
curl http://localhost:3000/health

# 检查数据库连接
curl http://localhost:3000/health/database

# 查看PM2进程状态
pm2 status
```

### 2. 常见问题快速修复

#### 启动错误
```bash
# 清除缓存重新安装
npm cache clean --force
rm -rf node_modules
npm install

# 重新生成Prisma客户端
npm run db:generate

# 检查环境配置
npm run env:list
```

#### 数据库连接问题
```bash
# 验证数据库连接
npm run db:validate

# 同步数据库Schema
npm run db:push

# 检查数据库统计
npm run db:stats
```

#### API调用失败
```bash
# 查看实时日志
npm run bug:logs

# 重启服务
npm run bug:restart

# 运行完整诊断
npm run bug:diagnose
```

### 3. BUG修复专家工具

#### 启动BUG修复专家
```bash
# Windows
npm run bug:expert

# 或直接运行
bug-expert.bat
```

#### 查看修复专家文档
```bash
# 打开详细文档
code .ai-agents/bug-fix-expert.md
```

## 🚨 紧急问题处理

### 服务完全无响应
1. 检查端口占用: `netstat -ano | findstr :3000`
2. 强制结束进程: `taskkill /PID <PID> /F`
3. 清理PM2: `pm2 delete all`
4. 重新启动: `npm run dev`

### 数据库连接失败
1. 检查网络: `ping 220.163.107.50`
2. 验证配置: 查看 `.env.local` 文件
3. 测试连接: `mysql -h 220.163.107.50 -P 14306 -u root -p`
4. 切换环境: `npm run env:switch-server`

### 内存/性能问题
1. 查看内存使用: `pm2 monit`
2. 检查慢查询: 查看MySQL慢查询日志
3. 重启清理: `pm2 restart zd-api`

## 📋 常见错误码对照表

| 错误码 | 含义 | 快速解决方案 |
|--------|------|------------|
| 401 | 未授权/Token无效 | 检查Authorization头 |
| 403 | 权限不足 | 验证用户等级和操作权限 |
| 404 | 资源不存在 | 检查API路径和参数 |
| 500 | 服务器内部错误 | 查看服务端日志 |
| 502 | 网关错误 | 检查Nginx配置 |
| 503 | 服务不可用 | 检查数据库连接 |

## 🔍 日志位置

### 应用日志
- PM2日志: `pm2 logs zd-api`
- 控制台输出: 直接查看终端
- 错误日志: `logs/error.log`

### 数据库日志
- 慢查询日志: MySQL配置位置
- 连接错误: 应用启动日志

## 🛠️ 开发环境切换

```bash
# 本地开发
npm run env:switch-local && npm run dev:local

# 远程开发
npm run env:switch-remote && npm run dev:local

# 生产环境
npm run env:switch-prod && npm run dev:prod

# 服务器同步
npm run env:switch-server && npm run dev:prod
```

## 📞 获取帮助

1. 运行BUG修复专家: `npm run bug:expert`
2. 查看详细文档: `.ai-agents/bug-fix-expert.md`
3. 访问API文档: http://localhost:3000/api-docs
4. 检查健康状态: http://localhost:3000/health

---
💡 提示: 使用 `npm run bug:expert` 可以启动交互式诊断工具，快速定位和解决问题。