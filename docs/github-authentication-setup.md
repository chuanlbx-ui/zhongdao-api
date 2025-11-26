# GitHub身份验证设置指南

## 🔐 问题说明

GitHub已不再支持密码认证，需要使用以下方式之一：
1. **Personal Access Token (PAT)** - 推荐
2. **SSH密钥** - 更安全

## 🚀 解决方案

### 方案1: 使用Personal Access Token (推荐)

#### 步骤1: 创建Personal Access Token

1. **登录GitHub**
   - 访问 https://github.com
   - 用你的账户登录

2. **创建Token**
   - 点击右上角头像 → Settings
   - 左侧菜单选择 "Developer settings"
   - 选择 "Personal access tokens" → "Tokens (classic)"
   - 点击 "Generate new token" → "Generate new token (classic)"

3. **配置Token权限**
   ```
   Note: Zhongdao Mall Server Sync
   Expiration: 90 days (或选择 No expiration)
   Scopes:
   ✅ repo (Full control of private repositories)
   ✅ workflow (Update GitHub Action workflows)
   ```

4. **复制Token**
   - 生成后立即复制token（只显示一次）
   - 保存到安全的地方

#### 步骤2: 在服务器上配置Token

```bash
# 方法A: 使用Git credential helper（推荐）
git config --global credential.helper store
# 第一次拉取时输入用户名和token，之后会自动保存

# 方法B: 在URL中包含token
git remote set-url origin https://<TOKEN>@github.com/chuanlbx-ui/zhongdao-mall-h5.git

# 方法C: 设置环境变量
export GITHUB_TOKEN="<YOUR_TOKEN>"
git config --global credential.helper "!f() { echo username=chuanlbx-ui; echo password=$GITHUB_TOKEN; }; f"
```

#### 步骤3: 测试连接

```bash
# 测试是否能连接到GitHub
curl -H "Authorization: token <YOUR_TOKEN>" https://api.github.com/user

# 测试Git操作
git pull origin main
```

### 方案2: 使用SSH密钥（更安全）

#### 步骤1: 生成SSH密钥

```bash
# 生成新的SSH密钥
ssh-keygen -t ed25519 -C "zhongdao-server@wenbita.cn"

# 或者使用RSA密钥
ssh-keygen -t rsa -b 4096 -C "zhongdao-server@wenbita.cn"

# 保存路径：/root/.ssh/id_ed25519（直接回车使用默认路径）
# 设置密码：可以为空（直接回车）或设置一个密码
```

#### 步骤2: 添加SSH密钥到GitHub

1. **复制公钥**
   ```bash
   # 复制公钥内容
   cat ~/.ssh/id_ed25519.pub
   # 或者
   ssh-copy-id git@github.com
   ```

2. **在GitHub添加密钥**
   - 登录GitHub → Settings
   - "SSH and GPG keys"
   - "New SSH key"
   - Title: Zhongdao Mall Server
   - Key: 粘贴刚才复制的公钥内容

#### 步骤3: 修改Git远程地址为SSH

```bash
# 修改为SSH地址
git remote set-url origin git@github.com:chuanlbx-ui/zhongdao-mall-h5.git

# 测试SSH连接
ssh -T git@github.com
# 应该返回: Hi chuanlbx-ui! You've successfully authenticated...
```

## 🔧 在同步脚本中使用

### 更新脚本中的仓库地址

如果使用SSH方式，需要更新脚本中的GITHUB_REPO变量：

```bash
# 原来的HTTPS地址
GITHUB_REPO="https://github.com/chuanlbx-ui/zhongdao-mall-h5.git"

# 改为SSH地址
GITHUB_REPO="git@github.com:chuanlbx-ui/zhongdao-mall-h5.git"
```

### 为所有项目更新配置

```bash
# H5前端
cd /www/wwwroot/zd-h5.wenbita.cn
git remote set-url origin git@github.com:chuanlbx-ui/zhongdao-mall-h5.git

# 管理后台
cd /www/wwwroot/zd-admin.wenbita.cn
git remote set-url origin git@github.com:chuanlbx-ui/zhondao-mall-admin.git

# 后端API
cd /www/wwwroot/zd-api.wenbita.cn
git remote set-url origin git@github.com:chuanlbx-ui/zhondao-mall.git
```

## 📋 快速解决步骤

### 如果你需要快速解决问题，推荐使用以下方法：

#### 方法A: 临时使用Token（最快）

```bash
# 1. 停止当前的同步脚本（Ctrl+C）

# 2. 在GitHub创建Personal Access Token
# 访问：https://github.com/settings/tokens

# 3. 配置Git使用token
git config --global credential.helper store

# 4. 重新运行脚本，输入用户名和token
./sync-h5-repo.sh
# Username: chuanlbx-ui
# Password: <YOUR_TOKEN>
```

#### 方法B: 直接在URL中包含Token

```bash
# 1. 获取Personal Access Token

# 2. 更新远程URL（H5项目）
cd /www/wwwroot/zd-h5.wenbita.cn
git remote set-url origin https://<TOKEN>@github.com/chuanlbx-ui/zhongdao-mall-h5.git

# 3. 重新运行脚本
./sync-h5-repo.sh
```

## 🛠️ 故障排除

### 如果Token无效：
- 检查Token是否过期
- 确认Token有正确的权限（repo权限）
- 重新生成新的Token

### 如果SSH连接失败：
```bash
# 检查SSH配置
ssh -vT git@github.com

# 查看SSH密钥
ls -la ~/.ssh/

# 重新生成SSH密钥
ssh-keygen -t ed25519 -C "server@wenbita.cn"
```

### 如果脚本仍然失败：
```bash
# 检查Git配置
git config --global --list

# 重置Git配置
git config --global --unset credential.helper

# 手动测试
git pull origin main
```

## 🎯 推荐配置

**对于生产服务器，推荐使用SSH密钥方式**，因为：
- 更安全
- 不需要在脚本中暴露token
- 支持自动化操作

**对于快速测试，可以使用Personal Access Token**，因为：
- 设置简单
- 可以快速验证
- 适合临时使用

---

选择适合你的方式，完成配置后就可以正常运行同步脚本了！