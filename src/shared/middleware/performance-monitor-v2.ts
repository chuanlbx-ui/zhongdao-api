/**
 * 高性能监控中间件 V2 - 中道商城系统
 * 优化版本：智能采样、异步日志、环形缓冲区、零阻塞
 */

import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

// 性能配置
const PERF_CONFIG = {
  // 响应时间阈值（毫秒）
  thresholds: {
    fast: 50,        // 快速：< 50ms（仅记录统计）
    normal: 200,     // 正常：50-200ms
    slow: 500,       // 慢：200-500ms
    verySlow: 1000,  // 很慢：500-1000ms
    critical: 2000   // 严重：> 1000ms
  },

  // 智能采样配置
  sampling: {
    // 基于响应时间的动态采样率
    fastSampleRate: 0.01,      // 快速请求：1%采样
    normalSampleRate: 0.1,     // 正常请求：10%采样
    slowSampleRate: 0.5,       // 慢请求：50%采样
    verySlowSampleRate: 1.0,   // 很慢请求：100%采样
    criticalSampleRate: 1.0,   // 严重请求：100%采样

    // 基于错误率的动态采样
    errorRateThreshold: 0.05,  // 5%错误率触发全采样
    errorRateWindow: 60 * 1000, // 1分钟窗口

    // 生产环境基础采样率
    baseSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.2
  },

  // 内存阈值（MB）
  memory: {
    warning: 512,
    critical: 1024
  },

  // 环形缓冲区大小
  ringBufferSize: 10000,

  // 异步批量写入配置
  batchWrite: {
    interval: 5000,  // 5秒批量写入一次
    maxSize: 100,    // 最大批量大小
    enabled: true    // 启用异步批量写入
  }
} as const;

// 简化的性能指标接口
interface CompactMetrics {
  t: number;        // 时间戳
  d: number;        // 响应时间（毫秒）
  s: number;        // 状态码
  m: string;        // 方法（1字符）
  r: string;        // 路由（hash）
  e?: string;       // 错误（hash）
  uid?: string;     // 用户ID（可选）
}

// 环形缓冲区实现
class RingBuffer<T> {
  private buffer: T[];
  private size: number;
  private index: number;
  private count: number;

  constructor(size: number) {
    this.buffer = new Array(size);
    this.size = size;
    this.index = 0;
    this.count = 0;
  }

  push(item: T): void {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }

  getAll(): T[] {
    if (this.count < this.size) {
      return this.buffer.slice(0, this.count);
    }
    return [...this.buffer.slice(this.index), ...this.buffer.slice(0, this.index)];
  }

  getLast(n: number): T[] {
    const all = this.getAll();
    return all.slice(-n);
  }

  clear(): void {
    this.index = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }
}

// 统计聚合器
class StatsAggregator {
  private routeStats = new Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    lastUpdate: number;
  }>();

  // 路由哈希函数（节省内存）
  private hashRoute(route: string): string {
    let hash = 5381;
    for (let i = 0; i < route.length; i++) {
      hash = (hash * 33) ^ route.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  // 添加指标
  add(metrics: CompactMetrics): void {
    const key = `${metrics.m}:${metrics.r}`;
    const existing = this.routeStats.get(key) || {
      count: 0,
      totalTime: 0,
      errors: 0,
      lastUpdate: 0
    };

    existing.count++;
    existing.totalTime += metrics.d;
    if (metrics.s >= 400) existing.errors++;
    existing.lastUpdate = Date.now();

    this.routeStats.set(key, existing);
  }

  // 获取聚合统计
  getStats(timeWindow: number = 60 * 1000): any {
    const now = Date.now();
    const cutoff = now - timeWindow;
    const result: any = {
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      routes: {},
      topSlowRoutes: []
    };

    let totalTime = 0;
    let totalCount = 0;

    for (const [route, stats] of this.routeStats.entries()) {
      if (stats.lastUpdate < cutoff) {
        this.routeStats.delete(route);
        continue;
      }

      const avgTime = stats.totalTime / stats.count;
      const errorRate = stats.errors / stats.count;

      result.routes[route] = {
        requests: stats.count,
        averageTime: Math.round(avgTime),
        errorRate: Math.round(errorRate * 10000) / 100,
        status: this.getStatus(avgTime, errorRate)
      };

      result.totalRequests += stats.count;
      result.totalErrors += stats.errors;
      totalTime += stats.totalTime;
      totalCount += stats.count;

      // 收录慢路由
      if (avgTime > PERF_CONFIG.thresholds.slow) {
        result.topSlowRoutes.push({
          route,
          avgTime: Math.round(avgTime),
          requests: stats.count
        });
      }
    }

    // 计算全局平均值
    if (totalCount > 0) {
      result.averageResponseTime = Math.round(totalTime / totalCount);
      result.errorRate = Math.round((result.totalErrors / totalCount) * 10000) / 100;
    }

    // 排序慢路由
    result.topSlowRoutes.sort((a: any, b: any) => b.avgTime - a.avgTime);
    result.topSlowRoutes = result.topSlowRoutes.slice(0, 10);

    return result;
  }

  private getStatus(avgTime: number, errorRate: number): string {
    if (errorRate > 0.1) return 'CRITICAL';
    if (avgTime > PERF_CONFIG.thresholds.critical) return 'CRITICAL';
    if (errorRate > 0.05 || avgTime > PERF_CONFIG.thresholds.verySlow) return 'WARNING';
    if (avgTime > PERF_CONFIG.thresholds.slow) return 'SLOW';
    return 'HEALTHY';
  }

  // 清理过期数据
  cleanup(): void {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1小时
    for (const [route, stats] of this.routeStats.entries()) {
      if (stats.lastUpdate < cutoff) {
        this.routeStats.delete(route);
      }
    }
  }
}

// 异步日志写入器
class AsyncLogWriter {
  private queue: any[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(private interval: number, private maxSize: number) {
    if (PERF_CONFIG.batchWrite.enabled) {
      this.start();
    }
  }

  private start(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.interval);
  }

  write(logData: any): void {
    if (!PERF_CONFIG.batchWrite.enabled) {
      // 同步写入
      console.log('[PERF]', logData);
      return;
    }

    this.queue.push(logData);

    if (this.queue.length >= this.maxSize) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0);
    // 批量写入（这里可以集成到实际的日志系统）
    console.log('[PERF-BATCH]', batch.length, 'entries');

    // 可以在这里发送到日志服务
    // logger.batchWrite(batch);
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}

// 主性能监控器类
class PerformanceMonitorV2 extends EventEmitter {
  private metricsBuffer: RingBuffer<CompactMetrics>;
  private aggregator: StatsAggregator;
  private logWriter: AsyncLogWriter;
  private errorCountWindow = new Map<string, number>();
  private lastCleanupTime = 0;

  constructor() {
    super();
    this.metricsBuffer = new RingBuffer<CompactMetrics>(PERF_CONFIG.ringBufferSize);
    this.aggregator = new StatsAggregator();
    this.logWriter = new AsyncLogWriter(
      PERF_CONFIG.batchWrite.interval,
      PERF_CONFIG.batchWrite.maxSize
    );

    // 定期清理
    setInterval(() => {
      this.aggregator.cleanup();
      this.cleanupErrorCounters();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  // 记录指标
  record(metrics: CompactMetrics): void {
    // 添加到环形缓冲区
    this.metricsBuffer.push(metrics);

    // 更新聚合统计
    this.aggregator.add(metrics);

    // 检查内存使用
    this.checkMemoryUsage();

    // 发出事件（用于外部监听）
    this.emit('metric', metrics);
  }

  // 异步记录日志
  private logAsync(metrics: CompactMetrics): void {
    this.logWriter.write({
      timestamp: metrics.t,
      duration: metrics.d,
      status: metrics.s,
      method: metrics.m,
      route: metrics.r,
      userId: metrics.uid,
      level: this.getLogLevel(metrics.d, metrics.s)
    });
  }

  private getLogLevel(duration: number, status: number): string {
    if (status >= 500) return 'error';
    if (status >= 400 || duration > PERF_CONFIG.thresholds.critical) return 'warn';
    if (duration > PERF_CONFIG.thresholds.slow) return 'info';
    return 'debug';
  }

  // 智能采样决策
  shouldSample(req: Request, responseTime?: number): boolean {
    // 如果已经有响应时间，基于时间决策
    if (responseTime !== undefined) {
      if (responseTime < PERF_CONFIG.thresholds.fast) {
        return Math.random() < PERF_CONFIG.sampling.fastSampleRate;
      } else if (responseTime < PERF_CONFIG.thresholds.normal) {
        return Math.random() < PERF_CONFIG.sampling.normalSampleRate;
      } else if (responseTime < PERF_CONFIG.thresholds.slow) {
        return Math.random() < PERF_CONFIG.sampling.slowSampleRate;
      } else if (responseTime < PERF_CONFIG.thresholds.verySlow) {
        return Math.random() < PERF_CONFIG.sampling.verySlowSampleRate;
      } else {
        return true; // 严重请求始终采样
      }
    }

    // 基础采样
    if (Math.random() < PERF_CONFIG.sampling.baseSampleRate) {
      return true;
    }

    // 检查错误率
    const route = `${req.method}:${req.route?.path || req.path}`;
    const errorRate = this.getErrorRate(route);
    if (errorRate > PERF_CONFIG.sampling.errorRateThreshold) {
      return true;
    }

    return false;
  }

  // 获取错误率
  private getErrorRate(route: string): number {
    const stats = this.aggregator.getStats(1000); // 最近1秒
    const routeStats = stats.routes[route];
    if (!routeStats) return 0;
    return routeStats.errorRate / 100;
  }

  // 检查内存使用
  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapMB = memUsage.heapUsed / 1024 / 1024;

    if (heapMB > PERF_CONFIG.memory.critical) {
      this.emit('alert', {
        type: 'memory',
        level: 'critical',
        value: heapMB,
        message: `Critical memory usage: ${Math.round(heapMB)}MB`
      });
    } else if (heapMB > PERF_CONFIG.memory.warning) {
      this.emit('alert', {
        type: 'memory',
        level: 'warning',
        value: heapMB,
        message: `High memory usage: ${Math.round(heapMB)}MB`
      });
    }
  }

  // 清理错误计数器
  private cleanupErrorCounters(): void {
    const now = Date.now();
    const window = PERF_CONFIG.sampling.errorRateWindow;

    for (const [key, timestamp] of this.errorCountWindow.entries()) {
      if (now - timestamp > window) {
        this.errorCountWindow.delete(key);
      }
    }
  }

  // 获取性能报告
  getPerformanceReport(): any {
    const stats = this.aggregator.getStats();
    const recentMetrics = this.metricsBuffer.getLast(1000);

    // 计算百分位数
    const responseTimes = recentMetrics.map(m => m.d).sort((a, b) => a - b);
    const percentiles = {
      p50: this.getPercentile(responseTimes, 0.5),
      p90: this.getPercentile(responseTimes, 0.9),
      p95: this.getPercentile(responseTimes, 0.95),
      p99: this.getPercentile(responseTimes, 0.99)
    };

    // 获取活跃告警
    const alerts = this.getRecentAlerts();

    return {
      timestamp: Date.now(),
      summary: {
        ...stats,
        bufferUtilization: this.metricsBuffer.length / PERF_CONFIG.ringBufferSize,
        memoryUsage: process.memoryUsage()
      },
      percentiles,
      alerts: alerts.slice(0, 10),
      recommendations: this.generateRecommendations(stats, percentiles)
    };
  }

  private getPercentile(sorted: number[], p: number): number {
    const index = Math.floor(sorted.length * p);
    return sorted[Math.min(index, sorted.length - 1)] || 0;
  }

  private getRecentAlerts(): any[] {
    // 这里应该从告警系统获取，暂时返回空数组
    return [];
  }

  private generateRecommendations(stats: any, percentiles: any): string[] {
    const recommendations: string[] = [];

    if (stats.averageResponseTime > PERF_CONFIG.thresholds.slow) {
      recommendations.push(`平均响应时间 ${stats.averageResponseTime}ms 偏高，建议优化数据库查询和API逻辑`);
    }

    if (percentiles.p99 > PERF_CONFIG.thresholds.critical) {
      recommendations.push(`99%请求响应时间 ${percentiles.p99}ms 严重偏高，存在性能瓶颈`);
    }

    if (stats.errorRate > 5) {
      recommendations.push(`错误率 ${stats.errorRate}% 偏高，需要检查和修复常见错误`);
    }

    if (stats.topSlowRoutes.length > 5) {
      recommendations.push(`多个路由响应缓慢，建议进行性能优化`);
    }

    const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryMB > PERF_CONFIG.memory.warning) {
      recommendations.push(`内存使用 ${Math.round(memoryMB)}MB 偏高，检查是否存在内存泄漏`);
    }

    return recommendations;
  }

  // 销毁监控器
  destroy(): void {
    this.logWriter.destroy();
    this.removeAllListeners();
  }
}

// 创建全局实例
const globalMonitor = new PerformanceMonitorV2();

// 错误哈希函数
function hashError(error: Error): string {
  return `${error.name}:${error.message.slice(0, 50)}`.slice(0, 100);
}

// 路由哈希函数
function hashRoute(route: string): string {
  if (!route || route === '/' || route.length <= 20) return route;
  return route.slice(0, 10) + '...' + route.slice(-10);
}

// 创建高性能中间件
export function createHighPerformanceMonitor() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();
    let sampled = false;
    let recorded = false;

    // 监听响应完成
    const onFinish = () => {
      if (recorded) return; // 避免重复记录

      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1000000; // 转换为毫秒

      // 智能采样决策
      if (!sampled && !globalMonitor.shouldSample(req, responseTime)) {
        recorded = true;
        return;
      }

      sampled = true;

      // 创建紧凑指标
      const metrics: CompactMetrics = {
        t: Date.now(),
        d: responseTime,
        s: res.statusCode,
        m: req.method[0], // 只取第一个字母节省内存
        r: hashRoute(req.route?.path || req.path || req.url),
        uid: (req as any).user?.id
      };

      // 记录错误（如果有）
      const resError = (res as any).error;
      if (resError) {
        metrics.e = hashError(resError);
      }

      // 异步记录
      globalMonitor.record(metrics);
      globalMonitor.logAsync(metrics);

      // 开发环境添加响应头
      if (process.env.NODE_ENV === 'development' && !res.headersSent) {
        try {
          res.set('X-RT', `${Math.round(responseTime)}ms`);
          res.set('X-Sample', sampled ? '1' : '0');
        } catch (e) {
          // 忽略错误
        }
      }

      recorded = true;
    };

    // 安全地监听事件
    if (res.on) {
      res.on('finish', onFinish);
      res.on('error', onFinish);
    }

    next();
  };
}

// 导出
export const performanceMonitorV2 = createHighPerformanceMonitor();
export { globalMonitor, PerformanceMonitorV2, PERF_CONFIG };

// 兼容性导出（保持与原有接口一致）
export const enhancedPerformanceMonitor = performanceMonitorV2;