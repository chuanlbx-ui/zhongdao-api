import { logger } from '../../utils/logger';
import NodeCache from 'node-cache';

// 缓存配置
const cacheConfig = {
  stdTTL: 300, // 默认5分钟缓存
  checkperiod: 60, // 每分钟检查过期项
  useClones: false // 提高性能，避免深度克隆
};

// 创建缓存实例
const queryCache = new NodeCache(cacheConfig);
const statsCache = new NodeCache({ ...cacheConfig, stdTTL: 600 }); // 统计数据缓存10分钟

// 缓存统计
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memoryUsage: number;
}

// 缓存配置接口
export interface CacheOptions {
  ttl?: number; // 生存时间（秒）
  prefix?: string; // 键前缀
  tags?: string[]; // 缓存标签，用于批量删除
}

// 查询缓存服务类
export class QueryCacheService {
  private static instance: QueryCacheService;
  private stats = {
    hits: 0,
    misses: 0
  };

  static getInstance(): QueryCacheService {
    if (!QueryCacheService.instance) {
      QueryCacheService.instance = new QueryCacheService();
    }
    return QueryCacheService.instance;
  }

  // 生成缓存键
  private generateKey(prefix: string, params: Record<string, any>): string {
    // 对参数进行排序，确保相同查询生成相同的键
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          result[key] = String(params[key]);
        }
        return result;
      }, {} as Record<string, string>);

    const paramString = JSON.stringify(sortedParams);
    const hash = this.simpleHash(paramString);
    return `${prefix}:${hash}`;
  }

  // 简单的哈希函数
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  // 获取缓存数据
  async get<T>(key: string): Promise<T | null> {
    const cached = queryCache.get<T>(key);

    if (cached !== undefined) {
      this.stats.hits++;
      logger.debug(`Cache hit for key: ${key}`);
      return cached;
    }

    this.stats.misses++;
    logger.debug(`Cache miss for key: ${key}`);
    return null;
  }

  // 设置缓存数据
  set<T>(key: string, data: T, options: CacheOptions = {}): boolean {
    try {
      const { ttl = cacheConfig.stdTTL } = options;

      // 添加缓存时间戳
      const cacheData = {
        data,
        cachedAt: new Date().toISOString()
      };

      const success = queryCache.set(key, cacheData, ttl);

      if (success) {
        logger.debug(`Cache set for key: ${key}, TTL: ${ttl}s`);
      }

      return success;
    } catch (error) {
      logger.error('Failed to set cache', { key, error });
      return false;
    }
  }

  // 删除缓存
  delete(key: string): boolean {
    const deleted = queryCache.del(key);
    logger.debug(`Cache deleted for key: ${key}, deleted: ${deleted}`);
    return deleted > 0;
  }

  // 清空所有缓存
  flush(): void {
    queryCache.flushAll();
    this.stats = { hits: 0, misses: 0 };
    logger.info('Cache flushed');
  }

  // 获取或设置缓存（常用模式）
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // 尝试从缓存获取
    let cached = await this.get<CacheData<T>>(key);

    if (cached) {
      return cached.data;
    }

    // 缓存未命中，执行查询
    logger.debug(`Fetching data for key: ${key}`);
    const data = await fetcher();

    // 存入缓存
    this.set(key, data, options);

    return data;
  }

  // 根据前缀删除缓存
  deleteByPrefix(prefix: string): number {
    const keys = queryCache.keys().filter(key => key.startsWith(prefix));
    const deleted = queryCache.del(keys);
    logger.info(`Deleted ${deleted} cache entries with prefix: ${prefix}`);
    return deleted;
  }

  // 获取缓存统计信息
  getStats(): CacheStats {
    const keys = queryCache.keys();
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    // 估算内存使用量
    const memoryUsage = this.estimateMemoryUsage();

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      keys: keys.length,
      memoryUsage
    };
  }

  // 估算内存使用量（粗略估算）
  private estimateMemoryUsage(): number {
    const stats = queryCache.getStats();
    // 每个缓存项平均大小估算（KB）
    const avgItemSize = 5;
    return Math.round(stats.kstats * avgItemSize);
  }

  // 重置统计
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  // 缓存预热
  async warmup(warmupData: Array<{
    key: string;
    fetcher: () => Promise<any>;
    options?: CacheOptions;
  }>): Promise<void> {
    logger.info(`Starting cache warmup for ${warmupData.length} items`);

    const promises = warmupData.map(async ({ key, fetcher, options }) => {
      try {
        await this.getOrSet(key, fetcher, options);
        logger.debug(`Warmed up cache for key: ${key}`);
      } catch (error) {
        logger.error(`Failed to warm up cache for key: ${key}`, error);
      }
    });

    await Promise.all(promises);
    logger.info('Cache warmup completed');
  }

  // 设置TTL
  setTTL(key: string, ttl: number): boolean {
    return queryCache.ttl(key, ttl) > 0;
  }

  // 获取剩余TTL
  getTTL(key: string): number {
    return queryCache.getTtl(key);
  }
}

// 缓存数据包装接口
interface CacheData<T> {
  data: T;
  cachedAt: string;
}

// 导出单例实例
export const queryCacheService = QueryCacheService.getInstance();

// 缓存装饰器
export function Cacheable(options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 生成缓存键
      const className = target.constructor.name;
      const key = queryCacheService['generateKey'](
        `${className}:${propertyKey}`,
        { args }
      );

      // 尝试从缓存获取
      let cached = await queryCacheService.get(key);

      if (cached) {
        return cached;
      }

      // 执行原方法
      const result = await originalMethod.apply(this, args);

      // 存入缓存
      queryCacheService.set(key, result, options);

      return result;
    };

    return descriptor;
  };
}

// 常用缓存键前缀
export const CacheKeys = {
  // 用户相关
  USER_PROFILE: 'user:profile',
  USER_TEAM: 'user:team',
  USER_STATS: 'user:stats',

  // 产品相关
  PRODUCT_LIST: 'product:list',
  PRODUCT_DETAIL: 'product:detail',
  PRODUCT_CATEGORIES: 'product:categories',

  // 积分相关
  POINTS_TRANSACTIONS: 'points:transactions',
  POINTS_BALANCE: 'points:balance',

  // 订单相关
  ORDER_LIST: 'order:list',
  ORDER_STATS: 'order:stats',

  // 库存相关
  INVENTORY_ALERTS: 'inventory:alerts',
  INVENTORY_STOCKS: 'inventory:stocks'
};

// 缓存清理函数
export const CacheInvalidators = {
  // 清理用户相关缓存
  invalidateUser: (userId: string) => {
    queryCacheService.deleteByPrefix(`user:profile:${userId}`);
    queryCacheService.deleteByPrefix(`user:team:${userId}`);
    queryCacheService.deleteByPrefix(`user:stats:${userId}`);
  },

  // 清理产品相关缓存
  invalidateProducts: () => {
    queryCacheService.deleteByPrefix('product:list');
    queryCacheService.deleteByPrefix('product:detail');
  },

  // 清理积分相关缓存
  invalidatePoints: (userId?: string) => {
    if (userId) {
      queryCacheService.deleteByPrefix(`points:transactions:${userId}`);
      queryCacheService.deleteByPrefix(`points:balance:${userId}`);
    } else {
      queryCacheService.deleteByPrefix('points:');
    }
  },

  // 清理订单相关缓存
  invalidateOrders: (userId?: string) => {
    if (userId) {
      queryCacheService.deleteByPrefix(`order:list:${userId}`);
    } else {
      queryCacheService.deleteByPrefix('order:list');
    }
    queryCacheService.deleteByPrefix('order:stats');
  }
};

// 定期日志缓存统计
setInterval(() => {
  const stats = queryCacheService.getStats();
  if (stats.hits + stats.misses > 0) {
    logger.info('Cache Statistics', stats);
  }
}, 300000); // 每5分钟记录一次