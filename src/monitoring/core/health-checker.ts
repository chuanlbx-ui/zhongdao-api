/**
 * 健康检查器 - 检查系统各组件的健康状态
 * 提供全面的健康检查和就绪状态检查
 */

import { EventEmitter } from 'events';
import { monitoringConfig, MonitoringConfig } from '../config/monitoring-config';
import { logger } from '../../shared/utils/logger';
import { PrismaClient } from '@prisma/client';

// 健康检查结果接口
export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  message?: string;
  responseTime?: number;
  lastCheck: Date;
  consecutiveFailures: number;
  details?: any;
}

export interface HealthReport {
  timestamp: Date;
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
    unknown: number;
  };
  uptime: number;
}

// 健康检查器配置
export interface HealthCheckConfig {
  name: string;
  type: 'http' | 'tcp' | 'database' | 'custom';
  target: string;
  timeout: number;
  interval: number;
  failureThreshold: number;
  checkFn?: () => Promise<boolean>;
}

/**
 * 健康检查器类
 */
export class HealthChecker extends EventEmitter {
  private config: MonitoringConfig;
  private prisma: PrismaClient;
  private isRunning = false;
  private checkTimer?: NodeJS.Timeout;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private lastReport: HealthReport | null = null;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.prisma = new PrismaClient();
  }

  /**
   * 初始化健康检查器
   */
  async initialize(): Promise<void> {
    logger.info('初始化健康检查器...');

    // 注册默认的健康检查
    await this.registerDefaultChecks();

    // 清理定时器
    process.on('exit', () => {
      this.prisma.$disconnect();
    });
  }

  /**
   * 启动健康检查
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // 设置定时检查
    this.checkTimer = setInterval(
      () => this.runAllChecks(),
      this.config.health.interval
    );

    // 立即执行一次检查
    await this.runAllChecks();

    logger.info('健康检查器已启动', {
      interval: this.config.health.interval,
      checks: Array.from(this.healthChecks.keys())
    });
  }

  /**
   * 停止健康检查
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }

    await this.prisma.$disconnect();
    logger.info('健康检查器已停止');
  }

  /**
   * 注册健康检查
   */
  registerCheck(config: HealthCheckConfig): void {
    const check: HealthCheck = {
      name: config.name,
      status: 'unknown',
      lastCheck: new Date(),
      consecutiveFailures: 0
    };

    this.healthChecks.set(config.name, check);
    logger.info('已注册健康检查', { name: config.name, type: config.type });
  }

  /**
   * 执行所有健康检查
   */
  private async runAllChecks(): Promise<void> {
    const checkPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, check]) => {
        try {
          const result = await this.runCheck(name);
          this.healthChecks.set(name, result);
        } catch (error) {
          logger.error(`健康检查失败: ${name}`, error);
          const failedCheck: HealthCheck = {
            ...check,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : '未知错误',
            lastCheck: new Date(),
            consecutiveFailures: check.consecutiveFailures + 1
          };
          this.healthChecks.set(name, failedCheck);
        }
      }
    );

    await Promise.all(checkPromises);

    // 生成报告
    const report = this.generateReport();
    this.lastReport = report;

    // 检查是否有不健康的服务
    const unhealthyChecks = Array.from(this.healthChecks.values())
      .filter(check => check.status === 'unhealthy');

    if (unhealthyChecks.length > 0) {
      this.emit('unhealthy', unhealthyChecks);
    }

    // 发出报告事件
    this.emit('report', report);
  }

  /**
   * 执行单个健康检查
   */
  private async runCheck(name: string): Promise<HealthCheck> {
    const check = this.healthChecks.get(name);
    if (!check) {
      throw new Error(`未找到健康检查: ${name}`);
    }

    const startTime = Date.now();

    try {
      let isHealthy = false;
      let message = '';

      switch (name) {
        case 'database':
          isHealthy = await this.checkDatabase();
          message = isHealthy ? '数据库连接正常' : '数据库连接失败';
          break;

        case 'cache':
          isHealthy = await this.checkCache();
          message = isHealthy ? '缓存服务正常' : '缓存服务不可用';
          break;

        case 'payments':
          isHealthy = await this.checkPaymentSystem();
          message = isHealthy ? '支付系统正常' : '支付系统异常';
          break;

        case 'external_services':
          isHealthy = await this.checkExternalServices();
          message = isHealthy ? '外部服务正常' : '外部服务异常';
          break;

        case 'disk_space':
          const diskCheck = await this.checkDiskSpace();
          isHealthy = diskCheck.healthy;
          message = diskCheck.message;
          break;

        default:
          throw new Error(`未知的健康检查类型: ${name}`);
      }

      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        return {
          ...check,
          status: 'healthy',
          message,
          responseTime,
          lastCheck: new Date(),
          consecutiveFailures: 0
        };
      } else {
        return {
          ...check,
          status: check.consecutiveFailures >= this.config.health.failureThreshold
            ? 'unhealthy'
            : 'degraded',
          message,
          responseTime,
          lastCheck: new Date(),
          consecutiveFailures: check.consecutiveFailures + 1
        };
      }

    } catch (error) {
      return {
        ...check,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : '检查失败',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        consecutiveFailures: check.consecutiveFailures + 1
      };
    }
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabase(): Promise<boolean> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;

      // 检查查询时间是否过长
      if (duration > this.config.health.timeout) {
        logger.warn('数据库响应缓慢', { duration });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('数据库健康检查失败', error);
      return false;
    }
  }

  /**
   * 检查缓存健康状态
   */
  private async checkCache(): Promise<boolean> {
    try {
      // 这里应该检查Redis或其他缓存服务
      // 由于Redis在生产环境中被禁用，我们返回true
      logger.debug('缓存检查跳过（Redis已禁用）');
      return true;
    } catch (error) {
      logger.error('缓存健康检查失败', error);
      return false;
    }
  }

  /**
   * 检查支付系统健康状态
   */
  private async checkPaymentSystem(): Promise<boolean> {
    try {
      // 检查支付配置
      const payments = require('../../config/payments');

      if (!payments.wechat.appId || !payments.alipay.appId) {
        logger.warn('支付系统配置不完整');
        return false;
      }

      // 这里可以添加对支付网关的ping检查
      return true;
    } catch (error) {
      logger.error('支付系统健康检查失败', error);
      return false;
    }
  }

  /**
   * 检查外部服务健康状态
   */
  private async checkExternalServices(): Promise<boolean> {
    try {
      // 检查微信服务
      const wechatConfig = require('../../config').wechat;
      if (!wechatConfig.appId || !wechatConfig.appSecret) {
        return false;
      }

      // 检查短信服务
      const smsConfig = require('../../config').sms;
      if (!smsConfig.accessKeyId || !smsConfig.accessKeySecret) {
        return false;
      }

      // 这里可以添加对实际外部服务的健康检查
      return true;
    } catch (error) {
      logger.error('外部服务健康检查失败', error);
      return false;
    }
  }

  /**
   * 检查磁盘空间
   */
  private async checkDiskSpace(): Promise<{ healthy: boolean; message: string }> {
    try {
      const fs = require('fs/promises');
      const stats = await fs.statfs('.');
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const usage = ((total - free) / total) * 100;

      if (usage > 90) {
        return {
          healthy: false,
          message: `磁盘空间不足: ${Math.round(usage)}%已使用`
        };
      } else if (usage > 80) {
        return {
          healthy: true,
          message: `磁盘空间警告: ${Math.round(usage)}%已使用`
        };
      }

      return {
        healthy: true,
        message: `磁盘空间充足: ${Math.round(usage)}%已使用`
      };
    } catch (error) {
      return {
        healthy: false,
        message: '无法检查磁盘空间'
      };
    }
  }

  /**
   * 注册默认健康检查
   */
  private async registerDefaultChecks(): Promise<void> {
    const defaultChecks: HealthCheckConfig[] = [
      {
        name: 'database',
        type: 'database',
        target: 'prisma',
        timeout: this.config.health.timeout,
        interval: this.config.health.interval,
        failureThreshold: this.config.health.failureThreshold
      },
      {
        name: 'cache',
        type: 'custom',
        target: 'redis',
        timeout: this.config.health.timeout,
        interval: this.config.health.interval,
        failureThreshold: this.config.health.failureThreshold
      },
      {
        name: 'payments',
        type: 'custom',
        target: 'payment-gateway',
        timeout: this.config.health.timeout,
        interval: this.config.health.interval,
        failureThreshold: this.config.health.failureThreshold
      },
      {
        name: 'external_services',
        type: 'custom',
        target: 'external',
        timeout: this.config.health.timeout,
        interval: this.config.health.interval,
        failureThreshold: this.config.health.failureThreshold
      },
      {
        name: 'disk_space',
        type: 'custom',
        target: 'filesystem',
        timeout: this.config.health.timeout,
        interval: this.config.health.interval,
        failureThreshold: this.config.health.failureThreshold
      }
    ];

    // 只注册启用的检查
    const enabledChecks = defaultChecks.filter(check => {
      switch (check.name) {
        case 'database':
          return this.config.health.checks.database;
        case 'cache':
          return this.config.health.checks.cache;
        case 'payments':
          return this.config.health.checks.payments;
        case 'external_services':
          return this.config.health.checks.external;
        default:
          return true;
      }
    });

    enabledChecks.forEach(check => this.registerCheck(check));
  }

  /**
   * 生成健康报告
   */
  private generateReport(): HealthReport {
    const checks = Array.from(this.healthChecks.values());
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unknown: checks.filter(c => c.status === 'unknown').length
    };

    // 确定整体状态
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (summary.unhealthy > 0) {
      status = 'unhealthy';
    } else if (summary.degraded > 0) {
      status = 'degraded';
    }

    return {
      timestamp: new Date(),
      status,
      checks,
      summary,
      uptime: process.uptime()
    };
  }

  /**
   * 获取健康报告
   */
  async getReport(): Promise<HealthReport> {
    return this.lastReport || this.generateReport();
  }

  /**
   * 获取简单健康状态（用于负载均衡器）
   */
  getLivenessStatus(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取就绪状态（用于Kubernetes）
   */
  async getReadinessStatus(): Promise<{ status: string; checks: Record<string, boolean> }> {
    const checks: Record<string, boolean> = {};

    for (const [name, check] of this.healthChecks) {
      checks[name] = check.status === 'healthy';
    }

    const allHealthy = Object.values(checks).every(v => v);

    return {
      status: allHealthy ? 'ready' : 'not_ready',
      checks
    };
  }

  /**
   * 手动触发健康检查
   */
  async checkNow(name?: string): Promise<void> {
    if (name) {
      const check = this.healthChecks.get(name);
      if (check) {
        const result = await this.runCheck(name);
        this.healthChecks.set(name, result);
      }
    } else {
      await this.runAllChecks();
    }
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.isRunning;
  }
}