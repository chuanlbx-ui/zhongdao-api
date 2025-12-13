# 中道商城系统 API 文档

## 项目概述

中道商城系统是一个多层级供应链社交电商平台，包含以下核心功能：

- **用户管理**: 多级用户体系（普通会员 → VIP → 1-5星店长 → 董事）
- **双店铺系统**: 云店（业绩累积升级）+ 五通店（特殊权益）
- **复杂采购规则**: 层级限制 + 中间人业绩 + 平级奖励
- **双仓库存**: 云仓（团队共享）+ 本地仓（个人独有）
- **通券流转**: 多源通券循环系统（进货+转账+充值）

## API文档访问

### Swagger UI

访问 `http://localhost:3000/api-docs` 查看交互式API文档

### JSON格式文档

访问 `http://localhost:3000/api-docs.json` 获取OpenAPI规范文件

## 文档索引

### 完整 API 文档集合

中道商城系统提供了完整的 API 文档集合，涵盖所有核心模块：

#### 1. 认证模块 (Authentication)

📄 [auth-api-documentation.md](./auth-api-documentation.md)

- 微信小程序登录
- 手机号密码登录/注册
- JWT Token 管理
- 推荐码系统

#### 2. 积分模块 (Points)

📄 [points-api-documentation.md](./points-api-documentation.md)

- 通券（积分）余额查询
- 通券转账
- 管理员充值
- 交易流水记录
- 统计分析

#### 3. 商品模块 (Products)

📄 [products-api-documentation.md](./products-api-documentation.md)

- 商品管理（CRUD）
- 商品规格管理
- 分类体系（三级分类）
- 标签系统
- 差异化定价

📄 [products-api-openapi.json](./products-api-openapi.json)

- OpenAPI 3.0 规范文件

📄 [products-api-types.ts](./products-api-types.ts)

- TypeScript 类型定义

📄
[zhongdao-mall-products-api.postman_collection.json](./zhongdao-mall-products-api.postman_collection.json)

- 商品模块 Postman 集合

#### 4. 库存模块 (Inventory)

📄 [inventory-api-documentation.md](./inventory-api-documentation.md)

- 多仓库库存管理
- 库存预警
- 出入库记录
- 库存调整
- 库存调拨
- 盘点功能

#### 5. 团队模块 (Teams)

📄 [teams-api-documentation.md](./teams-api-documentation.md)

- 团队结构管理
- 成员邀请
- 等级调整
- 团队统计
- 邀请管理

#### 6. 性能监控模块 (Performance)

📄 [performance-api-documentation.md](./performance-api-documentation.md)

- 系统性能监控
- 慢路由分析
- 告警管理
- 实时指标流

#### 7. 健康检查模块 (Health)

📄 [health-api-documentation.md](./health-api-documentation.md)

- 基础健康检查
- 详细健康检查
- 数据库健康检查
- 缓存健康检查
- Kubernetes 探针

#### 8. 监控面板模块 (Monitoring)

📄 [monitoring-api-documentation.md](./monitoring-api-documentation.md)

- 监控页面
- 仪表板数据
- 实时数据流
- 告警管理

### 9. 完整 Postman 集合

📄
[zhongdao-mall-complete-api.postman_collection.json](./zhongdao-mall-complete-api.postman_collection.json)

- 包含所有模块的完整 API 集合

### 10. API 文档总览

📄 [API-Documentation-Summary.md](./API-Documentation-Summary.md)

- 所有模块的汇总文档和快速导航

### 商品模块功能特性

- ✅ **商品管理**: 完整的 CRUD 操作
- ✅ **商品规格**: 支持多规格商品管理
- ✅ **分类体系**: 三级分类树结构
- ✅ **标签系统**: 灵活的商品标签管理
- ✅ **差异化定价**: 基于用户等级的智能定价
- ✅ **批量操作**: 高效的批量处理功能
- ✅ **缓存优化**: 多级缓存提升性能
- ✅ **权限控制**: 细粒度的权限管理

## 快速开始

### 1. 使用Postman

```bash
# 1. 导入环境变量
postman collection import docs/api/postman-environment.json

# 2. 导入API集合
postman collection import docs/api/zhongdao-mall-api.postman_collection.json

# 3. 设置环境变量（开发环境）
baseUrl = http://localhost:3000/api/v1

# 4. 执行登录获取token
POST /auth/password-login
{
  "phone": "13800138000",
  "password": "123456"
}

# 5. 设置返回的token到环境变量
accessToken = <登录返回的token>
```

### 2. 使用curl

```bash
# 获取API信息
curl -X GET http://localhost:3000/api/v1/

# 微信登录
curl -X POST http://localhost:3000/api/v1/auth/wechat-login \
  -H "Content-Type: application/json" \
  -d '{"code": "your_wechat_code"}'

# 密码登录
curl -X POST http://localhost:3000/api/v1/auth/password-login \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000", "password": "123456"}'

# 获取用户信息（需要token）
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 已完成的API文档

### ✅ 认证模块 (Authentication)

- 检查认证服务状态
- 微信小程序登录
- 密码登录
- 密码注册（支持推荐码）
- 获取当前用户信息
- 刷新访问令牌
- 用户登出

### ✅ 通券管理 (Points)

- 获取用户通券余额
- 通券转账（含限额控制）
- 通券充值（管理员权限）
- 获取通券流水记录（分页+筛选）
- 通券冻结/解冻（管理员权限）
- 批量充值（管理员权限）
- 通券统计信息

### ✅ 库存管理 (Inventory)

- 获取库存列表（分页+筛选）
- 获取低库存预警列表
- 获取库存变动记录
- 获取库存汇总信息
- 查询商品在各仓库的库存
- 调整库存数量（管理员权限）
- 库存调拨（管理员权限）
- 创建库存盘点任务
- 预留/释放库存（星级店长以上）
- 获取库存详情

## 待完成的API文档

以下模块的API接口尚未添加完整的Swagger文档，需要继续完善：

### 📋 商品管理 (Products)

- [ ] 公开商品列表
- [ ] 公开商品详情
- [ ] 商品分类管理
- [ ] 商品标签管理
- [ ] 商品规格管理
- [ ] 商品定价管理

### 📋 订单管理 (Orders)

- [ ] 订单创建
- [ ] 订单列表查询
- [ ] 订单详情
- [ ] 订单状态更新

### 📋 支付管理 (Payments)

- [ ] 微信支付
- [ ] 支付宝支付
- [ ] 支付回调
- [ ] 充值接口

### 📋 团队管理 (Teams)

- [ ] 团队成员列表
- [ ] 团队统计
- [ ] 推荐关系管理
- [ ] 团队业绩

### 📋 店铺管理 (Shops)

- [ ] 云店管理
- [ ] 五通店管理
- [ ] 店铺升级

### 📋 管理员接口 (Admin)

- [ ] 仪表板统计
- [ ] 用户管理
- [ ] 商品管理
- [ ] 订单管理
- [ ] 财务管理
- [ ] 系统配置

## 贡献指南

### 添加新API文档

1. 在对应的路由文件中添加Swagger注解：

```typescript
/**
 * @swagger
 * /api/path:
 *   post:
 *     tags:
 *       - ModuleName
 *     summary: 接口摘要
 *     description: 接口详细描述
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field1:
 *                 type: string
 *                 description: 字段描述
 *     responses:
 *       200:
 *         description: 成功响应
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       # 响应数据结构
 */
router.post('/path', handler);
```

2. 更新Postman集合和环境变量

3. 更新API文档索引

### 文档规范

- 使用中文描述
- 提供完整的请求/响应示例
- 包含各种错误场景
- 注明所需权限
- 添加业务规则说明

## 相关文件

- **Swagger配置**: `src/config/swagger.ts`
- **API路由**: `src/routes/v1/`
- **Postman集合**: `docs/api/zhongdao-mall-api.postman_collection.json`
- **环境变量**: `docs/api/postman-environment.json`
- **API索引**: `docs/api/API文档索引.md`

## 联系方式

如有问题或建议，请联系开发团队：

- 邮箱：dev@zhongdao-mall.com
- 项目地址：[内部Git仓库]

---

**最后更新**: 2025-12-12
