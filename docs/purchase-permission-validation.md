# 采购权限验证功能文档

## 概述

本文档描述了"中道商城系统"中采购权限验证功能的实现。该功能确保用户只能向更高级别且非平级的上级进货，这是多层级供应链社交电商平台的核心业务规则。

## 核心业务规则

### 1. 用户等级体系
```
NORMAL → VIP → STAR_1 → STAR_2 → STAR_3 → STAR_4 → STAR_5 → DIRECTOR
```

### 2. 采购规则
- **基本规则**：用户只能向更高级别的用户进货
- **平级处理**：如果上级与自己平级，需要再往上找更高等级
- **团队限制**：必须在团队内才能进行采购
- **业绩计算**：采购链路中所有中间人都算业绩

## 技术实现

### 主要文件结构
```
src/modules/purchase/
├── purchase.service.ts          # 主要实现文件
└── purchase.service.test.ts     # 单元测试

tests/
├── unit/services/
│   └── purchase.service.test.ts # 单元测试
└── integration/services/
    └── purchase.service.integration.test.ts # 集成测试
```

### 核心方法

#### `validatePurchasePermission`
这是主要的权限验证方法，包含以下验证步骤：

1. **基础验证**：用户存在性检查
2. **账户状态验证**：检查用户是否为ACTIVE状态
3. **团队关系验证**：验证采购方和销售方是否在同一团队
4. **等级关系验证**：处理复杂的等级比较逻辑
5. **产品和库存验证**：检查商品状态和库存
6. **采购限制验证**：检查用户等级和数量限制

#### `findHigherLevelUpline`
向上查找更高级别的上级，处理平级上级的特殊情况。

#### `getUplineChain`
获取完整的上级链，支持多种优化策略：
- 使用 `teamPath` 字段进行批量查询优化
- 回退到逐级查询方案
- 带缓存机制提升性能

### 性能优化

#### 1. 缓存机制
- **用户信息缓存**：缓存用户基本信息，减少重复查询
- **产品信息缓存**：缓存产品状态和库存信息
- **上级链缓存**：缓存用户上级关系，优化复杂查询
- **缓存TTL**：5分钟自动过期
- **缓存大小限制**：最大1000条记录，LRU淘汰策略

#### 2. 查询优化
- **批量查询**：使用 `IN` 查询减少数据库往返次数
- **字段选择**：只查询必要字段，减少数据传输
- **索引利用**：充分利用数据库索引提升查询速度
- **并行查询**：使用 `Promise.all` 并行执行独立查询

#### 3. 性能监控
```typescript
// 获取性能统计
const stats = purchaseService.getPerformanceStats();
console.log(stats);
// {
//   totalValidations: 1000,
//   cacheHits: 750,
//   cacheMisses: 250,
//   averageResponseTime: 45,
//   cacheHitRate: 75,
//   cacheSize: {
//     user: 150,
//     product: 80,
//     uplineChain: 200
//   }
// }
```

## 使用示例

### 基本使用
```typescript
import { purchaseService } from './src/modules/purchase/purchase.service';

const result = await purchaseService.validatePurchasePermission(
  'buyer-user-id',
  'seller-user-id',
  'product-id',
  10 // 采购数量
);

if (result.canPurchase) {
  console.log('采购权限验证通过');
} else {
  console.log('采购权限验证失败:', result.reasons);
}
```

### 错误处理
```typescript
try {
  const result = await purchaseService.validatePurchasePermission(
    buyerId,
    sellerId,
    productId,
    quantity
  );

  // 处理验证结果
  if (!result.isValid) {
    // 记录详细的失败原因
    logger.warn('采购权限验证失败', {
      buyerId,
      sellerId,
      reasons: result.reasons,
      metadata: result.metadata
    });
  }
} catch (error) {
  // 处理系统级错误
  logger.error('采购权限验证异常', { error });
}
```

### 性能监控
```typescript
// 获取性能统计
const stats = purchaseService.getPerformanceStats();

// 清理缓存（如果需要）
purchaseService.clearCache();
```

## 测试

### 单元测试
```bash
# 运行所有单元测试
npm run test:unit

# 运行特定测试文件
npm test -- tests/unit/services/purchase.service.test.ts
```

### 集成测试
```bash
# 运行所有集成测试
npm run test:integration

# 运行特定集成测试
npm test -- tests/integration/services/purchase.service.integration.test.ts
```

### 测试覆盖率
```bash
# 生成测试覆盖率报告
npm run test:coverage
```

## 业务场景示例

### 场景1：正常采购流程
- 用户A（NORMAL）向用户B（VIP）采购
- 验证结果：✅ 通过
- 原因：采购方等级低于销售方等级

### 场景2：平级上级处理
- 用户C（STAR_1）向用户D（STAR_1）采购
- 系统自动查找用户E（STAR_2）作为最终销售方
- 验证结果：✅ 通过（自动找到更高级别上级）
- 原因：找到符合等级要求的上级

### 场景3：违规采购
- 用户F（STAR_3）向用户G（VIP）采购
- 验证结果：❌ 失败
- 原因：采购方等级高于销售方等级

### 场景4：无团队关系
- 用户H向无团队关系的用户I采购
- 验证结果：❌ 失败
- 原因：采购方与销售方无有效团队关系

## 配置选项

### 缓存配置
```typescript
// 在 purchase.service.ts 中修改
const CACHE_TTL = 5 * 60 * 1000; // 缓存时间（毫秒）
const MAX_CACHE_SIZE = 1000; // 最大缓存条目数
```

### 搜索深度配置
```typescript
// 限制向上搜索的深度
const maxDepth = 10; // 最多向上查找10级
```

## 监控和日志

### 关键指标
- 响应时间
- 缓存命中率
- 验证成功率
- 错误类型分布

### 日志级别
- **ERROR**：系统级错误
- **WARN**：业务验证失败
- **INFO**：性能统计和缓存操作

## 故障排查

### 常见问题

#### 1. 验证失败
- 检查用户等级是否正确
- 验证团队关系是否存在
- 确认商品状态和库存

#### 2. 性能问题
- 检查缓存命中率
- 分析数据库查询日志
- 考虑增加索引

#### 3. 缓存问题
- 清理缓存：`purchaseService.clearCache()`
- 检查缓存大小限制
- 验证TTL设置

### 调试模式
```typescript
// 获取详细的验证信息
const result = await purchaseService.validatePurchasePermission(...);
console.log('验证详情:', result.metadata);

// 获取性能统计
const stats = purchaseService.getPerformanceStats();
console.log('性能统计:', stats);
```

## 扩展建议

### 1. 分布式缓存
- 考虑使用 Redis 替代内存缓存
- 支持多实例缓存共享

### 2. 实时更新
- 实现缓存失效机制
- 监听数据库变更事件

### 3. 更复杂的业务规则
- 支持限时特殊权限
- 区域限制验证
- 黑名单机制

## 版本历史

- **v1.0.0**：基础功能实现
- **v1.1.0**：添加性能优化和缓存机制
- **v1.2.0**：完善测试覆盖率和错误处理

## 贡献指南

1. 确保代码通过所有测试
2. 更新相关文档
3. 遵循现有代码风格
4. 添加适当的错误处理
5. 考虑性能影响