# Admin系统测试指南

## 概述

本文档详细说明了中道商城Admin系统的测试策略、测试用例和性能基准。Admin系统作为平台的核心管理模块，需要确保其功能的正确性、安全性和高性能。

## 测试架构

### 测试文件结构
```
tests/api/
├── admin.test.ts              # Admin基础功能测试
├── admin-roles.test.ts        # Admin角色和权限详细测试
├── admin-performance.test.ts  # Admin操作性能测试
└── admin-compatibility.test.ts # Admin系统兼容性测试
```

### 测试覆盖范围

1. **认证与授权**
   - Admin用户身份验证
   - JWT令牌验证
   - 权限级别控制
   - 会话管理

2. **用户管理**
   - 创建/更新/删除用户
   - 用户等级管理
   - 用户状态控制（启用/禁用）
   - 批量用户操作

3. **商品管理**
   - 商品CRUD操作
   - 分类管理
   - 库存管理
   - 价格管理

4. **订单管理**
   - 订单查询
   - 订单状态更新
   - 订单统计
   - 退款处理

5. **积分管理**
   - 积分充值
   - 积分冻结/解冻
   - 积分转账
   - 积分明细

6. **系统配置**
   - 配置项管理
   - 系统参数调整
   - 功能开关控制

7. **数据统计与导出**
   - 用户统计
   - 订单统计
   - 财务统计
   - 数据导出

## 运行测试

### 命令行运行

```bash
# 运行所有Admin测试
npm run test:admin

# 运行特定测试文件
npx vitest run tests/api/admin.test.ts
npx vitest run tests/api/admin-roles.test.ts
npx vitest run tests/api/admin-performance.test.ts

# 生成覆盖率报告
npm run test:admin:coverage

# 运行性能基准测试
npm run test:admin:performance
```

### 测试环境配置

测试使用独立的测试数据库，确保不影响生产数据：

```typescript
// tests/config/test-security.config.ts
export const testDatabaseConfig = {
  url: process.env.TEST_DATABASE_URL,
  isolation: true,
  autoCleanup: true
};
```

## 测试用例详解

### 1. Admin认证测试

```typescript
describe('Admin用户认证测试', () => {
  it('Admin用户应能成功访问系统', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set(adminHeaders)
      .expect(200);

    expect(response.body.data.role).toBe('ADMIN');
    expect(response.body.data.permissions).toContain('admin:access');
  });
});
```

### 2. 权限控制测试

验证不同角色用户的权限边界：

```typescript
describe('权限隔离测试', () => {
  it('非Admin用户不能访问管理端点', async () => {
    const adminEndpoints = [
      '/api/v1/admin/users',
      '/api/v1/admin/products',
      '/api/v1/admin/orders'
    ];

    for (const endpoint of adminEndpoints) {
      await request(app)
        .get(endpoint)
        .set(directorHeaders) // 总监权限
        .expect(403);
    }
  });
});
```

### 3. 性能测试基准

定义了严格的性能要求：

| 操作类型 | 响应时间要求 | 并发数 | 数据量 |
|---------|-------------|--------|--------|
| 用户列表查询 | < 1000ms | 10 | 10,000条 |
| 商品搜索 | < 500ms | 20 | 50,000条 |
| 订单统计 | < 1500ms | 5 | 100,000条 |
| 数据导出 | < 5000ms | 1 | 10,000条 |
| 配置更新 | < 200ms | 10 | - |

## 性能优化建议

### 1. 数据库优化

- **索引优化**
  ```sql
  -- 用户查询索引
  CREATE INDEX idx_users_level_status ON users(level, status);
  CREATE INDEX idx_users_created_at ON users(created_at);

  -- 订单查询索引
  CREATE INDEX idx_orders_user_status ON orders(user_id, status);
  CREATE INDEX idx_orders_created_at ON orders(created_at);
  ```

- **查询优化**
  ```typescript
  // 使用分页避免全表扫描
  const users = await prisma.user.findMany({
    skip: (page - 1) * perPage,
    take: perPage,
    where: {
      level: params.level,
      status: 'ACTIVE'
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  ```

### 2. 缓存策略

```typescript
// Redis缓存热点数据
const cacheKey = `admin:stats:${date}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

// 生成统计数据
const stats = await generateStatistics();
await redis.setex(cacheKey, 300, JSON.stringify(stats)); // 5分钟缓存
```

### 3. 异步处理

```typescript
// 大数据导出使用异步处理
app.post('/api/v1/admin/export/async', async (req, res) => {
  const taskId = uuidv4();

  // 异步处理导出任务
  exportQueue.add('export', {
    taskId,
    format: req.body.format,
    filters: req.body.filters
  });

  res.json({ taskId, status: 'processing' });
});
```

## 测试数据管理

### 测试用户创建

```typescript
// tests/helpers/auth.helper.ts
export async function createTestUser(type: TestUserType, overrides?: any) {
  const userData = {
    phone: `1380013${Math.random().toString().slice(2, 6)}`,
    password: 'test123456',
    level: type,
    status: 'ACTIVE',
    ...overrides
  };

  return await prisma.user.create({ data: userData });
}
```

### 数据清理策略

```typescript
// tests/helpers/database.helper.ts
export async function cleanupTestData() {
  // 清理测试用户
  await prisma.user.deleteMany({
    where: {
      phone: { startsWith: '1380013' }
    }
  });

  // 清理测试商品
  await prisma.product.deleteMany({
    where: {
      name: { contains: '测试' }
    }
  });
}
```

## 持续集成配置

### GitHub Actions示例

```yaml
name: Admin System Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
    - uses: actions/checkout@v2

    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Run Admin tests
      run: npm run test:admin

    - name: Upload coverage
      uses: codecov/codecov-action@v1
```

## 测试报告解读

### 覆盖率报告

运行 `npm run test:admin:coverage` 后会生成详细的覆盖率报告：

- **行覆盖率**: 应达到90%以上
- **函数覆盖率**: 应达到95%以上
- **分支覆盖率**: 应达到85%以上
- **语句覆盖率**: 应达到90%以上

### 性能报告

性能测试会生成包含以下指标的报告：

- **响应时间分布**
- **吞吐量**
- **错误率**
- **资源使用率**

## 常见问题排查

### 1. 测试数据库连接失败

```bash
# 检查测试数据库配置
echo $TEST_DATABASE_URL

# 重启测试数据库
npm run db:test:restart
```

### 2. 权限测试失败

检查以下配置：

```typescript
// 确保测试环境正确配置
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
```

### 3. 性能测试超时

调整测试超时配置：

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    timeout: 30000, // 30秒
    hookTimeout: 10000
  }
});
```

## 最佳实践

### 1. 测试隔离

- 每个测试用例使用独立的数据
- 使用事务回滚确保数据清理
- 避免测试之间的依赖关系

### 2. 测试数据工厂

使用工厂模式创建测试数据：

```typescript
export class UserFactory {
  static create(type: TestUserType, overrides?: any) {
    return {
      phone: faker.phone.number('1380013####'),
      password: 'test123456',
      level: type,
      status: 'ACTIVE',
      ...overrides
    };
  }
}
```

### 3. 断言最佳实践

- 使用具体的断言而非通用断言
- 验证业务逻辑而不仅是技术实现
- 包含边界条件测试

### 4. Mock策略

合理使用Mock避免外部依赖：

```typescript
// Mock外部服务
vi.mock('../../services/external.service', () => ({
  sendNotification: vi.fn().mockResolvedValue(true),
  processPayment: vi.fn().mockResolvedValue({ success: true })
}));
```

## 总结

Admin系统测试是确保平台稳定运行的关键环节。通过完善的测试覆盖、严格的性能基准和持续的集成流程，可以保证Admin系统的质量和可靠性。

定期运行测试、分析报告并优化性能是维持系统健康的重要手段。建议：

1. 每次代码提交都运行完整测试套件
2. 定期审查和更新测试用例
3. 监控性能基准并及时优化
4. 保持测试数据和配置的更新
5. 建立测试失败预警机制

通过遵循本指南，可以构建高质量、高性能的Admin系统。