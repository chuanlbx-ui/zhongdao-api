# 中道商城系统Git仓库结构指南

## 🎯 仓库架构决策

对于中道商城系统，我推荐采用**分离仓库**的架构，原因如下：

### ✅ 分离仓库的优势

1. **独立部署**: 前端和后端可以独立部署和扩展
2. **团队协作**: 前端和后端团队可以独立工作
3. **技术栈灵活性**: 前端可以独立升级技术栈
4. **权限管理**: 不同仓库可以设置不同的访问权限
5. **CI/CD优化**: 前后端可以有不同的构建和部署流程

## 📁 推荐的仓库结构

### 1. 后端API仓库（已完成）
```
https://github.com/chuanlbx-ui/zhondao-mall.git

zhongdao-mall/
├── src/                          # 后端源代码
│   ├── index.ts                 # 应用入口
│   ├── app.ts                    # Express应用配置
│   ├── modules/                  # 业务模块
│   ├── routes/                   # API路由
│   ├── shared/                   # 共享工具和服务
│   └── middleware/               # 中间件
├── prisma/                       # 数据库相关
│   ├── schema.prisma             # 数据库模型
│   └── seed.ts                   # 数据种子
├── docs/                         # 文档
├── scripts/                      # 脚本工具
├── tests/                        # 测试文件
├── package.json                  # 依赖配置
├── tsconfig.json                 # TypeScript配置
└── .env.example                  # 环境配置模板
```

### 2. H5前端仓库（待创建）
```
https://github.com/chuanlbx-ui/zhondao-mall-h5.git

zhongdao-mall-h5/
├── src/
│   ├── api/                      # API接口
│   ├── components/               # 组件
│   ├── pages/                    # 页面
│   ├── hooks/                    # React Hooks
│   ├── utils/                    # 工具函数
│   ├── assets/                   # 静态资源
│   ├── styles/                   # 样式文件
│   └── App.tsx                   # 应用根组件
├── public/                       # 公共资源
├── package.json                  # 依赖配置
├── vite.config.ts                # Vite配置
├── tsconfig.json                 # TypeScript配置
└── .env.example                  # 环境配置模板
```

### 3. 管理后台仓库（待创建）
```
https://github.com/chuanlbx-ui/zhondao-mall-admin.git

zhongdao-mall-admin/
├── src/
│   ├── api/                      # API接口
│   ├── components/               # 组件
│   ├── pages/                    # 页面
│   ├── hooks/                    # React Hooks
│   ├── utils/                    # 工具函数
│   ├── layouts/                  # 布局组件
│   ├── assets/                   # 静态资源
│   └── App.tsx                   # 应用根组件
├── public/                       # 公共资源
├── package.json                  # 依赖配置
├── vite.config.ts                # Vite配置
├── tsconfig.json                 # TypeScript配置
└── .env.example                  # 环境配置模板
```

### 4. 文档仓库（可选）
```
https://github.com/chuanlbx-ui/zhondao-mall-docs.git

zhongdao-mall-docs/
├── api/                          # API文档
├── deployment/                   # 部署文档
├── development/                  # 开发文档
├── user-guide/                   # 用户指南
└── README.md                     # 项目介绍
```

## 🚀 创建前端仓库的步骤

### 1. 创建H5前端仓库

```bash
# 在D:\wwwroot目录执行
cd D:\wwwroot\zhongdao-H5

# 初始化Git仓库
git init
git remote add origin https://github.com/chuanlbx-ui/zhondao-mall-h5.git
git branch -M main

# 创建.gitignore文件
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Build outputs
dist/
build/
out/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Coverage
coverage/
*.lcov
EOF

# 添加文件并提交
git add .
git commit -m "feat: 中道商城H5前端初始化"
git push -u origin main
```

### 2. 创建管理后台仓库

```bash
# 在D:\wwwroot目录执行
cd D:\wwwroot\zhongdao-admin

# 初始化Git仓库
git init
git remote add origin https://github.com/chuanlbx-ui/zhondao-mall-admin.git
git branch -M main

# 创建.gitignore文件（同H5）
# ...（复制H5的.gitignore内容）

# 添加文件并提交
git add .
git commit -m "feat: 中道商城管理后台初始化"
git push -u origin main
```

## 🔗 仓库间的关联策略

### 1. API接口版本控制

在所有前端项目中，通过环境变量配置API地址：

```typescript
// 前端项目中的API配置
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
```

### 2. 共享类型定义

#### 方案A：发布NPM包
```bash
# 后端项目发布共享类型
npm publish zhongdao-mall-types

# 前端项目安装
npm install zhongdao-mall-types
```

#### 方案B：Git Submodule（推荐）
```bash
# 在前端项目中添加类型定义子模块
git submodule add https://github.com/chuanlbx-ui/zhondao-mall-types.git shared/types
```

#### 方案C：同步文件（最简单）
定期从后端仓库同步类型定义文件到前端仓库：

```bash
# 前端项目中创建同步脚本
node scripts/sync-types.js
```

### 3. 版本发布策略

#### 版本号规范
- 后端API：`v1.0.0`
- H5前端：`v1.0.0`（对应API版本）
- 管理后台：`v1.0.0`（对应API版本）

#### 发布流程
1. 后端API发布新版本
2. 更新前端项目中的API类型定义
3. 前端项目发布兼容版本
4. 更新文档

## 🔄 CI/CD配置

### 后端API的GitHub Actions

```yaml
# .github/workflows/backend-ci.yml
name: Backend CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        run: |
          # 部署脚本
```

### 前端的GitHub Actions

```yaml
# 前端项目的CI/CD配置
name: Frontend CI/CD

on:
  push:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run test

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to CDN
        run: |
          # 部署到CDN或静态托管
```

## 📋 开发工作流程

### 1. 日常开发流程

```bash
# 1. 后端开发
cd zhongdao-mall
git checkout feature/new-api
npm run dev
# 开发完成后
git add .
git commit -m "feat: 新增API功能"
git push origin feature/new-api

# 2. 前端开发
cd zhongdao-H5
git checkout feature/new-ui
npm run dev
# 开发完成后
git add .
git commit -m "feat: 新增UI功能"
git push origin feature/new-ui
```

### 2. 发布流程

```bash
# 1. 后端发布
cd zhongdao-mall
npm run build
npm run test
git tag v1.0.1
git push origin v1.0.1

# 2. 前端发布
cd zhongdao-H5
npm run build
npm run test
git tag v1.0.1
git push origin v1.0.1
```

## 🔧 开发工具配置

### 1. 统一代码格式化

在所有仓库中添加相同的代码格式化配置：

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 2. 统一ESLint配置

```json
// .eslintrc.json
{
  "extends": ["@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

### 3. 统一提交规范

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

## 📚 相关文档

- [后端API文档](./API-Documentation.md)
- [部署指南](./deployment-guide.md)
- [开发流程规范](./开发流程与代码规范.md)

## 🎯 总结

采用分离仓库的架构为中道商城系统提供了：

1. **✅ 更好的团队协作** - 前后端团队可以独立工作
2. **✅ 更灵活的部署策略** - 前后端可以独立部署和扩展
3. **✅ 更清晰的代码管理** - 每个仓库专注于特定的技术栈
4. **✅ 更好的CI/CD流程** - 每个项目可以有独立的构建和部署流程

现在后端API仓库已经成功创建和推送到GitHub，接下来您可以：

1. 按照上述步骤创建H5前端和管理后台仓库
2. 配置相应的CI/CD流程
3. 建立团队协作规范
4. 开始实际的开发工作

这样的架构将为您提供一个可扩展、可维护的代码管理基础！