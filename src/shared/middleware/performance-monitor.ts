/**
 * API性能监控中间件
 * 用于实时监控API响应时间，检测性能回归
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// 性能阈值配置（毫秒）
export const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 100,  // 优秀：< 100ms
  GOOD: 300,       // 良好：100-300ms
  ACCEPTABLE: 1000, // 可接受：300-1000ms
  SLOW: 2000,      // 缓慢：1000-2000ms
  CRITICAL: 5000   // 严重：> 2000ms
} as const;

// 性能统计接口
interface PerformanceStats {
  requestId: string;
  method: string;
  url: string;
  userAgent: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  performanceLevel?: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'SLOW' | 'CRITICAL';
  warning?: string;
}

// 性能警告计数器
const warningCounters = new Map<string, number>();

/**
 * 评估性能等级
 */
function evaluatePerformance(duration: number): PerformanceStats['performanceLevel'] {
  if (duration <= PERFORMANCE_THRESHOLDS.EXCELLENT) return 'EXCELLENT';
  if (duration <= PERFORMANCE_THRESHOLDS.GOOD) return 'GOOD';
  if (duration <= PERFORMANCE_THRESHOLDS.ACCEPTABLE) return 'ACCEPTABLE';
  if (duration <= PERFORMANCE_THRESHOLDS.SLOW) return 'SLOW';
  return 'CRITICAL';
}

/**
 * 获取性能警告信息
 */
function getPerformanceWarning(duration: number): string | null {
  if (duration > PERFORMANCE_THRESHOLDS.CRITICAL) {
    return '响应时间严重超时，可能存在性能问题';
  }
  if (duration > PERFORMANCE_THRESHOLDS.SLOW) {
    return '响应时间较慢，建议优化';
  }
  return null;
}

/**
 * 更新警告计数器
 */
function updateWarningCounter(key: string): number {
  const current = warningCounters.get(key) || 0;
  const newCount = current + 1;
  warningCounters.set(key, newCount);
  return newCount;
}

/**
 * 性能监控中间件
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // 生成请求唯一标识
  const requestId = req.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 创建性能统计对象
  const stats: PerformanceStats = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.get('User-Agent') || 'Unknown',
    startTime,
    memoryUsage: startMemory
  };

  // 监听响应完成事件
  res.on('finish', () => {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - startTime;

    stats.endTime = endTime;
    stats.duration = duration;
    stats.status = res.statusCode;
    stats.performanceLevel = evaluatePerformance(duration);
    stats.warning = getPerformanceWarning(duration);

    // 记录性能数据
    const logLevel = stats.performanceLevel === 'CRITICAL' ? 'error' :
                    stats.performanceLevel === 'SLOW' ? 'warn' : 'info';

    logger[logLevel]('API Performance', {
      requestId: stats.requestId,
      method: stats.method,
      url: stats.url,
      statusCode: stats.status,
      duration: `${duration}ms`,
      performanceLevel: stats.performanceLevel,
      memoryUsage: {
        heapUsed: `${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024 * 100) / 100}MB`,
        heapTotal: `${Math.round(endMemory.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(endMemory.external / 1024 / 1024)}MB`
      },
      userAgent: stats.userAgent
    });

    // 如果有性能警告，增加警告计数器
    if (stats.warning) {
      const warningKey = `${stats.method}:${stats.url}`;
      const warningCount = updateWarningCounter(warningKey);

      // 如果某个端点连续出现性能问题，记录警告
      if (warningCount >= 5) {
        logger.warn('Performance Regression Detected', {
          endpoint: warningKey,
          warningCount,
          averageDuration: `${duration}ms`,
          message: `端点 ${warningKey} 连续 ${warningCount} 次出现性能问题`
        });
      }
    }

    // 在响应头中添加性能信息（仅开发环境）- 完全安全检查
    if (process.env.NODE_ENV === 'development' &&
        res &&
        !res.headersSent &&
        typeof res.set === 'function' &&
        res.statusCode &&
        res.statusCode >= 200 &&
        res.statusCode < 600) {
      try {
        res.set('X-Response-Time', `${duration}ms`);
        res.set('X-Performance-Level', stats.performanceLevel || 'UNKNOWN');
      } catch (error) {
        // 完全忽略设置响应头时的任何错误，避免服务器崩溃
        console.debug('Performance header setting failed:', error.message);
      }
    }
  });

  // 监听错误事件
  res.on('error', (error) => {
    logger.error('API Performance Error', {
      requestId: stats.requestId,
      method: stats.method,
      url: stats.url,
      error: error.message,
      duration: `${Date.now() - startTime}ms`
    });
  });

  next();
}

/**
 * 获取性能统计摘要
 */
export function getPerformanceSummary() {
  const summary = {
    totalWarnings: Array.from(warningCounters.values()).reduce((sum, count) => sum + count, 0),
    endpointsWithWarnings: warningCounters.size,
    topSlowEndpoints: Array.from(warningCounters.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, warningCount: count }))
  };

  return summary;
}

/**
 * 重置警告计数器
 */
export function resetWarningCounters(): void {
  warningCounters.clear();
  logger.info('Performance warning counters reset');
}

/**
 * 性能分析报告生成器
 */
export class PerformanceAnalyzer {
  private measurements: PerformanceStats[] = [];

  addMeasurement(stats: PerformanceStats): void {
    this.measurements.push(stats);

    // 保持最近1000条记录
    if (this.measurements.length > 1000) {
      this.measurements = this.measurements.slice(-1000);
    }
  }

  generateReport(): {
    summary: any;
    trends: any;
    recommendations: string[];
  } {
    if (this.measurements.length === 0) {
      return {
        summary: { totalRequests: 0 },
        trends: {},
        recommendations: ['暂无数据']
      };
    }

    const recent = this.measurements.slice(-100); // 最近100个请求
    const averageDuration = recent.reduce((sum, m) => sum + (m.duration || 0), 0) / recent.length;

    const performanceDistribution = {
      EXCELLENT: recent.filter(m => m.performanceLevel === 'EXCELLENT').length,
      GOOD: recent.filter(m => m.performanceLevel === 'GOOD').length,
      ACCEPTABLE: recent.filter(m => m.performanceLevel === 'ACCEPTABLE').length,
      SLOW: recent.filter(m => m.performanceLevel === 'SLOW').length,
      CRITICAL: recent.filter(m => m.performanceLevel === 'CRITICAL').length
    };

    const recommendations: string[] = [];

    if (performanceDistribution.CRITICAL > 0) {
      recommendations.push(`${performanceDistribution.CRITICAL} 个请求响应时间严重超时，需要立即优化`);
    }

    if (performanceDistribution.SLOW > 10) {
      recommendations.push(`${performanceDistribution.SLOW} 个请求响应时间较慢，建议进行性能优化`);
    }

    if (averageDuration > 1000) {
      recommendations.push(`平均响应时间 ${Math.round(averageDuration)}ms 过长，建议全面优化`);
    }

    return {
      summary: {
        totalRequests: this.measurements.length,
        recentRequests: recent.length,
        averageDuration: Math.round(averageDuration),
        performanceDistribution
      },
      trends: {
        // 可以添加更多趋势分析
      },
      recommendations
    };
  }
}

// 全局性能分析器实例
export const globalPerformanceAnalyzer = new PerformanceAnalyzer();

/**
 * 集成性能监控和分析的中间件
 */
export function enhancedPerformanceMonitor(req: Request, res: Response, next: NextFunction): void {
  performanceMonitor(req, res, () => {
    // 在响应完成后将数据添加到分析器
    const originalFinish = res.finish;
    res.finish = function(this: Response) {
      globalPerformanceAnalyzer.addMeasurement({
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        userAgent: req.get('User-Agent') || 'Unknown',
        startTime: 0, // 这里应该从外部传入
        status: res.statusCode
      });
      return originalFinish.apply(this);
    };
    next();
  });
}