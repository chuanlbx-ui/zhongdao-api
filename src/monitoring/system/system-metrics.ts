/**
 * 系统性能监控器
 * 监控CPU、内存、磁盘、网络、数据库等系统资源
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs/promises';
import { monitoringConfig, MonitoringConfig } from '../config/monitoring-config';
import { logger } from '../../shared/utils/logger';
import { PrismaClient } from '@prisma/client';

// 系统指标接口
export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    heap: {
      used: number;
      total: number;
      limit: number;
    };
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  database: {
    connections: number;
    activeConnections: number;
    idleConnections: number;
    queryTime: number;
    slowQueries: number;
  };
  uptime: number;
  process: {
    pid: number;
    version: string;
    nodeVersion: string;
  };
}

/**
 * 系统指标收集器
 */
export class SystemMetricsCollector extends EventEmitter {
  private config: MonitoringConfig;
  private prisma: PrismaClient;
  private isRunning = false;
  private collectTimer?: NodeJS.Timeout;
  private lastNetworkStats?: { bytesIn: number; bytesOut: number; packetsIn: number; packetsOut: number };
  private startTime = Date.now();

  // 指标历史记录
  private metricsHistory: SystemMetrics[] = [];
  private maxHistorySize = 1000;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.prisma = new PrismaClient();
  }

  /**
   * 初始化系统监控
   */
  async initialize(): Promise<void> {
    logger.info('初始化系统监控器...');

    // 获取初始网络统计
    if (this.config.system.network.enabled) {
      this.lastNetworkStats = await this.getNetworkStats();
    }

    // 清理定时器
    process.on('exit', () => {
      this.prisma.$disconnect();
    });
  }

  /**
   * 启动监控
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // 设置定时收集
    this.collectTimer = setInterval(
      () => this.collectMetrics(),
      this.config.system.collectInterval
    );

    // 立即收集一次
    await this.collectMetrics();

    logger.info('系统监控器已启动', {
      interval: this.config.system.collectInterval,
      networkEnabled: this.config.system.network.enabled
    });
  }

  /**
   * 停止监控
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = undefined;
    }

    await this.prisma.$disconnect();
    logger.info('系统监控器已停止');
  }

  /**
   * 收集系统指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();

      // 并行收集各项指标
      const [
        cpuMetrics,
        memoryMetrics,
        diskMetrics,
        networkMetrics,
        databaseMetrics
      ] = await Promise.all([
        this.getCPUMetrics(),
        this.getMemoryMetrics(),
        this.getDiskMetrics(),
        this.getNetworkMetricsDelta(),
        this.getDatabaseMetrics()
      ]);

      const metrics: SystemMetrics = {
        timestamp,
        cpu: cpuMetrics,
        memory: memoryMetrics,
        disk: diskMetrics,
        network: networkMetrics,
        database: databaseMetrics,
        uptime: Date.now() - this.startTime,
        process: {
          pid: process.pid,
          version: process.env.npm_package_version || '1.0.0',
          nodeVersion: process.version
        }
      };

      // 存储指标
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // 检查阈值
      this.checkThresholds(metrics);

      // 发出事件
      this.emit('metrics', metrics);
      this.emit('metrics-collected', { type: 'system', data: metrics });

    } catch (error) {
      logger.error('收集系统指标失败', error);
    }
  }

  /**
   * 获取CPU指标
   */
  private async getCPUMetrics(): Promise<SystemMetrics['cpu']> {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    // 计算CPU使用率（简化版本）
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const usage = 100 - (totalIdle / totalTick * 100);

    return {
      usage: Math.round(usage * 100) / 100,
      loadAverage: loadAvg,
      cores: cpus.length
    };
  }

  /**
   * 获取内存指标
   */
  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;

    // Node.js堆内存
    const heapUsage = process.memoryUsage();

    return {
      total: Math.round(total / 1024 / 1024), // MB
      used: Math.round(used / 1024 / 1024), // MB
      free: Math.round(free / 1024 / 1024), // MB
      usage: Math.round(usage * 100) / 100,
      heap: {
        used: Math.round(heapUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(heapUsage.heapTotal / 1024 / 1024), // MB
        limit: Math.round(heapUsage.heapLimit / 1024 / 1024) // MB
      }
    };
  }

  /**
   * 获取磁盘指标
   */
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    try {
      const stats = await fs.statfs('.');
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const usage = (used / total) * 100;

      return {
        total: Math.round(total / 1024 / 1024 / 1024), // GB
        used: Math.round(used / 1024 / 1024 / 1024), // GB
        free: Math.round(free / 1024 / 1024 / 1024), // GB
        usage: Math.round(usage * 100) / 100
      };
    } catch (error) {
      logger.error('获取磁盘指标失败', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      };
    }
  }

  /**
   * 获取网络指标
   */
  private async getNetworkStats(): Promise<{ bytesIn: number; bytesOut: number; packetsIn: number; packetsOut: number }> {
    try {
      const content = await fs.readFile('/proc/net/dev', 'utf8');
      const lines = content.split('\n');

      let totalBytesIn = 0;
      let totalBytesOut = 0;
      let totalPacketsIn = 0;
      let totalPacketsOut = 0;

      for (const line of lines) {
        if (line.includes(':')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 17) {
            totalBytesIn += parseInt(parts[1], 10);
            totalPacketsIn += parseInt(parts[2], 10);
            totalBytesOut += parseInt(parts[9], 10);
            totalPacketsOut += parseInt(parts[10], 10);
          }
        }
      }

      return {
        bytesIn: totalBytesIn,
        bytesOut: totalBytesOut,
        packetsIn: totalPacketsIn,
        packetsOut: totalPacketsOut
      };
    } catch (error) {
      // Windows或其他系统，返回默认值
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      };
    }
  }

  /**
   * 获取网络指标增量
   */
  private async getNetworkMetricsDelta(): Promise<SystemMetrics['network']> {
    if (!this.config.system.network.enabled) {
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      };
    }

    const currentStats = await this.getNetworkStats();
    let deltaStats = currentStats;

    if (this.lastNetworkStats) {
      const timeDelta = this.config.system.collectInterval / 1000; // 转换为秒
      deltaStats = {
        bytesIn: Math.max(0, (currentStats.bytesIn - this.lastNetworkStats.bytesIn) / timeDelta),
        bytesOut: Math.max(0, (currentStats.bytesOut - this.lastNetworkStats.bytesOut) / timeDelta),
        packetsIn: Math.max(0, (currentStats.packetsIn - this.lastNetworkStats.packetsIn) / timeDelta),
        packetsOut: Math.max(0, (currentStats.packetsOut - this.lastNetworkStats.packetsOut) / timeDelta)
      };
    }

    this.lastNetworkStats = currentStats;
    return deltaStats;
  }

  /**
   * 获取数据库指标
   */
  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      // 获取数据库连接池状态
      const db = this.prisma as any;
      const engine = db._engine || db._client?.engine;

      if (!engine) {
        // 如果无法获取引擎信息，返回默认值
        return {
          connections: 0,
          activeConnections: 0,
          idleConnections: 0,
          queryTime: 0,
          slowQueries: 0
        };
      }

      // 模拟查询时间测量
      const queryStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const queryTime = Date.now() - queryStart;

      // 获取连接数（Prisma可能不直接暴露，使用近似值）
      const connections = engine.numConnections || 1;
      const activeConnections = Math.floor(connections * 0.7);
      const idleConnections = connections - activeConnections;

      return {
        connections,
        activeConnections,
        idleConnections,
        queryTime,
        slowQueries: queryTime > this.config.system.database.queryTimeThreshold ? 1 : 0
      };
    } catch (error) {
      logger.error('获取数据库指标失败', error);
      return {
        connections: 0,
        activeConnections: 0,
        idleConnections: 0,
        queryTime: 0,
        slowQueries: 1
      };
    }
  }

  /**
   * 检查阈值并触发告警
   */
  private checkThresholds(metrics: SystemMetrics): void {
    // CPU检查
    if (metrics.cpu.usage > this.config.system.cpu.critical) {
      this.emit('threshold', {
        type: 'cpu',
        severity: 'critical',
        message: `CPU使用率严重超标: ${metrics.cpu.usage}%`,
        data: { value: metrics.cpu.usage, threshold: this.config.system.cpu.critical }
      });
    } else if (metrics.cpu.usage > this.config.system.cpu.warning) {
      this.emit('threshold', {
        type: 'cpu',
        severity: 'warning',
        message: `CPU使用率偏高: ${metrics.cpu.usage}%`,
        data: { value: metrics.cpu.usage, threshold: this.config.system.cpu.warning }
      });
    }

    // 内存检查
    if (metrics.memory.usage > this.config.system.memory.critical) {
      this.emit('threshold', {
        type: 'memory',
        severity: 'critical',
        message: `内存使用率严重超标: ${metrics.memory.usage}%`,
        data: { value: metrics.memory.usage, threshold: this.config.system.memory.critical }
      });
    } else if (metrics.memory.usage > this.config.system.memory.warning) {
      this.emit('threshold', {
        type: 'memory',
        severity: 'warning',
        message: `内存使用率偏高: ${metrics.memory.usage}%`,
        data: { value: metrics.memory.usage, threshold: this.config.system.memory.warning }
      });
    }

    // 磁盘检查
    if (metrics.disk.usage > this.config.system.disk.critical) {
      this.emit('threshold', {
        type: 'disk',
        severity: 'critical',
        message: `磁盘使用率严重超标: ${metrics.disk.usage}%`,
        data: { value: metrics.disk.usage, threshold: this.config.system.disk.critical }
      });
    } else if (metrics.disk.usage > this.config.system.disk.warning) {
      this.emit('threshold', {
        type: 'disk',
        severity: 'warning',
        message: `磁盘使用率偏高: ${metrics.disk.usage}%`,
        data: { value: metrics.disk.usage, threshold: this.config.system.disk.warning }
      });
    }

    // 数据库连接检查
    if (metrics.database.connections > this.config.system.database.connectionThreshold) {
      this.emit('threshold', {
        type: 'database',
        severity: 'warning',
        message: `数据库连接数过多: ${metrics.database.connections}`,
        data: { value: metrics.database.connections, threshold: this.config.system.database.connectionThreshold }
      });
    }

    // 慢查询检查
    if (metrics.database.slowQueries > 0) {
      this.emit('threshold', {
        type: 'slow_query',
        severity: 'warning',
        message: `检测到慢查询: ${metrics.database.queryTime}ms`,
        data: { value: metrics.database.queryTime, threshold: this.config.system.database.queryTimeThreshold }
      });
    }
  }

  /**
   * 获取实时系统指标
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  /**
   * 获取历史指标
   */
  getHistoryMetrics(minutes: number = 60): SystemMetrics[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  /**
   * 获取系统指标报告
   */
  async getReport(): Promise<any> {
    const current = this.getCurrentMetrics();
    const history = this.getHistoryMetrics(60); // 最近1小时

    if (!current) {
      return {
        timestamp: new Date(),
        status: 'unavailable',
        message: '系统指标暂不可用'
      };
    }

    // 计算平均值
    const avgCPU = history.length > 0
      ? history.reduce((sum, m) => sum + m.cpu.usage, 0) / history.length
      : current.cpu.usage;

    const avgMemory = history.length > 0
      ? history.reduce((sum, m) => sum + m.memory.usage, 0) / history.length
      : current.memory.usage;

    return {
      timestamp: new Date(),
      current,
      summary: {
        cpu: {
          current: Math.round(current.cpu.usage * 100) / 100,
          average: Math.round(avgCPU * 100) / 100,
          cores: current.cpu.cores,
          loadAverage: current.cpu.loadAverage
        },
        memory: {
          current: Math.round(current.memory.usage * 100) / 100,
          average: Math.round(avgMemory * 100) / 100,
          total: current.memory.total,
          used: current.memory.used,
          heap: current.memory.heap
        },
        disk: {
          usage: Math.round(current.disk.usage * 100) / 100,
          total: current.disk.total,
          used: current.disk.used,
          free: current.disk.free
        },
        database: current.database,
        uptime: current.uptime,
        process: current.process
      },
      trends: {
        cpu: this.calculateTrend(history.map(m => m.cpu.usage)),
        memory: this.calculateTrend(history.map(m => m.memory.usage)),
        connections: this.calculateTrend(history.map(m => m.database.connections))
      }
    };
  }

  /**
   * 计算趋势
   */
  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 10) return 'stable';

    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));

    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return 'up';
    if (change < -10) return 'down';
    return 'stable';
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.isRunning;
  }
}