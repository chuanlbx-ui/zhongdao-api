# 快速解决GitHub认证问题

## 🚀 立即解决方案（最简单）

你现在遇到的问题是GitHub不再支持密码认证。这里是最快的解决方法：

### 方法1: 直接在URL中使用Token（推荐）

```bash
# 1. 停止当前运行的脚本（按Ctrl+C）

# 2. 进入H5项目目录
cd /www/wwwroot/zd-h5.wenbita.cn

# 3. 直接更新Git远程URL，包含你的token
git remote set-url origin https://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@github.com/chuanlbx-ui/zhongdao-mall-h5.git

# 4. 重新运行同步脚本
./sync-h5-repo.sh
```

### 方法2: 配置Git credential helper

```bash
# 1. 配置Git保存认证信息
git config --global credential.helper store

# 2. 尝试拉取，会提示输入用户名和token
git pull origin main
# Username: chuanlbx-ui
# Password: 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

# 3. 重新运行同步脚本
./sync-h5-repo.sh
```

## 📝 为所有项目设置认证

```bash
# H5前端
cd /www/wwwroot/zd-h5.wenbita.cn
git remote set-url origin https://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@github.com/chuanlbx-ui/zhongdao-mall-h5.git

# 管理后台
cd /www/wwwroot/zd-admin.wenbita.cn
git remote set-url origin https://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@github.com/chuanlbx-ui/zhondao-mall-admin.git

# 后端API
cd /www/wwwroot/zd-api.wenbita.cn
git remote set-url origin https://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@github.com/chuanlbx-ui/zhondao-mall.git
```

## ⚠️ 安全提醒

- Token已经包含在URL中，请确保不要公开这个文件
- 这个方法简单快捷，适合服务器环境
- 如果需要更高安全性，建议设置SSH密钥

## 🎯 现在立即执行

**直接运行这些命令：**

```bash
# 停止当前脚本（按Ctrl+C）

# 立即修复H5项目
cd /www/wwwroot/zd-h5.wenbita.cn
git remote set-url origin https://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@github.com/chuanlbx-ui/zhongdao-mall-h5.git
./sync-h5-repo.sh
```

这样就可以立即继续运行同步脚本了！