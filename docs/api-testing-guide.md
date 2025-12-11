# 中道商城API测试指南

**更新日期**: 2025年12月17日
**系统状态**: ✅ 测试工具已准备就绪

---

## 🎯 测试概览

### 已准备的测试工具

1. **完整API测试** (`test-all-api-endpoints.js`)
   - 测试所有45个API端点
   - 支持认证和权限测试
   - 生成详细的测试报告

2. **公共API测试** (`test-public-api.js`)
   - 测试11个不需要认证的公共端点
   - 快速验证系统基本功能

3. **单元测试套件** (`tests/`)
   - 使用Vitest测试框架
   - 包含API、数据库、集成测试

---

## 🚀 快速开始

### 1. 启动服务器

```bash
# 开发模式
npm run dev

# 或
npm run start:dev
```

服务器将在 http://localhost:3000 启动

### 2. 运行公共API测试

```bash
node test-public-api.js
```

### 3. 运行完整API测试

```bash
# 需要先配置测试Token
node test-all-api-endpoints.js
```

### 4. 运行单元测试

```bash
# 运行所有测试
npm test

# 运行API测试
npm run test:api

# 运行集成测试
npm run test:integration
```

---

## 📋 测试端点列表

### 健康检查端点
- `GET /health` - 基本健康检查
- `GET /health/detailed` - 详细健康检查（含系统指标）
- `GET /health/database` - 数据库健康检查
- `GET /health/redis` - Redis状态检查
- `GET /health/security` - 安全状态检查

### 认证相关端点
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/wechat-login` - 微信登录
- `GET /api/v1/auth/me` - 获取当前用户信息

### 用户管理端点
- `GET /api/v1/users` - 获取用户列表（需管理员权限）
- `GET /api/v1/users/profile` - 获取用户资料
- `PUT /api/v1/users/profile` - 更新用户资料
- `GET /api/v1/users/{id}` - 获取指定用户信息

### 商品管理端点
- `GET /api/v1/products` - 获取商品列表
- `GET /api/v1/products/{id}` - 获取商品详情
- `GET /api/v1/products/categories` - 获取商品分类
- `GET /api/v1/products/tags` - 获取商品标签
- `GET /api/v1/products/specs` - 获取商品规格

### 订单管理端点
- `GET /api/v1/orders` - 获取订单列表
- `POST /api/v1/orders` - 创建订单
- `GET /api/v1/orders/{id}` - 获取订单详情
- `PUT /api/v1/orders/{id}/status` - 更新订单状态

### 积分系统端点
- `GET /api/v1/points/balance` - 获取积分余额
- `GET /api/v1/points/statistics` - 获取积分统计
- `GET /api/v1/points/transactions` - 获取积分交易记录
- `POST /api/v1/points/transfer` - 积分转账
- `POST /api/v1/points/recharge` - 积分充值

### 店铺管理端点
- `GET /api/v1/shops` - 获取店铺列表
- `GET /api/v1/shops/{id}` - 获取店铺详情
- `GET /api/v1/shops/my` - 获取我的店铺
- `POST /api/v1/shops` - 创建店铺

### 团队管理端点
- `GET /api/v1/teams` - 获取团队信息
- `GET /api/v1/teams/performance` - 获取团队业绩
- `GET /api/v1/teams/tree` - 获取团队树形结构
- `POST /api/v1/teams/invite` - 邀请团队成员

### 库存管理端点
- `GET /api/v1/inventory` - 获取库存列表
- `GET /api/v1/inventory/alerts` - 获取库存警报
- `PUT /api/v1/inventory/adjust` - 调整库存
- `GET /api/v1/inventory/logs` - 获取库存日志

### 支付相关端点
- `GET /api/v1/payments/methods` - 获取支付方式
- `POST /api/v1/payments/create` - 创建支付
- `POST /api/v1/payments/callback/wechat` - 微信支付回调
- `POST /api/v1/payments/callback/alipay` - 支付宝回调

### 管理员端点
- `GET /api/v1/admin/dashboard` - 管理员仪表板
- `GET /api/v1/admin/users` - 用户管理
- `GET /api/v1/admin/orders` - 订单管理
- `GET /api/v1/admin/products` - 商品管理
- `GET /api/v1/admin/shops` - 店铺管理

### 等级系统端点
- `GET /api/v1/levels` - 获取等级列表
- `GET /api/v1/levels/requirements` - 获取等级要求
- `POST /api/v1/levels/upgrade` - 申请升级

### 佣金系统端点
- `GET /api/v1/commission` - 获取佣金信息
- `GET /api/v1/commission/history` - 获取佣金历史
- `POST /api/v1/commission/withdraw` - 申请佣金提现
- `GET /api/v1/commission/statistics` - 获取佣金统计

### 通知系统端点
- `GET /api/v1/notifications` - 获取通知列表
- `GET /api/v1/notifications/preferences` - 获取通知偏好
- `PUT /api/v1/notifications/read` - 标记通知已读
- `GET /api/v1/notifications/statistics` - 获取通知统计

---

## 🔧 测试配置

### 1. 配置测试Token

编辑 `test-all-api-endpoints.js` 中的 `testTokens`：

```javascript
const testTokens = {
    admin: '你的管理员Token',
    user: '你的用户Token'
};
```

### 2. 生成测试Token

使用提供的脚本：

```bash
# 生成管理员Token
node generate-admin-token.js

# 生成普通用户Token
node generate-user-token.js
```

### 3. 配置测试环境

创建 `.env.test`：

```env
NODE_ENV=test
DATABASE_URL=mysql://test_user:test_pass@localhost:3306/zhongdao_mall_test
JWT_SECRET=test-jwt-secret
```

---

## 📊 测试报告

### 1. 公共API测试报告

```
🔍 测试公共API端点...

测试: /health
  ✅ 200 - OK
测试: /health/database
  ✅ 200 - OK
...

📊 测试结果:
  成功: 11
  失败: 0
  成功率: 100.0%

✨ 所有公共API端点正常工作！
```

### 2. 完整API测试报告

测试报告将保存为 `api-test-report-YYYY-MM-DD.json`：

```json
{
  "timestamp": "2025-12-17T10:00:00.000Z",
  "summary": {
    "total": 45,
    "success": 42,
    "failed": 3,
    "successRate": 93.3,
    "avgResponseTime": 125,
    "maxResponseTime": 850
  },
  "errors": [
    {
      "endpoint": "POST /api/v1/commission/withdraw",
      "error": "Insufficient balance"
    }
  ]
}
```

---

## 🧪 单元测试

### 1. API测试

```bash
npm run test:api
```

测试文件：
- `tests/api/auth.test.ts` - 认证功能测试
- `tests/api/products.test.ts` - 商品管理测试
- `tests/api/points.test.ts` - 积分系统测试
- `tests/api/users.test.ts` - 用户管理测试

### 2. 数据库测试

```bash
npm run test:db
```

测试文件：
- `tests/database/test-database.helper.ts` - 数据库测试辅助
- `tests/database/connection.test.ts` - 连接池测试

### 3. 集成测试

```bash
npm run test:integration
```

测试完整业务流程：
- 用户注册 → 创建店铺 → 发布商品 → 下单 → 支付

---

## 📝 测试最佳实践

### 1. 测试数据准备

使用测试数据库，避免影响生产数据：

```javascript
beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
});
```

### 2. 断言最佳实践

```javascript
// 验证响应结构
expect(response.body).toHaveProperty('code');
expect(response.body).toHaveProperty('message');
expect(response.body).toHaveProperty('data');

// 验证状态码
expect(response.status).toBe(200);

// 验证数据类型
expect(typeof response.body.data).toBe('object');
```

### 3. 异步测试

```javascript
it('should handle async operations', async () => {
  const response = await request(app)
    .post('/api/v1/orders')
    .send(orderData);

  expect(response.status).toBe(201);
});
```

---

## 🚨 常见问题

### 1. 服务器未运行

```bash
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**解决方案**：
```bash
npm run dev
```

### 2. Token过期

```bash
Error: jwt expired
```

**解决方案**：
生成新的Token或更新测试脚本中的Token

### 3. 测试数据库连接失败

```bash
Error: connect ECONNREFUSED database
```

**解决方案**：
- 检查MySQL服务是否运行
- 验证 `.env.test` 配置
- 创建测试数据库

### 4. 端口占用

```bash
Error: listen EADDRINUSE :::3000
```

**解决方案**：
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或使用其他端口
PORT=3001 npm run dev
```

---

## 📞 技术支持

测试相关问题：

1. 查看测试文档
2. 检查 `tests/` 目录下的示例
3. 查看日志文件：`logs/test.log`
4. 联系开发团队

---

**最后更新**: 2025年12月17日
**文档版本**: v1.0