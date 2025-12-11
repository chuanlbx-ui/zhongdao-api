/**
 * 基础服务类
 * 提供通用服务功能，包括事务管理、事件发布、审计日志等
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { AppError } from '../errors';
import { container, SERVICE_TOKENS } from '../di/container';

export abstract class BaseService extends EventEmitter {
  protected prisma: PrismaClient = prisma;

  /**
   * 执行事务
   */
  async executeTransaction<T>(
    callback: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(callback);
    } catch (error) {
      logger.error('事务执行失败', { error, service: this.constructor.name });
      throw error;
    }
  }

  /**
   * 执行批量事务
   */
  async executeBatchTransaction<T>(
    operations: Array<(tx: PrismaClient) => Promise<T>>
  ): Promise<T[]> {
    try {
      return await this.prisma.$transaction(operations);
    } catch (error) {
      logger.error('批量事务执行失败', { error, service: this.constructor.name });
      throw error;
    }
  }

  /**
   * 分页查询
   */
  protected async paginate<T>(
    model: any,
    where: any = {},
    options: {
      page?: number;
      perPage?: number;
      orderBy?: any;
      include?: any;
      select?: any;
    } = {}
  ): Promise<{ items: T[]; total: number; page: number; perPage: number }> {
    const { page = 1, perPage = 10, orderBy, include, select } = options;
    const skip = (page - 1) * perPage;

    const [items, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take: perPage,
        orderBy,
        include,
        select
      }),
      model.count({ where })
    ]);

    return {
      items,
      total,
      page,
      perPage
    };
  }

  /**
   * 发布事件
   */
  protected async publishEvent(
    event: string,
    data: any,
    options: {
      userId?: string;
      requestId?: string;
      immediate?: boolean;
    } = {}
  ): Promise<void> {
    const eventBus = container.tryResolve(SERVICE_TOKENS.EVENT_BUS);
    if (eventBus) {
      await eventBus.publish(event, {
        ...data,
        timestamp: new Date(),
        userId: options.userId,
        requestId: options.requestId
      });
    } else {
      // 回退到内部事件发射器
      this.emit(event, data);
    }
  }

  /**
   * 记录审计日志
   */
  protected async logAudit(
    action: string,
    resource: string,
    resourceId?: string,
    details?: any,
    options: {
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    } = {}
  ): Promise<void> {
    const auditLogger = container.tryResolve(SERVICE_TOKENS.AUDIT_LOGGER);
    if (auditLogger) {
      await auditLogger.log(action, options.userId || 'system', {
        resource,
        resourceId,
        details,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        requestId: options.requestId
      });
    }

    // 同时记录到日志
    logger.info('审计日志', {
      action,
      resource,
      resourceId,
      userId: options.userId,
      details
    });
  }

  /**
   * 验证权限
   */
  protected async checkPermission(
    userId: string,
    permission: string,
    resource?: string,
    resourceId?: string
  ): Promise<boolean> {
    // 这里可以实现权限验证逻辑
    // 例如调用权限服务
    const permissionService = container.tryResolve(SERVICE_TOKENS.PERMISSION_SERVICE);
    if (permissionService) {
      return permissionService.hasPermission(userId, permission, resource, resourceId);
    }

    // 简单实现：检查用户角色
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      throw new AppError('USER_NOT_FOUND', '用户不存在', 404);
    }

    // 管理员拥有所有权限
    return ['ADMIN', 'DIRECTOR'].includes(user.role);
  }

  /**
   * 获取缓存
   */
  protected async getCache<T>(
    key: string,
    options?: { ttl?: number }
  ): Promise<T | null> {
    const cacheService = container.tryResolve(SERVICE_TOKENS.CACHE_SERVICE);
    if (cacheService) {
      return cacheService.get<T>(key);
    }
    return null;
  }

  /**
   * 设置缓存
   */
  protected async setCache(
    key: string,
    value: any,
    options?: { ttl?: number; tags?: string[] }
  ): Promise<void> {
    const cacheService = container.tryResolve(SERVICE_TOKENS.CACHE_SERVICE);
    if (cacheService) {
      await cacheService.set(key, value, options);
    }
  }

  /**
   * 清除缓存
   */
  protected async clearCache(
    patternOrKey: string,
    options?: { isPattern?: boolean }
  ): Promise<void> {
    const cacheService = container.tryResolve(SERVICE_TOKENS.CACHE_SERVICE);
    if (cacheService) {
      if (options?.isPattern) {
        await cacheService.clearPattern(patternOrKey);
      } else {
        await cacheService.delete(patternOrKey);
      }
    }
  }

  /**
   * 验证资源是否存在
   */
  protected async validateResourceExists<T>(
    model: any,
    id: string,
    errorMessage?: string
  ): Promise<T> {
    const resource = await model.findUnique({ where: { id } });
    if (!resource) {
      throw new AppError('NOT_FOUND', errorMessage || '资源不存在', 404);
    }
    return resource as T;
  }

  /**
   * 生成唯一ID
   */
  protected generateId(prefix?: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return prefix ? `${prefix}${timestamp}${random}` : `${timestamp}${random}`;
  }

  /**
   * 延迟执行
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试机制
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          break;
        }

        logger.warn(`重试第${attempt}次`, {
          error: lastError.message,
          service: this.constructor.name
        });

        await this.delay(delayMs * attempt);
      }
    }

    throw lastError!;
  }

  /**
   * 批量处理
   */
  protected async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: {
      batchSize?: number;
      concurrency?: number;
      progressCallback?: (processed: number, total: number) => void;
    } = {}
  ): Promise<R[]> {
    const { batchSize = 100, concurrency = 5, progressCallback } = options;
    const results: R[] = [];

    // 分批处理
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // 并发处理批次
      const batchPromises = batch.map(async (item, batchIndex) => {
        const index = i + batchIndex;
        return processor(item, index);
      });

      // 限制并发数
      for (let j = 0; j < batchPromises.length; j += concurrency) {
        const concurrentBatch = batchPromises.slice(j, j + concurrency);
        const batchResults = await Promise.all(concurrentBatch);
        results.push(...batchResults);

        // 进度回调
        if (progressCallback) {
          progressCallback(Math.min(i + j + concurrency, items.length), items.length);
        }
      }
    }

    return results;
  }

  /**
   * 性能监控
   */
  protected async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      logger.performance(operation, duration, {
        service: this.constructor.name
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('性能监控: 操作失败', {
        operation,
        duration,
        error: error instanceof Error ? error.message : '未知错误',
        service: this.constructor.name
      });

      throw error;
    }
  }
}