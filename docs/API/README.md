# API 文档开发指南

## 概述

中道商城系统 API 文档基于 OpenAPI 3.0 规范，使用 Swagger 进行自动生成和展示。

## 文档结构

```
docs/
├── api/                    # API 接口文档
│   ├── authentication.md   # 认证相关
│   ├── users.md           # 用户管理
│   ├── products.md        # 商品管理
│   ├── orders.md          # 订单管理
│   ├── payments.md        # 支付相关
│   ├── points.md          # 通券管理
│   ├── shops.md           # 店铺管理
│   ├── inventory.md       # 库存管理
│   ├── teams.md           # 团队管理
│   ├── commission.md      # 佣金管理
│   └── admin.md           # 管理员接口
├── architecture/          # 架构文档
│   ├── overview.md        # 系统概述
│   ├── design-principles.md # 设计原则
│   ├── database-schema.md  # 数据库设计
│   └── security.md        # 安全设计
├── adr/                   # 架构决策记录
│   ├── 0001-use-prisma.md
│   ├── 0002-jwt-auth.md
│   └── ...
├── guides/                # 开发者指南
│   ├── getting-started.md # 快速开始
│   ├── authentication.md  # 认证指南
│   ├── error-handling.md  # 错误处理
│   └── best-practices.md  # 最佳实践
└── diagrams/              # 架构图和流程图
    ├── c4-model/          # C4 架构图
    ├── business-flow/     # 业务流程图
    └── sequence-diagrams/ # 时序图
```

## OpenAPI 注释规范

### 1. 路由级别注释

```typescript
/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: 获取用户列表
 *     description: 分页获取用户列表，支持搜索和筛选
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词（昵称或手机号）
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [NORMAL, VIP, STAR_1, STAR_2, STAR_3, STAR_4, STAR_5, DIRECTOR]
 *         description: 用户等级筛选
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/User'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 权限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
```

### 2. 请求体注释

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - openid
 *         - nickname
 *       properties:
 *         openid:
 *           type: string
 *           description: 微信 OpenID
 *           example: "wx_1234567890abcdef"
 *           minLength: 1
 *           maxLength: 100
 *         nickname:
 *           type: string
 *           description: 用户昵称
 *           example: "张三"
 *           minLength: 1
 *           maxLength: 50
 *         phone:
 *           type: string
 *           description: 手机号
 *           example: "13800138000"
 *           pattern: "^1[3-9]\d{9}$"
 *         avatarUrl:
 *           type: string
 *           format: uri
 *           description: 头像 URL
 *           example: "https://example.com/avatar.jpg"
 *         parentId:
 *           type: string
 *           description: 推荐人 ID
 *           example: "cmi1234567890abcdef"
 *           nullable: true
 */
```

### 3. 响应模型注释

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     UserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 用户 ID
 *           example: "cmi1234567890abcdef"
 *         openid:
 *           type: string
 *           description: 微信 OpenID
 *           example: "wx_1234567890abcdef"
 *         nickname:
 *           type: string
 *           description: 用户昵称
 *           example: "张三"
 *         phone:
 *           type: string
 *           description: 手机号
 *           example: "13800138000"
 *         level:
 *           type: string
 *           enum: [NORMAL, VIP, STAR_1, STAR_2, STAR_3, STAR_4, STAR_5, DIRECTOR]
 *           description: 用户等级
 *           example: "STAR_3"
 *         teamPath:
 *           type: string
 *           description: 团队路径
 *           example: "root/user1/user2"
 *         parentId:
 *           type: string
 *           description: 推荐人 ID
 *           nullable: true
 *         isActive:
 *           type: boolean
 *           description: 是否激活
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *         shop:
 *           $ref: '#/components/schemas/Shop'
 *         teamStats:
 *           $ref: '#/components/schemas/TeamStats'
 */
```

### 4. 认证和权限

```typescript
/**
 * @swagger
 * securitySchemes:
 *   bearerAuth:
 *     type: http
 *     scheme: bearer
 *     bearerFormat: JWT
 *     description: JWT 认证令牌
 *
 * security:
 *   - bearerAuth: []
 */
```

### 5. 标签组织

```typescript
/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: 认证相关接口
 *   - name: Users
 *     description: 用户管理接口
 *   - name: Products
 *     description: 商品管理接口
 *   - name: Orders
 *     description: 订单管理接口
 *   - name: Payments
 *     description: 支付相关接口
 *   - name: Points
 *     description: 通券管理接口
 *   - name: Shops
 *     description: 店铺管理接口
 *   - name: Inventory
 *     description: 库存管理接口
 *   - name: Teams
 *     description: 团队管理接口
 *   - name: Commission
 *     description: 佣金管理接口
 *   - name: Admin
 *     description: 管理员接口
 */
```

## 注释最佳实践

### 1. 完整性
- 每个接口都需要有 summary 和 description
- 所有参数都需要说明类型、格式、约束条件和示例
- 所有可能的响应状态码都需要说明
- 复杂的业务逻辑需要在 description 中详细说明

### 2. 一致性
- 使用统一的命名规范
- 保持相同字段在不同接口中的描述一致
- 使用统一的错误响应格式

### 3. 可读性
- 使用清晰的中文描述
- 提供有意义的示例值
- 合理使用枚举值说明

### 4. 维护性
- 代码变更时同步更新注释
- 定期检查文档与代码的一致性
- 使用自动化工具验证注释完整性

## 文档生成和查看

### 本地开发
```bash
# 启动开发服务器
npm run dev

# 访问 API 文档
open http://localhost:3000/api-docs
```

### 生产环境
```bash
# 获取 JSON 格式的 API 文档
curl https://api.zhongdao-mall.com/api-docs.json
```

## 自动化集成

### CI/CD 集成
1. 在构建流程中验证 OpenAPI 规范
2. 自动检查文档覆盖率
3. 生成静态文档并部署

### 测试集成
```typescript
// 使用 API 文档生成测试用例
import { spec } from 'pactum';

// 加载 OpenAPI 规范
const oas = await loadOpenAPISpec('./api-docs.json');

// 自动生成测试
it('should conform to API specification', async () => {
  await spec()
    .get('/api/v1/users')
    .expectStatus(200)
    .expectJsonMatch(oas.paths['/api/v1/users'].get.responses['200']);
});
```

## 文档版本管理

### 版本策略
- API 版本通过 URL 路径管理（/api/v1/、/api/v2/）
- 每个版本独立的文档和 OpenAPI 规范
- 向后兼容性说明

### 变更日志
- 记录所有 API 变更
- 标注破坏性变更
- 提供迁移指南