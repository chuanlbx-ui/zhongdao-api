# 系统配置管理框架使用指南

## 📌 概述

这是一个完整的参数管理系统，用于管理所有可变的业务参数（会员等级、折扣比例、佣金比例等），避免硬编码参数在代码中。

## 🚀 快速开始

### 1. 初始化配置（应用启动时）

在主应用启动文件中调用初始化函数：

```typescript
import { initializeConfigs } from './modules/config';

// 应用启动时
app.listen(PORT, async () => {
  // 初始化所有配置
  await initializeConfigs();
  console.log('✓ 系统配置已初始化');
});
```

### 2. 在业务逻辑中使用配置

不再使用硬编码的常量：

```typescript
// ❌ 旧方法 - 硬编码参数
const minBottles = 4;  // 不好，参数改了要改代码

// ✅ 新方法 - 动态读取参数
import { configService } from '../modules/config';

const minBottles = await configService.getConfig<number>(
  'cloud_shop_level_1_minBottles',
  4  // 默认值
);
```

### 3. 参数命名规范

所有参数使用 `snake_case` 命名，格式为：

```
<模块>_<功能>_<属性>

示例：
- cloud_shop_level_1_minBottles         // 云店一级最低瓶数
- cloud_shop_level_1_purchaseDiscount   // 云店一级采购折扣
- commission_personal_rate              // 个人销售佣金比例
- points_min_transfer_amount            // 通券最低转账金额
- order_auto_cancel_minutes             // 订单自动取消时间
```

## 📊 支持的配置分类

### 1. 云店等级配置 (cloud_shop_levels)

存储所有云店等级的参数：

```typescript
{
  "cloud_shop_level_1": {
    "level": 1,
    "name": "一星店长",
    "minBottles": 4,
    "minTeamSize": 0,
    "minDirectMembers": 0,
    "purchaseDiscount": 0.4,
    "monthlyTarget": 2400,
    "monthlyCommission": 600,
    "description": "基础店长等级，无团队要求"
  },
  "cloud_shop_level_2": { ... }
}
```

### 2. 佣金配置 (commission)

```typescript
- commission_personal_rate         // 个人销售佣金比例
- commission_direct_referral_rate  // 直推佣金比例
- commission_indirect_referral_rate // 间接推荐佣金比例
- commission_team_bonus_rate       // 团队奖金比例
- commission_level_bonus_rate      // 等级奖金比例
- commission_performance_threshold // 业绩奖金阈值
```

### 3. 通券配置 (points)

```typescript
- points_min_transfer_amount      // 最低转账金额
- points_max_transfer_amount      // 最高转账金额
- points_daily_transfer_limit     // 每日转账限额
- points_transfer_fee_rate        // 转账手续费率
- points_freeze_threshold         // 冻结阈值
```

### 4. 订单配置 (order)

```typescript
- order_auto_cancel_minutes       // 自动取消订单时间（分钟）
- order_refund_days               // 退款时限（天）
- order_default_shipping_fee      // 默认运费
- order_free_shipping_threshold   // 包邮阈值
```

### 5. 库存配置 (inventory)

```typescript
- inventory_warning_threshold     // 预警阈值
- inventory_auto_reorder_enabled  // 是否启用自动补货
- inventory_auto_reorder_quantity // 自动补货数量
```

## 💻 API 使用

### 获取单个配置

```typescript
const value = await configService.getConfig<number>(
  'cloud_shop_level_1_minBottles',
  4  // 默认值（如果配置不存在）
);
```

### 获取多个配置

```typescript
const configs = await configService.getConfigs<{
  minBottles: number;
  discount: number;
}>([
  'cloud_shop_level_1_minBottles',
  'cloud_shop_level_1_purchaseDiscount'
]);
```

### 获取某个分类的所有配置

```typescript
const cloudShopConfigs = await configService.getConfigsByCategory('cloud_shop_levels');
// 返回所有以 cloud_shop_levels 为分类的配置
```

### 更新配置

```typescript
await configService.updateConfig('cloud_shop_level_1_minBottles', 6, {
  description: '一级最低瓶数',
  category: 'cloud_shop_levels',
  type: 'NUMBER',
  lastModifiedBy: adminUserId
});
```

### 批量更新配置

```typescript
await configService.updateConfigs({
  'cloud_shop_level_1_minBottles': 6,
  'cloud_shop_level_1_purchaseDiscount': 0.35
}, {
  category: 'cloud_shop_levels',
  lastModifiedBy: adminUserId
});
```

### 删除配置

```typescript
await configService.deleteConfig('cloud_shop_level_1_minBottles');
```

### 清除缓存

```typescript
configService.clearCache();  // 清除所有配置缓存
```

## 🔄 缓存机制

配置服务内置 5 分钟缓存，可以提高性能：

- 首次读取时从数据库加载
- 之后 5 分钟内从内存缓存读取
- 更新或删除配置时自动清除缓存
- 可手动调用 `clearCache()` 立即清除缓存

## 📝 实际例子

### 例子1：在店铺服务中使用

```typescript
// 旧方法：硬编码
const CLOUD_SHOP_LEVELS = {
  1: {
    minBottles: 4,
    purchaseDiscount: 0.4,
  }
};

// 新方法：动态读取
import { configService } from '../config';

async checkCloudShopUpgrade(userId: string) {
  const minBottles = await configService.getConfig<number>(
    'cloud_shop_level_1_minBottles'
  );
  
  if (user.totalBottles >= minBottles) {
    // 可以升级
  }
}
```

### 例子2：在佣金计算中使用

```typescript
async calculateCommission(userId: string, salesAmount: number) {
  // 获取所有佣金配置
  const commissionConfigs = await configService.getConfigsByCategory('commission');
  
  const personalRate = await configService.getConfig<number>(
    'commission_personal_rate'
  );
  
  const commission = salesAmount * personalRate;
  
  // ... 保存佣金记录
}
```

### 例子3：在订单服务中使用

```typescript
async createOrder(userId: string, items: OrderItem[]) {
  const autoCancelMinutes = await configService.getConfig<number>(
    'order_auto_cancel_minutes',
    30  // 默认30分钟
  );
  
  const order = {
    // ... 订单信息
    cancelAt: new Date(Date.now() + autoCancelMinutes * 60 * 1000)
  };
  
  // ... 创建订单
}
```

## 🛠️ 后续：管理后台集成

当开发管理后台时，可以创建 API 端点来管理这些配置：

```typescript
// GET /api/v1/admin/configs - 获取所有配置
// GET /api/v1/admin/configs/:key - 获取单个配置
// PUT /api/v1/admin/configs/:key - 更新配置
// DELETE /api/v1/admin/configs/:key - 删除配置
```

这样运营人员就可以通过管理后台直接修改参数，无需改代码和重新部署。

## ✅ 检查清单

- [x] 建立 SystemConfig 数据库表
- [x] 创建 ConfigService 服务类
- [x] 实现配置CRUD操作
- [x] 实现内存缓存机制
- [x] 创建配置初始化脚本
- [x] 定义所有参数命名规范
- [ ] 集成到管理后台（后续）
- [ ] 创建配置管理 UI（后续）

## 🚨 注意事项

1. **首次启动**：必须调用 `initializeConfigs()` 初始化默认参数
2. **参数更新**：如果参数改了，管理后台更新时会自动清除缓存，但代码查询参数时要注意可能会读到新值
3. **类型安全**：使用泛型确保参数类型正确 `getConfig<number>()` `getConfig<boolean>()`
4. **默认值**：总是提供合理的默认值，防止参数不存在时出错
5. **性能**：配置读取很快（从缓存），但在性能要求极高的地方可以考虑批量获取

## 📚 相关文件

```
src/modules/config/
├── config.service.ts     // ConfigService 服务类
├── config.init.ts        // 配置初始化脚本
├── config.types.ts       // TypeScript 类型定义
├── index.ts             // 模块导出
└── USAGE.md            // 本文件
```
