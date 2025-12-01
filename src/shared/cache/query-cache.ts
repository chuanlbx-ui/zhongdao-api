/**
 * 查询结果缓存管理器
 * 支持内存缓存和Redis缓存的混合模式
 */

import { logger } from '../utils/logger';

/**
 * 缓存配置
 */
export interface CacheConfig {
  ttl: number; // 缓存过期时间(毫秒)
  maxSize?: number; // 最大缓存数量
  namespace?: string; // 缓存命名空间
}

/**
 * 缓存项
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

/**
 * 内存缓存存储
 */
class MemoryCache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  set<T>(key: string, value: T, ttl: number): void {
    if (this.store.size >= this.maxSize) {
      // 删除最旧的条目
      const firstKey = this.store.keys().next().value;
      if (firstKey) {
        this.store.delete(firstKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      hits: 0,
      createdAt: Date.now()
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    entry.hits++;
    return entry.value as T;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deleteByPattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (pattern.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  getStats() {
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      entries: Array.from(this.store.entries()).map(([key, entry]) => ({
        key,
        hits: entry.hits,
        age: Date.now() - entry.createdAt,
        ttl: entry.expiresAt - Date.now()
      }))
    };
  }
}

/**
 * 查询缓存管理器
 */
export class QueryCache {
  private static instance: QueryCache;
  private memoryCache: MemoryCache;
  private readonly namespace: string = 'query';

  private constructor() {
    this.memoryCache = new MemoryCache(1000);
  }

  static getInstance(): QueryCache {
    if (!QueryCache.instance) {
      QueryCache.instance = new QueryCache();
    }
    return QueryCache.instance;
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(
    prefix: string,
    params: Record<string, any> = {}
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => {
        const value = params[key];
        return `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`;
      })
      .join('|');

    return `${this.namespace}:${prefix}:${sortedParams}`;
  }

  /**
   * 获取缓存的数据
   */
  async get<T>(
    prefix: string,
    params?: Record<string, any>
  ): Promise<T | null> {
    const key = this.getCacheKey(prefix, params);
    return this.memoryCache.get<T>(key);
  }

  /**
   * 设置缓存
   */
  async set<T>(
    prefix: string,
    value: T,
    config: CacheConfig
  ): Promise<void> {
    const key = this.getCacheKey(prefix, config);
    this.memoryCache.set(key, value, config.ttl);
    
    logger.debug(`缓存设置: ${key}`, {
      ttl: config.ttl,
      namespace: config.namespace
    });
  }

  /**
   * 使用缓存执行查询
   */
  async withCache<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    config: CacheConfig
  ): Promise<T> {
    // 尝试获取缓存
    const cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      logger.debug(`缓存命中: ${cacheKey}`);
      return cached;
    }

    // 执行查询
    logger.debug(`缓存未命中，执行查询: ${cacheKey}`);
    const result = await queryFn();

    // 存储到缓存
    await this.set(cacheKey, result, config);

    return result;
  }

  /**
   * 删除缓存
   */
  async delete(prefix: string, params?: Record<string, any>): Promise<void> {
    const key = this.getCacheKey(prefix, params);
    this.memoryCache.delete(key);
    logger.debug(`缓存删除: ${key}`);
  }

  /**
   * 删除匹配的缓存
   */
  async deleteByPattern(pattern: string | RegExp): Promise<number> {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern)
      : pattern;

    const count = this.memoryCache.deleteByPattern(regex);
    logger.debug(`删除${count}条缓存匹配: ${pattern}`);
    return count;
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    logger.info('所有缓存已清空');
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      memory: this.memoryCache.getStats()
    };
  }
}

/**
 * 缓存装饰器
 * 用于方法级缓存
 */
export function Cacheable(config: CacheConfig) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;
      const cache = QueryCache.getInstance();

      return cache.withCache(
        cacheKey,
        () => originalMethod.apply(this, args),
        config
      );
    };

    return descriptor;
  };
}

/**
 * 缓存失效装饰器
 * 用于清除相关缓存
 */
export function CacheInvalidate(patterns: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      const cache = QueryCache.getInstance();

      for (const pattern of patterns) {
        await cache.deleteByPattern(pattern);
      }

      logger.debug(`缓存已失效: ${patterns.join(', ')}`);
      return result;
    };

    return descriptor;
  };
}

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIGS = {
  // 短期缓存：用户信息、产品等
  short: {
    ttl: 5 * 60 * 1000, // 5分钟
    namespace: 'short'
  },

  // 中期缓存：统计数据、配置等
  medium: {
    ttl: 30 * 60 * 1000, // 30分钟
    namespace: 'medium'
  },

  // 长期缓存：基础数据、分类等
  long: {
    ttl: 2 * 60 * 60 * 1000, // 2小时
    namespace: 'long'
  },

  // 极短缓存：实时数据
  veryShort: {
    ttl: 1 * 60 * 1000, // 1分钟
    namespace: 'veryShort'
  }
};

// 导出缓存实例
export const queryCache = QueryCache.getInstance();

