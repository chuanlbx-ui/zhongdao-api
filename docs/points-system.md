# 中道商城积分通券多源流转引擎

## 概述

积分通券多源流转引擎是中道商城系统的核心价值流通组件，实现支持采购支付、用户转账、平台充值的积分通券系统，包含事务一致性、流水追踪、余额冻结机制。

## 核心特性

### 🎯 业务场景支持

1. **采购支付** (P0优先级) - 下级向上级采购商品时使用积分支付
2. **直推奖励** (P0优先级) - 系统向下级发放固定金额奖励
3. **平台充值** (P1优先级) - 五星/董事专属充值功能
4. **用户转账** (P1优先级) - 用户间灵活积分流转
5. **提现申请** - 所有店长可申请积分提现

### 🔒 安全机制

- **事务一致性** - 使用Prisma事务确保数据一致性
- **防重复提交** - 基于时间窗口的重复操作检测
- **余额冻结** - 订单支付时临时冻结积分
- **权限验证** - 基于用户等级的功能权限控制
- **审计追踪** - 完整的操作日志和流水记录

### ⚡ 性能优化

- **批量操作** - 支持批量转账和奖励发放
- **数据库优化** - 使用索引和事务优化
- **缓存策略** - 热点用户余额缓存支持
- **异步处理** - 高并发操作支持

## 架构设计

### 数据模型

```typescript
// PointsTransaction 数据模型
model PointsTransaction {
  id                String            @id @default(cuid())
  transactionNo     String            @unique @map("transaction_no")
  fromUserId        String?           @map("from_user_id")
  toUserId          String            @map("to_user_id")
  amount            Float             // 交易金额
  type              TransactionType   // 交易类型
  relatedOrderId    String?           @map("related_order_id")
  description       String?           // 交易描述
  metadata          Json?             // 额外数据
  status            TransactionStatus @default(PENDING)
  balanceBefore     Float             @map("balance_before")
  balanceAfter      Float             @map("balance_after")
  createdAt         DateTime          @default(now())
  completedAt       DateTime?
}

// User 表中的积分字段
model User {
  pointsBalance     Float             @default(0) @map("points_balance")
  pointsFrozen      Float             @default(0) @map("points_frozen")
}
```

### 交易类型

```typescript
export enum PointsTransactionType {
  PURCHASE = 'PURCHASE',    // 采购支付
  TRANSFER = 'TRANSFER',    // 用户转账
  RECHARGE = 'RECHARGE',    // 充值
  WITHDRAW = 'WITHDRAW',    // 提现
  REFUND = 'REFUND',        // 退款
  COMMISSION = 'COMMISSION', // 佣金
  REWARD = 'REWARD',        // 奖励
  FREEZE = 'FREEZE',        // 冻结
  UNFREEZE = 'UNFREEZE'    // 解冻
}
```

## API 接口

### 核心服务类：PointsService

#### 1. 余额管理

```typescript
// 获取用户积分余额
async getBalance(userId: string): Promise<PointsBalance>

// 冻结积分
async freezePoints(
  userId: string,
  amount: number,
  reason?: string,
  relatedOrderId?: string
): Promise<string>

// 解冻积分
async unfreezePoints(
  userId: string,
  amount: number,
  reason?: string,
  relatedOrderId?: string
): Promise<string>
```

#### 2. 转账功能

```typescript
// 单笔转账
async transfer(data: PointsTransactionData): Promise<PointsTransferResult>

// 批量转账
async batchTransfer(
  transfers: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    description?: string;
  }>,
  type: PointsTransactionType = PointsTransactionType.TRANSFER
): Promise<PointsTransferResult[]>
```

#### 3. 充值提现

```typescript
// 平台充值（五星/董事专属）
async recharge(
  userId: string,
  amount: number,
  paymentMethod: string = 'manual',
  description?: string,
  operatorId?: string
): Promise<PointsTransferResult>

// 提现申请
async withdrawPoints(
  userId: string,
  amount: number,
  withdrawalInfo: WithdrawalInfo,
  description?: string
): Promise<PointsTransferResult>

// 审核提现申请
async auditWithdrawal(
  transactionId: string,
  approved: boolean,
  auditRemark?: string,
  auditorId?: string
): Promise<void>
```

#### 4. 流水查询

```typescript
// 获取交易流水
async getTransactions(
  userId: string,
  page: number = 1,
  perPage: number = 20,
  type?: PointsTransactionType,
  startDate?: Date,
  endDate?: Date
): Promise<TransactionListResult>

// 获取积分统计信息
async getPointsStatistics(userId: string): Promise<PointsStatistics>
```

## 使用示例

### 1. 采购支付场景

```typescript
// 下级店长向上级采购商品
const result = await pointsService.transfer({
  fromUserId: 'shop_manager_a_id',
  toUserId: 'shop_manager_b_id',
  amount: 1000,
  type: PointsTransactionType.PURCHASE,
  description: '采购商品支付',
  relatedOrderId: 'order_12345',
  metadata: {
    productIds: ['prod_001', 'prod_002'],
    purchaseType: 'inventory_replenishment'
  }
});
```

### 2. 订单支付冻结机制

```typescript
// 1. 先冻结积分
const freezeTransactionNo = await pointsService.freezePoints(
  userId,
  orderAmount,
  '订单支付冻结',
  orderId
);

// 2. 执行转账支付
const transferResult = await pointsService.transfer({
  fromUserId: userId,
  toUserId: 'merchant_001',
  amount: orderAmount,
  type: PointsTransactionType.PURCHASE,
  relatedOrderId: orderId
});

// 3. 解冻积分
await pointsService.unfreezePoints(
  userId,
  orderAmount,
  '订单完成解冻',
  orderId
);
```

### 3. 直推奖励发放

```typescript
// 向下级发放直推奖励
await pointsService.transfer({
  fromUserId: 'SYSTEM',
  toUserId: 'shop_manager_a_id',
  amount: 500,
  type: PointsTransactionType.REWARD,
  description: '直推奖励',
  metadata: {
    rewardType: 'direct_referral',
    referredUserId: 'new_user_123',
    rewardAmount: 500
  }
});
```

### 4. 平台充值（五星/董事专属）

```typescript
// 五星店长充值
const result = await pointsService.recharge(
  'five_star_manager_id',
  10000,
  'bank_transfer',
  '银行转账充值',
  'admin_operator_id'
);
```

### 5. 批量奖励发放

```typescript
const rewardList = [
  { fromUserId: 'SYSTEM', toUserId: 'user_001', amount: 100, description: '活动奖励' },
  { fromUserId: 'SYSTEM', toUserId: 'user_002', amount: 150, description: '活动奖励' }
];

const results = await pointsService.batchTransfer(
  rewardList,
  PointsTransactionType.REWARD
);
```

## 权限控制

### 用户等级权限

| 功能 | NORMAL | ONE_STAR | TWO_STAR | THREE_STAR | FOUR_STAR | FIVE_STAR | DIRECTOR |
|------|--------|----------|----------|------------|-----------|-----------|----------|
| 用户转账 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 采购支付 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 提现申请 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 平台充值 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### 状态验证

- 用户账户状态必须为 `ACTIVE`
- 余额必须充足
- 冻结金额不能超过可用余额
- 防重复提交检查

## 安全机制

### 1. 防重复提交

```typescript
// 系统会自动检查指定时间窗口内的重复操作
const duplicateCheck = await pointsService.checkDuplicateSubmission(
  userId,
  amount,
  type,
  timeWindow = 30 // 默认30秒时间窗口
);
```

### 2. 事务一致性

所有涉及资金变动的操作都在数据库事务中执行，确保原子性。

### 3. 审计追踪

- 每个操作都有完整的日志记录
- 交易记录包含详细的metadata
- 支持操作时间和操作人员追踪

## 性能优化

### 1. 批量操作

```typescript
// 批量转账一次最多支持100笔
const results = await pointsService.batchTransfer(transfers);
```

### 2. 数据库优化

- 合理的索引设计
- 分页查询支持
- 聚合统计优化

### 3. 缓存策略

热点用户余额可以缓存，提高查询性能：

```typescript
// 获取用户余额（可配合缓存使用）
const balance = await pointsService.getBalance(userId);
```

## 错误处理

系统提供了详细的错误信息和异常处理：

```typescript
try {
  const result = await pointsService.transfer(transferData);
} catch (error) {
  // 常见错误类型：
  // - '用户不存在'
  // - '通券余额不足'
  // - '用户账户状态异常'
  // - '请勿重复提交'
  // - '只有五星店长和董事可以充值'
  // - '只有店长级别才能申请提现'
}
```

## 监控和日志

系统提供完整的日志记录：

```typescript
// 操作成功日志
logger.info('通券转账成功', {
  transactionNo,
  fromUserId,
  toUserId,
  amount,
  type
});

// 操作失败日志
logger.error('通券转账失败', {
  fromUserId,
  toUserId,
  amount,
  error: error.message
});
```

## 测试

### 单元测试

```bash
# 运行积分服务单元测试
npm test -- points.service.test.ts
```

### 集成测试

```bash
# 运行积分系统集成测试
npm run test:integration -- points
```

## 部署注意事项

1. **数据库配置** - 确保Prisma配置正确
2. **日志配置** - 配置适当的日志级别
3. **监控配置** - 设置关键指标监控
4. **备份策略** - 定期备份交易数据
5. **性能调优** - 根据业务量调整数据库连接池

## 扩展功能

### 1. 积分商城集成

可以与积分商城系统集成，支持积分兑换商品。

### 2. 多级分销奖励

支持复杂的多级分销奖励计算。

### 3. 定时任务

支持定时发放奖励、结算佣金等场景。

### 4. 报表分析

提供详细的积分流转分析和报表功能。

## 常见问题

### Q: 如何处理高并发场景？

A: 系统使用数据库事务和行级锁来处理并发，建议使用连接池优化数据库连接。

### Q: 如何保证数据一致性？

A: 所有资金变动都在事务中执行，发生错误时会自动回滚。

### Q: 如何处理网络异常？

A: 建议实现重试机制和幂等性设计，防重复提交机制可以避免重复操作。

### Q: 如何扩展新的交易类型？

A: 在 `PointsTransactionType` 枚举中添加新类型，并在相应业务逻辑中处理。

## 联系支持

如有问题或建议，请联系技术团队：
- 邮箱：tech-support@zhongdao-mall.com
- 文档：查看 `docs/` 目录下的更多文档
- 示例：参考 `examples/points-usage-examples.ts`