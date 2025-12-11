import { logger } from '../utils/logger';
import { prisma } from '../database/client';

interface SystemMetrics {
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  databaseConnections: number;
  requestCount: number;
  errorCount: number;
  responseTime: {
    avg: number;
    max: number;
    min: number;
  };
}

interface RequestMetrics {
  timestamp: Date;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  error?: string;
}

class SystemMonitor {
  private static instance: SystemMonitor;
  private requestMetrics: RequestMetrics[] = [];
  private maxMetricsSize = 1000;
  private requestCount = 0;
  private errorCount = 0;
  private totalResponseTime = 0;
  private maxResponseTime = 0;
  private minResponseTime = Number.MAX_SAFE_INTEGER;

  private constructor() {
    // 初始化监控系统
    this.startMonitoring();
  }

  static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
  }

  private startMonitoring(): void {
    // 每30秒记录系统指标
    setInterval(() => {
      this.recordSystemMetrics();
    }, 30000);

    // 每小时清理旧指标
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  // 记录请求指标
  recordRequest(req: any, res: any, responseTime: number, error?: Error): void {
    this.requestCount++;

    const metric: RequestMetrics = {
      timestamp: new Date(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userId: req.user?.id,
      error: error?.message
    };

    this.requestMetrics.push(metric);

    // 保持数组大小
    if (this.requestMetrics.length > this.maxMetricsSize) {
      this.requestMetrics.shift();
    }

    // 更新统计
    if (res.statusCode >= 400) {
      this.errorCount++;
    }

    this.totalResponseTime += responseTime;
    this.maxResponseTime = Math.max(this.maxResponseTime, responseTime);
    this.minResponseTime = Math.min(this.minResponseTime, responseTime);
  }

  // 记录系统指标
  private recordSystemMetrics(): void {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0, // TODO: 从实际连接池获取
      databaseConnections: 0, // TODO: 从数据库连接池获取
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      responseTime: {
        avg: this.getAverageResponseTime(),
        max: this.maxResponseTime,
        min: this.minResponseTime === Number.MAX_SAFE_INTEGER ? 0 : this.minResponseTime
      }
    };

    // 记录到日志
    logger.info('系统监控指标', {
      memoryUsage: `${metrics.memoryUsage.heapUsed / 1024 / 1024}MB`,
      cpuUsage: `${metrics.cpuUsage.user}%`,
      requestCount: metrics.requestCount,
      errorRate: `${this.getErrorRate()}%`,
      avgResponseTime: `${metrics.responseTime.avg}ms`
    });

    // 可以选择发送到监控系统
    this.sendToMonitoringService(metrics);
  }

  // 计算平均响应时间
  private getAverageResponseTime(): number {
    const recentMetrics = this.requestMetrics.slice(-100); // 最近100个请求
    if (recentMetrics.length === 0) return 0;

    const sum = recentMetrics.reduce((acc, metric) => acc + metric.responseTime, 0);
    return sum / recentMetrics.length;
  }

  // 计算错误率
  private getErrorRate(): number {
    if (this.requestCount === 0) return 0;
    return ((this.errorCount / this.requestCount) * 100);
  }

  // 清理旧指标
  private cleanupOldMetrics(): void {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const initialSize = this.requestMetrics.length;

    this.requestMetrics = this.requestMetrics.filter(
      metric => metric.timestamp > oneHourAgo
    );

    if (this.requestMetrics.length !== initialSize) {
      logger.info('清理旧监控指标', {
        removed: initialSize - this.requestMetrics.length,
        remaining: this.requestMetrics.length
      });
    }
  }

  // 发送到监控服务（示例）
  private async sendToMonitoringService(metrics: SystemMetrics): Promise<void> {
    // 这里可以集成到实际的监控系统
    // 例如：Prometheus、Datadog、New Relic等

    // 示例：写入数据库
    try {
      await prisma.systemMetrics.create({
        data: {
          timestamp: metrics.timestamp,
          memoryUsage: metrics.memoryUsage,
          cpuUsage: metrics.cpuUsage,
          activeConnections: metrics.activeConnections,
          databaseConnections: metrics.databaseConnections,
          requestCount: metrics.requestCount,
          errorCount: metrics.errorCount,
          responseTime: metrics.responseTime
        }
      });
    } catch (error) {
      logger.error('保存监控指标失败', error);
    }
  }

  // 获取健康状态
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: SystemMetrics;
    issues: string[];
  }> {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0,
      databaseConnections: 0,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      responseTime: {
        avg: this.getAverageResponseTime(),
        max: this.maxResponseTime,
        min: this.minResponseTime === Number.MAX_SAFE_INTEGER ? 0 : this.minResponseTime
      }
    };

    const issues: string[] = [];

    // 检查内存使用
    const memoryUsageMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 1024) { // 超过1GB
      issues.push(`内存使用过高: ${memoryUsageMB.toFixed(2)}MB`);
    }

    // 检查CPU使用
    if (metrics.cpuUsage.user > 80) {
      issues.push(`CPU使用过高: ${metrics.cpuUsage.user.toFixed(2)}%`);
    }

    // 检查错误率
    const errorRate = this.getErrorRate();
    if (errorRate > 10) { // 错误率超过10%
      issues.push(`错误率过高: ${errorRate.toFixed(2)}%`);
    }

    // 检查数据库连接
    try {
      await prisma.$queryRaw`SELECT 1 as health`;
    } catch (error) {
      issues.push('数据库连接异常');
    }

    // 确定健康状态
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 2) {
      status = 'unhealthy';
    } else if (issues.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      metrics,
      issues
    };
  }

  // 获取最近指标
  getRecentMetrics(minutes: number = 5): RequestMetrics[] {
    const since = new Date(Date.now() - minutes * 60000);
    return this.requestMetrics.filter(metric => metric.timestamp > since);
  }
}

export const systemMonitor = SystemMonitor.getInstance();
export default systemMonitor;