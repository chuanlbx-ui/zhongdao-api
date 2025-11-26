# 中道商城同步脚本使用指南

## 🔧 已修复的问题

### 1. Git远程仓库配置问题
- **问题**: 当远程仓库origin不存在时，脚本会报错 "No such remote 'origin'"
- **解决**: 增加了智能检测逻辑，先检查远程仓库是否存在，不存在则添加，存在但URL不匹配则更新

### 2. 项目路径配置问题
- **问题**: 脚本中硬编码的路径可能与实际部署路径不符
- **解决**: 增加了自动路径检测功能，脚本会自动识别当前运行目录

## 🚀 使用方法

### 基本用法

#### 方法1：在项目根目录运行（推荐）
脚本会自动检测当前目录，无需修改配置：

```bash
# 进入后端API项目目录
cd /www/wwwroot/zd-api.wenbita.cn
./scripts/sync-backend-repo.sh

# 进入H5前端项目目录
cd /path/to/zhongdao-H5
./scripts/sync-h5-repo.sh

# 进入管理后台项目目录
cd /path/to/zhongdao-admin
./scripts/sync-admin-repo.sh
```

#### 方法2：使用完整路径运行
```bash
# 从任意位置运行（需要修改脚本中的PROJECT_PATH）
/d/wwwroot/zhongdao-mall/scripts/sync-backend-repo.sh
/d/wwwroot/zhongdao-H5/scripts/sync-h5-repo.sh
/d/wwwroot/zhongdao-admin/scripts/sync-admin-repo.sh
```

### 服务器特定配置

根据你的服务器环境，可能需要调整以下配置：

#### 1. 确认项目路径
你的实际部署路径可能是：
- 后端API: `/www/wwwroot/zd-api.wenbita.cn`
- H5前端: `/www/wwwroot/h5.wenbita.cn` (或类似)
- 管理后台: `/www/wwwroot/admin.wenbita.cn` (或类似)

#### 2. 环境变量检查
确保在项目根目录下有正确的环境文件：
```bash
# 后端API
ls -la /www/wwwroot/zd-api.wenbita.cn/.env*

# H5前端
ls -la /path/to/h5/.env*

# 管理后台
ls -la /path/to/admin/.env*
```

#### 3. Git仓库确认
确保GitHub仓库地址正确：
- 后端: `https://github.com/chuanlbx-ui/zhondao-mall.git`
- H5: `https://github.com/chuanlbx-ui/zhongdao-mall-h5.git`
- 管理: `https://github.com/chuanlbx-ui/zhondao-mall-admin.git`

## 📋 修复后的脚本功能

### 智能路径检测
```bash
# 后端API检测逻辑
if [[ -f "package.json" && -d "src" && -d "prisma" ]]; then
    PROJECT_PATH="$(pwd)"
else
    PROJECT_PATH="/d/wwwroot/zhongdao-mall"
fi

# 前端检测逻辑
if [[ -f "package.json" && -d "src" && -f "vite.config.ts" ]]; then
    PROJECT_PATH="$(pwd)"
else
    PROJECT_PATH="/d/wwwroot/zhongdao-H5"
fi
```

### Git远程仓库管理
```bash
# 智能远程仓库处理
local current_remote=$(git remote get-url origin 2>/dev/null || echo "")
if [[ -z "$current_remote" ]]; then
    git remote add origin "$GITHUB_REPO"
elif [[ "$current_remote" != "$GITHUB_REPO" ]]; then
    git remote set-url origin "$GITHUB_REPO"
fi
```

## 🛠️ 故障排除

### 1. 权限问题
```bash
# 确保脚本有执行权限
chmod +x scripts/sync-*-repo.sh

# 确保Git配置正确
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 2. 路径问题
```bash
# 检查项目结构
ls -la
pwd

# 手动设置路径（如果自动检测失败）
export PROJECT_PATH="/www/wwwroot/zd-api.wenbita.cn"
```

### 3. 网络连接问题
```bash
# 测试GitHub连接
ssh -T git@github.com

# 测试HTTPS连接
curl -I https://github.com/chuanlbx-ui/zhondao-mall.git
```

### 4. 依赖安装问题
```bash
# 手动安装依赖（如果自动安装失败）
npm install

# 清理缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

## ⚡ 高级配置

### 1. 环境变量配置
可以在脚本运行前设置环境变量：
```bash
export CUSTOM_PROJECT_PATH="/www/wwwroot/zd-api.wenbita.cn"
export CUSTOM_GITHUB_REPO="https://github.com/your-username/your-repo.git"
./scripts/sync-backend-repo.sh
```

### 2. 日志级别控制
```bash
# 详细输出
./scripts/sync-backend-repo.sh --verbose

# 静默模式
./scripts/sync-backend-repo.sh --quiet
```

### 3. 定时任务配置
```bash
# 编辑crontab
crontab -e

# 添加每小时同步一次
0 * * * * cd /www/wwwroot/zd-api.wenbita.cn && ./scripts/sync-backend-repo.sh

# 添加每天凌晨2点同步
0 2 * * * cd /path/to/h5 && ./scripts/sync-h5-repo.sh
0 2 * * * cd /path/to/admin && ./scripts/sync-admin-repo.sh
```

## 📊 监控建议

### 1. 日志监控
```bash
# 查看同步日志
tail -f /var/log/sync-*.log

# 设置日志轮转
logrotate -f /etc/logrotate.d/zhongdao-sync
```

### 2. 服务监控
```bash
# 检查服务状态
pm2 list
pm2 logs zhongdao-mall-api

# 检查端口占用
netstat -tuln | grep :3000
```

### 3. 磁盘空间监控
```bash
# 检查磁盘使用
df -h

# 清理备份文件（保留最近7天）
find /www/wwwroot/*/backups -type d -mtime +7 -exec rm -rf {} \;
```

## 🎯 最佳实践

1. **首次运行前**：确保Git配置正确，网络连接正常
2. **定期检查**：监控同步日志，确保脚本正常运行
3. **备份策略**：重要数据定期备份到云存储
4. **权限管理**：使用专用用户运行同步脚本
5. **网络优化**：配置SSH密钥认证，提高同步速度

---

## 📞 技术支持

如果遇到问题，请检查：
1. 脚本执行日志
2. Git状态和权限
3. 网络连接状况
4. 项目文件完整性

所有修复后的脚本都已设置为可执行权限，现在可以在你的服务器环境中正常使用了！