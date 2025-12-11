/**
 * 指标收集器 - 收集和存储所有性能指标
 * 基于现有的performance-monitor-v2进行增强
 */

import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { monitoringConfig, MonitoringConfig } from '../config/monitoring-config';
import { logger } from '../../shared/utils/logger';
import { performanceMonitorV2 } from '../../shared/middleware/performance-monitor-v2';

// 指标类型定义
export interface Metric {
  timestamp: number;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  name: string;
  value: number;
  tags?: Record<string, string>;
}

export interface RequestMetrics {
  method: string;
  route: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

export interface AggregatedMetrics {
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  topRoutes: Array<{
    route: string;
    count: number;
    avgTime: number;
    errorRate: number;
  }>;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

/**
 * 指标收集器类
 */
export class MetricsCollector extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: Metric[] = [];
  private requestMetrics: RequestMetrics[] = [];
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private isRunning = false;
  private aggregateTimer?: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
  }

  /**
   * 初始化收集器
   */
  async initialize(): Promise<void> {
    logger.info('初始化指标收集器...');

    // 设置指标聚合定时器
    this.aggregateTimer = setInterval(
      () => this.aggregateMetrics(),
      this.config.business.aggregation.interval * 1000
    );

    // 监听性能监控器的事件
    this.setupPerformanceMonitorListener();
  }

  /**
   * 启动收集器
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('指标收集器已启动');
  }

  /**
   * 停止收集器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.aggregateTimer) {
      clearInterval(this.aggregateTimer);
      this.aggregateTimer = undefined;
    }

    logger.info('指标收集器已停止');
  }

  /**
   * 记录指标
   */
  record(
    type: 'counter' | 'gauge' | 'histogram' | 'timer',
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    const metric: Metric = {
      timestamp: Date.now(),
      type,
      name,
      value,
      tags
    };

    // 存储指标
    this.metrics.push(metric);

    // 更新内部计数器
    this.updateInternalCounters(type, name, value);

    // 发出事件
    this.emit('metric', metric);

    // 检查阈值
    this.checkThresholds(metric);
  }

  /**
   * 记录请求指标
   */
  recordRequest(
    req: Request,
    res: Response,
    responseTime: number
  ): void {
    const requestMetric: RequestMetrics = {
      method: req.method,
      route: this.normalizeRoute(req.route?.path || req.path || req.url),
      statusCode: res.statusCode,
      responseTime,
      timestamp: Date.now(),
      userId: (req as any).user?.id,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    this.requestMetrics.push(requestMetric);

    // 记录到计数器
    this.record('counter', 'http_requests_total', 1, {
      method: req.method,
      route: requestMetric.route,
      status: res.statusCode.toString()
    });

    // 记录响应时间
    this.record('histogram', 'http_request_duration_ms', responseTime, {
      method: req.method,
      route: requestMetric.route
    });

    // 记录错误
    if (res.statusCode >= 400) {
      this.record('counter', 'http_errors_total', 1, {
        method: req.method,
        route: requestMetric.route,
        status: res.statusCode.toString()
      });
    }

    // 限制内存中的请求数量
    if (this.requestMetrics.length > 10000) {
      this.requestMetrics = this.requestMetrics.slice(-5000);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): AggregatedMetrics & {
    counters: Record<string, number>;
    gauges: Record<string, number>;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // 过滤最近1分钟的请求
    const recentRequests = this.requestMetrics.filter(r => r.timestamp > oneMinuteAgo);

    // 计算基本统计
    const totalRequests = recentRequests.length;
    const totalErrors = recentRequests.filter(r => r.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    const requestsPerSecond = totalRequests / 60;

    // 计算平均响应时间
    const avgResponseTime = totalRequests > 0
      ? recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / totalRequests
      : 0;

    // 计算百分位数
    const responseTimes = recentRequests.map(r => r.responseTime).sort((a, b) => a - b);
    const percentiles = {
      p50: this.getPercentile(responseTimes, 0.5),
      p90: this.getPercentile(responseTimes, 0.9),
      p95: this.getPercentile(responseTimes, 0.95),
      p99: this.getPercentile(responseTimes, 0.99)
    };

    // 统计路由信息
    const routeStats = new Map<string, {
      count: number;
      totalTime: number;
      errors: number;
    }>();

    recentRequests.forEach(r => {
      const key = `${r.method}:${r.route}`;
      const stats = routeStats.get(key) || { count: 0, totalTime: 0, errors: 0 };
      stats.count++;
      stats.totalTime += r.responseTime;
      if (r.statusCode >= 400) stats.errors++;
      routeStats.set(key, stats);
    });

    // 获取热门路由
    const topRoutes = Array.from(routeStats.entries())
      .map(([route, stats]) => ({
        route,
        count: stats.count,
        avgTime: stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0,
        errorRate: stats.count > 0 ? Math.round((stats.errors / stats.count) * 10000) / 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      totalErrors,
      averageResponseTime: Math.round(avgResponseTime),
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      topRoutes,
      percentiles,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges)
    };
  }

  /**
   * 获取指标报告
   */
  async getReport(): Promise<any> {
    const stats = this.getStats();
    const now = Date.now();

    // 清理过期指标
    this.cleanupOldMetrics();

    return {
      timestamp: now,
      window: '1分钟',
      ...stats,
      metrics: {
        total: this.metrics.length,
        types: this.getMetricTypeStats(),
        memoryUsage: this.getMemoryUsage()
      }
    };
  }

  /**
   * 获取特定指标
   */
  getMetric(name: string, timeRange?: number): Metric[] {
    let metrics = this.metrics.filter(m => m.name === name);

    if (timeRange) {
      const cutoff = Date.now() - timeRange;
      metrics = metrics.filter(m => m.timestamp > cutoff);
    }

    return metrics;
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.metrics = [];
    this.requestMetrics = [];
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    logger.info('所有指标已重置');
  }

  // 私有方法

  /**
   * 更新内部计数器
   */
  private updateInternalCounters(type: string, name: string, value: number): void {
    switch (type) {
      case 'counter':
        this.counters.set(name, (this.counters.get(name) || 0) + value);
        break;
      case 'gauge':
        this.gauges.set(name, value);
        break;
      case 'histogram':
      case 'timer':
        if (!this.histograms.has(name)) {
          this.histograms.set(name, []);
        }
        this.histograms.get(name)!.push(value);
        // 限制直方图数据量
        const hist = this.histograms.get(name)!;
        if (hist.length > 1000) {
          this.histograms.set(name, hist.slice(-500));
        }
        break;
    }
  }

  /**
   * 检查阈值
   */
  private checkThresholds(metric: Metric): void {
    const thresholds = this.config.performance.thresholds;

    // 检查响应时间阈值
    if (metric.name === 'http_request_duration_ms' && metric.type === 'histogram') {
      if (metric.value > thresholds.critical) {
        this.emit('alert', {
          type: 'performance',
          severity: 'critical',
          message: `响应时间严重超标: ${metric.value}ms`,
          data: metric
        });
      } else if (metric.value > thresholds.verySlow) {
        this.emit('alert', {
          type: 'performance',
          severity: 'warning',
          message: `响应时间较慢: ${metric.value}ms`,
          data: metric
        });
      }
    }

    // 检查错误率
    if (metric.name === 'http_errors_total') {
      const errorRate = this.calculateErrorRate();
      if (errorRate > 10) {
        this.emit('alert', {
          type: 'error_rate',
          severity: 'critical',
          message: `错误率过高: ${errorRate}%`,
          data: { errorRate, metric }
        });
      } else if (errorRate > 5) {
        this.emit('alert', {
          type: 'error_rate',
          severity: 'warning',
          message: `错误率偏高: ${errorRate}%`,
          data: { errorRate, metric }
        });
      }
    }
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestMetrics.filter(r => r.timestamp > oneMinuteAgo);

    if (recentRequests.length === 0) return 0;

    const errors = recentRequests.filter(r => r.statusCode >= 400).length;
    return Math.round((errors / recentRequests.length) * 10000) / 100;
  }

  /**
   * 聚合指标
   */
  private aggregateMetrics(): void {
    // 聚合逻辑，定期执行
    const now = Date.now();
    const windowSize = this.config.business.aggregation.interval * 1000;
    const cutoff = now - windowSize;

    // 获取窗口内的指标
    const windowMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    // 计算聚合值
    const aggregated = new Map<string, any>();

    windowMetrics.forEach(metric => {
      const key = `${metric.type}:${metric.name}`;
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          values: []
        });
      }

      const agg = aggregated.get(key)!;
      agg.count++;
      agg.sum += metric.value;
      agg.min = Math.min(agg.min, metric.value);
      agg.max = Math.max(agg.max, metric.value);

      if (metric.type === 'histogram' || metric.type === 'timer') {
        agg.values.push(metric.value);
      }
    });

    // 发出聚合事件
    this.emit('aggregated', {
      timestamp: now,
      windowSize,
      metrics: Object.fromEntries(aggregated)
    });
  }

  /**
   * 设置性能监控器监听
   */
  private setupPerformanceMonitorListener(): void {
    // 监听现有性能监控器的事件
    this.on('request', (data) => {
      this.recordRequest(data.req, data.res, data.responseTime);
    });
  }

  /**
   * 标准化路由
   */
  private normalizeRoute(route: string): string {
    // 将参数路由标准化
    return route
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-f0-9]{24}/g, '/:mongoId');
  }

  /**
   * 获取百分位数
   */
  private getPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 获取指标类型统计
   */
  private getMetricTypeStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.metrics.forEach(metric => {
      stats[metric.type] = (stats[metric.type] || 0) + 1;
    });
    return stats;
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): any {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024) // MB
    };
  }

  /**
   * 清理过期指标
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const retentionMs = this.config.business.retention.metrics * 24 * 60 * 60 * 1000;
    const cutoff = now - retentionMs;

    // 清理过期指标
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.requestMetrics = this.requestMetrics.filter(r => r.timestamp > cutoff);
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.isRunning;
  }
}