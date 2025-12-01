/**
 * Prisma查询优化工具
 * 提供查询性能优化的最佳实践
 */

import { logger } from '../utils/logger';

/**
 * 查询优化配置接口
 */
export interface QueryOptimizeOptions {
  maxResults?: number;
  batchSize?: number;
  selectFields?: string[];
  skipRelations?: boolean;
  enableBatching?: boolean;
}

/**
 * 查询优化工具类
 */
export class QueryOptimizer {
  /**
   * 批量查询优化
   * 当需要处理大量数据时，使用批量方式避免内存溢出
   */
  static async batchQuery<T>(
    queryFn: (skip: number, take: number) => Promise<T[]>,
    totalRecords: number,
    batchSize: number = 100
  ): Promise<T[]> {
    const results: T[] = [];
    const batches = Math.ceil(totalRecords / batchSize);

    for (let i = 0; i < batches; i++) {
      const skip = i * batchSize;
      const batch = await queryFn(skip, batchSize);
      results.push(...batch);
      
      logger.debug(`已获取第${i + 1}/${batches}批数据`, {
        skip,
        take: batchSize,
        batchSize: batch.length
      });
    }

    return results;
  }

  /**
   * 并发查询优化
   * 多个独立查询可以并发执行
   */
  static async concurrentQueries<T>(
    queries: Promise<T>[],
    concurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < queries.length; i++) {
      const promise = queries[i].then(result => {
        results[i] = result;
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * 分页查询优化
   * 使用cursor-based分页而不是offset-based
   */
  static getPaginationParams(page: number = 1, perPage: number = 20) {
    const maxPerPage = 100;
    const actualPerPage = Math.min(perPage, maxPerPage);
    const actualPage = Math.max(1, page);
    const skip = (actualPage - 1) * actualPerPage;

    return {
      skip,
      take: actualPerPage,
      page: actualPage,
      perPage: actualPerPage
    };
  }

  /**
   * 字段选择优化
   * 只查询需要的字段，减少数据传输
   */
  static buildSelectFields(
    requiredFields: string[],
    includeRelations: string[] = []
  ) {
    const select: Record<string, any> = {};

    // 添加基础字段
    for (const field of requiredFields) {
      select[field] = true;
    }

    // 添加关联字段
    for (const relation of includeRelations) {
      select[relation] = {
        select: {
          id: true,
          name: true
        }
      };
    }

    return select;
  }

  /**
   * 延迟加载优化
   * 首先加载基础数据，然后按需加载关联数据
   */
  static async lazyLoadRelations<T extends { id: string }>(
    items: T[],
    relationLoader: (id: string) => Promise<any>
  ) {
    const relationCache: Map<string, any> = new Map();

    return Promise.all(
      items.map(async item => {
        if (!relationCache.has(item.id)) {
          relationCache.set(item.id, await relationLoader(item.id));
        }
        return {
          ...item,
          relation: relationCache.get(item.id)
        };
      })
    );
  }

  /**
   * 缓存键生成
   * 为缓存生成统一的键格式
   */
  static generateCacheKey(
    prefix: string,
    params: Record<string, any>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');

    return `${prefix}:${sortedParams}`;
  }

  /**
   * 查询性能分析
   */
  static async measureQuery<T>(
    name: string,
    queryFn: () => Promise<T>,
    warnThreshold: number = 1000
  ): Promise<T> {
    const start = Date.now();
    const result = await queryFn();
    const duration = Date.now() - start;

    if (duration > warnThreshold) {
      logger.warn(`慢查询警告: ${name}`, {
        duration: `${duration}ms`,
        threshold: `${warnThreshold}ms`
      });
    } else {
      logger.debug(`查询完成: ${name}`, {
        duration: `${duration}ms`
      });
    }

    return result;
  }
}

/**
 * 查询时间统计
 */
export class QueryMetrics {
  private static metrics: Map<string, number[]> = new Map();

  static record(queryName: string, duration: number) {
    if (!this.metrics.has(queryName)) {
      this.metrics.set(queryName, []);
    }
    this.metrics.get(queryName)!.push(duration);
  }

  static getStats(queryName: string) {
    const durations = this.metrics.get(queryName) || [];
    if (durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    return {
      count: durations.length,
      avg: Math.round(durations.reduce((a, b) => a + b) / durations.length),
      min: Math.min(...durations),
      max: Math.max(...durations),
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0
    };
  }

  static getAllStats() {
    const stats: Record<string, any> = {};
    for (const [name, _] of this.metrics) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  static reset() {
    this.metrics.clear();
  }
}
