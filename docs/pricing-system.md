# 差异化定价系统文档

## 概述

中道商城的差异化定价系统是一个核心商业逻辑基础，根据用户等级实现商品价格的动态计算。系统支持多种折扣策略、批量价格管理、特殊定价规则以及高性能的价格缓存机制。

## 核心特性

### 1. 用户等级折扣体系

系统支持以下用户等级的差异化定价：

| 用户等级 | 折扣率 | 显示名称 | 说明 |
|---------|--------|----------|------|
| NORMAL | 0% | 普通会员 | 无折扣 |
| VIP | 5% | VIP会员 | 95折 |
| STAR_1 | 40% | 一星店长 | 4折 |
| STAR_2 | 35% | 二星店长 | 3.5折 |
| STAR_3 | 30% | 三星店长 | 3折 |
| STAR_4 | 26% | 四星店长 | 2.6折 |
| STAR_5 | 24% | 五星店长 | 2.4折 |
| DIRECTOR | 22% | 董事 | 2.2折 |

### 2. 特殊定价规则

- **固定价格**: 为特定等级用户设置固定价格
- **优先级**: 特殊定价优先于等级折扣
- **灵活性**: 支持商品规格级别的特殊定价

### 3. 批量价格管理

- **批量计算**: 一次计算多个商品的价格
- **批量更新**: 批量设置多个商品的定价规则
- **汇总统计**: 提供总计金额、总折扣等统计信息

### 4. 高性能缓存

- **内存缓存**: 价格计算结果自动缓存
- **TTL机制**: 可配置缓存过期时间
- **智能清除**: 价格更新时自动清除相关缓存

## 快速开始

### 基础使用

```typescript
import { pricingService, UserLevel } from '../src/modules/products';

// 计算商品价格
const priceResult = await pricingService.calculatePrice(
  'product-123',
  UserLevel.VIP
);

console.log(`最终价格: ¥${priceResult.finalPrice}`);
console.log(`折扣率: ${(priceResult.discountRate * 100).toFixed(1)}%`);
```

### 批量计算

```typescript
const params = {
  userLevel: UserLevel.STAR_2,
  items: [
    { productId: 'prod-001', quantity: 2 },
    { productId: 'prod-002', quantity: 1 }
  ]
};

const results = await pricingService.batchCalculatePrices(params);
```

### 特殊定价设置

```typescript
// 为VIP会员设置特殊价格
await pricingService.updateProductPricing({
  productId: 'prod-001',
  userLevel: UserLevel.VIP,
  price: 85, // 特殊价格
  isSpecialPrice: true
});
```

## API 接口

### 1. 计算商品价格

**GET** `/api/v1/products/pricing/calculate`

**查询参数:**
- `productId` (必需): 商品ID
- `userLevel` (必需): 用户等级
- `specId` (可选): 商品规格ID
- `quantity` (可选): 购买数量

**响应示例:**
```json
{
  "success": true,
  "data": {
    "productId": "prod-001",
    "basePrice": 100,
    "userLevel": "VIP",
    "finalPrice": 95,
    "discountRate": 0.05,
    "discountAmount": 5,
    "isSpecialPrice": false
  }
}
```

### 2. 批量计算价格

**POST** `/api/v1/products/pricing/batch-calculate`

**请求体:**
```json
{
  "userLevel": "STAR_1",
  "items": [
    {
      "productId": "prod-001",
      "specId": "spec-001",
      "quantity": 2
    }
  ]
}
```

### 3. 更新商品定价

**POST** `/api/v1/products/pricing/update`

**请求体:**
```json
{
  "productId": "prod-001",
  "userLevel": "VIP",
  "price": 85,
  "isSpecialPrice": true
}
```

### 4. 批量更新定价

**POST** `/api/v1/products/pricing/batch-update`

**请求体:**
```json
{
  "updates": [
    {
      "productId": "prod-001",
      "userLevel": "STAR_1",
      "price": 50
    }
  ]
}
```

### 5. 获取商品所有等级定价

**GET** `/api/v1/products/pricing/product/:productId/levels`

### 6. 获取折扣配置

**GET** `/api/v1/products/pricing/discounts/levels`

### 7. 缓存管理

- **GET** `/api/v1/products/pricing/cache/stats` - 获取缓存统计
- **POST** `/api/v1/products/pricing/cache/clear` - 清除缓存

## 核心服务类

### PricingService

主要的价格计算和管理服务。

#### 主要方法

##### `calculatePrice(productId, userLevel, specId?)`

计算单个商品的价格。

**参数:**
- `productId`: 商品ID
- `userLevel`: 用户等级
- `specId`: 商品规格ID（可选）

**返回:** `Promise<PriceResult>`

##### `batchCalculatePrices(params)`

批量计算商品价格。

**参数:** `BatchPriceCalculationParams`
```typescript
{
  userLevel: UserLevel;
  items: Array<{
    productId: string;
    specId?: string;
    quantity?: number;
  }>;
}
```

##### `updateProductPricing(params)`

更新商品定价。

**参数:** `PriceUpdateParams`
```typescript
{
  productId: string;
  specId?: string;
  userLevel: UserLevel;
  price: number;
  isSpecialPrice?: boolean;
}
```

##### `batchUpdateProductPricing(params)`

批量更新商品定价。

##### `getProductPricingForAllLevels(productId, specId?)`

获取商品所有等级的定价。

##### `deleteProductPricing(productId, userLevel, specId?)`

删除商品定价。

##### `getLevelDiscountInfo(userLevel)`

获取等级折扣信息。

##### `getAllLevelDiscounts()`

获取所有等级折扣配置。

##### `calculatePriceForUser(productId, userId, specId?)`

根据用户ID计算价格（便捷方法）。

## 数据模型

### ProductPricing

差异化定价记录表。

**字段:**
- `id`: 主键
- `productId`: 商品ID
- `specId`: 商品规格ID（可选）
- `userLevel`: 用户等级
- `price`: 价格
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

**唯一约束:** `[productId, specId, userLevel]`

## 类型定义

### PriceResult

价格计算结果。

```typescript
interface PriceResult {
  productId: string;
  specId?: string;
  basePrice: number;
  userLevel: UserLevel;
  finalPrice: number;
  discountRate: number;
  discountAmount: number;
  isSpecialPrice: boolean;
}
```

### SpecialPricingRule

特殊定价规则。

```typescript
interface SpecialPricingRule {
  id: string;
  productId: string;
  specId?: string;
  userLevel: UserLevel;
  ruleType: 'FIXED_PRICE' | 'DISCOUNT_RATE' | 'DISCOUNT_AMOUNT';
  ruleValue: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  maxQuantity?: number;
  description?: string;
}
```

## 缓存策略

### 缓存键格式

```
price:{productId}:{userLevel}[:{specId}]
```

例如:
- `price:prod-001:VIP`
- `price:prod-001:STAR_1:spec-001`

### 缓存TTL

- 默认TTL: 5分钟
- 可通过 `setCacheTTL()` 方法自定义
- 价格更新时自动清除相关缓存

### 缓存统计

```typescript
const stats = pricingService.getCacheStats();
// 返回: { size: number, ttl: number }
```

## 性能优化

### 1. 数据库索引

确保以下字段有适当索引:
- `product_pricing` 表: `[productId, specId, userLevel]`
- `products` 表: `id`, `status`
- `product_specs` 表: `productId`, `id`

### 2. 批量操作

- 使用批量接口减少数据库查询
- 一次查询多个商品信息
- 批量计算减少重复计算

### 3. 缓存策略

- 频繁访问的价格使用缓存
- 价格更新时及时清除缓存
- 合理设置缓存TTL

## 错误处理

### 常见错误码

- `PRODUCT_NOT_FOUND`: 商品不存在
- `INVALID_USER_LEVEL`: 无效的用户等级
- `INVALID_PRICE`: 无效的价格
- `SPEC_NOT_FOUND`: 商品规格不存在
- `CALCULATION_ERROR`: 价格计算错误

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "商品不存在",
    "details": "..."
  }
}
```

## 最佳实践

### 1. 价格计算

- 优先使用批量计算接口
- 合理设置缓存TTL
- 处理价格为0或负数的情况

### 2. 定价管理

- 使用事务确保数据一致性
- 定价变更时记录操作日志
- 提供定价审批流程

### 3. 性能监控

- 监控价格计算响应时间
- 统计缓存命中率
- 记录定价变更操作

### 4. 安全考虑

- 验证用户权限
- 防止价格篡改
- 记录敏感操作

## 扩展功能

### 1. 限时特价

可以基于现有框架扩展限时特价功能:

```typescript
interface SpecialPricingRule {
  // ... 现有字段
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
}
```

### 2. 数量折扣

支持基于购买数量的阶梯定价:

```typescript
interface QuantityDiscount {
  minQuantity: number;
  maxQuantity?: number;
  discountRate: number;
}
```

### 3. 促销活动

集成促销活动系统:

```typescript
interface PromotionPricing {
  promotionId: string;
  discountType: 'PERCENTAGE' | 'FIXED' | 'BOGO';
  discountValue: number;
  conditions: any;
}
```

## 测试

运行测试:

```bash
# 运行单元测试
npm test -- tests/units/services/pricing.service.test.ts

# 运行集成测试
npm test -- tests/integration/services/
```

## 更新日志

### v1.0.0 (2024-11-20)

- ✅ 实现基础价格计算功能
- ✅ 支持8个用户等级的差异化定价
- ✅ 实现特殊定价规则
- ✅ 添加批量价格管理功能
- ✅ 实现高性能缓存机制
- ✅ 提供完整的REST API接口
- ✅ 添加单元测试和集成测试
- ✅ 完善的错误处理和日志记录
- ✅ 详细的文档和使用示例

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 运行测试
5. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证。