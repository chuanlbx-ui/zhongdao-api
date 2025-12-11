/**
 * 智能缓存中间件
 * 提供自动缓存、智能失效、缓存穿透防护等功能
 */

import { Request, Response, NextFunction } from 'express';
import { cacheManager } from '../cache/CacheManager';
import { CacheOptions } from '../cache/CacheInterface';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface CacheMiddlewareConfig {
  // 基础配置
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  skipCache?: (req: Request) => boolean;

  // 高级配置
  varyOn?: string[]; // 根据请求头变化缓存
  includeQuery?: boolean; // 是否包含查询参数
  includeBody?: boolean; // 是否包含请求体
  keyPrefix?: string;
  tags?: string[]; // 缓存标签

  // 穿透防护
  enableProtection?: boolean;
  protectionTTL?: number; // 空值缓存TTL
  maxRequests?: number; // 穿透防护最大请求数

  // 回调
  onHit?: (req: Request, data: any) => void;
  onMiss?: (req: Request) => void;
  onSet?: (req: Request, data: any) => void;

  // 状态码配置
  cacheableStatus?: number[];
}

export interface CacheResponse extends Response {
  _cacheKey?: string;
  _cacheConfig?: CacheMiddlewareConfig;
  _cacheData?: any;
}

// 默认配置
const DEFAULT_CONFIG: Partial<CacheMiddlewareConfig> = {
  ttl: 300, // 5分钟
  includeQuery: true,
  includeBody: false,
  enableProtection: true,
  protectionTTL: 60, // 1分钟
  maxRequests: 10,
  cacheableStatus: [200, 301, 302, 404]
};

/**
 * 生成缓存键
 */
function generateCacheKey(req: Request, config: CacheMiddlewareConfig): string {
  // 检查是否有自定义键生成器
  if (config.keyGenerator) {
    return config.keyGenerator(req);
  }

  // 默认键生成逻辑
  const parts = [
    req.method,
    req.originalUrl || req.url,
    req.path
  ];

  // 包含查询参数
  if (config.includeQuery && req.query) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .reduce((result: any, key) => {
        result[key] = req.query[key];
        return result;
      }, {});

    if (Object.keys(sortedQuery).length > 0) {
      parts.push(JSON.stringify(sortedQuery));
    }
  }

  // 包含请求体（仅对POST/PUT/PATCH）
  if (config.includeBody && ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    parts.push(JSON.stringify(req.body));
  }

  // 包含变化的请求头
  if (config.varyOn && config.varyOn.length > 0) {
    const varyHeaders = config.varyOn
      .map(header => req.headers[header])
      .filter(Boolean)
      .join('|');

    if (varyHeaders) {
      parts.push(varyHeaders);
    }
  }

  // 添加前缀
  const prefix = config.keyPrefix || 'api';
  const rawKey = `${prefix}:${parts.join(':')}`;

  // 使用MD5缩短键长度
  const hash = crypto.createHash('md5').update(rawKey).digest('hex');
  return `${prefix}:${hash}`;
}

/**
 * 检查是否应该跳过缓存
 */
function shouldSkipCache(req: Request, config: CacheMiddlewareConfig): boolean {
  // 检查自定义跳过条件
  if (config.skipCache && config.skipCache(req)) {
    return true;
  }

  // 检查条件
  if (config.condition && !config.condition(req)) {
    return true;
  }

  // 检查请求头中的缓存控制
  const cacheControl = req.headers['cache-control'];
  if (cacheControl && cacheControl.includes('no-cache')) {
    return true;
  }

  // 检查授权头（默认跳过需要授权的请求）
  if (req.headers.authorization && !config.keyPrefix?.includes('auth')) {
    return true;
  }

  return false;
}

/**
 * 缓存穿透防护键
 */
function getProtectionKey(cacheKey: string): string {
  return `protection:${cacheKey}`;
}

/**
 * 响应是否可缓存
 */
function isResponseCacheable(res: Response, config: CacheMiddlewareConfig): boolean {
  const statusCode = res.statusCode;
  const cacheableStatus = config.cacheableStatus || DEFAULT_CONFIG.cacheableStatus;

  return cacheableStatus.includes(statusCode);
}

/**
 * 主要缓存中间件
 */
export function cacheMiddleware(config: CacheMiddlewareConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: CacheResponse, next: NextFunction) => {
    // 检查是否跳过缓存
    if (shouldSkipCache(req, finalConfig)) {
      return next();
    }

    // 生成缓存键
    const cacheKey = generateCacheKey(req, finalConfig);
    res._cacheKey = cacheKey;
    res._cacheConfig = finalConfig;

    try {
      // 尝试从缓存获取
      const cached = await cacheManager.get(cacheKey);

      if (cached !== null) {
        // 缓存命中
        logger.debug(`缓存命中: ${cacheKey}`);

        // 设置响应头
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'X-Cache-TTL': String(await cacheManager.ttl(cacheKey))
        });

        // 执行命中回调
        if (finalConfig.onHit) {
          finalConfig.onHit(req, cached);
        }

        return res.json(cached);
      }

      // 缓存未命中，检查穿透防护
      if (finalConfig.enableProtection) {
        const protectionKey = getProtectionKey(cacheKey);
        const protectionCount = await cacheManager.get<number>(protectionKey) || 0;

        if (protectionCount >= (finalConfig.maxRequests || DEFAULT_CONFIG.maxRequests)) {
          logger.warn(`触发缓存穿透防护: ${cacheKey}`);

          // 返回空响应或错误
          res.set({
            'X-Cache': 'PROTECTION',
            'X-Cache-Key': cacheKey
          });

          return res.status(429).json({
            error: 'Too Many Requests',
            message: '请求过于频繁，请稍后再试'
          });
        }

        // 增加保护计数
        await cacheManager.set(protectionKey, protectionCount + 1, {
          ttl: finalConfig.protectionTTL || DEFAULT_CONFIG.protectionTTL
        });
      }

      logger.debug(`缓存未命中: ${cacheKey}`);

      // 设置响应头
      res.set({
        'X-Cache': 'MISS',
        'X-Cache-Key': cacheKey
      });

      // 执行未命中回调
      if (finalConfig.onMiss) {
        finalConfig.onMiss(req);
      }

      // 拦截响应
      const originalJson = res.json;
      res.json = function(data: any) {
        // 保存原始响应数据
        res._cacheData = data;

        // 检查是否可缓存
        if (isResponseCacheable(res, finalConfig)) {
          // 异步缓存响应数据
          cacheManager.set(cacheKey, data, {
            ttl: finalConfig.ttl,
            tags: finalConfig.tags
          }).catch(error => {
            logger.error('缓存设置失败:', error);
          });

          // 清除穿透保护
          if (finalConfig.enableProtection) {
            const protectionKey = getProtectionKey(cacheKey);
            cacheManager.del(protectionKey).catch(() => {});
          }

          // 执行设置回调
          if (finalConfig.onSet) {
            finalConfig.onSet(req, data);
          }
        }

        // 调用原始方法
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('缓存中间件错误:', error);
      next();
    }
  };
}

/**
 * 清除缓存中间件
 */
export function invalidateCacheMiddleware(patterns: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function(data: any) {
      // 在响应成功后清除缓存
      if (res.statusCode >= 200 && res.statusCode < 300) {
        Promise.all(
          patterns.map(pattern => cacheManager.delPattern(pattern))
        ).catch(error => {
          logger.error('缓存清除失败:', error);
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * 标签缓存失效中间件
 */
export function invalidateTagsMiddleware(tags: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function(data: any) {
      // 在响应成功后清除标签
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheManager.invalidateTags(tags).catch(error => {
          logger.error('标签缓存清除失败:', error);
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * 缓存条件装饰器
 */
export function cacheIf(condition: (req: Request) => boolean, config?: CacheMiddlewareConfig) {
  return cacheMiddleware({
    ...config,
    condition
  });
}

/**
 * 用户级缓存中间件
 */
export function userCacheMiddleware(config: Partial<CacheMiddlewareConfig> = {}) {
  return cacheMiddleware({
    ...config,
    keyPrefix: 'user',
    varyOn: ['authorization'],
    tags: ['user-data'],
    ttl: config.ttl || 600 // 10分钟
  });
}

/**
 * 产品缓存中间件
 */
export function productCacheMiddleware(config: Partial<CacheMiddlewareConfig> = {}) {
  return cacheMiddleware({
    ...config,
    keyPrefix: 'product',
    tags: ['product-data'],
    ttl: config.ttl || 1800 // 30分钟
  });
}

/**
 * 团队缓存中间件
 */
export function teamCacheMiddleware(config: Partial<CacheMiddlewareConfig> = {}) {
  return cacheMiddleware({
    ...config,
    keyPrefix: 'team',
    varyOn: ['authorization'],
    tags: ['team-data'],
    ttl: config.ttl || 900 // 15分钟
  });
}

/**
 * 积分缓存中间件
 */
export function pointsCacheMiddleware(config: Partial<CacheMiddlewareConfig> = {}) {
  return cacheMiddleware({
    ...config,
    keyPrefix: 'points',
    varyOn: ['authorization'],
    tags: ['points-data'],
    ttl: config.ttl || 60 // 1分钟
  });
}

/**
 * 配置缓存中间件
 */
export function configCacheMiddleware(config: Partial<CacheMiddlewareConfig> = {}) {
  return cacheMiddleware({
    ...config,
    keyPrefix: 'config',
    tags: ['config-data'],
    ttl: config.ttl || 3600 // 1小时
  });
}

/**
 * 统计缓存中间件
 */
export function statsCacheMiddleware(config: Partial<CacheMiddlewareConfig> = {}) {
  return cacheMiddleware({
    ...config,
    keyPrefix: 'stats',
    varyOn: ['authorization'],
    tags: ['stats-data'],
    ttl: config.ttl || 300 // 5分钟
  });
}

/**
 * 热点数据缓存中间件
 */
export function hotDataCacheMiddleware(config: Partial<CacheMiddlewareConfig> = {}) {
  return cacheMiddleware({
    ...config,
    keyPrefix: 'hot',
    tags: ['hot-data'],
    ttl: config.ttl || 1800, // 30分钟
    enableProtection: true,
    protectionTTL: 10, // 热点数据保护时间更短
    maxRequests: 100 // 允许更多请求
  });
}

/**
 * 缓存状态路由
 */
export function cacheStatsRoute() {
  return async (req: Request, res: Response) => {
    try {
      const stats = await cacheManager.getStats();
      const config = cacheManager.getConfig();
      const health = await cacheManager.healthCheck();

      res.json({
        success: true,
        data: {
          health,
          stats,
          config,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('获取缓存统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取缓存统计失败'
      });
    }
  };
}

/**
 * 清除缓存路由
 */
export function clearCacheRoute() {
  return async (req: Request, res: Response) => {
    try {
      const { pattern, tags } = req.body;

      let count = 0;

      if (tags && Array.isArray(tags)) {
        count += await cacheManager.invalidateTags(tags);
      }

      if (pattern && typeof pattern === 'string') {
        count += await cacheManager.delPattern(pattern);
      }

      if (!pattern && !tags) {
        await cacheManager.flush();
        count = -1; // 表示全部清除
      }

      res.json({
        success: true,
        data: {
          cleared: count,
          pattern,
          tags
        }
      });
    } catch (error) {
      logger.error('清除缓存失败:', error);
      res.status(500).json({
        success: false,
        error: '清除缓存失败'
      });
    }
  };
}

/**
 * 预热缓存路由
 */
export function warmupCacheRoute() {
  return async (req: Request, res: Response) => {
    try {
      const { data } = req.body;

      if (!Array.isArray(data)) {
        return res.status(400).json({
          success: false,
          error: '预热数据格式错误'
        });
      }

      await cacheManager.warmup(data);

      res.json({
        success: true,
        data: {
          warmed: data.length
        }
      });
    } catch (error) {
      logger.error('预热缓存失败:', error);
      res.status(500).json({
        success: false,
        error: '预热缓存失败'
      });
    }
  };
}

// 导出默认中间件
export const defaultCacheMiddleware = cacheMiddleware();