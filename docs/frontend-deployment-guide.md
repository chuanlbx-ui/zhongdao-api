# 中道商城前端部署指南

## 🚀 部署概述

本指南介绍如何将中道商城的前端应用（H5前端和管理后台）部署到各种平台。

### 📱 前端项目架构

- **H5前端**: 移动端商城应用
  - 仓库: https://github.com/chuanlbx-ui/zhongdao-mall-h5.git
  - 技术栈: React 18 + TypeScript + Vite + Ant Design Mobile

- **管理后台**: Web管理界面
  - 仓库: https://github.com/chuanlbx-ui/zhongdao-mall-admin.git
  - 技术栈: React 18 + TypeScript + Vite + Ant Design

## 🔧 部署前准备

### 1. 环境要求
- Node.js 18+
- npm 或 yarn
- Git
- 域名和SSL证书（生产环境）

### 2. 配置环境变量

#### H5前端环境变量
```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_ENABLE_MOCK_SMS=true

# .env.production
VITE_API_BASE_URL=https://api.zhongdao-mall.com/api/v1
VITE_ENABLE_MOCK_SMS=false
```

#### 管理后台环境变量
```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_ENABLE_MOCK_DATA=true

# .env.production
VITE_API_BASE_URL=https://api.zhongdao-mall.com/api/v1
VITE_ENABLE_MOCK_DATA=false
```

### 3. 构建项目
```bash
# H5前端
cd /d/wwwroot/zhongdao-H5
npm install
npm run build

# 管理后台
cd /d/wwwroot/zhongdao-admin
npm install
npm run build
```

## 🌐 部署方案

### 方案1: Vercel部署（推荐）

#### 优势
- 零配置部署
- 自动HTTPS
- 全球CDN加速
- 自动CI/CD
- 免费额度充足

#### H5前端部署
```bash
# 1. 安装Vercel CLI
npm install -g vercel

# 2. 登录Vercel
vercel login

# 3. 部署项目
cd /d/wwwroot/zhongdao-H5
vercel

# 4. 配置环境变量
vercel env add VITE_API_BASE_URL

# 5. 生产部署
vercel --prod
```

#### 管理后台部署
```bash
cd /d/wwwroot/zhongdao-admin
vercel
vercel env add VITE_API_BASE_URL
vercel --prod
```

#### Vercel配置文件
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 方案2: Nginx静态托管

#### 服务器配置
```nginx
# /etc/nginx/sites-available/zhongdao-h5
server {
    listen 80;
    server_name h5.zhongdao-mall.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name h5.zhongdao-mall.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/zhongdao-h5/dist;
    index index.html;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
}

# /etc/nginx/sites-available/zhongdao-admin
server {
    listen 80;
    server_name admin.zhongdao-mall.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.zhongdao-mall.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/zhongdao-admin/dist;
    index index.html;

    # 更严格的安全配置
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 部署脚本
```bash
#!/bin/bash
# deploy.sh

# 构建项目
echo "🏗️  构建H5前端..."
cd /d/wwwroot/zhongdao-H5
npm run build

echo "🏗️  构建管理后台..."
cd /d/wwwroot/zhongdao-admin
npm run build

# 部署到服务器
echo "🚀 部署到服务器..."

# H5前端
rsync -avz --delete dist/ user@server:/var/www/zhongdao-h5/dist/

# 管理后台
rsync -avz --delete dist/ user@server:/var/www/zhongdao-admin/dist/

# 重载Nginx
ssh user@server "sudo nginx -t && sudo systemctl reload nginx"

echo "✅ 部署完成！"
```

### 方案3: Docker容器部署

#### Dockerfile
```dockerfile
# H5前端 Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx配置
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Docker Compose
```yaml
version: '3.8'
services:
  zhongdao-h5:
    build:
      context: ./zhongdao-H5
      dockerfile: Dockerfile
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production

  zhongdao-admin:
    build:
      context: ./zhongdao-admin
      dockerfile: Dockerfile
    ports:
      - "81:80"
    environment:
      - NODE_ENV=production
```

## 🔗 域名和SSL配置

### 推荐的域名结构
- **H5前端**: `https://m.zhongdao-mall.com` 或 `https://h5.zhongdao-mall.com`
- **管理后台**: `https://admin.zhongdao-mall.com`
- **API服务**: `https://api.zhongdao-mall.com`

### SSL证书配置
```bash
# 使用Let's Encrypt
sudo certbot --nginx -d h5.zhongdao-mall.com
sudo certbot --nginx -d admin.zhongdao-mall.com
```

## 🚨 生产环境安全配置

### 1. CORS配置
后端API需要配置正确的CORS：
```javascript
// 后端CORS配置
const corsOptions = {
  origin: [
    'https://h5.zhongdao-mall.com',
    'https://admin.zhongdao-mall.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

### 2. 安全头配置
```javascript
// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 3. API限流
```javascript
// 限流配置
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 100个请求
});

app.use('/api/', limiter);
```

## 📊 监控和分析

### 1. 性能监控
- **Lighthouse CI**: 自动性能测试
- **Web Vitals**: 用户体验指标
- **Sentry**: 错误监控

### 2. 分析工具
- **Google Analytics**: 用户行为分析
- **Hotjar**: 用户行为录制
- **LogRocket**: 用户会话回放

### 3. 监控配置
```javascript
// 前端监控配置
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
});
```

## 🔄 CI/CD集成

### GitHub Actions工作流
已经配置了完整的CI/CD流程：
- 自动测试
- 自动构建
- 自动部署
- 健康检查

### 部署触发条件
- 推送到main分支 → 自动部署生产环境
- 推送到develop分支 → 自动部署预发布环境
- 手动触发 → 可选择部署环境

## 📋 部署检查清单

### 部署前检查
- [ ] 环境变量已配置
- [ ] 构建测试通过
- [ ] SSL证书已申请
- [ ] 域名已解析
- [ ] CORS配置正确
- [ ] 安全头已配置

### 部署后检查
- [ ] 页面能正常访问
- [ ] API接口连接正常
- [ ] 用户注册登录功能正常
- [ ] 移动端适配正常
- [ ] 性能指标达标
- [ ] 错误监控已启用

## 🎯 优化建议

### 1. 性能优化
- **代码分割**: 按路由分割代码
- **懒加载**: 图片和组件懒加载
- **缓存策略**: 合理的缓存配置
- **CDN**: 使用全球CDN加速

### 2. SEO优化
- **Meta标签**: 完整的页面信息
- **结构化数据**: 商品信息结构化
- **Sitemap**: 自动生成站点地图
- **开放图谱**: 社交媒体分享优化

### 3. 用户体验
- **骨架屏**: 加载状态优化
- **离线支持**: PWA功能
- **推送通知**: 重要通知推送
- **深链接**: 直接跳转到特定页面

## 🛠️ 故障排除

### 常见问题
1. **构建失败**: 检查Node.js版本和依赖
2. **部署后404**: 检查路由配置和服务器设置
3. **API跨域**: 检查CORS配置
4. **样式丢失**: 检查静态资源路径
5. **白屏问题**: 检查JavaScript错误

### 调试工具
- **浏览器开发者工具**: 网络和console检查
- **Vercel日志**: 部署日志查看
- **Nginx日志**: 服务器日志分析
- **Sentry**: 错误追踪和调试

## 📞 技术支持

如果在部署过程中遇到问题，请参考：
1. [Vercel部署文档](https://vercel.com/docs)
2. [Nginx官方文档](https://nginx.org/en/docs/)
3. [Docker部署指南](https://docs.docker.com/)
4. 项目GitHub仓库的Issue板块

---

**🎉 遵循本指南，您可以成功将中道商城前端应用部署到生产环境！**