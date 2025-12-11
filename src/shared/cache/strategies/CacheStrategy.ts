/**
 * 缓存策略实现
 * 提供各种缓存策略的具体实现
 */

import crypto from 'crypto';
import { cacheManager } from '../CacheManager';
import { ICacheStrategy, CacheOptions } from '../CacheInterface';
import { logger } from '../../utils/logger';

/**
 * 默认缓存策略
 */
export class DefaultCacheStrategy implements ICacheStrategy {
  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result: any, key) => {
        result[key] = params[key];
        return result;
      }, {});

    const paramString = JSON.stringify(sortedParams);
    const hash = crypto.createHash('md5').update(paramString).digest('hex');
    return `${prefix}:${hash}`;
  }

  calculateTTL(data: any, baseOptions: CacheOptions): number {
    // 根据数据大小和重要性计算TTL
    if (!baseOptions.ttl) {
      const size = JSON.stringify(data).length;

      // 小数据使用更短的TTL
      if (size < 1024) {
        return 300; // 5分钟
      } else if (size < 10240) {
        return 600; // 10分钟
      } else {
        return 1800; // 30分钟
      }
    }

    return baseOptions.ttl;
  }

  async warmup(patterns: string[]): Promise<void> {
    // 基础预热逻辑，子类可以覆盖
    logger.info('开始预热缓存');

    for (const pattern of patterns) {
      const keys = await cacheManager.keys(pattern);
      logger.debug(`预热模式 ${pattern}: 找到 ${keys.length} 个键`);
    }
  }

  async update(key: string, updater: (value: any) => any): Promise<void> {
    const current = await cacheManager.get(key);
    if (current !== null) {
      const updated = updater(current);
      await cacheManager.set(key, updated);
    }
  }

  async protect(key: string, fn: () => Promise<any>): Promise<any> {
    const protectionKey = `protect:${key}`;
    const count = await cacheManager.get<number>(protectionKey) || 0;

    if (count > 10) {
      throw new Error('请求过于频繁，请稍后再试');
    }

    await cacheManager.set(protectionKey, count + 1, { ttl: 60 });

    try {
      const result = await fn();
      await cacheManager.del(protectionKey);
      return result;
    } catch (error) {
      await cacheManager.expire(protectionKey, 300); // 5分钟后再试
      throw error;
    }
  }
}

/**
 * 用户缓存策略
 */
export class UserCacheStrategy extends DefaultCacheStrategy {
  generateKey(prefix: string, params: Record<string, any>): string {
    if (params.userId) {
      return `user:${params.userId}:${prefix}`;
    }
    if (params.email) {
      return `user:email:${params.email}:${prefix}`;
    }
    return super.generateKey(`user:${prefix}`, params);
  }

  calculateTTL(data: any, baseOptions: CacheOptions): number {
    // 用户数据根据用户级别设置不同的TTL
    const baseTTL = super.calculateTTL(data, baseOptions);

    if (data.level === 'DIRECTOR' || data.level === 'STAR_5') {
      return baseTTL * 2; // 高级用户缓存更久
    } else if (data.level === 'NORMAL') {
      return baseTTL / 2; // 普通用户缓存较短
    }

    return baseTTL;
  }

  async warmup(patterns: string[]): Promise<void> {
    // 预热热门用户数据
    const hotUserIds = ['1', '2', '3']; // 可以从配置或统计中获取

    for (const userId of hotUserIds) {
      // 这里可以调用具体的用户服务获取数据
      logger.debug(`预热用户数据: ${userId}`);
    }
  }

  async update(key: string, updater: (value: any) => any): Promise<void> {
    await super.update(key, updater);

    // 更新用户时，清除相关缓存
    if (key.startsWith('user:')) {
      const userId = key.split(':')[1];
      await cacheManager.delPattern(`user:${userId}:*`);
      await cacheManager.invalidateTags(['user-data']);
    }
  }
}

/**
 * 产品缓存策略
 */
export class ProductCacheStrategy extends DefaultCacheStrategy {
  generateKey(prefix: string, params: Record<string, any>): string {
    if (params.categoryId) {
      return `product:category:${params.categoryId}:${prefix}`;
    }
    if (params.tagId) {
      return `product:tag:${params.tagId}:${prefix}`;
    }
    return super.generateKey(`product:${prefix}`, params);
  }

  calculateTTL(data: any, baseOptions: CacheOptions): number {
    // 产品根据状态设置不同TTL
    const baseTTL = super.calculateTTL(data, baseOptions);

    if (data.status === 'ACTIVE') {
      return baseTTL * 3; // 活跃产品缓存更久
    } else if (data.status === 'DRAFT' || data.status === 'PENDING') {
      return baseTTL / 3; // 草稿或待审核产品缓存很短
    }

    return baseTTL;
  }

  async warmup(patterns: string[]): Promise<void> {
    // 预热热门产品和分类
    const hotCategories = ['electronics', 'clothing', 'food'];

    for (const category of hotCategories) {
      logger.debug(`预热产品分类: ${category}`);
    }

    // 预热产品详情页
    const hotProductIds = ['p1', 'p2', 'p3'];
    for (const productId of hotProductIds) {
      logger.debug(`预热产品: ${productId}`);
    }
  }

  async update(key: string, updater: (value: any) => any): Promise<void> {
    await super.update(key, updater);

    // 更新产品时，清除相关缓存
    if (key.includes('product:')) {
      await cacheManager.invalidateTags(['product-data']);

      // 清除分类缓存
      const categories = await cacheManager.keys('product:category:*');
      for (const categoryKey of categories) {
        await cacheManager.del(categoryKey);
      }
    }
  }
}

/**
 * 团队缓存策略
 */
export class TeamCacheStrategy extends DefaultCacheStrategy {
  generateKey(prefix: string, params: Record<string, any>): string {
    if (params.teamId) {
      return `team:${params.teamId}:${prefix}`;
    }
    if (params.userId) {
      return `team:user:${params.userId}:${prefix}`;
    }
    return super.generateKey(`team:${prefix}`, params);
  }

  calculateTTL(data: any, baseOptions: CacheOptions): number {
    // 团队数据根据团队大小动态调整TTL
    const baseTTL = super.calculateTTL(data, baseOptions);

    if (data.memberCount > 100) {
      return baseTTL * 2; // 大团队缓存更久
    } else if (data.memberCount < 10) {
      return baseTTL / 2; // 小团队缓存较短
    }

    return baseTTL;
  }

  async warmup(patterns: string[]): Promise<void> {
    // 预热团队路径数据
    const activeTeams = ['team1', 'team2', 'team3'];

    for (const teamId of activeTeams) {
      logger.debug(`预热团队数据: ${teamId}`);
    }
  }

  async update(key: string, updater: (value: any) => any): Promise<void> {
    await super.update(key, updater);

    // 更新团队时，清除所有团队相关缓存
    if (key.includes('team:')) {
      await cacheManager.invalidateTags(['team-data']);

      // 清除团队成员的缓存
      const userTeamKeys = await cacheManager.keys('team:user:*');
      for (const userKey of userTeamKeys) {
        await cacheManager.del(userKey);
      }
    }
  }
}

/**
 * 积分缓存策略
 */
export class PointsCacheStrategy extends DefaultCacheStrategy {
  generateKey(prefix: string, params: Record<string, any>): string {
    if (params.userId) {
      return `points:user:${params.userId}:${prefix}`;
    }
    if (params.transactionType) {
      return `points:type:${params.transactionType}:${prefix}`;
    }
    return super.generateKey(`points:${prefix}`, params);
  }

  calculateTTL(data: any, baseOptions: CacheOptions): number {
    // 积分余额使用较短的TTL
    return baseOptions.ttl || 60; // 默认1分钟
  }

  async warmup(patterns: string[]): Promise<void> {
    // 积分不需要预热，实时性要求高
  }

  async update(key: string, updater: (value: any) => any): Promise<void> {
    await super.update(key, updater);

    // 积分更新时，立即清除用户相关缓存
    if (key.startsWith('points:user:')) {
      const userId = key.split(':')[2];
      await cacheManager.delPattern(`points:user:${userId}:*`);
      await cacheManager.invalidateTags(['points-data']);
    }
  }

  async protect(key: string, fn: () => Promise<any>): Promise<any> {
    // 积分操作使用更严格的保护
    const protectionKey = `protect:${key}`;
    const lockKey = `lock:${key}`;

    // 获取分布式锁
    const lock = await cacheManager.get(lockKey);
    if (lock) {
      throw new Error('操作进行中，请稍后再试');
    }

    // 设置锁
    await cacheManager.set(lockKey, '1', { ttl: 10 });

    try {
      const result = await fn();
      await cacheManager.del(lockKey);
      return result;
    } catch (error) {
      await cacheManager.expire(lockKey, 30);
      throw error;
    }
  }
}

/**
 * 统计数据缓存策略
 */
export class StatsCacheStrategy extends DefaultCacheStrategy {
  generateKey(prefix: string, params: Record<string, any>): string {
    const { period, userId, teamId, type } = params;

    if (period) {
      if (userId) {
        return `stats:user:${userId}:${period}:${type || 'all'}`;
      }
      if (teamId) {
        return `stats:team:${teamId}:${period}:${type || 'all'}`;
      }
      return `stats:system:${period}:${type || 'all'}`;
    }

    return super.generateKey(`stats:${prefix}`, params);
  }

  calculateTTL(data: any, baseOptions: CacheOptions): number {
    // 统计数据根据时间周期设置TTL
    if (baseOptions.period === 'realtime') {
      return 60; // 实时数据1分钟
    } else if (baseOptions.period === 'hourly') {
      return 3600; // 小时数据1小时
    } else if (baseOptions.period === 'daily') {
      return 86400; // 日数据24小时
    }

    return baseOptions.ttl || 300; // 默认5分钟
  }

  async warmup(patterns: string[]): Promise<void> {
    // 预热基础统计数据
    const periods = ['today', 'yesterday', 'thisWeek', 'thisMonth'];

    for (const period of periods) {
      logger.debug(`预热统计数据: ${period}`);
    }
  }

  async update(key: string, updater: (value: any) => any): Promise<void> {
    // 统计数据不支持更新，只能重新计算
    await cacheManager.del(key);
  }

  async protect(key: string, fn: () => Promise<any>): Promise<any> {
    // 统计计算使用较长锁时间
    const protectionKey = `protect:${key}`;
    const lockKey = `lock:${key}`;

    const lock = await cacheManager.get(lockKey);
    if (lock) {
      // 返回缓存中的旧数据
      const cached = await cacheManager.get(key);
      if (cached !== null) {
        return cached;
      }
      throw new Error('统计计算中，请稍后再试');
    }

    await cacheManager.set(lockKey, '1', { ttl: 60 });

    try {
      const result = await fn();
      await cacheManager.set(key, result, { ttl: 300 });
      await cacheManager.del(lockKey);
      return result;
    } catch (error) {
      await cacheManager.expire(lockKey, 300);
      throw error;
    }
  }
}

/**
 * 策略工厂
 */
export class CacheStrategyFactory {
  private static strategies: Map<string, new () => ICacheStrategy> = new Map([
    ['default', DefaultCacheStrategy],
    ['user', UserCacheStrategy],
    ['product', ProductCacheStrategy],
    ['team', TeamCacheStrategy],
    ['points', PointsCacheStrategy],
    ['stats', StatsCacheStrategy]
  ]);

  static getStrategy(type: string): ICacheStrategy {
    const StrategyClass = this.strategies.get(type);
    if (!StrategyClass) {
      logger.warn(`未知的缓存策略类型: ${type}，使用默认策略`);
      return new DefaultCacheStrategy();
    }
    return new StrategyClass();
  }

  static registerStrategy(type: string, strategy: new () => ICacheStrategy): void {
    this.strategies.set(type, strategy);
  }
}

// 导出策略实例
export const defaultStrategy = CacheStrategyFactory.getStrategy('default');
export const userStrategy = CacheStrategyFactory.getStrategy('user');
export const productStrategy = CacheStrategyFactory.getStrategy('product');
export const teamStrategy = CacheStrategyFactory.getStrategy('team');
export const pointsStrategy = CacheStrategyFactory.getStrategy('points');
export const statsStrategy = CacheStrategyFactory.getStrategy('stats');