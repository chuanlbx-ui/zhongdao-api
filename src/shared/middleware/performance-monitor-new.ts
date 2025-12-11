import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { queryOptimizerService } from '../services/database/query-optimizer.service';
import { redisCacheService } from '../services/cache/redis-cache.service';

/**
 * 性能监控中间件
 * 监控API响应时间、数据库查询性能和缓存命中率
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private slowRequestThreshold = 2000; // 2秒阈值
  private requestStats: Map<string, { count: number; totalTime: number; avgTime: number; maxTime: number }> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 性能监控中间件
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const endpoint = `${req.method} ${req.route?.path || req.path}`;

      // 监听响应完成事件
      res.on('finish', () => {
        const executionTime = Date.now() - startTime;
        this.recordRequestStats(endpoint, executionTime);

        // 记录慢请求
        if (executionTime > this.slowRequestThreshold) {
          logger.warn('慢请求检测', {
            endpoint,
            executionTime,
            threshold: this.slowRequestThreshold,
            userId: req.user?.id,
            requestId: req.requestId,
            query: req.query,
            statusCode: res.statusCode
          });

          // 记录详细性能信息
          this.logDetailedPerformance(req, executionTime);
        }

        // 记录性能日志
        logger.info('API请求性能', {
          endpoint,
          executionTime,
          statusCode: res.statusCode,
          userId: req.user?.id,
          requestId: req.requestId
        });
      });

      next();
    };
  }

  /**
   * 记录请求统计
   */
  private recordRequestStats(endpoint: string, executionTime: number): void {
    const stats = this.requestStats.get(endpoint) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0
    };

    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, executionTime);

    this.requestStats.set(endpoint, stats);
  }

  /**
   * 记录详细性能信息
   */
  private logDetailedPerformance(req: Request, executionTime: number): void {
    // 获取数据库查询统计
    const dbStats = queryOptimizerService.getQueryStats();

    // 获取缓存统计
    const cacheStats = redisCacheService.getCacheStats();

    logger.warn('性能分析报告', {
      endpoint: `${req.method} ${req.route?.path || req.path}`,
      executionTime,
      userId: req.user?.id,
      requestId: req.requestId,
      performance: {
        database: dbStats,
        cache: cacheStats,
        slowQueries: Object.entries(dbStats)
          .filter(([_, stats]: [string, any]) => stats.avgTime > 500)
          .map(([query, stats]) => ({ query, ...stats }))
      }
    });
  }

  /**
   * 获取请求统计
   */
  getRequestStats(): Record<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
  }> {
    return Object.fromEntries(this.requestStats);
  }

  /**
   * 数据库查询性能监控装饰器
   */
  dbQueryMonitor(queryName: string) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;

      descriptor.value = async function(...args: any[]) {
        const startTime = Date.now();
        try {
          const result = await method.apply(this, args);
          const executionTime = Date.now() - startTime;
          queryOptimizerService.recordQueryStats(queryName, executionTime);
          return result;
        } catch (error) {
          const executionTime = Date.now() - startTime;
          logger.error('数据库查询失败', {
            queryName,
            executionTime,
            error: error instanceof Error ? error.message : '未知错误',
            args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
          });
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * 缓存命中率监控装饰器
   */
  cacheMonitor(cacheKey: string) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;

      descriptor.value = async function(...args: any[]) {
        const startTime = Date.now();
        let cacheHit = false;

        try {
          // 尝试从缓存获取
          const cached = await redisCacheService.get(cacheKey);
          if (cached !== null) {
            cacheHit = true;
            const executionTime = Date.now() - startTime;
            logger.debug('缓存命中', {
              cacheKey,
              executionTime
            });
            return cached;
          }

          // 缓存未命中，执行原方法
          const result = await method.apply(this, args);

          // 缓存结果
          await redisCacheService.set(cacheKey, result);

          const executionTime = Date.now() - startTime;
          logger.debug('缓存未命中', {
            cacheKey,
            executionTime,
            cacheMiss: true
          });

          return result;
        } catch (error) {
          const executionTime = Date.now() - startTime;
          logger.error('缓存操作失败', {
            cacheKey,
            executionTime,
            cacheHit,
            error: error instanceof Error ? error.message : '未知错误'
          });
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): {
    summary: {
      totalEndpoints: number;
      totalRequests: number;
      avgResponseTime: number;
      slowRequestsCount: number;
    };
    endpoints: Array<{
      endpoint: string;
      count: number;
      avgTime: number;
      maxTime: number;
    }>;
    database: Record<string, {
      count: number;
      totalTime: number;
      avgTime: number;
    }>;
    cache: {
      size: number;
      keys: string[];
      memoryUsage: number;
    };
  } {
    const endpoints = Array.from(this.requestStats.entries()).map(([endpoint, stats]) => ({
      endpoint,
      count: stats.count,
      avgTime: Math.round(stats.avgTime),
      maxTime: stats.maxTime
    }));

    const totalRequests = endpoints.reduce((sum, e) => sum + e.count, 0);
    const totalResponseTime = endpoints.reduce((sum, e) => sum + e.avgTime * e.count, 0);
    const avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;

    const slowRequestsCount = endpoints.filter(e => e.avgTime > this.slowRequestThreshold)
      .reduce((sum, e) => sum + e.count, 0);

    return {
      summary: {
        totalEndpoints: endpoints.length,
        totalRequests,
        avgResponseTime: Math.round(avgResponseTime),
        slowRequestsCount
      },
      endpoints: endpoints.sort((a, b) => b.avgTime - a.avgTime),
      database: queryOptimizerService.getQueryStats(),
      cache: redisCacheService.getCacheStats()
    };
  }

  /**
   * 重置统计数据
   */
  resetStats(): void {
    this.requestStats.clear();
    logger.info('性能监控统计数据已重置');
  }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance();