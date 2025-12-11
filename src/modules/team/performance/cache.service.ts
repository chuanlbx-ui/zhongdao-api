/**
 * 业绩系统缓存管理服务
 * 提供内存缓存管理和性能优化功能
 */

import { logger } from '../../../shared/utils/logger';

export class PerformanceCacheService {
  private cache = new Map<string, { data: any; expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 定期清理缓存
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // 每分钟清理一次
  }

  /**
   * 设置缓存
   */
  set(key: string, data: any, ttl: number): void {
    try {
      this.cache.set(key, {
        data,
        expires: Date.now() + ttl * 1000
      });
    } catch (error) {
      logger.error('设置缓存失败', { key, error });
    }
  }

  /**
   * 获取缓存
   */
  get(key: string): any | null {
    try {
      const item = this.cache.get(key);
      if (!item || Date.now() > item.expires) {
        this.cache.delete(key);
        return null;
      }
      return item.data;
    } catch (error) {
      logger.error('获取缓存失败', { key, error });
      return null;
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    try {
      this.cache.delete(key);
    } catch (error) {
      logger.error('删除缓存失败', { key, error });
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    try {
      this.cache.clear();
    } catch (error) {
      logger.error('清空缓存失败', { error });
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, item] of this.cache.entries()) {
        if (now > item.expires) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug('清理过期缓存', { count: cleanedCount });
      }
    } catch (error) {
      logger.error('清理过期缓存失败', { error });
    }
  }

  /**
   * 清除匹配模式的缓存
   */
  clearByPattern(pattern: string): void {
    try {
      const keysToDelete: string[] = [];

      for (const key of this.cache.keys()) {
        if (this.matchPattern(key, pattern)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key));

      logger.info('按模式清除缓存', { pattern, count: keysToDelete.length });
    } catch (error) {
      logger.error('按模式清除缓存失败', { pattern, error });
    }
  }

  /**
   * 清除用户相关的缓存
   */
  clearUserCache(userId: string): void {
    try {
      const patterns = [
        `personal_performance:${userId}:*`,
        `team_performance:${userId}:*`,
        `referral_performance:${userId}:*`,
        `commission_forecast:${userId}:*`
      ];

      patterns.forEach(pattern => this.clearByPattern(pattern));

      // 排行榜需要全部清除，因为用户可能在其中
      this.clearByPattern('leaderboard:*:*:*');

      logger.info('清除用户缓存', { userId });
    } catch (error) {
      logger.error('清除用户缓存失败', { userId, error });
    }
  }

  /**
   * 批量清除缓存
   */
  deleteBatch(keys: string[]): void {
    try {
      keys.forEach(key => this.cache.delete(key));
      logger.debug('批量删除缓存', { count: keys.length });
    } catch (error) {
      logger.error('批量删除缓存失败', { count: keys.length, error });
    }
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    try {
      const item = this.cache.get(key);
      if (!item) return false;

      if (Date.now() > item.expires) {
        this.cache.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('检查缓存失败', { key, error });
      return false;
    }
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 简单的通配符匹配
   */
  private matchPattern(str: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(str);
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// 创建单例实例
export const performanceCacheService = new PerformanceCacheService();