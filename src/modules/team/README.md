# 团队业绩实时统计系统

中道商城多层级供应链社交电商平台的核心业绩统计系统，为用户提供实时、准确的业绩数据分析，支撑用户激励体系和等级晋升体系。

## 📋 目录

- [功能概述](#功能概述)
- [核心特性](#核心特性)
- [快速开始](#快速开始)
- [API文档](#api文档)
- [使用示例](#使用示例)
- [性能优化](#性能优化)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

## 🎯 功能概述

### 业绩计算引擎
- **个人业绩统计**: 销售额、订单数、新客数、复购率、平均订单价值
- **团队业绩统计**: 团队销售额、团队订单数、新增成员、活跃率、生产力指数
- **推荐业绩统计**: 直推人数、间推人数、推荐收入、网络增长率、转化率

### 排行榜系统
- **多维度排行榜**: 个人销售、团队业绩、推荐人数
- **实时排名更新**: 支持排名变化追踪
- **灵活查询**: 支持不同周期、不同范围的排行榜查询

### 晋级进度分析
- **智能晋级预测**: 基于当前业绩预测晋级时间
- **多维度要求检查**: 销售额、团队规模、下级等级等
- **进度可视化**: 百分比进度条和详细要求说明

### 佣金预测系统
- **多周期预测**: 当前周期和下周期佣金预测
- **构成分析**: 个人销售、团队奖金、推荐佣金等详细构成
- **容量分析**: 基于等级的佣金潜力和利用率分析

## ✨ 核心特性

### 🚀 实时计算
- 支持实时业绩统计和更新
- 智能缓存策略，平衡实时性和性能
- 增量计算，避免重复处理

### 📊 多维度统计
- 时间维度：日、周、月、季、年
- 业绩维度：个人、团队、推荐
- 分析维度：历史趋势、同比环比、预测分析

### 🔍 数据准确性
- 完整的数据校验机制
- 异常数据自动检测和修复
- 事务一致性保证

### ⚡ 高性能
- 智能内存缓存系统
- 批量数据处理能力
- 并发查询优化

## 🚀 快速开始

### 安装和引入

```typescript
import { performanceService } from './performance.service';
import { TeamRole } from './types';
```

### 基础使用

```typescript
// 计算个人业绩
const personalPerformance = await performanceService.calculatePersonalPerformance('user123', '2025-11');

// 计算团队业绩
const teamPerformance = await performanceService.calculateTeamPerformance('leader456', '2025-11');

// 获取排行榜
const leaderboard = await performanceService.getPerformanceLeaderboard('personal', '2025-11', 20);

// 分析晋级进度
const upgradeProgress = await performanceService.getUpgradeProgress('user789', TeamRole.DIRECTOR);
```

## 📚 API文档

### 核心方法

#### `calculatePersonalPerformance(userId, period)`

计算指定用户在指定周期的个人业绩。

**参数：**
- `userId: string` - 用户ID
- `period: string` - 统计周期 (YYYY-MM, YYYY)

**返回：** `Promise<PersonalPerformance>`

```typescript
interface PersonalPerformance {
  salesAmount: number;        // 销售额
  orderCount: number;         // 订单数
  newCustomers: number;       // 新客数
  repeatRate: number;         // 复购率
  averageOrderValue: number;  // 平均订单价值
  monthToDate: number;        // 月至今
  yearToDate: number;         // 年至今
}
```

#### `calculateTeamPerformance(userId, period)`

计算指定用户的团队业绩。

**参数：**
- `userId: string` - 团队负责人用户ID
- `period: string` - 统计周期

**返回：** `Promise<TeamPerformance>`

#### `getPerformanceLeaderboard(type, period, limit)`

获取业绩排行榜。

**参数：**
- `type: 'personal' | 'team' | 'referral'` - 排行榜类型
- `period: string` - 统计周期
- `limit: number` - 返回条数

**返回：** `Promise<LeaderboardItem[]>`

#### `getUpgradeProgress(userId, targetLevel?)`

分析用户晋级进度。

**参数：**
- `userId: string` - 用户ID
- `targetLevel?: TeamRole` - 目标等级（可选，默认为下一等级）

**返回：** `Promise<UpgradeProgress>`

#### `predictCommission(userId, period)`

预测用户佣金收入。

**参数：**
- `userId: string` - 用户ID
- `period: string` - 预测周期

**返回：** `Promise<CommissionForecast>`

### 缓存管理方法

#### `warmupCache(userIds)`

预热指定用户的业绩缓存。

#### `clearUserCache(userId)`

清除指定用户的所有相关缓存。

#### `validatePerformanceData(userId, period)`

验证业绩数据的完整性和准确性。

#### `rebuildPerformanceMetrics(userId, period)`

重建用户的业绩指标数据。

## 📖 使用示例

### 示例1：生成个人业绩报告

```typescript
import { performanceExamples } from './performance.examples';

async function generatePersonalReport() {
  const report = await performanceExamples.calculatePersonalPerformance();
  console.log('个人业绩报告:', report);
}
```

### 示例2：团队综合分析

```typescript
async function teamAnalysis() {
  const [personalPerf, teamPerf, referralPerf] = await Promise.all([
    performanceService.calculatePersonalPerformance('leader123', '2025-11'),
    performanceService.calculateTeamPerformance('leader123', '2025-11'),
    performanceService.calculateReferralPerformance('leader123', '2025-11')
  ]);

  return {
    personal: personalPerf,
    team: teamPerf,
    referral: referralPerf
  };
}
```

### 示例3：晋级进度监控

```typescript
async function monitorUpgradeProgress() {
  const progress = await performanceService.getUpgradeProgress('user456', TeamRole.DIRECTOR);

  if (progress.progressPercentage > 80) {
    console.log('恭喜！即将晋级到', progress.targetLevel);
    // 发送晋级提醒通知
  }

  return progress;
}
```

### 示例4：佣金预测和建议

```typescript
async function commissionAdvice() {
  const forecast = await performanceService.predictCommission('user789', '2025-11');

  // 生成优化建议
  const suggestions = [];

  if (forecast.capacityAnalysis.utilizationRate < 0.5) {
    suggestions.push('您的佣金潜力巨大，建议制定更高目标');
  }

  if (forecast.nextPeriod.confidence > 80) {
    suggestions.push('业绩增长稳定，可以规划更大目标');
  }

  return { forecast, suggestions };
}
```

### 示例5：批量团队分析

```typescript
async function batchTeamAnalysis() {
  const teamAnalysis = await performanceExamples.batchTeamAnalysis();

  console.log(`团队平均业绩: ¥${teamAnalysis.averagePerformance.toLocaleString()}`);
  console.log(`表现最佳成员:`, teamAnalysis.topPerformers[0]);

  return teamAnalysis;
}
```

## ⚡ 性能优化

### 缓存策略

系统采用多层缓存策略：

1. **内存缓存**: 热点数据缓存在内存中，响应时间 < 10ms
2. **缓存TTL**: 根据数据更新频率设置不同的缓存时间
   - 业绩指标：5分钟
   - 排行榜：10分钟
   - 团队统计：3分钟
   - 佣金数据：1小时

3. **智能预热**: 支持批量预热用户缓存，提升系统响应速度

### 批量处理

```typescript
// 推荐：并行批量查询
const results = await Promise.all([
  performanceService.calculatePersonalPerformance(userId1, period),
  performanceService.calculatePersonalPerformance(userId2, period),
  performanceService.calculatePersonalPerformance(userId3, period)
]);

// 避免：串行查询
// for (const userId of userIds) {
//   await performanceService.calculatePersonalPerformance(userId, period);
// }
```

### 数据库优化

1. **索引优化**: 确保关键字段有合适的索引
2. **查询优化**: 使用聚合查询减少数据传输
3. **连接池**: 合理配置数据库连接池

## 💡 最佳实践

### 1. 缓存管理

```typescript
// 定期预热重要用户缓存
setInterval(async () => {
  const importantUsers = await getImportantUsers();
  await performanceService.warmupCache(importantUsers);
}, 300000); // 每5分钟
```

### 2. 错误处理

```typescript
try {
  const performance = await performanceService.calculatePersonalPerformance(userId, period);

  // 验证数据合理性
  if (performance.salesAmount < 0) {
    throw new Error('销售额不能为负数');
  }

  return performance;
} catch (error) {
  logger.error('计算业绩失败', { userId, period, error });

  // 尝试重建数据
  const rebuildResult = await performanceService.rebuildPerformanceMetrics(userId, period);
  if (rebuildResult.success) {
    return rebuildResult.metrics;
  }

  throw error;
}
```

### 3. 性能监控

```typescript
// 监控API性能
const startTime = Date.now();
const result = await performanceService.calculatePersonalPerformance(userId, period);
const duration = Date.now() - startTime;

if (duration > 1000) {
  logger.warn('业绩计算耗时过长', { userId, period, duration });
}
```

### 4. 数据一致性检查

```typescript
// 定期检查数据一致性
setInterval(async () => {
  const users = await.getActiveUsers();

  for (const user of users) {
    const validation = await performanceService.validatePerformanceData(user.id, currentPeriod);

    if (!validation.isValid) {
      logger.warn('用户数据验证失败', {
        userId: user.id,
        errors: validation.errors,
        warnings: validation.warnings
      });

      // 自动修复数据
      await performanceService.rebuildPerformanceMetrics(user.id, currentPeriod);
    }
  }
}, 3600000); // 每小时检查一次
```

## ❓ 常见问题

### Q1: 如何处理大量用户的业绩计算？

**A:** 建议采用分批处理和并行计算：

```typescript
async function batchCalculatePerformance(userIds: string[], period: string) {
  const batchSize = 50; // 每批处理50个用户
  const results = [];

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(userId => performanceService.calculatePersonalPerformance(userId, period))
    );

    results.push(...batchResults);

    // 避免数据库压力，批次间稍作等待
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}
```

### Q2: 如何确保业绩数据的实时性？

**A:** 系统采用智能缓存策略：

1. **关键数据短缓存**: 业绩指标缓存5分钟
2. **事件驱动更新**: 当有新订单时主动清除相关缓存
3. **定期预热**: 定期预热活跃用户数据

```typescript
// 订单完成后清除相关用户缓存
async function onOrderCompleted(order: Order) {
  performanceService.clearUserCache(order.sellerId);

  // 如果是团队订单，也要清除团队领导的缓存
  const teamLeader = await getTeamLeader(order.sellerId);
  if (teamLeader) {
    performanceService.clearUserCache(teamLeader.id);
  }
}
```

### Q3: 如何处理历史数据迁移？

**A:** 建议分阶段迁移：

```typescript
async function migrateHistoricalData(startDate: Date, endDate: Date) {
  const users = await getAllUsers();
  const periods = generatePeriods(startDate, endDate);

  for (const period of periods) {
    console.log(`迁移 ${period} 的数据...`);

    // 分批处理用户
    for (let i = 0; i < users.length; i += 100) {
      const batch = users.slice(i, i + 100);

      await Promise.allSettled(
        batch.map(user => performanceService.rebuildPerformanceMetrics(user.id, period))
      );

      // 避免数据库压力
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

### Q4: 如何监控系统性能？

**A:** 建议监控以下指标：

```typescript
// 性能监控中间件
function performanceMonitor() {
  return async (ctx: any, next: any) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    // 记录性能指标
    metrics.record('api_duration', duration, {
      endpoint: ctx.path,
      method: ctx.method
    });

    // 慢查询告警
    if (duration > 2000) {
      logger.warn('慢请求检测', {
        endpoint: ctx.path,
        duration,
        userId: ctx.state.userId
      });
    }
  };
}
```

### Q5: 如何处理并发访问？

**A:** 系统设计了完善的并发控制：

1. **无锁设计**: 使用缓存减少数据库并发冲突
2. **幂等操作**: 确保重复执行不会产生问题
3. **错误隔离**: 单个用户计算失败不影响其他用户

```typescript
// 安全的并发计算
async function safeCalculatePerformance(userId: string, period: string) {
  const cacheKey = `performance:${userId}:${period}`;

  // 使用分布式锁避免重复计算
  const lock = await acquireLock(cacheKey, 30000); // 30秒锁

  try {
    // 检查是否已有其他进程在计算
    const cached = performanceService.getFromCache(cacheKey);
    if (cached) return cached;

    // 执行计算
    const result = await performanceService.calculatePersonalPerformance(userId, period);
    return result;
  } finally {
    await releaseLock(lock);
  }
}
```

## 📞 技术支持

如有问题或建议，请联系技术团队或提交Issue。

---

**中道商城团队**
*让每一份努力都有回报*