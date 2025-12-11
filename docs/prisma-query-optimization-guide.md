# Prisma查询优化指南

## 概述

本指南提供了针对中道商城系统的Prisma查询优化策略，旨在解决N+1查询问题，提高数据库查询性能。

## 1. 核心优化原则

### 1.1 避免N+1查询问题

N+1查询是指执行1次主查询获取记录列表，然后对每条记录执行N次额外查询。这是最常见的性能问题。

#### 问题示例：
```typescript
// ❌ 错误：会产生N+1查询
const users = await prisma.users.findMany({
  where: { parentId: userId }
});

for (const user of users) {
  const orders = await prisma.orders.findMany({
    where: { buyerId: user.id }
  });
  // 处理订单...
}
```

#### 正确解决方案：
```typescript
// ✅ 正确：使用include预加载关联数据
const users = await prisma.users.findMany({
  where: { parentId: userId },
  include: {
    orders: {
      where: { status: 'COMPLETED' },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true
      }
    }
  }
});
```

### 1.2 使用select优化字段选择

只查询需要的字段，减少数据传输量。

```typescript
// ✅ 优化：只选择必要字段
const products = await prisma.products.findMany({
  select: {
    id: true,
    name: true,
    basePrice: true,
    status: true,
    categoryId: true  // 只返回ID，不查询关联数据
  }
});
```

### 1.3 分页查询优化

对于大数据量查询，始终使用分页。

```typescript
// ✅ 优化分页查询
const page = parseInt(req.query.page as string) || 1;
const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);
const skip = (page - 1) * perPage;

const [items, total] = await Promise.all([
  prisma.items.findMany({
    skip,
    take: perPage,
    orderBy: { createdAt: 'desc' }
  }),
  prisma.items.count({ where: filterCondition })
]);
```

## 2. 具体场景优化

### 2.1 团队层级查询优化

团队查询是最复杂和频繁的查询之一。

```typescript
// 优化后的团队查询
export async function getOptimizedTeamHierarchy(userId: string, depth: number = 3) {
  // 使用teamPath字段进行高效查询
  const teamMembers = await prisma.users.findMany({
    where: {
      teamPath: {
        startsWith: `${userId}/`  // 利用前缀索引
      },
      status: 'ACTIVE'
    },
    select: {
      id: true,
      nickname: true,
      level: true,
      teamLevel: true,
      parentId: true,
      totalSales: true,
      directCount: true,
      createdAt: true,
      // 只统计总数，不加载具体成员
      _count: {
        select: {
          referredUsers: true
        }
      }
    },
    orderBy: [
      { teamLevel: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  return teamMembers;
}
```

### 2.2 积分流水查询优化

积分流水查询是高频查询，需要特别注意优化。

```typescript
// 优化后的积分流水查询（已在项目中实现）
export async function getOptimizedPointsTransactions(
  userId: string,
  page: number = 1,
  perPage: number = 20,
  type?: PointsTransactionType,
  startDate?: Date,
  endDate?: Date
) {
  const offset = (page - 1) * perPage;

  // 构建优化的查询条件
  const baseCondition: any = {
    OR: [
      { fromUserId: userId },
      { toUserId: userId }
    ]
  };

  if (type) {
    baseCondition.type = type;
  }

  if (startDate || endDate) {
    baseCondition.createdAt = {};
    if (startDate) baseCondition.createdAt.gte = startDate;
    if (endDate) baseCondition.createdAt.lte = endDate;
  }

  // 并行执行查询和计数
  const [transactions, totalCount] = await Promise.all([
    prisma.pointsTransactions.findMany({
      where: baseCondition,
      select: {
        id: true,
        transactionNo: true,
        amount: true,
        type: true,
        description: true,
        status: true,
        createdAt: true,
        completedAt: true,
        fromUserId: true,
        toUserId: true,
        metadata: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: perPage
    }),
    prisma.pointsTransactions.count({
      where: baseCondition
    })
  ]);

  return {
    transactions: transactions.map(t => ({
      ...t,
      isIncoming: t.toUserId === userId,
      isOutgoing: t.fromUserId === userId
    })),
    pagination: {
      page,
      perPage,
      total: totalCount,
      totalPages: Math.ceil(totalCount / perPage)
    }
  };
}
```

### 2.3 产品列表查询优化

产品列表是前台的高频查询。

```typescript
// 优化后的产品列表查询
export async function getOptimizedProducts(params: {
  page?: number;
  perPage?: number;
  categoryId?: string;
  status?: string;
  search?: string;
  isFeatured?: boolean;
}) {
  const {
    page = 1,
    perPage = 20,
    categoryId,
    status,
    search,
    isFeatured
  } = params;

  const skip = (page - 1) * perPage;

  // 构建查询条件
  const where: any = {};

  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status.toUpperCase();
  if (isFeatured !== undefined) where.isFeatured = isFeatured;

  // 优化搜索：只搜索名称字段
  if (search) {
    where.name = {
      contains: search,
      mode: 'insensitive' as const
    };
  }

  // 并行执行查询和计数
  const [products, total] = await Promise.all([
    prisma.products.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        code: true,
        sku: true,
        basePrice: true,
        totalStock: true,
        status: true,
        isFeatured: true,
        sort: true,
        images: true,
        createdAt: true,
        categoryId: true  // 只返回ID，避免JOIN
      },
      orderBy: [
        { sort: 'asc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: perPage
    }),
    prisma.products.count({ where })
  ]);

  return {
    products,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  };
}
```

## 3. 批量操作优化

### 3.1 批量插入优化

```typescript
// ✅ 使用createMany进行批量插入
const newRecords = data.map(item => ({
  userId: item.userId,
  amount: item.amount,
  type: item.type,
  createdAt: new Date()
}));

await prisma.pointsTransactions.createMany({
  data: newRecords,
  skipDuplicates: true  // 跳过重复记录
});
```

### 3.2 批量更新优化

```typescript
// ✅ 使用updateMany进行批量更新
await prisma.products.updateMany({
  where: {
    categoryId: oldCategoryId
  },
  data: {
    categoryId: newCategoryId,
    updatedAt: new Date()
  }
});
```

## 4. 查询缓存策略

### 4.1 内存缓存

对于不常变化的数据，使用内存缓存。

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5分钟缓存

export async function getCachedProducts(categoryId: string) {
  const cacheKey = `products:category:${categoryId}`;

  // 尝试从缓存获取
  let products = cache.get(cacheKey);

  if (!products) {
    // 缓存未命中，查询数据库
    products = await prisma.products.findMany({
      where: { categoryId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        basePrice: true,
        images: true
      }
    });

    // 存入缓存
    cache.set(cacheKey, products);
  }

  return products;
}
```

### 4.2 查询结果缓存

使用Redis进行分布式缓存（可选）。

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedUserStats(userId: string) {
  const cacheKey = `user:stats:${userId}`;

  // 尝试从Redis获取
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  // 查询数据库
  const stats = await calculateUserStats(userId);

  // 存入Redis，TTL 10分钟
  await redis.setex(cacheKey, 600, JSON.stringify(stats));

  return stats;
}
```

## 5. 查询监控和调试

### 5.1 启用查询日志

```typescript
// 开发环境启用查询日志
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'info', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' }
  ],
});

// 监听查询事件
prisma.$on('query', (e) => {
  if (e.duration > 100) { // 记录慢查询
    console.log('Slow Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`
    });
  }
});
```

### 5.2 查询性能分析

```typescript
// 查询性能分析装饰器
function logQueryPerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    const result = await originalMethod.apply(this, args);
    const end = performance.now();

    console.log(`Query ${propertyKey} took ${end - start} milliseconds`);

    if (end - start > 500) {
      // 记录到监控系统
      logger.warn('Slow query detected', {
        method: propertyKey,
        duration: end - start,
        args: args.length
      });
    }

    return result;
  };

  return descriptor;
}

// 使用示例
class UserService {
  @logQueryPerformance
  async getTeamMembers(userId: string) {
    // 查询逻辑...
  }
}
```

## 6. 事务优化

### 6.1 批量事务操作

```typescript
// ✅ 优化：使用单个事务处理多个操作
export async function processOrder(orderData: OrderData) {
  return await prisma.$transaction(async (tx) => {
    // 1. 创建订单
    const order = await tx.orders.create({
      data: {
        buyerId: orderData.buyerId,
        totalAmount: orderData.totalAmount,
        // ...其他字段
      }
    });

    // 2. 扣减库存
    await tx.inventoryItems.updateMany({
      where: {
        productId: orderData.productId,
        warehouseType: 'LOCAL'
      },
      data: {
        quantity: {
          decrement: orderData.quantity
        }
      }
    });

    // 3. 创建积分交易
    await tx.pointsTransactions.create({
      data: {
        fromUserId: orderData.buyerId,
        amount: -orderData.pointsAmount,
        type: 'PURCHASE',
        relatedOrderId: order.id,
        // ...其他字段
      }
    });

    return order;
  });
}
```

### 6.2 事务超时设置

```typescript
// 设置事务超时，避免长时间锁定
await prisma.$transaction(
  async (tx) => {
    // 事务操作...
  },
  {
    timeout: 10000 // 10秒超时
  }
);
```

## 7. 性能测试建议

### 7.1 定期性能测试

```bash
# 运行性能测试脚本
node scripts/test-index-performance.js before  # 优化前测试
node scripts/test-index-performance.js after   # 优化后测试
```

### 7.2 监控指标

- 查询响应时间（目标：95%的查询 < 100ms）
- 数据库连接池使用率
- 慢查询日志
- 索引命中率

## 8. 最佳实践总结

1. **始终使用分页**：避免一次性加载大量数据
2. **选择性查询字段**：只查询需要的字段
3. **预加载关联数据**：避免N+1查询问题
4. **使用索引**：确保查询字段有适当的索引
5. **并行执行查询**：使用Promise.all并行执行独立查询
6. **缓存策略**：对不常变化的数据使用缓存
7. **监控性能**：定期检查和优化慢查询
8. **事务优化**：保持事务简短，避免长时间锁定

## 9. 常见问题排查

### 9.1 查询慢怎么办？

1. 检查是否使用了适当的索引
2. 查看是否有不必要的JOIN操作
3. 确认是否返回了过多的数据
4. 使用EXPLAIN分析查询执行计划

### 9.2 N+1查询如何定位？

1. 启用Prisma查询日志
2. 查看是否有大量重复的查询模式
3. 使用查询性能分析工具

### 9.3 内存使用过高怎么办？

1. 限制查询返回的数据量
2. 使用流式处理处理大数据集
3. 检查是否有内存泄漏

---

本文档将根据实际使用情况持续更新。如有疑问或建议，请联系开发团队。