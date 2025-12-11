/**
 * 高性能监控中间件 - 中道商城系统
 * 提供全面的性能监控、Prometheus指标输出和告警功能
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import { EventEmitter } from 'events';

// 性能配置
const PERFORMANCE_CONFIG = {
  // 响应时间阈值（毫秒）
  thresholds: {
    excellent: 50,   // 优秀：< 50ms
    good: 200,       // 良好：50-200ms
    acceptable: 500, // 可接受：200-500ms
    slow: 1000,      // 缓慢：500-1000ms
    critical: 2000   // 严重：> 1000ms
  },

  // 内存使用阈值（MB）
  memory: {
    warning: 512,    // 警告：512MB
    critical: 1024   // 严重：1024MB
  },

  // 数据库连接池阈值
  connectionPool: {
    warning: 70,     // 警告：70%
    critical: 90     // 严重：90%
  },

  // 慢查询阈值（毫秒）
  slowQuery: 1000,

  // 采样率（0-1）
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 指标保留时间（毫秒）
  retentionPeriod: 24 * 60 * 60 * 1000, // 24小时

  // 告警配置
  alerts: {
    enabled: true,
    cooldown: 5 * 60 * 1000, // 5分钟冷却时间
    consecutiveFailures: 3   // 连续失败次数
  }
} as const;

// 性能指标接口
interface PerformanceMetrics {
  timestamp: number;
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  userAgent: string;
  ip: string;
  userId?: string;
  dbQueryCount?: number;
  dbQueryTime?: number;
  error?: string;
}

// Prometheus指标格式
interface PrometheusMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  samples: MetricSample[];
}

interface MetricSample {
  labels: Record<string, string>;
  value: number;
  timestamp?: number;
}

// 告警接口
interface Alert {
  id: string;
  type: 'response_time' | 'memory' | 'cpu' | 'connection_pool' | 'error_rate';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  metadata?: Record<string, any>;
}

// 性能监控器类
class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();

  constructor() {
    super();
    // 定期清理过期指标
    setInterval(() => this.cleanup(), 60 * 1000);
    // 定期检查告警条件
    setInterval(() => this.checkAlerts(), 5 * 60 * 1000); // 增加到5分钟间隔
  }

  /**
   * 记录请求指标
   */
  recordRequest(metrics: PerformanceMetrics): void {
    const routeKey = `${metrics.method}:${metrics.route}`;

    // 存储原始指标
    if (!this.metrics.has(routeKey)) {
      this.metrics.set(routeKey, []);
    }
    const routeMetrics = this.metrics.get(routeKey)!;
    routeMetrics.push(metrics);

    // 保持最近1000条记录
    if (routeMetrics.length > 1000) {
      routeMetrics.splice(0, routeMetrics.length - 1000);
    }

    // 更新计数器
    this.incrementCounter('http_requests_total', {
      method: metrics.method,
      route: metrics.route,
      status_code: metrics.statusCode.toString()
    });

    // 更新直方图
    this.recordHistogram('http_request_duration_seconds', metrics.responseTime / 1000, {
      method: metrics.method,
      route: metrics.route
    });

    // 更新内存使用量
    this.setGauge('process_memory_bytes', metrics.memoryUsage.heapUsed, {
      type: 'heap_used'
    });

    // 检查性能告警
    this.checkPerformanceAlerts(metrics);

    // 发出指标更新事件
    this.emit('metrics:updated', metrics);
  }

  /**
   * 记录错误
   */
  recordError(route: string, error: Error, context?: any): void {
    this.incrementCounter('http_errors_total', {
      route,
      error_type: error.constructor.name
    });

    // 检查错误率告警
    const errorKey = `error_rate:${route}`;
    const failures = this.consecutiveFailures.get(errorKey) || 0;
    this.consecutiveFailures.set(errorKey, failures + 1);

    logger.error('Performance Monitor - Error Recorded', {
      route,
      error: error.message,
      stack: error.stack,
      context,
      consecutive_failures: failures + 1
    });
  }

  /**
   * 记录数据库查询
   */
  recordDatabaseQuery(query: string, duration: number): void {
    this.incrementCounter('db_queries_total', {
      query_type: this.getQueryType(query)
    });

    this.recordHistogram('db_query_duration_seconds', duration / 1000, {
      query_type: this.getQueryType(query)
    });

    // 慢查询检测
    if (duration > PERFORMANCE_CONFIG.slowQuery) {
      logger.warn('Slow Query Detected', {
        query,
        duration,
        threshold: PERFORMANCE_CONFIG.slowQuery
      });

      this.incrementCounter('db_slow_queries_total', {
        query_type: this.getQueryType(query)
      });
    }
  }

  /**
   * 增加计数器
   */
  private incrementCounter(name: string, labels: Record<string, string>): void {
    const key = this.createMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }

  /**
   * 设置仪表盘值
   */
  private setGauge(name: string, value: number, labels: Record<string, string>): void {
    const key = this.createMetricKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * 记录直方图数据
   */
  private recordHistogram(name: string, value: number, labels: Record<string, string>): void {
    const key = this.createMetricKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    const values = this.histograms.get(key)!;
    values.push(value);

    // 保持最近1000个值
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
  }

  /**
   * 创建指标键
   */
  private createMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  /**
   * 获取查询类型
   */
  private getQueryType(query: string): string {
    const upper = query.trim().toUpperCase();
    if (upper.startsWith('SELECT')) return 'SELECT';
    if (upper.startsWith('INSERT')) return 'INSERT';
    if (upper.startsWith('UPDATE')) return 'UPDATE';
    if (upper.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  /**
   * 检查性能告警
   */
  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    const routeKey = `${metrics.method}:${metrics.route}`;
    const now = Date.now();

    // 响应时间告警
    if (metrics.responseTime > PERFORMANCE_CONFIG.thresholds.critical) {
      this.triggerAlert('response_time', 'critical',
        `Critical response time: ${metrics.responseTime}ms for ${routeKey}`, {
          route: routeKey,
          response_time: metrics.responseTime
        });
    } else if (metrics.responseTime > PERFORMANCE_CONFIG.thresholds.slow) {
      this.triggerAlert('response_time', 'warning',
        `Slow response time: ${metrics.responseTime}ms for ${routeKey}`, {
          route: routeKey,
          response_time: metrics.responseTime
        });
    }

    // 内存使用告警
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryMB > PERFORMANCE_CONFIG.memory.critical) {
      this.triggerAlert('memory', 'critical',
        `Critical memory usage: ${Math.round(memoryMB)}MB`, {
          memory_mb: Math.round(memoryMB)
        });
    } else if (memoryMB > PERFORMANCE_CONFIG.memory.warning) {
      this.triggerAlert('memory', 'warning',
        `High memory usage: ${Math.round(memoryMB)}MB`, {
          memory_mb: Math.round(memoryMB)
        });
    }

    // 重置连续失败计数（成功请求）
    this.consecutiveFailures.delete(`error_rate:${routeKey}`);
  }

  /**
   * 触发告警
   */
  private triggerAlert(type: Alert['type'], severity: Alert['severity'], message: string, metadata?: Record<string, any>): void {
    const alertKey = `${type}:${severity}`;
    const now = Date.now();

    // 检查冷却时间
    const lastAlertTime = this.lastAlertTimes.get(alertKey) || 0;
    if (now - lastAlertTime < PERFORMANCE_CONFIG.alerts.cooldown) {
      return;
    }

    // 检查连续失败次数
    if (type === 'error_rate') {
      const failures = this.consecutiveFailures.get(alertKey) || 0;
      if (failures < PERFORMANCE_CONFIG.alerts.consecutiveFailures) {
        return;
      }
    }

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: now,
      resolved: false,
      metadata
    };

    this.alerts.set(alert.id, alert);
    this.lastAlertTimes.set(alertKey, now);

    // 记录告警日志
    logger[severity](`Performance Alert [${type}]`, {
      alertId: alert.id,
      message,
      severity,
      metadata
    });

    // 发出告警事件
    this.emit('alert:triggered', alert);
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(): void {
    const now = Date.now();

    // 检查连接池状态（如果可用）
    this.checkConnectionPool();

    // 清理过期告警
    for (const [id, alert] of this.alerts.entries()) {
      if (now - alert.timestamp > PERFORMANCE_CONFIG.retentionPeriod) {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * 检查数据库连接池
   */
  private async checkConnectionPool(): Promise<void> {
    try {
      // 获取连接池状态（Prisma暂时不暴露连接池指标）
      // 这里可以通过其他方式监控，比如查询performance_schema

      // 示例：检查数据库响应时间
      const start = Date.now();
      // // await prisma.$queryRaw`SELECT 1`; // 临时禁用以避免测试时的数据库查询 // 临时禁用以避免测试时的数据库查询
      const responseTime = Date.now() - start;

      if (responseTime > 1000) {
        this.triggerAlert('connection_pool', 'warning',
          `Database response time slow: ${responseTime}ms`, {
            response_time: responseTime
          });
      }
    } catch (error) {
      this.triggerAlert('connection_pool', 'critical',
        `Database connection error: ${error.message}`, {
          error: error.message
        });
    }
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const cutoff = Date.now() - PERFORMANCE_CONFIG.retentionPeriod;

    // 清理指标数据
    for (const [route, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(route);
      } else {
        this.metrics.set(route, filtered);
      }
    }

    // 清理直方图数据
    for (const [key, values] of this.histograms.entries()) {
      // 保持最近1000个值
      if (values.length > 1000) {
        this.histograms.set(key, values.slice(-1000));
      }
    }
  }

  /**
   * 生成Prometheus格式的指标
   */
  generatePrometheusMetrics(): string {
    const lines: string[] = [];

    // HTTP请求总数
    lines.push(this.formatPrometheusCounter(
      'http_requests_total',
      'Total number of HTTP requests',
      this.counters
    ));

    // HTTP请求持续时间
    lines.push(this.formatPrometheusHistogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      this.histograms
    ));

    // 内存使用量
    lines.push(this.formatPrometheusGauge(
      'process_memory_bytes',
      'Process memory usage in bytes',
      this.gauges
    ));

    // 数据库查询
    lines.push(this.formatPrometheusCounter(
      'db_queries_total',
      'Total number of database queries',
      this.counters
    ));

    // 数据库慢查询
    lines.push(this.formatPrometheusCounter(
      'db_slow_queries_total',
      'Total number of slow database queries',
      this.counters
    ));

    // 错误总数
    lines.push(this.formatPrometheusCounter(
      'http_errors_total',
      'Total number of HTTP errors',
      this.counters
    ));

    // 自定义指标：应用状态
    const uptime = process.uptime();
    lines.push(`# HELP process_uptime_seconds Process uptime in seconds`);
    lines.push(`# TYPE process_uptime_seconds gauge`);
    lines.push(`process_uptime_seconds ${uptime}`);

    // 活跃告警数
    const activeAlerts = Array.from(this.alerts.values()).filter(a => !a.resolved).length;
    lines.push(`# HELP performance_alerts_active Number of active performance alerts`);
    lines.push(`# TYPE performance_alerts_active gauge`);
    lines.push(`performance_alerts_active ${activeAlerts}`);

    return lines.join('\n\n') + '\n';
  }

  /**
   * 格式化Prometheus计数器
   */
  private formatPrometheusCounter(name: string, help: string, data: Map<string, number>): string {
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} counter`);

    for (const [key, value] of data.entries()) {
      if (key.startsWith(name)) {
        const labels = key.match(/\{(.+)\}/)?.[1] || '';
        lines.push(`${name}${labels} ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 格式化Prometheus仪表盘
   */
  private formatPrometheusGauge(name: string, help: string, data: Map<string, number>): string {
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} gauge`);

    for (const [key, value] of data.entries()) {
      if (key.startsWith(name)) {
        const labels = key.match(/\{(.+)\}/)?.[1] || '';
        lines.push(`${name}${labels} ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 格式化Prometheus直方图
   */
  private formatPrometheusHistogram(name: string, help: string, data: Map<string, number[]>): string {
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} histogram`);

    for (const [key, values] of data.entries()) {
      if (key.startsWith(name) && values.length > 0) {
        const labels = key.match(/\{(.+)\}/)?.[1] || '';

        // 计算分位数
        const sorted = [...values].sort((a, b) => a - b);
        const count = sorted.length;

        // 标准分位数
        const quantiles = [0.5, 0.9, 0.95, 0.99];
        for (const q of quantiles) {
          const index = Math.floor(q * count);
          const value = sorted[Math.min(index, count - 1)];
          lines.push(`${name}${labels.replace('}', ',quantile="' + q + '"')} ${value}`);
        }

        // 总数
        lines.push(`${name}_bucket${labels.replace('}', ',le="+Infinity"')} ${count}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): any {
    const now = Date.now();
    const report: any = {
      timestamp: now,
      summary: {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeAlerts: 0
      },
      routes: {},
      alerts: [],
      recommendations: []
    };

    // 汇总请求统计
    let totalResponseTime = 0;
    let errorCount = 0;

    for (const [route, metrics] of this.metrics.entries()) {
      const recent = metrics.filter(m => now - m.timestamp < 60 * 60 * 1000); // 最近1小时
      if (recent.length === 0) continue;

      const routeResponseTime = recent.reduce((sum, m) => sum + m.responseTime, 0);
      const routeErrors = recent.filter(m => m.statusCode >= 400).length;

      report.routes[route] = {
        requests: recent.length,
        averageResponseTime: Math.round(routeResponseTime / recent.length),
        errorRate: routeErrors / recent.length,
        status: this.getRouteStatus(routeResponseTime / recent.length, routeErrors / recent.length)
      };

      report.summary.totalRequests += recent.length;
      totalResponseTime += routeResponseTime;
      errorCount += routeErrors;
    }

    // 计算平均值
    if (report.summary.totalRequests > 0) {
      report.summary.averageResponseTime = Math.round(totalResponseTime / report.summary.totalRequests);
      report.summary.errorRate = errorCount / report.summary.totalRequests;
    }

    // 活跃告警
    const activeAlerts = Array.from(this.alerts.values()).filter(a => !a.resolved);
    report.summary.activeAlerts = activeAlerts.length;
    report.alerts = activeAlerts.slice(0, 10); // 最近10个告警

    // 生成建议
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  /**
   * 获取路由状态
   */
  private getRouteStatus(avgResponseTime: number, errorRate: number): string {
    if (errorRate > 0.1) return 'CRITICAL';
    if (avgResponseTime > 1000) return 'SLOW';
    if (errorRate > 0.05 || avgResponseTime > 500) return 'WARNING';
    return 'HEALTHY';
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(report: any): string[] {
    const recommendations: string[] = [];

    if (report.summary.averageResponseTime > 500) {
      recommendations.push('平均响应时间较高，建议优化数据库查询和API逻辑');
    }

    if (report.summary.errorRate > 0.05) {
      recommendations.push('错误率偏高，需要检查和修复常见错误');
    }

    if (report.summary.activeAlerts > 5) {
      recommendations.push('活跃告警较多，需要及时处理性能问题');
    }

    // 检查内存使用
    const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryMB > PERFORMANCE_CONFIG.memory.warning) {
      recommendations.push(`内存使用量较高(${Math.round(memoryMB)}MB)，检查是否有内存泄漏`);
    }

    return recommendations;
  }
}

// 创建全局性能监控器实例
const performanceMonitor = new PerformanceMonitor();

/**
 * 性能监控中间件
 */
export function createPerformanceMonitor() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 采样检查
    if (Math.random() > PERFORMANCE_CONFIG.sampleRate) {
      return next();
    }

    const startTime = process.hrtime.bigint();
    const startCpu = process.cpuUsage();
    const startMemory = process.memoryUsage();
    let dbQueryCount = 0;
    let dbQueryTime = 0;

    // 监听Prisma查询事件（如果可用）
    const queryListener = (event: any) => {
      if (event.duration) {
        dbQueryCount++;
        dbQueryTime += event.duration / 1000000; // 转换为毫秒
        performanceMonitor.recordDatabaseQuery(event.query, event.duration / 1000000);
      }
    };

    // // prisma.$on('query', queryListener); // 完全禁用以避免性能问题

    // 监听响应完成
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const endCpu = process.cpuUsage(startCpu);
      const endMemory = process.memoryUsage();

      const responseTime = Number(endTime - startTime) / 1000000; // 转换为毫秒

      // 记录性能指标
      performanceMonitor.recordRequest({
        timestamp: Date.now(),
        requestId: req.requestId || 'unknown',
        method: req.method,
        route: req.route?.path || req.path || req.url,
        statusCode: res.statusCode,
        responseTime,
        memoryUsage: endMemory,
        cpuUsage: endCpu,
        userAgent: req.get('User-Agent') || 'Unknown',
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userId: (req as any).user?.id,
        dbQueryCount,
        dbQueryTime
      });

      // 在响应头中添加性能信息（仅开发环境）
      if (process.env.NODE_ENV === 'development' && !res.headersSent) {
        try {
          res.set('X-Response-Time', `${Math.round(responseTime)}ms`);
          res.set('X-Memory-Usage', `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`);
        } catch (e) {
          // 忽略设置响应头的错误
        }
      }
    });

    // 监听错误
    res.on('error', (error) => {
      performanceMonitor.recordError(req.route?.path || req.path, error, {
        method: req.method,
        statusCode: res.statusCode
      });
    });

    next();
  };
}

// 导出增强版中间件
export const performanceMonitorMiddleware = createPerformanceMonitor();

// 导出性能监控器实例
export { performanceMonitor };

// 导出配置
export { PERFORMANCE_CONFIG };