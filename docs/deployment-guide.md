# 中道商城系统远程部署指南

## 📋 部署准备状态评估

基于我们之前的全面测试，系统已经准备好进行远程部署。

### ✅ 已完成的准备工作

1. **后端API服务** ✅
   - 完整的错误处理机制（88.5%数据质量）
   - 统一的API响应格式
   - 完善的用户认证和权限控制
   - 推荐码系统优化（6位字母数字组合）

2. **数据库架构** ✅
   - Prisma ORM配置完整
   - 数据库schema验证通过
   - 多层级用户体系完整
   - 业务逻辑数据约束完善

3. **前端应用** ✅
   - H5前端错误处理机制完善
   - 管理后台功能完整
   - API接口数据格式一致性验证
   - React Hook错误处理集成

4. **安全性** ✅
   - JWT认证机制
   - CSRF保护
   - 输入验证和XSS防护
   - API限流和安全中间件

## 🚀 部署架构建议

### 生产环境架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   用户访问       │    │    管理后台      │    │   移动端H5      │
│   (域名主站)     │    │  (admin.域名)    │    │  (m.域名)       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      CDN/负载均衡         │
                    │   (Nginx/CloudFlare)     │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      应用服务器           │
                    │   (Node.js + Express)     │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │       数据库              │
                    │    (MySQL + Redis)        │
                    └───────────────────────────┘
```

## 📦 1. 服务器环境准备

### 1.1 系统要求

**最低配置**:
- CPU: 2核心
- 内存: 4GB RAM
- 存储: 50GB SSD
- 网络: 5Mbps带宽

**推荐配置**:
- CPU: 4核心
- 内存: 8GB RAM
- 存储: 100GB SSD
- 网络: 20Mbps带宽

### 1.2 软件环境

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js (推荐使用NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装MySQL 8.0
sudo apt update
sudo apt install mysql-server -y
sudo mysql_secure_installation

# 安装Redis
sudo apt install redis-server -y

# 安装Nginx
sudo apt install nginx -y

# 安装PM2进程管理器
sudo npm install -g pm2

# 安装Git
sudo apt install git -y
```

### 1.3 防火墙配置

```bash
# 配置UFW防火墙
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 🗄️ 2. 数据库配置

### 2.1 MySQL配置

```sql
-- 创建数据库
CREATE DATABASE zhongdao_mall_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户
CREATE USER 'zhongdao_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON zhongdao_mall_prod.* TO 'zhongdao_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2.2 Redis配置

```bash
# 编辑Redis配置
sudo nano /etc/redis/redis.conf

# 关键配置项
bind 127.0.0.1
port 6379
requirepass your_redis_password
maxmemory 256mb
maxmemory-policy allkeys-lru

# 重启Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

## 📁 3. 应用部署

### 3.1 代码部署

```bash
# 创建项目目录
sudo mkdir -p /var/www/zhongdao-mall
sudo chown $USER:$USER /var/www/zhongdao-mall

# 克隆代码
cd /var/www/zhongdao-mall
git clone <your-repository-url> .

# 安装依赖
npm install --production
```

### 3.2 环境配置

```bash
# 复制环境配置模板
cp .env.example .env

# 编辑生产环境配置
nano .env
```

**关键配置项**:

```env
# 生产环境配置
NODE_ENV=production
PORT=3000

# 数据库配置
DATABASE_URL="mysql://zhongdao_user:your_secure_password@localhost:3306/zhongdao_mall_prod"

# JWT配置（生产环境必须使用强密钥）
JWT_SECRET="your-super-secure-jwt-secret-key-256-bits-long"
JWT_EXPIRES_IN=7d

# 微信配置（必须配置）
WECHAT_APP_ID="wx1234567890abcdef"
WECHAT_APP_SECRET="your_wechat_app_secret"
WECHAT_MCH_ID="1234567890"
WECHAT_API_V3_KEY="your_32_character_api_v3_key"

# 生产环境URL
WECHAT_NOTIFY_URL="https://yourdomain.com/api/v1/payments/wechat/notify"

# 安全配置
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com,https://m.yourdomain.com

# Redis配置
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD="your_redis_password"
```

### 3.3 数据库迁移

```bash
# 生成Prisma客户端
npx prisma generate

# 推送数据库schema
npx prisma db push

# （可选）运行数据种子
npx prisma db seed
```

### 3.4 使用PM2启动应用

```bash
# 创建PM2配置文件
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'zhongdao-mall-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

```bash
# 创建日志目录
mkdir -p logs

# 启动应用
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

## 🌐 4. Nginx配置

### 4.1 主站配置

```bash
sudo nano /etc/nginx/sites-available/zhongdao-mall
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # H5前端
    location / {
        root /var/www/zhongdao-mall/frontend/h5/dist;
        try_files $uri $uri/ /index.html;

        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
    }

    # 文件上传限制
    client_max_body_size 10M;
}
```

### 4.2 管理后台配置

```bash
sudo nano /etc/nginx/sites-available/zhongdao-mall-admin
```

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 管理后台前端
    location / {
        root /var/www/zhongdao-mall/frontend/admin/dist;
        try_files $uri $uri/ /index.html;

        # 安全头（管理后台更严格）
        add_header X-Frame-Options "DENY" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.3 启用站点

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/zhongdao-mall /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/zhongdao-mall-admin /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 🔒 5. SSL证书配置

### 5.1 使用Let's Encrypt

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取SSL证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d admin.yourdomain.com

# 设置自动续期
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📱 6. 前端构建部署

### 6.1 H5前端

```bash
cd /var/www/zhongdao-mall/frontend/h5

# 安装依赖
npm install

# 构建生产版本
npm run build

# 验证构建结果
ls -la dist/
```

### 6.2 管理后台

```bash
cd /var/www/zhongdao-mall/frontend/admin

# 安装依赖
npm install

# 构建生产版本
npm run build

# 验证构建结果
ls -la dist/
```

## 🔧 7. 部署脚本

### 7.1 创建部署脚本

```bash
nano /var/www/zhongdao-mall/scripts/deploy.sh
```

```bash
#!/bin/bash

# 中道商城系统部署脚本
set -e

echo "🚀 开始部署中道商城系统..."

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 安装依赖
echo "📦 安装后端依赖..."
npm install --production

# 构建后端
echo "🔨 构建后端..."
npm run build

# 数据库迁移
echo "🗄️ 执行数据库迁移..."
npx prisma db push

# 构建前端
echo "🎨 构建H5前端..."
cd frontend/h5
npm install
npm run build
cd ../..

echo "🎨 构建管理后台..."
cd frontend/admin
npm install
npm run build
cd ../..

# 重启应用
echo "🔄 重启应用..."
pm2 restart zhongdao-mall-api

# 重载Nginx
echo "🌐 重载Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ 部署完成！"
echo "📊 查看应用状态: pm2 status"
echo "📝 查看日志: pm2 logs"
```

```bash
# 设置执行权限
chmod +x /var/www/zhongdao-mall/scripts/deploy.sh
```

## 📊 8. 监控和日志

### 8.1 应用监控

```bash
# PM2监控
pm2 monit

# 查看应用状态
pm2 status

# 查看日志
pm2 logs zhongdao-mall-api

# 重启应用
pm2 restart zhongdao-mall-api
```

### 8.2 日志管理

```bash
# 配置日志轮转
sudo nano /etc/logrotate.d/zhongdao-mall
```

```
/var/www/zhongdao-mall/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 8.3 系统监控

```bash
# 创建健康检查脚本
nano /var/www/zhongdao-mall/scripts/health-check.sh
```

```bash
#!/bin/bash

# 健康检查脚本
HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ 应用健康检查通过"
    exit 0
else
    echo "❌ 应用健康检查失败 (HTTP $RESPONSE)"
    # 重启应用
    pm2 restart zhongdao-mall-api
    exit 1
fi
```

## 🔒 9. 安全配置

### 9.1 数据库安全

```sql
-- 禁用MySQL root远程登录
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
FLUSH PRIVILEGES;
```

### 9.2 应用安全

```bash
# 设置文件权限
sudo chown -R $USER:www-data /var/www/zhongdao-mall
sudo chmod -R 755 /var/www/zhongdao-mall
sudo chmod -R 644 /var/www/zhongdao-mall/.env
```

### 9.3 防火墙配置

```bash
# 只允许特定IP访问管理后台
sudo ufw allow from YOUR_ADMIN_IP to any port 22
sudo ufw allow from YOUR_ADMIN_IP to any port 80
sudo ufw allow from YOUR_ADMIN_IP to any port 443
```

## 🚨 10. 备份策略

### 10.1 数据库备份

```bash
# 创建备份脚本
nano /var/www/zhongdao-mall/scripts/backup-db.sh
```

```bash
#!/bin/bash

# 数据库备份脚本
BACKUP_DIR="/var/backups/zhongdao-mall"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="zhongdao_mall_prod"
DB_USER="zhongdao_user"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# 压缩备份文件
gzip $BACKUP_DIR/db_backup_$DATE.sql

# 删除30天前的备份
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "数据库备份完成: $BACKUP_DIR/db_backup_$DATE.sql.gz"
```

```bash
# 设置定时备份
sudo crontab -e
# 添加以下行（每天凌晨2点备份）
0 2 * * * /var/www/zhongdao-mall/scripts/backup-db.sh
```

### 10.2 代码备份

```bash
# 创建代码备份脚本
nano /var/www/zhongdao-mall/scripts/backup-code.sh
```

```bash
#!/bin/bash

# 代码备份脚本
BACKUP_DIR="/var/backups/zhongdao-mall"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/var/www/zhongdao-mall"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 打包代码
tar -czf $BACKUP_DIR/code_backup_$DATE.tar.gz -C $PROJECT_DIR .

# 删除7天前的代码备份
find $BACKUP_DIR -name "code_backup_*.tar.gz" -mtime +7 -delete

echo "代码备份完成: $BACKUP_DIR/code_backup_$DATE.tar.gz"
```

## 📋 11. 部署检查清单

### 部署前检查

- [ ] 服务器配置满足最低要求
- [ ] 域名已解析到服务器IP
- [ ] SSL证书已申请
- [ ] 数据库已创建
- [ ] Redis已配置
- [ ] 环境变量已配置
- [ ] 微信支付配置已获取

### 部署后检查

- [ ] 后端API服务正常运行
- [ ] 数据库连接正常
- [ ] Redis缓存工作正常
- [ ] H5前端可以访问
- [ ] 管理后台可以访问
- [ ] 用户注册功能正常
- [ ] 推荐码系统工作
- [ ] 支付接口已配置（如需要）
- [ ] 日志记录正常
- [ ] 备份策略已启用

## 🎯 12. 生产环境优化建议

### 12.1 性能优化

```bash
# 启用Node.js性能优化
echo 'export NODE_OPTIONS="--max-old-space-size=2048"' >> ~/.bashrc

# 优化MySQL配置
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

```ini
[mysqld]
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
max_connections = 200
query_cache_size = 64M
query_cache_type = 1
```

### 12.2 CDN配置

建议使用CloudFlare或阿里云CDN：
- 静态资源CDN加速
- DDoS防护
- 全球负载均衡
- 缓存策略优化

## 🔧 13. 故障排除

### 常见问题

1. **应用启动失败**
   ```bash
   # 检查PM2日志
   pm2 logs zhongdao-mall-api

   # 检查环境配置
   cat .env

   # 检查数据库连接
   mysql -u zhongdao_user -p zhongdao_mall_prod
   ```

2. **Nginx配置错误**
   ```bash
   # 测试配置
   sudo nginx -t

   # 查看错误日志
   sudo tail -f /var/log/nginx/error.log
   ```

3. **数据库连接问题**
   ```bash
   # 检查MySQL状态
   sudo systemctl status mysql

   # 检查用户权限
   mysql -u root -p -e "SHOW GRANTS FOR 'zhongdao_user'@'localhost';"
   ```

## 📞 14. 技术支持

如果在部署过程中遇到问题，请：

1. 检查相关日志文件
2. 参考故障排除指南
3. 查看项目文档
4. 联系技术支持团队

---

**🎉 恭喜！按照本指南完成部署后，您的中道商城系统就可以正式上线运营了！**