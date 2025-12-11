/**
 * 监控系统集成中间件
 * 将监控系统集成到Express应用中
 */

import { Request, Response, NextFunction } from 'express';
import { monitoringCenter } from '../core/monitoring-center';
import { logger } from '../../shared/utils/logger';

/**
 * 初始化监控系统中间件
 * 在应用启动时初始化监控
 */
export async function initializeMonitoring(): Promise<void> {
  try {
    logger.info('正在启动监控系统...');
    await monitoringCenter.start();
    logger.info('监控系统启动成功');
  } catch (error) {
    logger.error('监控系统启动失败', error);
    throw error;
  }
}

/**
 * 性能监控中间件
 * 集成现有的性能监控V2
 */
export function performanceMonitoring(req: Request, res: Response, next: NextFunction): void {
  // 记录请求开始时间
  const startTime = process.hrtime.bigint();

  // 监听响应完成
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // 转换为毫秒

    // 记录到监控中心
    monitoringCenter.getMetricsCollector().recordRequest(req, res, responseTime);
  });

  next();
}

/**
 * 业务指标中间件
 * 自动收集业务指标
 */
export function businessMetrics(req: Request, res: Response, next: NextFunction): void {
  // 记录业务相关的指标
  const url = req.url;
  const method = req.method;

  // 注册相关业务指标
  if (url.includes('/api/v1/auth/register')) {
    monitoringCenter.recordMetric('counter', 'user_registrations_total', 1);
  } else if (url.includes('/api/v1/auth/login')) {
    monitoringCenter.recordMetric('counter', 'user_logins_total', 1);
  } else if (url.includes('/api/v1/orders')) {
    if (method === 'POST') {
      monitoringCenter.recordMetric('counter', 'orders_created_total', 1);
    }
  } else if (url.includes('/api/v1/payments')) {
    if (method === 'POST') {
      monitoringCenter.recordMetric('counter', 'payments_initiated_total', 1);
    }
  }

  next();
}

/**
 * 错误监控中间件
 * 捕获并记录错误
 */
export function errorMonitoring(error: Error, req: Request, res: Response, next: NextFunction): void {
  // 记录错误指标
  monitoringCenter.recordMetric('counter', 'errors_total', 1, {
    type: error.constructor.name,
    route: req.path,
    method: req.method
  });

  // 触发告警
  if (res.statusCode >= 500) {
    monitoringCenter.triggerAlert(
      'server_error',
      'high',
      `服务器错误: ${error.message}`,
      {
        stack: error.stack,
        route: req.path,
        method: req.method,
        userId: (req as any).user?.id
      }
    );
  }

  // 继续传递错误
  next(error);
}

/**
 * 用户行为追踪中间件
 */
export function userTracking(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;

  if (user) {
    // 记录活跃用户
    monitoringCenter.recordMetric('gauge', 'active_users', 1, {
      userId: user.id,
      role: user.role,
      level: user.level
    });
  }

  next();
}

/**
 * API速率监控中间件
 */
export const rateLimitMonitoring = (() => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const window = 60 * 1000; // 1分钟窗口

    const existing = requestCounts.get(key);
    if (!existing || now > existing.resetTime) {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + window
      });
    } else {
      existing.count++;
    }

    const count = requestCounts.get(key)!.count;

    // 记录请求速率
    monitoringCenter.recordMetric('gauge', 'requests_per_minute', count, {
      ip: key
    });

    // 检查是否超过阈值
    if (count > 1000) {
      monitoringCenter.triggerAlert(
        'high_request_rate',
        'warning',
        `高请求速率检测: ${count} 请求/分钟 来自 ${key}`,
        { ip: key, count }
      );
    }

    next();
  };
})();

/**
 * 健康检查端点增强
 */
export function enhanceHealthCheck(req: Request, res: Response, next: NextFunction): void {
  // 在健康检查响应中添加监控状态
  const originalJson = res.json;

  res.json = function(data: any) {
    if (req.path.includes('/health')) {
      // 添加监控状态
      if (data.success && data.data) {
        data.data.monitoring = {
          status: monitoringCenter.getStatus().components,
          uptime: monitoringCenter.getStatus().uptime
        };
      }
    }

    return originalJson.call(this, data);
  };

  next();
}

/**
 * 优雅关闭处理
 */
export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`收到 ${signal} 信号，正在关闭监控系统...`);
    try {
      await monitoringCenter.stop();
      process.exit(0);
    } catch (error) {
      logger.error('关闭监控系统失败', error);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
}

/**
 * 获取监控中间件组合
 */
export function getMonitoringMiddleware() {
  return [
    enhanceHealthCheck,
    performanceMonitoring,
    businessMetrics,
    userTracking,
    rateLimitMonitoring
  ];
}