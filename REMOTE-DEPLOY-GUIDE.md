# 🚀 远程开发和部署指南

## 📋 快速开始

### Windows用户：

**方式1：双击运行批处理脚本（最简单）**
```bash
deploy-remote.bat
```

**方式2：使用PowerShell**
```powershell
.\deploy-remote.ps1
```

**方式3：使用npm命令**
```bash
npm run remote:deploy
```

---

## 🎯 远程开发工作流

### 1️⃣ 修改本地文件后，一键部署到服务器

```bash
npm run remote:deploy
```

这个命令会：
- ✅ 上传 `ecosystem.config.js` PM2配置
- ✅ 上传部署脚本
- ✅ 在服务器上执行完整部署
- ✅ 安装依赖、编译、启动PM2

### 2️⃣ 查看部署状态

```bash
npm run remote:status
```

显示：
- 环境变量检查
- PM2进程状态
- API服务健康检查
- 日志摘要

### 3️⃣ 查看实时日志

```bash
npm run remote:logs
```

或查看特定服务日志：
```bash
ssh root@162.14.114.224 "pm2 logs zd-api"
ssh root@162.14.114.224 "pm2 logs zd-h5"
ssh root@162.14.114.224 "pm2 logs zd-admin"
```

### 4️⃣ 重启服务

```bash
npm run remote:restart
```

或：
```bash
ssh root@162.14.114.224 "pm2 restart zd-api"
```

---

## 🔧 PM2常用命令

### 查看进程状态
```bash
ssh root@162.14.114.224 "pm2 list"
```

### 查看实时日志
```bash
ssh root@162.14.114.224 "pm2 logs"
```

### 监控资源使用
```bash
ssh root@162.14.114.224 "pm2 monit"
```

### 重启特定服务
```bash
ssh root@162.14.114.224 "pm2 restart zd-api"
ssh root@162.14.114.224 "pm2 restart zd-h5"
ssh root@162.14.114.224 "pm2 restart zd-admin"
```

### 停止服务
```bash
ssh root@162.14.114.224 "pm2 stop zd-api"
```

### 启动服务
```bash
ssh root@162.14.114.224 "pm2 start zd-api"
```

### 删除服务
```bash
ssh root@162.14.114.224 "pm2 delete zd-api"
```

---

## 🔥 热重载开发

PM2已配置了文件监听，修改 `src/` 目录下的文件时会自动重新编译和重启服务。

### 启用热重载
编辑 `ecosystem.config.js`，确保以下配置：

```javascript
{
  watch: ['src'],              // 监听src目录
  ignore_watch: ['node_modules', 'dist', 'logs', '.git'],  // 忽略这些目录
  watch_delay: 1000            // 延迟1秒后重启（避免频繁重启）
}
```

### 工作流：
1. 修改本地 `src/` 文件
2. Git提交或者直接上传
3. 服务器自动检测到变化
4. 自动编译和重启PM2进程
5. 服务自动更新

---

## 📁 服务部署路径

```
API服务 (Node.js + Express):
  路径: /www/wwwroot/zd-api.wenbita.cn
  域名: https://zd-api.wenbita.cn
  端口: 3000 (内部)
  进程名: zd-api

H5前端 (Vue3 + Vite):
  路径: /www/wwwroot/zd-h5.wenbita.cn
  域名: https://zd-h5.wenbita.cn
  端口: 3001 (内部)
  进程名: zd-h5

管理后台 (React + TypeScript):
  路径: /www/wwwroot/zd-admin.wenbita.cn
  域名: https://zd-admin.wenbita.cn
  端口: 3002 (内部)
  进程名: zd-admin
```

---

## 🔐 服务器配置信息

```
Host: 162.14.114.224
User: root
SSH: 支持密码和密钥认证
```

配置已保存在 `.remote.json`：
```json
{
  "user": "root",
  "host": "162.14.114.224",
  "path": "/www/wwwroot/zd-api.wenbita.cn",
  "apiPath": "/www/wwwroot/zd-api.wenbita.cn",
  "h5Path": "/www/wwwroot/zd-h5.wenbita.cn",
  "adminPath": "/www/wwwroot/zd-admin.wenbita.cn"
}
```

---

## 🐛 故障排除

### 问题1：SSH连接失败

**解决方案**：
```bash
# 检查SSH是否可用
ssh -V

# 如果是Windows，需要安装Git Bash或OpenSSH
# Git官方网址: https://git-scm.com/download/win
```

### 问题2：PM2找不到script

**原因**：PATH环境变量未正确设置

**解决方案**：
```bash
ssh root@162.14.114.224 "bash /www/wwwroot/zd-api.wenbita.cn/fix-pm2.sh"
```

### 问题3：依赖安装失败

**原因**：package.json或npm版本不兼容

**解决方案**：
```bash
# 清除缓存后重试
ssh root@162.14.114.224 "cd /www/wwwroot/zd-api.wenbita.cn && npm cache clean --force && npm ci --only=production"
```

### 问题4：编译失败

**原因**：TypeScript编译错误或内存不足

**解决方案**：
```bash
# 检查服务器内存
ssh root@162.14.114.224 "free -h"

# 如果内存不足，增加Node内存限制
ssh root@162.14.114.224 "cd /www/wwwroot/zd-api.wenbita.cn && node --max-old-space-size=4096 node_modules/typescript/bin/tsc"
```

### 问题5：服务无法启动

**解决方案**：
```bash
# 查看详细日志
ssh root@162.14.114.224 "pm2 logs zd-api --lines 100"

# 查看PM2错误日志
ssh root@162.14.114.224 "cat /www/wwwlogs/zd-api-error.log"
```

---

## 📊 监控和维护

### 定期检查服务状态
```bash
npm run remote:status
```

### 查看系统资源使用
```bash
ssh root@162.14.114.224 "pm2 monit"
```

### 查看服务器磁盘空间
```bash
ssh root@162.14.114.224 "df -h"
```

### 查看日志文件大小
```bash
ssh root@162.14.114.224 "du -sh /www/wwwlogs/*"
```

---

## 🎓 最佳实践

### 1. 始终先在本地测试

```bash
npm run dev        # 启动本地开发服务器
npm run build      # 本地编译测试
npm run test       # 运行测试
```

### 2. 使用Git版本控制

```bash
git add .
git commit -m "修复API的某个功能"
git push origin main
```

### 3. 定期检查服务状态

```bash
npm run remote:status  # 每天检查一次
```

### 4. 监控日志

```bash
npm run remote:logs    # 随时监控实时日志
```

### 5. 定期备份数据库

```bash
# 备份数据库（由宝塔面板自动处理）
# 手动备份：
ssh root@162.14.114.224 "mysqldump -u zhongdao_mall -p zhongdao-mall > /www/backups/zhongdao-mall-$(date +%Y%m%d).sql"
```

---

## 🚨 紧急情况处理

### 服务宕机
```bash
npm run remote:restart
```

### 强制杀死进程
```bash
ssh root@162.14.114.224 "pm2 kill && pm2 start /www/wwwroot/zd-api.wenbita.cn/ecosystem.config.js"
```

### 清除PM2日志
```bash
ssh root@162.14.114.224 "pm2 flush"
```

### 重置PM2
```bash
ssh root@162.14.114.224 "pm2 delete all && pm2 start /www/wwwroot/zd-api.wenbita.cn/ecosystem.config.js && pm2 save"
```

---

## 📞 支持

遇到问题？

1. 查看日志：`npm run remote:logs`
2. 检查状态：`npm run remote:status`
3. 查看完整文档：查看 `.remote.json` 和 `ecosystem.config.js`

---

**最后更新**：2025年11月26日
**部署系统**：PM2 + Nginx
**技术栈**：Node.js 18+ | TypeScript | Express.js | MySQL 8.0
