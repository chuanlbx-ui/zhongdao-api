/**
 * 告警管理器 - 统一管理所有告警
 * 支持多种告警渠道、抑制、升级等功能
 */

import { EventEmitter } from 'events';
import { monitoringConfig, MonitoringConfig } from '../config/monitoring-config';
import { logger } from '../../shared/utils/logger';
import nodemailer from 'nodemailer';

// 告警接口定义
export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  escalationLevel: number;
  tags?: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  window: number; // 时间窗口（秒）
  message: string;
  channels: string[];
  suppressWindow?: number; // 抑制窗口（秒）
  escalation?: {
    enabled: boolean;
    delay: number; // 延迟升级（秒）
    levels: Array<{
      severity: string;
      channels: string[];
    }>;
  };
}

export interface NotificationChannel {
  name: string;
  type: 'email' | 'sms' | 'webhook' | 'console';
  enabled: boolean;
  config: any;
}

/**
 * 告警管理器类
 */
export class AlertManager extends EventEmitter {
  private config: MonitoringConfig;
  private isRunning = false;
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private suppressionMap: Map<string, Date> = new Map();
  private emailTransporter?: nodemailer.Transporter;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.initializeDefaultRules();
  }

  /**
   * 初始化告警管理器
   */
  async initialize(): Promise<void> {
    logger.info('初始化告警管理器...');

    // 初始化邮件传输器
    if (this.config.alerts.channels.email.enabled) {
      await this.initializeEmailTransporter();
    }
  }

  /**
   * 启动告警管理器
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // 定期清理过期的抑制
    setInterval(() => {
      this.cleanupSuppressions();
    }, 60000); // 每分钟清理一次

    logger.info('告警管理器已启动');
  }

  /**
   * 停止告警管理器
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('告警管理器已停止');
  }

  /**
   * 处理告警
   */
  async handleAlert(alertData: Partial<Alert>): Promise<void> {
    try {
      // 检查抑制
      if (this.isSuppressed(alertData.type || '')) {
        logger.debug('告警被抑制', { type: alertData.type });
        return;
      }

      // 创建告警
      const alert: Alert = {
        id: this.generateAlertId(),
        type: alertData.type || 'unknown',
        severity: alertData.severity || 'medium',
        title: alertData.title || `${alertData.type}告警`,
        message: alertData.message || '检测到异常',
        data: alertData.data,
        timestamp: new Date(),
        resolved: false,
        acknowledged: false,
        escalationLevel: 0,
        tags: alertData.tags
      };

      // 检查是否已存在类似的活跃告警
      const existingAlert = this.findSimilarAlert(alert);
      if (existingAlert) {
        logger.debug('发现相似告警，更新现有告警', {
          existingId: existingAlert.id,
          newId: alert.id
        });
        this.updateExistingAlert(existingAlert, alert);
        return;
      }

      // 存储告警
      this.alerts.set(alert.id, alert);

      // 记录日志
      this.logAlert(alert);

      // 发送通知
      await this.sendNotifications(alert);

      // 设置抑制
      if (this.config.alerts.suppression.enabled) {
        this.setSuppression(alert);
      }

      // 设置升级定时器
      if (this.config.alerts.escalation.enabled) {
        this.scheduleEscalation(alert);
      }

      // 发出事件
      this.emit('alert', alert);

    } catch (error) {
      logger.error('处理告警失败', error);
    }
  }

  /**
   * 手动触发告警
   */
  async trigger(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    data?: any
  ): Promise<void> {
    await this.handleAlert({
      type,
      severity,
      title: `${type}告警`,
      message,
      data
    });
  }

  /**
   * 确认告警
   */
  async acknowledge(alertId: string, userId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.acknowledged) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    logger.info('告警已确认', { alertId, userId });
    this.emit('acknowledged', alert);

    return true;
  }

  /**
   * 解决告警
   */
  async resolve(alertId: string, userId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = userId;

    // 取消升级定时器
    this.cancelEscalation(alert);

    logger.info('告警已解决', { alertId, userId });
    this.emit('resolved', alert);

    return true;
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        // 按严重程度和时间排序
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aSeverity = severityOrder[a.severity];
        const bSeverity = severityOrder[b.severity];

        if (aSeverity !== bSeverity) {
          return bSeverity - aSeverity;
        }

        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  /**
   * 获取告警统计
   */
  getStats(): {
    total: number;
    active: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    activeAlerts: number;
  } {
    const all = Array.from(this.alerts.values());
    const active = all.filter(a => !a.resolved);

    return {
      total: all.length,
      active: active.length,
      critical: active.filter(a => a.severity === 'critical').length,
      high: active.filter(a => a.severity === 'high').length,
      medium: active.filter(a => a.severity === 'medium').length,
      low: active.filter(a => a.severity === 'low').length,
      activeAlerts: active.length
    };
  }

  /**
   * 获取告警报告
   */
  async getReport(): Promise<any> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const allAlerts = Array.from(this.alerts.values());
    const activeAlerts = allAlerts.filter(a => !a.resolved);
    const last24hAlerts = allAlerts.filter(a => a.timestamp > last24h);
    const last7dAlerts = allAlerts.filter(a => a.timestamp > last7d);

    // 按类型统计
    const alertsByType: Record<string, number> = {};
    last24hAlerts.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    });

    // 按严重程度统计
    const alertsBySeverity = {
      critical: last24hAlerts.filter(a => a.severity === 'critical').length,
      high: last24hAlerts.filter(a => a.severity === 'high').length,
      medium: last24hAlerts.filter(a => a.severity === 'medium').length,
      low: last24hAlerts.filter(a => a.severity === 'low').length
    };

    return {
      timestamp: now,
      summary: {
        total: allAlerts.length,
        active: activeAlerts.length,
        last24h: last24hAlerts.length,
        last7d: last7dAlerts.length
      },
      activeAlerts: activeAlerts.slice(0, 20), // 只返回前20个
      distribution: {
        byType: alertsByType,
        bySeverity: alertsBySeverity
      },
      topAlerts: this.getTopAlertTypes(last24hAlerts),
      trends: this.calculateAlertTrends(last7dAlerts)
    };
  }

  // 私有方法

  /**
   * 初始化邮件传输器
   */
  private async initializeEmailTransporter(): Promise<void> {
    // 这里应该从配置中读取邮件服务器配置
    // 暂时使用测试配置
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'test@example.com',
        pass: process.env.SMTP_PASS || 'password'
      }
    });

    // 验证连接
    try {
      await this.emailTransporter.verify();
      logger.info('邮件传输器初始化成功');
    } catch (error) {
      logger.error('邮件传输器初始化失败', error);
      this.emailTransporter = undefined;
    }
  }

  /**
   * 发送通知
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    const channels = this.getChannelsForAlert(alert);

    const notificationPromises = channels.map(channel => {
      return this.sendNotification(channel, alert);
    });

    await Promise.allSettled(notificationPromises);
  }

  /**
   * 获取告警对应的通知渠道
   */
  private getChannelsForAlert(alert: Alert): string[] {
    const channels: string[] = [];

    if (this.config.alerts.channels.console.enabled) {
      channels.push('console');
    }

    if (this.config.alerts.channels.email.enabled &&
        ['high', 'critical'].includes(alert.severity)) {
      channels.push('email');
    }

    if (this.config.alerts.channels.sms.enabled &&
        alert.severity === 'critical') {
      channels.push('sms');
    }

    if (this.config.alerts.channels.webhook.enabled &&
        ['high', 'critical'].includes(alert.severity)) {
      channels.push('webhook');
    }

    return channels;
  }

  /**
   * 发送单个通知
   */
  private async sendNotification(channel: string, alert: Alert): Promise<void> {
    try {
      switch (channel) {
        case 'console':
          this.sendConsoleNotification(alert);
          break;

        case 'email':
          await this.sendEmailNotification(alert);
          break;

        case 'sms':
          await this.sendSMSNotification(alert);
          break;

        case 'webhook':
          await this.sendWebhookNotification(alert);
          break;

        default:
          logger.warn('未知的通知渠道', { channel });
      }
    } catch (error) {
      logger.error(`发送${channel}通知失败`, error);
    }
  }

  /**
   * 控制台通知
   */
  private sendConsoleNotification(alert: Alert): void {
    const level = alert.severity.toUpperCase();
    const message = `[ALERT] ${level}: ${alert.title} - ${alert.message}`;

    switch (alert.severity) {
      case 'critical':
        logger.error(message, alert);
        break;
      case 'high':
        logger.error(message, alert);
        break;
      case 'medium':
        logger.warn(message, alert);
        break;
      case 'low':
        logger.info(message, alert);
        break;
    }
  }

  /**
   * 邮件通知
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    if (!this.emailTransporter) return;

    const recipients = this.config.alerts.channels.email.recipients;
    if (recipients.length === 0) return;

    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const html = this.generateEmailHTML(alert);

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'monitoring@zhongdao.com',
      to: recipients.join(', '),
      subject,
      html
    });

    logger.info('邮件通知已发送', { alertId: alert.id, recipients: recipients.length });
  }

  /**
   * 短信通知
   */
  private async sendSMSNotification(alert: Alert): Promise<void> {
    const recipients = this.config.alerts.channels.sms.recipients;
    if (recipients.length === 0) return;

    // 这里应该集成实际的短信服务
    logger.info('短信通知已模拟发送', {
      alertId: alert.id,
      recipients: recipients.length,
      message: `[${alert.severity.toUpperCase()}] ${alert.title}`
    });
  }

  /**
   * Webhook通知
   */
  private async sendWebhookNotification(alert: Alert): Promise<void> {
    const urls = this.config.alerts.channels.webhook.urls;
    if (urls.length === 0) return;

    const payload = {
      alert,
      timestamp: new Date().toISOString()
    };

    const promises = urls.map(url => {
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        logger.error('Webhook通知发送失败', { url, error });
      });
    });

    await Promise.allSettled(promises);
    logger.info('Webhook通知已发送', { alertId: alert.id, urls: urls.length });
  }

  /**
   * 生成邮件HTML
   */
  private generateEmailHTML(alert: Alert): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .alert { border-left: 4px solid; padding: 20px; background: #f9f9f9; }
          .critical { border-color: #dc3545; }
          .high { border-color: #fd7e14; }
          .medium { border-color: #ffc107; }
          .low { border-color: #28a745; }
          .title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
          .message { margin-bottom: 15px; }
          .details { background: #fff; padding: 15px; border-radius: 4px; }
          .timestamp { color: #666; font-size: 12px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="alert ${alert.severity}">
          <div class="title">${alert.title}</div>
          <div class="message">${alert.message}</div>
          <div class="details">
            <strong>类型:</strong> ${alert.type}<br>
            <strong>严重程度:</strong> ${alert.severity}<br>
            <strong>时间:</strong> ${alert.timestamp.toLocaleString('zh-CN')}
          </div>
          <div class="timestamp">告警ID: ${alert.id}</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 初始化默认规则
   */
  private initializeDefaultRules(): void {
    // 基础告警规则
    const defaultRules: AlertRule[] = [
      {
        id: 'high_cpu_usage',
        name: 'CPU使用率过高',
        enabled: this.config.alerts.rules.system.cpu,
        condition: 'cpu_usage > 80',
        severity: 'high',
        threshold: 80,
        window: 300,
        message: 'CPU使用率超过80%',
        channels: ['console', 'email']
      },
      {
        id: 'high_memory_usage',
        name: '内存使用率过高',
        enabled: this.config.alerts.rules.system.memory,
        condition: 'memory_usage > 85',
        severity: 'high',
        threshold: 85,
        window: 300,
        message: '内存使用率超过85%',
        channels: ['console', 'email']
      },
      {
        id: 'disk_space_low',
        name: '磁盘空间不足',
        enabled: this.config.alerts.rules.system.disk,
        condition: 'disk_usage > 90',
        severity: 'critical',
        threshold: 90,
        window: 300,
        message: '磁盘使用率超过90%',
        channels: ['console', 'email', 'sms']
      },
      {
        id: 'high_error_rate',
        name: '错误率过高',
        enabled: this.config.alerts.rules.performance.errorRate,
        condition: 'error_rate > 5',
        severity: 'high',
        threshold: 5,
        window: 300,
        message: 'API错误率超过5%',
        channels: ['console', 'email']
      },
      {
        id: 'slow_response',
        name: '响应时间过慢',
        enabled: this.config.alerts.rules.performance.responseTime,
        condition: 'response_time > 2000',
        severity: 'medium',
        threshold: 2000,
        window: 300,
        message: 'API响应时间超过2秒',
        channels: ['console']
      }
    ];

    defaultRules.forEach(rule => {
      if (rule.enabled) {
        this.alertRules.set(rule.id, rule);
      }
    });
  }

  /**
   * 生成告警ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 查找相似告警
   */
  private findSimilarAlert(newAlert: Alert): Alert | null {
    for (const alert of this.alerts.values()) {
      if (alert.type === newAlert.type &&
          alert.severity === newAlert.severity &&
          !alert.resolved) {
        const timeDiff = newAlert.timestamp.getTime() - alert.timestamp.getTime();
        if (timeDiff < 300000) { // 5分钟内
          return alert;
        }
      }
    }
    return null;
  }

  /**
   * 更新现有告警
   */
  private updateExistingAlert(existing: Alert, update: Alert): void {
    existing.timestamp = update.timestamp;
    existing.data = update.data;
    if (update.message) {
      existing.message = update.message;
    }
  }

  /**
   * 记录告警日志
   */
  private logAlert(alert: Alert): void {
    const logData = {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data
    };

    switch (alert.severity) {
      case 'critical':
        logger.error('CRITICAL告警', logData);
        break;
      case 'high':
        logger.error('HIGH告警', logData);
        break;
      case 'medium':
        logger.warn('MEDIUM告警', logData);
        break;
      case 'low':
        logger.info('LOW告警', logData);
        break;
    }
  }

  /**
   * 设置抑制
   */
  private setSuppression(alert: Alert): void {
    const suppressWindow = this.config.alerts.suppression.window * 60 * 1000;
    const suppressUntil = new Date(Date.now() + suppressWindow);
    this.suppressionMap.set(alert.type, suppressUntil);
  }

  /**
   * 检查是否被抑制
   */
  private isSuppressed(type: string): boolean {
    const suppressUntil = this.suppressionMap.get(type);
    if (!suppressUntil) return false;

    if (Date.now() > suppressUntil.getTime()) {
      this.suppressionMap.delete(type);
      return false;
    }

    return true;
  }

  /**
   * 清理过期的抑制
   */
  private cleanupSuppressions(): void {
    const now = Date.now();
    for (const [type, until] of this.suppressionMap.entries()) {
      if (now > until.getTime()) {
        this.suppressionMap.delete(type);
      }
    }
  }

  /**
   * 安排升级
   */
  private scheduleEscalation(alert: Alert): void {
    if (!this.config.alerts.escalation.enabled) return;

    const escalation = this.config.alerts.escalation;
    if (escalation.levels.length === 0) return;

    const delay = escalation.levels[0].delay * 60 * 1000;

    setTimeout(() => {
      this.escalateAlert(alert);
    }, delay);
  }

  /**
   * 取消升级
   */
  private cancelEscalation(alert: Alert): void {
    // 这里应该清理定时器
    // 简化实现，实际应该存储定时器ID
  }

  /**
   * 升级告警
   */
  private escalateAlert(alert: Alert): void {
    if (alert.resolved || alert.acknowledged) return;

    alert.escalationLevel++;

    this.emit('escalated', alert);
    logger.warn('告警已升级', {
      alertId: alert.id,
      level: alert.escalationLevel
    });

    // 重新发送通知
    this.sendNotifications(alert);
  }

  /**
   * 获取热门告警类型
   */
  private getTopAlertTypes(alerts: Alert[]): Array<{ type: string; count: number }> {
    const counts: Record<string, number> = {};
    alerts.forEach(alert => {
      counts[alert.type] = (counts[alert.type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * 计算告警趋势
   */
  private calculateAlertTrends(alerts: Alert[]): any {
    // 按天分组
    const daily: Record<string, number> = {};
    alerts.forEach(alert => {
      const day = alert.timestamp.toISOString().split('T')[0];
      daily[day] = (daily[day] || 0) + 1;
    });

    return {
      daily,
      trend: this.calculateTrend(Object.values(daily))
    };
  }

  /**
   * 计算趋势
   */
  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';

    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));

    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 20) return 'up';
    if (change < -20) return 'down';
    return 'stable';
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.isRunning;
  }
}