/**
 * 监控中心 - 统一管理所有监控功能
 * 系统的大脑，协调各个监控组件
 */

import { EventEmitter } from 'events';
import { monitoringConfig } from '../config/monitoring-config';
import { MetricsCollector } from './metrics-collector';
import { HealthChecker } from './health-checker';
import { AlertManager } from './alert-manager';
import { BusinessMetricsCollector } from '../business/business-metrics';
import { SystemMetricsCollector } from '../system/system-metrics';
import { logger } from '../../shared/utils/logger';

export interface MonitoringStatus {
  startTime: Date;
  uptime: number;
  version: string;
  environment: string;
  components: {
    metrics: boolean;
    health: boolean;
    alerts: boolean;
    business: boolean;
    system: boolean;
  };
  stats: {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    activeAlerts: number;
  };
}

/**
 * 监控中心主类
 */
export class MonitoringCenter extends EventEmitter {
  private config = monitoringConfig;
  private startTime = new Date();

  // 核心组件
  private metricsCollector: MetricsCollector;
  private healthChecker: HealthChecker;
  private alertManager: AlertManager;
  private businessMetrics: BusinessMetricsCollector;
  private systemMetrics: SystemMetricsCollector;

  // 状态管理
  private isInitialized = false;
  private isShuttingDown = false;

  constructor() {
    super();

    // 初始化核心组件
    this.metricsCollector = new MetricsCollector(this.config);
    this.healthChecker = new HealthChecker(this.config);
    this.alertManager = new AlertManager(this.config);
    this.businessMetrics = new BusinessMetricsCollector(this.config);
    this.systemMetrics = new SystemMetricsCollector(this.config);

    // 组件间事件绑定
    this.setupEventBindings();
  }

  /**
   * 初始化监控系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('监控系统已经初始化');
      return;
    }

    try {
      logger.info('正在初始化监控系统...');

      // 按顺序初始化各个组件
      await this.metricsCollector.initialize();
      await this.systemMetrics.initialize();
      await this.businessMetrics.initialize();
      await this.healthChecker.initialize();
      await this.alertManager.initialize();

      this.isInitialized = true;

      // 发出初始化完成事件
      this.emit('initialized', {
        timestamp: new Date(),
        environment: this.config.environment,
        components: this.getComponentStatus()
      });

      logger.info('监控系统初始化完成', {
        environment: this.config.environment,
        components: this.getComponentStatus()
      });

    } catch (error) {
      logger.error('监控系统初始化失败', error);
      throw error;
    }
  }

  /**
   * 启动监控
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info('正在启动监控系统...');

      // 启动各个组件
      await this.metricsCollector.start();
      await this.systemMetrics.start();
      await this.businessMetrics.start();
      await this.healthChecker.start();
      await this.alertManager.start();

      // 注册优雅关闭处理
      this.setupGracefulShutdown();

      logger.info('监控系统启动成功');

    } catch (error) {
      logger.error('监控系统启动失败', error);
      throw error;
    }
  }

  /**
   * 停止监控
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      logger.info('正在停止监控系统...');

      // 按相反顺序停止组件
      await this.alertManager.stop();
      await this.healthChecker.stop();
      await this.businessMetrics.stop();
      await this.systemMetrics.stop();
      await this.metricsCollector.stop();

      logger.info('监控系统已停止');

    } catch (error) {
      logger.error('停止监控系统时出错', error);
    }
  }

  /**
   * 获取监控状态
   */
  getStatus(): MonitoringStatus {
    const metricsStats = this.metricsCollector.getStats();
    const alertStats = this.alertManager.getStats();

    return {
      startTime: this.startTime,
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: this.config.environment,
      components: this.getComponentStatus(),
      stats: {
        totalRequests: metricsStats.totalRequests,
        totalErrors: metricsStats.totalErrors,
        averageResponseTime: metricsStats.averageResponseTime,
        activeAlerts: alertStats.activeAlerts
      }
    };
  }

  /**
   * 获取综合监控报告
   */
  async getMonitoringReport(): Promise<any> {
    const [
      metricsReport,
      healthReport,
      businessReport,
      systemReport,
      alertReport
    ] = await Promise.all([
      this.metricsCollector.getReport(),
      this.healthChecker.getReport(),
      this.businessMetrics.getReport(),
      this.systemMetrics.getReport(),
      this.alertManager.getReport()
    ]);

    return {
      timestamp: new Date(),
      status: this.getStatus(),
      performance: metricsReport,
      health: healthReport,
      business: businessReport,
      system: systemReport,
      alerts: alertReport,
      recommendations: this.generateRecommendations(metricsReport, healthReport, systemReport)
    };
  }

  /**
   * 手动记录指标
   */
  recordMetric(type: string, name: string, value: number, tags?: Record<string, string>): void {
    this.metricsCollector.record(type, name, value, tags);
  }

  /**
   * 手动触发告警
   */
  triggerAlert(type: string, severity: string, message: string, data?: any): void {
    this.alertManager.trigger(type, severity, message, data);
  }

  /**
   * 获取特定组件
   */
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  getAlertManager(): AlertManager {
    return this.alertManager;
  }

  getBusinessMetrics(): BusinessMetricsCollector {
    return this.businessMetrics;
  }

  getSystemMetrics(): SystemMetricsCollector {
    return this.systemMetrics;
  }

  // 私有方法

  /**
   * 设置组件间事件绑定
   */
  private setupEventBindings(): void {
    // 性能指标事件
    this.metricsCollector.on('alert', (alert) => {
      this.alertManager.handleAlert(alert);
    });

    // 健康检查事件
    this.healthChecker.on('unhealthy', (check) => {
      this.alertManager.handleAlert({
        type: 'health',
        severity: 'high',
        message: `健康检查失败: ${check.name}`,
        data: check
      });
    });

    // 系统指标事件
    this.systemMetrics.on('threshold', (alert) => {
      this.alertManager.handleAlert(alert);
    });

    // 业务指标事件
    this.businessMetrics.on('anomaly', (alert) => {
      this.alertManager.handleAlert(alert);
    });

    // 告警管理器事件
    this.alertManager.on('escalated', (alert) => {
      this.emit('alert-escalated', alert);
    });
  }

  /**
   * 获取组件状态
   */
  private getComponentStatus() {
    return {
      metrics: this.metricsCollector.isRunning(),
      health: this.healthChecker.isRunning(),
      alerts: this.alertManager.isRunning(),
      business: this.businessMetrics.isRunning(),
      system: this.systemMetrics.isRunning()
    };
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`收到 ${signal} 信号，正在优雅关闭监控系统...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('优雅关闭失败', error);
        process.exit(1);
      }
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * 生成监控建议
   */
  private generateRecommendations(
    metricsReport: any,
    healthReport: any,
    systemReport: any
  ): string[] {
    const recommendations: string[] = [];

    // 性能建议
    if (metricsReport.averageResponseTime > this.config.performance.thresholds.slow) {
      recommendations.push('平均响应时间偏高，建议优化数据库查询和API逻辑');
    }

    if (metricsReport.errorRate > 5) {
      recommendations.push('错误率偏高，需要检查和修复常见错误');
    }

    // 健康检查建议
    const unhealthyChecks = healthReport.checks?.filter((c: any) => c.status !== 'healthy');
    if (unhealthyChecks?.length > 0) {
      recommendations.push(`${unhealthyChecks.length}个健康检查失败，需要立即检查相关服务`);
    }

    // 系统建议
    if (systemReport.cpu?.usage > this.config.system.cpu.warning) {
      recommendations.push('CPU使用率偏高，检查是否有异常进程');
    }

    if (systemReport.memory?.usage > this.config.system.memory.warning) {
      recommendations.push('内存使用率偏高，检查是否存在内存泄漏');
    }

    if (systemReport.disk?.usage > this.config.system.disk.warning) {
      recommendations.push('磁盘空间不足，需要清理日志文件或扩容');
    }

    return recommendations;
  }
}

// 创建并导出单例
const monitoringCenter = new MonitoringCenter();
export default monitoringCenter;