# 开发者快速开始指南

## 系统要求

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0 或 **yarn**: >= 1.22.0
- **MySQL**: >= 8.0
- **Redis**: >= 7.0 (可选，生产环境禁用)
- **Git**: >= 2.30.0

## 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/zhongdao/zhongdao-mall.git
cd zhongdao-mall
```

### 2. 安装依赖
```bash
npm install
```

### 3. 环境配置
```bash
# 复制环境变量模板
cp .env.example .env.development

# 编辑环境变量
vim .env.development
```

**必要的环境变量配置：**
```bash
# 数据库配置
DATABASE_URL="mysql://username:password@localhost:3306/zhongdao_mall"

# JWT配置
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"

# 微信小程序配置
WECHAT_APP_ID="your-wechat-app-id"
WECHAT_APP_SECRET="your-wechat-app-secret"

# 支付配置
WECHAT_PAY_MCH_ID="your-mch-id"
WECHAT_PAY_KEY="your-pay-key"
ALIPAY_APP_ID="your-alipay-app-id"
ALIPAY_PRIVATE_KEY="your-alipay-private-key"
```

### 4. 数据库设置
```bash
# 生成Prisma客户端
npm run db:generate

# 推送数据库schema
npm run db:push

# 运行数据库迁移
npm run db:migrate

# 初始化种子数据
npm run db:seed
```

### 5. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000/api-docs 查看API文档。

## 项目结构详解

```
zhongdao-mall/
├── src/                    # 源代码
│   ├── modules/           # 业务模块
│   │   ├── auth/         # 认证模块
│   │   ├── users/        # 用户模块
│   │   ├── products/     # 商品模块
│   │   ├── orders/       # 订单模块
│   │   ├── payments/     # 支付模块
│   │   ├── shops/        # 店铺模块
│   │   ├── inventory/    # 库存模块
│   │   ├── teams/        # 团队模块
│   │   └── commission/   # 佣金模块
│   ├── routes/           # API路由
│   │   └── v1/          # API v1版本
│   ├── shared/           # 共享代码
│   │   ├── middleware/  # 中间件
│   │   ├── services/    # 共享服务
│   │   ├── utils/       # 工具函数
│   │   └── types/       # 类型定义
│   ├── config/          # 配置文件
│   └── index.ts        # 应用入口
├── prisma/              # 数据库相关
│   ├── schema.prisma   # 数据库模型
│   ├── migrations/     # 数据库迁移
│   └── seed.ts        # 种子数据
├── tests/              # 测试文件
├── docs/               # 文档
└── scripts/            # 脚本文件
```

## 核心概念理解

### 1. 多层级用户体系
```typescript
enum UserLevel {
  NORMAL = 'NORMAL',        // 普通用户
  VIP = 'VIP',             // VIP会员
  STAR_1 = 'STAR_1',       // 1星店长
  STAR_2 = 'STAR_2',       // 2星店长
  STAR_3 = 'STAR_3',       // 3星店长
  STAR_4 = 'STAR_4',       // 4星店长
  STAR_5 = 'STAR_5',       // 5星店长
  DIRECTOR = 'DIRECTOR'    // 董事
}
```

### 2. 团队关系
- **推荐关系**: 每个用户可以有唯一的推荐人
- **团队路径**: 从根节点到当前用户的完整路径
- **层级计算**: 基于团队路径快速计算用户层级

### 3. 双店铺系统
- **云店**: 基于业绩累积升级的店铺
- **五通店**: 一次性购买获得特殊权益的店铺

### 4. 库存类型
- **平台仓**: 系统统一管理的库存
- **云仓**: 团队共享的库存
- **本地仓**: 用户个人的库存

## 开发工作流

### 1. 创建新的API端点
```typescript
// 1. 在 routes/v1/ 创建路由文件
// src/routes/v1/example/index.ts

import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';

const router = Router();

/**
 * @swagger
 * /api/v1/example:
 *   get:
 *     summary: 示例接口
 *     tags:
 *       - Example
 *     security:
 *       - bearerAuth: []
 */
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    // 业务逻辑
    res.json({ message: 'Hello World' });
  })
);

export default router;
```

### 2. 注册路由
```typescript
// src/routes/v1/index.ts
import exampleRouter from './example';

router.use('/example', exampleRouter);
```

### 3. 添加数据库模型
```prisma
// prisma/schema.prisma
model Example {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 4. 运行数据库迁移
```bash
npm run db:push
```

### 5. 编写测试
```typescript
// tests/api/example.test.ts
import { describe, it, expect } from 'vitest';
import { request } from '../setup';

describe('Example API', () => {
  it('should return hello world', async () => {
    const response = await request(app)
      .get('/api/v1/example')
      .expect(200);

    expect(response.body.message).toBe('Hello World');
  });
});
```

## 常用开发命令

### 数据库操作
```bash
# 生成Prisma客户端
npm run db:generate

# 推送schema到数据库
npm run db:push

# 创建新的迁移
npm run db:migrate --name add_example_table

# 重置数据库
npm run db:reset

# 查看数据库
npm run db:studio
```

### 测试
```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test example.test.ts

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式运行测试
npm run test:watch
```

### 代码质量
```bash
# 代码检查
npm run lint

# 自动修复代码问题
npm run lint:fix

# 类型检查
npm run type-check

# 代码格式化
npm run format
```

### 调试
```bash
# 以调试模式启动
npm run debug

# 查看详细日志
DEBUG=* npm run dev
```

## 调试技巧

### 1. 使用调试器
```typescript
// 在代码中添加断点
debugger;

// 或使用 VS Code 调试配置
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug App",
  "program": "${workspaceFolder}/src/index.ts",
  "env": {
    "NODE_ENV": "development"
  }
}
```

### 2. 日志调试
```typescript
import { logger } from '../shared/utils/logger';

// 记录调试信息
logger.debug('Debug info', { userId, action });

// 记录业务日志
logger.info('User action', {
  userId,
  action: 'purchase',
  metadata: { orderId, amount }
});

// 记录错误
logger.error('API Error', error);
```

### 3. 数据库查询调试
```typescript
// 查看生成的SQL
import { Prisma } from '@prisma/client';

// 启用查询日志
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' }
  ]
});

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
  console.log('Duration: ' + e.duration + 'ms');
});
```

## 常见问题解决

### 1. 数据库连接失败
```bash
# 检查MySQL服务是否运行
systemctl status mysql

# 检查数据库配置
cat .env.development | grep DATABASE_URL

# 测试数据库连接
npm run db:test
```

### 2. Prisma客户端生成失败
```bash
# 清理并重新生成
rm -rf node_modules/.prisma
npm run db:generate
```

### 3. JWT认证问题
```bash
# 检查JWT密钥配置
echo $JWT_SECRET

# 生成新的测试Token
npm run generate:test-token
```

### 4. 性能问题
```bash
# 启用性能监控
DEBUG=performance npm run dev

# 分析慢查询
npm run db:analyze
```

## 获取帮助

1. **查看文档**:
   - API文档: http://localhost:3000/api-docs
   - 架构文档: `/docs` 目录

2. **团队协作**:
   - 技术讨论群
   - 代码评审流程
   - 问题反馈系统

3. **学习资源**:
   - Prisma文档: https://www.prisma.io/docs/
   - Express文档: https://expressjs.com/
   - TypeScript文档: https://www.typescriptlang.org/docs/

## 下一步

1. 阅读[业务规则文档](./business-rules.md)了解系统核心逻辑
2. 查看[API文档](../api/)了解所有可用接口
3. 学习[最佳实践指南](./best-practices.md)提高代码质量
4. 参与[贡献指南](./contributing.md)为项目做贡献