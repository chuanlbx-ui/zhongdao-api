/**
 * 缓存监控服务
 * 提供缓存性能监控、统计和报警功能
 */

import { EventEmitter } from 'events';
import { cacheManager } from '../CacheManager';
import { logger } from '../../utils/logger';

export interface CacheMetrics {
  timestamp: number;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  responseTime: {
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  operations: {
    get: number;
    set: number;
    del: number;
    mget: number;
    mset: number;
  };
}

export interface CacheAlert {
  id: string;
  type: 'hit_rate_low' | 'memory_high' | 'error_rate_high' | 'response_time_high' | 'connection_lost';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  value?: number;
  threshold?: number;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface CacheHealth {
  status: 'healthy' | 'warning' | 'unhealthy' | 'unknown';
  score: number; // 0-100
  uptime: number;
  lastCheck: number;
  issues: string[];
}

export class CacheMonitor extends EventEmitter {
  private static instance: CacheMonitor;
  private metrics: CacheMetrics[] = [];
  private alerts: Map<string, CacheAlert> = new Map();
  private thresholds = {
    hitRateMin: 70, // 最低命中率
    memoryMax: 80, // 最大内存使用率
    errorRateMax: 5, // 最大错误率
    responseTimeMax: 100, // 最大响应时间(ms)
    sampleInterval: 60000 // 采样间隔(ms)
  };
  private startTime: number = Date.now();
  private monitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private responseTimes: number[] = [];

  private constructor() {
    super();
    this.initializeMetrics();
  }

  static getInstance(): CacheMonitor {
    if (!CacheMonitor.instance) {
      CacheMonitor.instance = new CacheMonitor();
    }
    return CacheMonitor.instance;
  }

  private initializeMetrics(): void {
    this.metrics = [{
      timestamp: Date.now(),
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      responseTime: {
        avg: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      },
      operations: {
        get: 0,
        set: 0,
        del: 0,
        mget: 0,
        mset: 0
      }
    }];
  }

  // 开始监控
  async startMonitoring(): Promise<void> {
    if (this.monitoring) {
      return;
    }

    this.monitoring = true;
    logger.info('开始缓存监控');

    // 定期采集指标
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.thresholds.sampleInterval);

    // 采集初始指标
    await this.collectMetrics();
  }

  // 停止监控
  stopMonitoring(): void {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('停止缓存监控');
  }

  // 采集指标
  private async collectMetrics(): Promise<void> {
    try {
      const stats = await cacheManager.getStats();
      const config = cacheManager.getConfig();
      const health = await cacheManager.healthCheck();

      // 计算响应时间统计
      const responseTimeStats = this.calculateResponseTimeStats();

      const metrics: CacheMetrics = {
        timestamp: Date.now(),
        hits: stats.hits,
        misses: stats.misses,
        sets: stats.sets,
        deletes: stats.deletes,
        errors: stats.errors,
        hitRate: stats.hitRate,
        responseTime: responseTimeStats,
        memory: {
          used: stats.memoryUsage || 0,
          total: 0, // Redis可用时可以从info获取
          percentage: 0
        },
        operations: {
          get: stats.hits + stats.misses,
          set: stats.sets,
          del: stats.deletes,
          mget: 0,
          mset: 0
        }
      };

      // 保存指标（保留最近1000个数据点）
      this.metrics.push(metrics);
      if (this.metrics.length > 1000) {
        this.metrics.shift();
      }

      // 检查警报
      this.checkAlerts(metrics);

      // 发出指标事件
      this.emit('metrics', metrics);

    } catch (error) {
      logger.error('采集缓存指标失败:', error);
      this.emit('error', error);
    }
  }

  // 计算响应时间统计
  private calculateResponseTimeStats() {
    if (this.responseTimes.length === 0) {
      return {
        avg: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  // 记录操作响应时间
  recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    // 只保留最近1000个响应时间
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  // 检查警报
  private checkAlerts(metrics: CacheMetrics): void {
    const now = Date.now();

    // 检查命中率
    if (metrics.hitRate < this.thresholds.hitRateMin) {
      this.createAlert('hit_rate_low', 'warning',
        `缓存命中率过低: ${metrics.hitRate.toFixed(2)}%`,
        metrics.hitRate,
        this.thresholds.hitRateMin
      );
    }

    // 检查内存使用
    if (metrics.memory.percentage > this.thresholds.memoryMax) {
      this.createAlert('memory_high', 'error',
        `内存使用率过高: ${metrics.memory.percentage.toFixed(2)}%`,
        metrics.memory.percentage,
        this.thresholds.memoryMax
      );
    }

    // 检查错误率
    const totalOperations = metrics.operations.get + metrics.operations.set + metrics.operations.del;
    const errorRate = totalOperations > 0 ? (metrics.errors / totalOperations) * 100 : 0;
    if (errorRate > this.thresholds.errorRateMax) {
      this.createAlert('error_rate_high', 'error',
        `错误率过高: ${errorRate.toFixed(2)}%`,
        errorRate,
        this.thresholds.errorRateMax
      );
    }

    // 检查响应时间
    if (metrics.responseTime.avg > this.thresholds.responseTimeMax) {
      this.createAlert('response_time_high', 'warning',
        `平均响应时间过长: ${metrics.responseTime.avg.toFixed(2)}ms`,
        metrics.responseTime.avg,
        this.thresholds.responseTimeMax
      );
    }

    // 清理已解决的警报
    this.cleanupResolvedAlerts();
  }

  // 创建警报
  private createAlert(type: CacheAlert['type'], severity: CacheAlert['severity'],
                     message: string, value?: number, threshold?: number): void {
    const alertId = `${type}_${Date.now()}`;

    // 检查是否已有相同类型的未解决警报
    const existingAlert = Array.from(this.alerts.values())
      .find(alert => alert.type === type && !alert.resolved);

    if (existingAlert) {
      return; // 已有相同警报，不重复创建
    }

    const alert: CacheAlert = {
      id: alertId,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.set(alertId, alert);
    logger.warn(`缓存警报: ${message}`, { type, severity, value, threshold });

    // 发出警报事件
    this.emit('alert', alert);
  }

  // 解决警报
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      logger.info(`警报已解决: ${alert.message}`);
      this.emit('alertResolved', alert);
    }
  }

  // 清理已解决的警报
  private cleanupResolvedAlerts(): void {
    const now = Date.now();
    const resolvedTimeout = 3600000; // 1小时后清理已解决的警报

    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && (now - alert.resolvedAt) > resolvedTimeout) {
        this.alerts.delete(id);
      }
    }
  }

  // 获取当前指标
  getCurrentMetrics(): CacheMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  // 获取指标历史
  getMetricsHistory(duration: number = 3600000): CacheMetrics[] {
    const cutoff = Date.now() - duration;
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  // 获取活跃警报
  getActiveAlerts(): CacheAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  // 获取所有警报
  getAllAlerts(): CacheAlert[] {
    return Array.from(this.alerts.values());
  }

  // 获取健康状态
  async getHealth(): Promise<CacheHealth> {
    try {
      const metrics = this.getCurrentMetrics();
      const activeAlerts = this.getActiveAlerts();
      const isHealthy = await cacheManager.healthCheck();

      const issues: string[] = [];

      // 检查各种指标
      if (metrics) {
        if (metrics.hitRate < this.thresholds.hitRateMin) {
          issues.push(`命中率过低: ${metrics.hitRate.toFixed(2)}%`);
        }
        if (metrics.responseTime.avg > this.thresholds.responseTimeMax) {
          issues.push(`响应时间过长: ${metrics.responseTime.avg.toFixed(2)}ms`);
        }
      }

      if (!isHealthy) {
        issues.push('缓存连接异常');
      }

      // 根据警报数量和严重程度计算健康分数
      let score = 100;
      for (const alert of activeAlerts) {
        switch (alert.severity) {
          case 'critical':
            score -= 30;
            break;
          case 'error':
            score -= 20;
            break;
          case 'warning':
            score -= 10;
            break;
          case 'info':
            score -= 5;
            break;
        }
      }

      // 根据问题数量进一步扣分
      score -= Math.min(issues.length * 5, 30);
      score = Math.max(0, score);

      let status: CacheHealth['status'] = 'healthy';
      if (score < 50) {
        status = 'unhealthy';
      } else if (score < 80) {
        status = 'warning';
      }

      return {
        status,
        score,
        uptime: Date.now() - this.startTime,
        lastCheck: Date.now(),
        issues
      };

    } catch (error) {
      logger.error('获取缓存健康状态失败:', error);
      return {
        status: 'unknown',
        score: 0,
        uptime: Date.now() - this.startTime,
        lastCheck: Date.now(),
        issues: ['无法获取健康状态']
      };
    }
  }

  // 获取性能报告
  getPerformanceReport(duration: number = 3600000): {
    summary: {
      totalRequests: number;
      hitRate: number;
      avgResponseTime: number;
      errorRate: number;
    };
    trends: {
      hitRate: Array<{ timestamp: number; value: number }>;
      responseTime: Array<{ timestamp: number; value: number }>;
      memory: Array<{ timestamp: number; value: number }>;
    };
    alerts: CacheAlert[];
  } {
    const history = this.getMetricsHistory(duration);
    const alerts = this.getActiveAlerts();

    if (history.length === 0) {
      return {
        summary: {
          totalRequests: 0,
          hitRate: 0,
          avgResponseTime: 0,
          errorRate: 0
        },
        trends: {
          hitRate: [],
          responseTime: [],
          memory: []
        },
        alerts
      };
    }

    // 计算汇总数据
    const totalRequests = history.reduce((sum, m) =>
      sum + m.operations.get + m.operations.set + m.operations.del, 0);
    const avgHitRate = history.reduce((sum, m) => sum + m.hitRate, 0) / history.length;
    const avgResponseTime = history.reduce((sum, m) => sum + m.responseTime.avg, 0) / history.length;
    const totalErrors = history.reduce((sum, m) => sum + m.errors, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // 准备趋势数据
    const hitRateTrend = history.map(m => ({ timestamp: m.timestamp, value: m.hitRate }));
    const responseTimeTrend = history.map(m => ({ timestamp: m.timestamp, value: m.responseTime.avg }));
    const memoryTrend = history.map(m => ({ timestamp: m.timestamp, value: m.memory.percentage }));

    return {
      summary: {
        totalRequests,
        hitRate: avgHitRate,
        avgResponseTime,
        errorRate
      },
      trends: {
        hitRate: hitRateTrend,
        responseTime: responseTimeTrend,
        memory: memoryTrend
      },
      alerts
    };
  }

  // 更新阈值
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('更新缓存监控阈值', this.thresholds);
  }

  // 获取当前阈值
  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  // 导出指标数据
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const history = this.getMetricsHistory();

    if (format === 'csv') {
      // CSV格式
      const headers = [
        'timestamp', 'hits', 'misses', 'hitRate', 'sets', 'deletes', 'errors',
        'avgResponseTime', 'minResponseTime', 'maxResponseTime',
        'memoryUsed', 'memoryPercentage'
      ];
      const rows = history.map(m => [
        m.timestamp,
        m.hits,
        m.misses,
        m.hitRate,
        m.sets,
        m.deletes,
        m.errors,
        m.responseTime.avg,
        m.responseTime.min,
        m.responseTime.max,
        m.memory.used,
        m.memory.percentage
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } else {
      // JSON格式
      return JSON.stringify(history, null, 2);
    }
  }

  // 重置所有指标
  reset(): void {
    this.initializeMetrics();
    this.alerts.clear();
    this.responseTimes = [];
    this.startTime = Date.now();
    logger.info('重置缓存监控指标');
  }
}

// 导出单例
export const cacheMonitor = CacheMonitor.getInstance();