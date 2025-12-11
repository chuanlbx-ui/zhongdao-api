# 团队业绩系统 - 模块化结构

本目录包含了团队业绩服务的模块化实现，将原有的 `performance.service.ts` (2022行) 拆分为多个职责单一的模块。

## 目录结构

```
performance/
├── index.ts                          # 主服务入口，保持向后兼容
├── types.ts                          # 类型定义
├── cache.service.ts                  # 缓存管理服务
├── personal-calculator.service.ts    # 个人业绩计算
├── team-calculator.service.ts        # 团队业绩计算
├── referral-calculator.service.ts    # 推荐业绩计算
├── ranking.service.ts                # 排行榜系统
├── progression.service.ts            # 晋级进度分析
├── commission-forecast.service.ts    # 佣金预测
└── README.md                         # 本文档
```

## 模块说明

### 1. types.ts
定义了所有业绩系统相关的类型接口，包括：
- 业绩统计结果 (PersonalPerformance, TeamPerformance, ReferralPerformance)
- 排行榜数据 (LeaderboardItem)
- 晋级进度 (UpgradeProgress)
- 佣金预测 (CommissionForecast)
- 缓存配置 (CacheConfig)
- 等级要求 (LevelRequirement)

### 2. cache.service.ts
内存缓存管理服务，提供：
- TTL 缓存机制
- 模式匹配缓存清除
- 自动过期清理
- 用户相关缓存管理
- 缓存预热功能

### 3. personal-calculator.service.ts
个人业绩计算服务，负责：
- 计算个人销售额、订单数、客户数据
- 计算复购率、平均订单价值
- 月度至今、年度至今统计
- 月增长率计算
- 历史最佳业绩追踪

### 4. team-calculator.service.ts
团队业绩计算服务，负责：
- 计算团队总销售额、订单数
- 团队成员活跃率分析
- 层级分布统计
- 新增成员统计
- 团队生产力分析

### 5. referral-calculator.service.ts
推荐业绩计算服务，负责：
- 直推、间接推荐统计
- 推荐销售收入计算
- 网络增长率分析
- 推荐树结构生成
- 推荐转化率分析

### 6. ranking.service.ts
排行榜系统，提供：
- 个人、团队、推荐排行榜
- 排名变化追踪
- 用户排行榜位置查询
- 排行榜摘要统计
- 周围排名查询

### 7. progression.service.ts
晋级进度分析服务，负责：
- 晋级进度计算
- 晋级条件检查
- 晋级时间预测
- 多等级进度追踪
- 晋级历史记录

### 8. commission-forecast.service.ts
佣金预测服务，提供：
- 佣金收入预测
- 佣金历史趋势
- 佣金构成分析
- 佣金容量分析
- 佣金影响因素分析

### 9. index.ts
主服务入口，整合所有子模块：
- 统一的服务接口
- 向后兼容性保证
- 缓存管理功能
- 数据验证和异常处理

## 使用方法

### 基本用法（保持向后兼容）

```typescript
import { performanceService } from './performance';

// 计算个人业绩
const personalPerf = await performanceService.calculatePersonalPerformance(userId, '2024-01');

// 获取排行榜
const leaderboard = await performanceService.getPerformanceLeaderboard('personal', '2024-01', 50);

// 晋级进度分析
const progress = await performanceService.getUpgradeProgress(userId);
```

### 使用特定模块

```typescript
import { personalCalculatorService } from './performance/personal-calculator.service';
import { rankingService } from './performance/ranking.service';

// 直接使用个人计算器
const perf = await personalCalculatorService.calculatePersonalPerformance(userId, period);

// 直接使用排行榜服务
const ranking = await rankingService.getPerformanceLeaderboard('team', period);
```

### 缓存管理

```typescript
import { performanceCacheService } from './performance/cache.service';

// 清除用户缓存
performanceCacheService.clearUserCache(userId);

// 手动设置缓存
performanceCacheService.set(key, data, ttl);

// 获取缓存
const cached = performanceCacheService.get(key);
```

## 性能优化特性

1. **智能缓存系统**
   - 不同类型数据独立 TTL 配置
   - 自动过期清理
   - 模式匹配批量清除

2. **并行计算**
   - 多项业绩指标并行查询
   - Promise.all 优化数据库访问

3. **批量操作**
   - 批量用户缓存预热
   - 团队成员批量统计

4. **数据预聚合**
   - 层级分布预先计算
   - 排行榜数据缓存

## 错误处理

每个模块都包含适当的错误处理：
- 数据库查询异常
- 数据验证失败
- 缓存操作异常
- 业务逻辑异常

## 日志记录

所有关键操作都会记录日志：
- 业绩计算完成
- 缓存操作
- 错误信息
- 性能指标

## 扩展性

模块化设计便于：
- 添加新的业绩指标
- 扩展排行榜类型
- 自定义缓存策略
- 集成新的预测算法

## 注意事项

1. 所有数据库查询都应通过相应模块执行，避免直接访问
2. 缓存键名遵循统一命名规范
3. 新增功能应保持向后兼容
4. 性能敏感操作应考虑使用缓存