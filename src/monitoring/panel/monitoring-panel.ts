/**
 * 监控面板 - 提供监控数据的可视化接口
 * 支持实时数据、历史数据查询和图表数据格式化
 */

import { EventEmitter } from 'events';
import { monitoringConfig, MonitoringConfig } from '../config/monitoring-config';
import { logger } from '../../shared/utils/logger';

// 面板数据接口
export interface PanelData {
  timestamp: number;
  system: {
    cpu: number;
    memory: number;
    disk: number;
    network: {
      in: number;
      out: number;
    };
  };
  performance: {
    requests: number;
    errors: number;
    avgResponseTime: number;
    p95: number;
    p99: number;
  };
  business: {
    activeUsers: number;
    orders: number;
    revenue: number;
    conversionRate: number;
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
  }>;
}

/**
 * 监控面板类
 */
export class MonitoringPanel extends EventEmitter {
  private config: MonitoringConfig;
  private dataHistory: PanelData[] = [];
  private maxHistorySize = 1000;
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
  }

  /**
   * 获取实时监控数据
   */
  async getRealtimeData(): Promise<PanelData> {
    // 检查缓存
    const cacheKey = 'realtime_data';
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 这里应该从监控中心获取实际数据
      // 暂时返回模拟数据
      const data: PanelData = {
        timestamp: Date.now(),
        system: {
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          disk: Math.random() * 100,
          network: {
            in: Math.random() * 1000,
            out: Math.random() * 1000
          }
        },
        performance: {
          requests: Math.floor(Math.random() * 1000),
          errors: Math.floor(Math.random() * 100),
          avgResponseTime: Math.random() * 1000,
          p95: Math.random() * 1500,
          p99: Math.random() * 2000
        },
        business: {
          activeUsers: Math.floor(Math.random() * 10000),
          orders: Math.floor(Math.random() * 500),
          revenue: Math.floor(Math.random() * 100000),
          conversionRate: Math.random() * 10
        },
        alerts: {
          critical: Math.floor(Math.random() * 5),
          high: Math.floor(Math.random() * 10),
          medium: Math.floor(Math.random() * 20),
          low: Math.floor(Math.random() * 30)
        }
      };

      // 存储到历史
      this.addToHistory(data);

      // 缓存数据
      this.setCache(cacheKey, data);

      return data;

    } catch (error) {
      logger.error('获取实时数据失败', error);
      throw error;
    }
  }

  /**
   * 获取历史数据
   */
  async getHistoryData(
    metric: string,
    timeRange: string = '1h'
  ): Promise<ChartData> {
    const cacheKey = `history_${metric}_${timeRange}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const now = Date.now();
      let timeMs: number;
      let intervalMs: number;

      // 解析时间范围
      switch (timeRange) {
        case '5m':
          timeMs = 5 * 60 * 1000;
          intervalMs = 30 * 1000;
          break;
        case '15m':
          timeMs = 15 * 60 * 1000;
          intervalMs = 60 * 1000;
          break;
        case '1h':
          timeMs = 60 * 60 * 1000;
          intervalMs = 5 * 60 * 1000;
          break;
        case '6h':
          timeMs = 6 * 60 * 60 * 1000;
          intervalMs = 30 * 60 * 1000;
          break;
        case '24h':
          timeMs = 24 * 60 * 60 * 1000;
          intervalMs = 60 * 60 * 1000;
          break;
        default:
          timeMs = 60 * 60 * 1000;
          intervalMs = 5 * 60 * 1000;
      }

      const startTime = now - timeMs;
      const data = this.dataHistory.filter(d => d.timestamp >= startTime);

      // 生成图表数据
      const chartData = this.formatChartData(metric, data, intervalMs);

      // 缓存结果
      this.setCache(cacheKey, chartData);

      return chartData;

    } catch (error) {
      logger.error('获取历史数据失败', error);
      throw error;
    }
  }

  /**
   * 获取仪表板数据
   */
  async getDashboardData(): Promise<any> {
    const [realtime, cpuHistory, memoryHistory, requestsHistory] = await Promise.all([
      this.getRealtimeData(),
      this.getHistoryData('system.cpu', '1h'),
      this.getHistoryData('system.memory', '1h'),
      this.getHistoryData('performance.requests', '1h')
    ]);

    return {
      summary: {
        system: {
          cpu: realtime.system.cpu,
          memory: realtime.system.memory,
          disk: realtime.system.disk
        },
        performance: {
          requests: realtime.performance.requests,
          errors: realtime.performance.errors,
          avgResponseTime: Math.round(realtime.performance.avgResponseTime)
        },
        business: {
          activeUsers: realtime.business.activeUsers,
          orders: realtime.business.orders,
          revenue: realtime.business.revenue
        },
        alerts: realtime.alerts
      },
      charts: {
        cpu: cpuHistory,
        memory: memoryHistory,
        requests: requestsHistory
      },
      timestamp: realtime.timestamp
    };
  }

  /**
   * 获取系统概览
   */
  async getSystemOverview(): Promise<any> {
    try {
      const realtime = await this.getRealtimeData();

      return {
        status: this.getSystemStatus(realtime),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        environment: this.config.environment,
        resources: {
          cpu: {
            current: Math.round(realtime.system.cpu * 100) / 100,
            status: this.getStatusLevel(realtime.system.cpu, 70, 85)
          },
          memory: {
            current: Math.round(realtime.system.memory * 100) / 100,
            status: this.getStatusLevel(realtime.system.memory, 75, 90)
          },
          disk: {
            current: Math.round(realtime.system.disk * 100) / 100,
            status: this.getStatusLevel(realtime.system.disk, 80, 90)
          }
        },
        performance: {
          requests: realtime.performance.requests,
          errors: realtime.performance.errors,
          avgResponseTime: Math.round(realtime.performance.avgResponseTime),
          status: this.getPerformanceStatus(realtime.performance)
        },
        alerts: {
          total: Object.values(realtime.alerts).reduce((a, b) => a + b, 0),
          critical: realtime.alerts.critical,
          high: realtime.alerts.high
        }
      };

    } catch (error) {
      logger.error('获取系统概览失败', error);
      throw error;
    }
  }

  /**
   * 获取告警列表
   */
  async getAlerts(severity?: string, limit: number = 50): Promise<any[]> {
    // 这里应该从告警管理器获取实际数据
    const alerts = [];

    for (let i = 0; i < limit; i++) {
      const severities = ['critical', 'high', 'medium', 'low'];
      const randomSeverity = severity || severities[Math.floor(Math.random() * severities.length)];

      alerts.push({
        id: `alert_${i}`,
        type: ['cpu', 'memory', 'disk', 'error_rate'][Math.floor(Math.random() * 4)],
        severity: randomSeverity,
        title: `告警 ${i + 1}`,
        message: `这是一个${randomSeverity}级别的告警`,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        resolved: Math.random() > 0.7,
        acknowledged: Math.random() > 0.5
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aOrder = severityOrder[a.severity as keyof typeof severityOrder];
      const bOrder = severityOrder[b.severity as keyof typeof severityOrder];
      return bOrder - aOrder;
    });
  }

  /**
   * 获取业务指标
   */
  async getBusinessMetrics(): Promise<any> {
    // 这里应该从业务指标监控器获取实际数据
    return {
      users: {
        total: Math.floor(Math.random() * 100000) + 50000,
        active: {
          daily: Math.floor(Math.random() * 10000) + 5000,
          weekly: Math.floor(Math.random() * 30000) + 20000,
          monthly: Math.floor(Math.random() * 50000) + 30000
        },
        new: {
          daily: Math.floor(Math.random() * 500) + 100,
          weekly: Math.floor(Math.random() * 2000) + 1000,
          monthly: Math.floor(Math.random() * 5000) + 3000
        }
      },
      orders: {
        total: Math.floor(Math.random() * 10000) + 5000,
        pending: Math.floor(Math.random() * 100),
        completed: Math.floor(Math.random() * 1000) + 500,
        cancelled: Math.floor(Math.random() * 50),
        revenue: Math.floor(Math.random() * 1000000) + 500000
      },
      conversion: {
        rate: Math.random() * 5 + 2,
        trend: 'up'
      },
      retention: {
        day1: Math.random() * 20 + 70,
        day7: Math.random() * 15 + 45,
        day30: Math.random() * 10 + 25
      }
    };
  }

  /**
   * 导出监控数据
   */
  async exportData(
    type: 'csv' | 'json' | 'excel',
    metrics: string[],
    timeRange: string
  ): Promise<Buffer> {
    // 收集数据
    const data = [];
    const now = Date.now();
    let timeMs: number;

    switch (timeRange) {
      case '1h':
        timeMs = 60 * 60 * 1000;
        break;
      case '24h':
        timeMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        timeMs = 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        timeMs = 60 * 60 * 1000;
    }

    const history = this.dataHistory.filter(d => d.timestamp >= now - timeMs);

    // 格式化数据
    history.forEach(record => {
      const row: any = {
        timestamp: new Date(record.timestamp).toISOString()
      };

      metrics.forEach(metric => {
        const value = this.getNestedValue(record, metric);
        row[metric] = value;
      });

      data.push(row);
    });

    // 生成导出内容
    switch (type) {
      case 'json':
        return Buffer.from(JSON.stringify(data, null, 2));

      case 'csv':
        const csv = this.convertToCSV(data);
        return Buffer.from(csv, 'utf8');

      case 'excel':
        // 这里应该使用excel库生成Excel文件
        // 简化实现，返回CSV格式
        const csvForExcel = this.convertToCSV(data);
        return Buffer.from(csvForExcel, 'utf8');

      default:
        throw new Error(`不支持的导出类型: ${type}`);
    }
  }

  // 私有方法

  /**
   * 添加到历史记录
   */
  private addToHistory(data: PanelData): void {
    this.dataHistory.push(data);

    // 限制历史记录大小
    if (this.dataHistory.length > this.maxHistorySize) {
      this.dataHistory.shift();
    }
  }

  /**
   * 格式化图表数据
   */
  private formatChartData(
    metric: string,
    data: PanelData[],
    intervalMs: number
  ): ChartData {
    const labels: string[] = [];
    const values: number[] = [];

    // 按间隔聚合数据
    const aggregated = new Map<number, number[]>();

    data.forEach(record => {
      const timeSlot = Math.floor(record.timestamp / intervalMs) * intervalMs;
      if (!aggregated.has(timeSlot)) {
        aggregated.set(timeSlot, []);
      }

      const value = this.getNestedValue(record, metric);
      if (value !== null) {
        aggregated.get(timeSlot)!.push(value);
      }
    });

    // 生成图表数据
    const sortedSlots = Array.from(aggregated.keys()).sort();
    sortedSlots.forEach(slot => {
      const valuesInSlot = aggregated.get(slot)!;
      const avgValue = valuesInSlot.reduce((a, b) => a + b, 0) / valuesInSlot.length;

      labels.push(new Date(slot).toLocaleTimeString());
      values.push(Math.round(avgValue * 100) / 100);
    });

    // 确定颜色
    const colors = this.getChartColors(metric);

    return {
      labels,
      datasets: [{
        label: this.getMetricLabel(metric),
        data: values,
        borderColor: colors.border,
        backgroundColor: colors.background,
        fill: colors.fill
      }]
    };
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): number {
    return path.split('.').reduce((o, p) => o?.[p], null);
  }

  /**
   * 获取图表颜色
   */
  private getChartColors(metric: string): { border: string; background: string; fill: boolean } {
    const colors = {
      'system.cpu': {
        border: '#ff6384',
        background: 'rgba(255, 99, 132, 0.1)',
        fill: true
      },
      'system.memory': {
        border: '#36a2eb',
        background: 'rgba(54, 162, 235, 0.1)',
        fill: true
      },
      'system.disk': {
        border: '#ffce56',
        background: 'rgba(255, 206, 86, 0.1)',
        fill: true
      },
      'performance.requests': {
        border: '#4bc0c0',
        background: 'rgba(75, 192, 192, 0.1)',
        fill: false
      },
      'performance.errors': {
        border: '#ff9f40',
        background: 'rgba(255, 159, 64, 0.1)',
        fill: false
      }
    };

    return colors[metric as keyof typeof colors] || {
      border: '#9966ff',
      background: 'rgba(153, 102, 255, 0.1)',
      fill: true
    };
  }

  /**
   * 获取指标标签
   */
  private getMetricLabel(metric: string): string {
    const labels: Record<string, string> = {
      'system.cpu': 'CPU使用率 (%)',
      'system.memory': '内存使用率 (%)',
      'system.disk': '磁盘使用率 (%)',
      'performance.requests': '请求数',
      'performance.errors': '错误数',
      'performance.avgResponseTime': '平均响应时间 (ms)'
    };

    return labels[metric] || metric;
  }

  /**
   * 获取系统状态
   */
  private getSystemStatus(data: PanelData): string {
    if (data.alerts.critical > 0) return 'critical';
    if (data.alerts.high > 0) return 'warning';
    if (data.system.cpu > 85 || data.system.memory > 90) return 'warning';
    return 'healthy';
  }

  /**
   * 获取状态级别
   */
  private getStatusLevel(value: number, warning: number, critical: number): string {
    if (value >= critical) return 'critical';
    if (value >= warning) return 'warning';
    return 'normal';
  }

  /**
   * 获取性能状态
   */
  private getPerformanceStatus(perf: PanelData['performance']): string {
    if (perf.avgResponseTime > 2000 || perf.errors > 100) return 'critical';
    if (perf.avgResponseTime > 1000 || perf.errors > 50) return 'warning';
    return 'normal';
  }

  /**
   * 转换为CSV
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(item => {
      return headers.map(header => {
        const value = item[header];
        return typeof value === 'string' ? `"${value}"` : value;
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * 从缓存获取数据
   */
  private getFromCache(key: string): any | null {
    if (!this.config.panel.cache.enabled) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.config.panel.cache.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, data: any): void {
    if (!this.config.panel.cache.enabled) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // 限制缓存大小
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}