/**
 * 缓存装饰器
 * 提供方法级和类级的缓存装饰器
 */

import 'reflect-metadata';
import { cacheManager } from '../CacheManager';
import { CacheOptions } from '../CacheInterface';
import { CacheStrategyFactory } from '../strategies/CacheStrategy';
import { logger } from '../../utils/logger';

// 装饰器元数据键
const CACHE_KEY_PREFIX = Symbol('cache:prefix');
const CACHE_OPTIONS = Symbol('cache:options');
const CACHE_STRATEGY = Symbol('cache:strategy');
const CACHE_INVALIDATE = Symbol('cache:invalidate');

/**
 * 缓存装饰器选项
 */
export interface CacheDecoratorOptions extends CacheOptions {
  // 缓存键策略
  keyPrefix?: string;
  keyGenerator?: (...args: any[]) => string;
  useArgs?: boolean; // 是否使用参数生成键

  // 策略
  strategy?: string; // 缓存策略类型

  // 条件
  condition?: (...args: any[]) => boolean;
  unless?: (...args: any[]) => boolean;

  // 结果处理
  transform?: (result: any) => any;

  // 过期时间
  ttl?: number;
}

/**
 * 主要的缓存装饰器
 */
export function Cached(options: CacheDecoratorOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // 设置元数据
    Reflect.defineMetadata(CACHE_KEY_PREFIX, options.keyPrefix || `${target.constructor.name}:${propertyKey}`, target, propertyKey);
    Reflect.defineMetadata(CACHE_OPTIONS, options, target, propertyKey);
    Reflect.defineMetadata(CACHE_STRATEGY, options.strategy || 'default', target, propertyKey);

    descriptor.value = async function (...args: any[]) {
      // 检查条件
      if (options.condition && !options.condition.apply(this, args)) {
        return originalMethod.apply(this, args);
      }

      if (options.unless && options.unless.apply(this, args)) {
        return originalMethod.apply(this, args);
      }

      // 获取策略
      const strategyType = Reflect.getMetadata(CACHE_STRATEGY, target, propertyKey) || 'default';
      const strategy = CacheStrategyFactory.getStrategy(strategyType);

      // 生成缓存键
      let cacheKey: string;
      if (options.keyGenerator) {
        cacheKey = options.keyGenerator.apply(this, args);
      } else if (options.useArgs) {
        const prefix = Reflect.getMetadata(CACHE_KEY_PREFIX, target, propertyKey);
        const params = args.map((arg, index) => ({ [`arg${index}`]: arg }));
        cacheKey = strategy.generateKey(prefix, Object.assign({}, ...params));
      } else {
        cacheKey = Reflect.getMetadata(CACHE_KEY_PREFIX, target, propertyKey);
      }

      try {
        // 尝试从缓存获取
        const cached = await cacheManager.get(cacheKey);
        if (cached !== null) {
          logger.debug(`缓存命中 (装饰器): ${cacheKey}`);
          return cached;
        }

        // 执行原方法
        logger.debug(`缓存未命中 (装饰器): ${cacheKey}`);
        const result = await originalMethod.apply(this, args);

        // 转换结果
        const finalResult = options.transform ? options.transform(result) : result;

        // 计算TTL
        const cacheOptions: CacheOptions = {
          ttl: options.ttl || strategy.calculateTTL(finalResult, options),
          tags: options.tags
        };

        // 设置缓存
        await cacheManager.set(cacheKey, finalResult, cacheOptions);

        return finalResult;
      } catch (error) {
        logger.error(`缓存装饰器错误: ${cacheKey}`, error);
        // 出错时直接执行原方法
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * 缓存失效装饰器
 */
export function CacheInvalidate(patterns: string | string[], options: { tags?: string[] } = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // 设置元数据
    const invalidationPatterns = Array.isArray(patterns) ? patterns : [patterns];
    Reflect.defineMetadata(CACHE_INVALIDATE, { patterns: invalidationPatterns, tags: options.tags }, target, propertyKey);

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // 执行成功后清除缓存
      try {
        if (options.tags && options.tags.length > 0) {
          await cacheManager.invalidateTags(options.tags);
        }

        for (const pattern of invalidationPatterns) {
          await cacheManager.delPattern(pattern);
        }

        logger.debug(`缓存已失效 (装饰器): ${invalidationPatterns.join(', ')}`);
      } catch (error) {
        logger.error('缓存失效失败:', error);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 类级缓存装饰器
 */
export function CachedClass(options: CacheDecoratorOptions = {}) {
  return function <T extends { new(...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);

        // 为类的所有方法添加缓存
        const propertyNames = Object.getOwnPropertyNames(constructor.prototype);

        for (const propertyName of propertyNames) {
          if (propertyName !== 'constructor' && typeof this[propertyName] === 'function') {
            const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, propertyName);
            if (descriptor && descriptor.value) {
              // 跳过已经装饰过的方法
              if (!Reflect.hasMetadata(CACHE_KEY_PREFIX, this, propertyName)) {
                Reflect.defineMetadata(CACHE_KEY_PREFIX, `${constructor.name}:${propertyName}`, this, propertyName);
                Reflect.defineMetadata(CACHE_OPTIONS, options, this, propertyName);
                Reflect.defineMetadata(CACHE_STRATEGY, options.strategy || 'default', this, propertyName);
              }
            }
          }
        }
      }
    };
  };
}

/**
 * 方法执行时间缓存装饰器
 * 根据方法执行时间动态调整TTL
 */
export function CachedWithDynamicTTL(options: CacheDecoratorOptions & { minTTL?: number; maxTTL?: number; timeThreshold?: number } = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const result = await originalMethod.apply(this, args);
      const executionTime = Date.now() - startTime;

      // 根据执行时间计算TTL
      const { minTTL = 60, maxTTL = 3600, timeThreshold = 1000 } = options;
      let ttl = options.ttl || 300;

      if (executionTime > timeThreshold) {
        // 执行时间越长，缓存越久
        ttl = Math.min(maxTTL, ttl * 2);
      } else {
        // 执行时间短，缓存较短
        ttl = Math.max(minTTL, ttl / 2);
      }

      // 应用标准缓存逻辑
      const cacheOptions = { ...options, ttl };
      const cachedDecorator = Cached(cacheOptions)(target, propertyKey, descriptor);

      return descriptor.value.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * 参数级缓存装饰器
 * 根据特定参数值决定是否缓存
 */
export function CachedIfParam(paramIndex: number, value: any, options: CacheDecoratorOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 检查指定参数的值
      if (args[paramIndex] === value) {
        // 应用缓存
        const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

        const cached = await cacheManager.get(cacheKey);
        if (cached !== null) {
          return cached;
        }

        const result = await originalMethod.apply(this, args);
        await cacheManager.set(cacheKey, result, options);
        return result;
      }

      // 不缓存，直接执行
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * 用户级缓存装饰器
 */
export function CachedUser(options: Omit<CacheDecoratorOptions, 'strategy'> = {}) {
  return Cached({
    ...options,
    strategy: 'user',
    keyPrefix: `user:${options.keyPrefix || 'data'}`,
    ttl: options.ttl || 600
  });
}

/**
 * 产品级缓存装饰器
 */
export function CachedProduct(options: Omit<CacheDecoratorOptions, 'strategy'> = {}) {
  return Cached({
    ...options,
    strategy: 'product',
    keyPrefix: `product:${options.keyPrefix || 'data'}`,
    ttl: options.ttl || 1800
  });
}

/**
 * 团队级缓存装饰器
 */
export function CachedTeam(options: Omit<CacheDecoratorOptions, 'strategy'> = {}) {
  return Cached({
    ...options,
    strategy: 'team',
    keyPrefix: `team:${options.keyPrefix || 'data'}`,
    ttl: options.ttl || 900
  });
}

/**
 * 积分级缓存装饰器
 */
export function CachedPoints(options: Omit<CacheDecoratorOptions, 'strategy'> = {}) {
  return Cached({
    ...options,
    strategy: 'points',
    keyPrefix: `points:${options.keyPrefix || 'data'}`,
    ttl: options.ttl || 60
  });
}

/**
 * 统计级缓存装饰器
 */
export function CachedStats(options: Omit<CacheDecoratorOptions, 'strategy'> = {}) {
  return Cached({
    ...options,
    strategy: 'stats',
    keyPrefix: `stats:${options.keyPrefix || 'data'}`,
    ttl: options.ttl || 300
  });
}

/**
 * 缓存工具函数
 */
export class CacheUtils {
  /**
   * 获取方法的缓存键
   */
  static getMethodCacheKey(target: any, propertyKey: string, ...args: any[]): string {
    const prefix = Reflect.getMetadata(CACHE_KEY_PREFIX, target, propertyKey) || `${target.constructor.name}:${propertyKey}`;
    const strategyType = Reflect.getMetadata(CACHE_STRATEGY, target, propertyKey) || 'default';
    const strategy = CacheStrategyFactory.getStrategy(strategyType);

    const params = args.map((arg, index) => ({ [`arg${index}`]: arg }));
    return strategy.generateKey(prefix, Object.assign({}, ...params));
  }

  /**
   * 清除方法缓存
   */
  static async clearMethodCache(target: any, propertyKey: string, ...args: any[]): Promise<void> {
    const cacheKey = this.getMethodCacheKey(target, propertyKey, ...args);
    await cacheManager.del(cacheKey);
  }

  /**
   * 清除类所有缓存
   */
  static async clearClassCache(target: any): Promise<void> {
    const className = target.constructor.name;
    const patterns = [
      `${className}:*`,
      `user:*:*`,
      `product:*:*`,
      `team:*:*`,
      `points:*:*`,
      `stats:*:*`
    ];

    for (const pattern of patterns) {
      await cacheManager.delPattern(pattern);
    }
  }

  /**
   * 预热类缓存
   */
  static async warmupClassCache(target: any, warmupData: Array<{ method: string; args: any[] }>): Promise<void> {
    const instance = target;

    for (const item of warmupData) {
      if (typeof instance[item.method] === 'function') {
        try {
          await instance[item.method](...item.args);
          logger.debug(`预热方法: ${instance.constructor.name}.${item.method}`);
        } catch (error) {
          logger.error(`预热失败: ${instance.constructor.name}.${item.method}`, error);
        }
      }
    }
  }
}