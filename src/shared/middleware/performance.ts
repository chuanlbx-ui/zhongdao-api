/**
 * 性能监控中间件
 * 监控API响应时间，记录慢查询
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// 性能统计接口
interface PerformanceStats {
  requestId: string;
  method: string;
  url: string;
  userId?: string;
  userAgent: string;
  ip: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  slow: boolean;
}

// 性能阈值配置
const PERFORMANCE_THRESHOLDS = {
  SLOW_REQUEST_MS: 1000,  // 超过1秒算慢请求
  VERY_SLOW_REQUEST_MS: 3000,  // 超过3秒算很慢请求
  CRITICAL_REQUEST_MS: 5000,  // 超过5秒算关键慢请求
} as const;

// 性能统计存储
const performanceStats = new Map<string, PerformanceStats>();

/**
 * 性能监控中间件
 */
export function performanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // 生成性能统计
  const stats: PerformanceStats = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    userId: (req.user as any)?.id,
    userAgent: req.get('User-Agent') || 'unknown',
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    startTime,
    slow: false
  };

  // 存储统计信息
  performanceStats.set(requestId, stats);

  // 监听响应完成事件
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const statusCode = res.statusCode;
    const responseSize = parseInt(res.get('Content-Length') || '0');

    // 更新统计信息
    stats.endTime = endTime;
    stats.duration = duration;
    stats.statusCode = statusCode;
    stats.responseSize = responseSize;
    stats.slow = duration >= PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS;

    // 记录日志
    if (duration >= PERFORMANCE_THRESHOLDS.CRITICAL_REQUEST_MS) {
      logger.error('关键慢请求告警', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode,
        userId: stats.userId,
        ip: stats.ip
      });
    } else if (duration >= PERFORMANCE_THRESHOLDS.VERY_SLOW_REQUEST_MS) {
      logger.warn('很慢请求', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode,
        userId: stats.userId
      });
    } else if (duration >= PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS) {
      logger.info('慢请求', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode
      });
    }

    // 清理统计信息
    performanceStats.delete(requestId);
  });

  // 监听响应错误事件
  res.on('error', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.error('请求处理错误', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      duration: `${duration}ms`,
      error: true,
      userId: stats.userId
    });

    // 清理统计信息
    performanceStats.delete(requestId);
  });

  next();
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `perf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 获取性能统计
 */
export function getPerformanceStats(): Array<PerformanceStats> {
  return Array.from(performanceStats.values());
}

/**
 * 获取当前活跃请求数
 */
export function getActiveRequestsCount(): number {
  return performanceStats.size;
}

/**
 * 获取平均响应时间（最近N个请求）
 */
export function getAverageResponseTime(sampleSize: number = 100): number {
  const stats = Array.from(performanceStats.values())
    .filter(s => s.duration !== undefined)
    .slice(-sampleSize);

  if (stats.length === 0) return 0;

  const total = stats.reduce((sum, s) => sum + s.duration!, 0);
  return Math.round(total / stats.length);
}

/**
 * 定期清理性能统计
 */
export function cleanupPerformanceStats(): void {
  // 清理超过10分钟的统计数据
  const now = Date.now();
  const threshold = 10 * 60 * 1000; // 10分钟

  for (const [requestId, stats] of performanceStats.entries()) {
    if (now - stats.startTime > threshold) {
      performanceStats.delete(requestId);
    }
  }
}

// 定期清理统计数据（每5分钟）
setInterval(cleanupPerformanceStats, 5 * 60 * 1000);

/**
 * 性能报告生成器
 */
export function generatePerformanceReport(): {
  timestamp: string;
  activeRequests: number;
  averageResponseTime: number;
  slowRequests: Array<PerformanceStats>;
  verySlowRequests: Array<PerformanceStats>;
  criticalRequests: Array<PerformanceStats>;
} {
  const stats = Array.from(performanceStats.values());
  const activeRequests = stats.filter(s => !s.endTime).length;
  const completedRequests = stats.filter(s => s.duration !== undefined);

  const averageResponseTime = getAverageResponseTime();

  return {
    timestamp: new Date().toISOString(),
    activeRequests,
    averageResponseTime,
    slowRequests: completedRequests.filter(s => s.slow),
    verySlowRequests: completedRequests.filter(s => s.duration! >= PERFORMANCE_THRESHOLDS.VERY_SLOW_REQUEST_MS),
    criticalRequests: completedRequests.filter(s => s.duration! >= PERFORMANCE_THRESHOLDS.CRITICAL_REQUEST_MS)
  };
}