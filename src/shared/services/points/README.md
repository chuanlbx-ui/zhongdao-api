# 积分服务模块化架构

## 概述

积分服务已经从单一大文件（1177行）重构为模块化架构，提高了代码的可维护性和可扩展性。

## 目录结构

```
src/shared/services/points/
├── types.ts                    # 类型定义
├── balance.service.ts           # 余额管理服务
├── transaction.service.ts       # 交易记录服务
├── transfer.service.ts          # 转账服务
├── recharge.service.ts          # 充值服务
├── statistics.service.ts        # 统计服务
├── index.internal.ts            # 内部导出（解决循环依赖）
├── index.ts                     # 主导出文件
└── README.md                    # 本文档
```

## 各模块功能说明

### 1. types.ts - 类型定义
包含所有积分相关的类型定义：
- `PointsTransactionType` - 交易类型枚举
- `PointsTransactionStatus` - 交易状态枚举
- `PointsTransactionData` - 交易数据接口
- `PointsTransferResult` - 转账结果接口
- `PointsBalance` - 余额信息接口
- `WithdrawalInfo` - 提现信息接口
- `DeduplicationResult` - 防重复提交结果接口

### 2. balance.service.ts - 余额管理服务
负责用户余额的查询和管理：
- `getBalance(userId)` - 获取用户余额
- `updateUserBalance()` - 更新用户余额（内部方法）
- `checkBalance()` - 检查余额是否足够
- `getUserBalanceDetails()` - 获取用户余额详情

### 3. transaction.service.ts - 交易记录服务
处理所有交易相关的操作：
- `generateTransactionNo()` - 生成交易号
- `createTransaction()` - 创建交易记录
- `updateTransactionStatus()` - 更新交易状态
- `getTransactions()` - 获取交易流水
- `getTransactionByNo()` - 根据交易号查询
- `getTransactionById()` - 根据ID查询交易
- `checkDuplicateSubmission()` - 防重复提交检查

### 4. transfer.service.ts - 转账服务
处理用户间的转账功能：
- `transfer()` - 单笔转账
- `batchTransfer()` - 批量转账
- `getUserIdByIdentifier()` - 根据标识符查找用户ID

### 5. recharge.service.ts - 充值服务
处理积分充值功能：
- `recharge()` - 积分充值

### 6. statistics.service.ts - 统计服务
提供积分相关的统计功能：
- `getPointsStatistics()` - 获取用户积分统计
- `getGlobalPointsStatistics()` - 获取全局统计（管理员功能）
- `getPointsRanking()` - 获取积分排行榜

## 使用方法

### 向后兼容使用（推荐）

原有的 `PointsService` 类仍然可用，所有现有的导入语句无需修改：

```typescript
import { pointsService, PointsTransactionType } from '@/shared/services/points';

// 获取余额
const balance = await pointsService.getBalance(userId);

// 转账
const result = await pointsService.transfer({
  fromUserId: 'user1',
  toUserId: 'user2',
  amount: 100,
  type: PointsTransactionType.TRANSFER
});
```

### 模块化使用（新项目推荐）

可以直接使用各个服务模块：

```typescript
// 导入特定服务
import {
  balanceService,
  transferService,
  transactionService,
  statisticsService
} from '@/shared/services/points';
import { PointsTransactionType } from '@/shared/services/points/types';

// 使用余额服务
const balance = await balanceService.getBalance(userId);

// 使用转账服务
const result = await transferService.transfer({
  fromUserId: 'user1',
  toUserId: 'user2',
  amount: 100,
  type: PointsTransactionType.TRANSFER
});

// 使用统计服务
const stats = await statisticsService.getPointsStatistics(userId);
```

## 优势

1. **代码组织清晰**：每个模块负责特定功能，职责单一
2. **易于维护**：相关功能集中，修改影响范围小
3. **便于测试**：可以独立测试每个模块
4. **按需导入**：可以只导入需要的服务
5. **向后兼容**：现有代码无需修改
6. **可扩展性**：新功能可以添加新模块或扩展现有模块

## 注意事项

1. `index.internal.ts` 是内部文件，用于解决循环依赖问题，不应被外部代码直接导入
2. 所有服务实例都是单例，通过导入的服务实例直接使用
3. 数据库事务通常在服务层处理，确保数据一致性
4. 日志记录统一在各服务中处理