import { logger } from '../utils/logger';
import { Request } from 'express';

// 安全事件类型
export enum SecurityEventType {
  CSRF_FAILURE = 'CSRF_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  AUTHENTICATION_FAILURE = 'AUTHENTICATION_FAILURE',
  AUTHORIZATION_FAILURE = 'AUTHORIZATION_FAILURE',
  INPUT_VALIDATION_FAILURE = 'INPUT_VALIDATION_FAILURE',
  FILE_UPLOAD_VIOLATION = 'FILE_UPLOAD_VIOLATION',
  SUSPICIOUS_REQUEST = 'SUSPICIOUS_REQUEST',
  RESOURCE_ACCESS_VIOLATION = 'RESOURCE_ACCESS_VIOLATION',
  PAYMENT_SECURITY_ALERT = 'PAYMENT_SECURITY_ALERT'
}

// 安全事件严重程度
export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 安全事件接口
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  userId?: string;
  ip: string;
  userAgent?: string;
  url: string;
  method: string;
  details: Record<string, any>;
  resolved: boolean;
}

// IP信誉检查结果
export interface IPReputation {
  ip: string;
  isMalicious: boolean;
  threatTypes: string[];
  riskScore: number;
  lastSeen: Date;
}

/**
 * 安全监控服务
 */
export class SecurityMonitoringService {
  private securityEvents: SecurityEvent[] = [];
  private ipBlacklist: Set<string> = new Set();
  private suspiciousIPs: Map<string, { count: number; lastSeen: Date; events: SecurityEventType[] }> = new Map();
  private userSecurityEvents: Map<string, SecurityEvent[]> = new Map();

  constructor() {
    // 定期清理过期数据
    setInterval(() => {
      this.cleanupExpiredData();
    }, 60 * 60 * 1000); // 每小时清理一次
  }

  /**
   * 记录安全事件
   */
  logSecurityEvent(
    type: SecurityEventType,
    severity: SecuritySeverity,
    req: Request,
    details: Record<string, any> = {}
  ): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      type,
      severity,
      timestamp: new Date(),
      userId: req.user?.id,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      url: req.url || 'unknown',
      method: req.method || 'unknown',
      details,
      resolved: false
    };

    // 存储事件
    this.securityEvents.push(event);

    // 更新IP统计
    this.updateIPStatistics(req.ip || 'unknown', type);

    // 更新用户事件统计
    if (req.user?.id) {
      this.updateUserSecurityEvents(req.user.id, event);
    }

    // 根据严重程度记录不同级别的日志
    const logMessage = `安全事件: ${type} - ${severity}`;
    const logData = {
      eventId: event.id,
      type,
      severity,
      userId: event.userId,
      ip: event.ip,
      url: event.url,
      method: event.method,
      details,
      userAgent: event.userAgent
    };

    switch (severity) {
      case SecuritySeverity.CRITICAL:
        logger.error(logMessage, logData);
        this.triggerImmediateAlert(event);
        break;
      case SecuritySeverity.HIGH:
        logger.error(logMessage, logData);
        this.triggerAlert(event);
        break;
      case SecuritySeverity.MEDIUM:
        logger.warn(logMessage, logData);
        break;
      case SecuritySeverity.LOW:
        logger.info(logMessage, logData);
        break;
    }

    // 自动采取安全措施
    this.autoSecurityResponse(event);
  }

  /**
   * 检查IP信誉
   */
  checkIPReputation(ip: string): IPReputation {
    const ipStats = this.suspiciousIPs.get(ip);

    if (!ipStats) {
      return {
        ip,
        isMalicious: false,
        threatTypes: [],
        riskScore: 0,
        lastSeen: new Date()
      };
    }

    const riskScore = this.calculateRiskScore(ipStats);
    const isMalicious = riskScore >= 80;
    const threatTypes = this.identifyThreatTypes(ipStats.events);

    return {
      ip,
      isMalicious,
      threatTypes,
      riskScore,
      lastSeen: ipStats.lastSeen
    };
  }

  /**
   * 检查用户是否需要额外的安全验证
   */
  requiresAdditionalSecurity(userId: string): boolean {
    const userEvents = this.userSecurityEvents.get(userId) || [];
    const recentEvents = userEvents.filter(
      event => Date.now() - event.timestamp.getTime() < 60 * 60 * 1000 // 最近1小时
    );

    // 如果最近有高风险或严重事件，需要额外验证
    const hasHighRiskEvents = recentEvents.some(
      event => event.severity === SecuritySeverity.HIGH || event.severity === SecuritySeverity.CRITICAL
    );

    // 如果事件数量过多，需要额外验证
    const hasTooManyEvents = recentEvents.length > 10;

    return hasHighRiskEvents || hasTooManyEvents;
  }

  /**
   * 获取安全统计信息
   */
  getSecurityStats(): {
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecuritySeverity, number>;
    blacklistedIPs: number;
    suspiciousIPs: number;
    recentEvents: SecurityEvent[];
  } {
    const eventsByType: Record<SecurityEventType, number> = {} as any;
    const eventsBySeverity: Record<SecuritySeverity, number> = {} as any;

    // 统计事件类型和严重程度
    this.securityEvents.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });

    // 获取最近的事件
    const recentEvents = this.securityEvents
      .filter(event => Date.now() - event.timestamp.getTime() < 24 * 60 * 60 * 1000) // 最近24小时
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    return {
      totalEvents: this.securityEvents.length,
      eventsByType,
      eventsBySeverity,
      blacklistedIPs: this.ipBlacklist.size,
      suspiciousIPs: this.suspiciousIPs.size,
      recentEvents
    };
  }

  /**
   * 标记事件为已解决
   */
  resolveEvent(eventId: string): boolean {
    const event = this.securityEvents.find(e => e.id === eventId);
    if (event) {
      event.resolved = true;
      logger.info('安全事件已解决', { eventId, type: event.type });
      return true;
    }
    return false;
  }

  /**
   * 将IP加入黑名单
   */
  blacklistIP(ip: string, reason: string): void {
    this.ipBlacklist.add(ip);
    logger.warn('IP已加入黑名单', { ip, reason });

    // 记录安全事件
    this.logSecurityEvent(
      SecurityEventType.SUSPICIOUS_REQUEST,
      SecuritySeverity.HIGH,
      { ip } as any,
      { action: 'ip_blacklisted', reason }
    );
  }

  /**
   * 检查IP是否在黑名单中
   */
  isIPBlacklisted(ip: string): boolean {
    return this.ipBlacklist.has(ip);
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新IP统计信息
   */
  private updateIPStatistics(ip: string, eventType: SecurityEventType): void {
    const current = this.suspiciousIPs.get(ip);

    if (current) {
      current.count++;
      current.lastSeen = new Date();
      if (!current.events.includes(eventType)) {
        current.events.push(eventType);
      }
    } else {
      this.suspiciousIPs.set(ip, {
        count: 1,
        lastSeen: new Date(),
        events: [eventType]
      });
    }
  }

  /**
   * 更新用户安全事件
   */
  private updateUserSecurityEvents(userId: string, event: SecurityEvent): void {
    const userEvents = this.userSecurityEvents.get(userId) || [];
    userEvents.push(event);

    // 只保留最近100个事件
    if (userEvents.length > 100) {
      userEvents.splice(0, userEvents.length - 100);
    }

    this.userSecurityEvents.set(userId, userEvents);
  }

  /**
   * 计算风险评分
   */
  private calculateRiskScore(ipStats: { count: number; events: SecurityEventType[] }): number {
    let score = 0;

    // 基础分数
    score += Math.min(ipStats.count * 5, 30);

    // 根据事件类型加分
    ipStats.events.forEach(eventType => {
      switch (eventType) {
        case SecurityEventType.CSRF_FAILURE:
          score += 15;
          break;
        case SecurityEventType.AUTHENTICATION_FAILURE:
          score += 10;
          break;
        case SecurityEventType.RATE_LIMIT_EXCEEDED:
          score += 8;
          break;
        case SecurityEventType.FILE_UPLOAD_VIOLATION:
          score += 20;
          break;
        case SecurityEventType.PAYMENT_SECURITY_ALERT:
          score += 25;
          break;
        default:
          score += 5;
      }
    });

    return Math.min(score, 100);
  }

  /**
   * 识别威胁类型
   */
  private identifyThreatTypes(events: SecurityEventType[]): string[] {
    const threatTypes: string[] = [];

    if (events.includes(SecurityEventType.CSRF_FAILURE)) {
      threatTypes.push('CSRF_ATTACK');
    }
    if (events.includes(SecurityEventType.AUTHENTICATION_FAILURE)) {
      threatTypes.push('BRUTE_FORCE');
    }
    if (events.includes(SecurityEventType.RATE_LIMIT_EXCEEDED)) {
      threatTypes.push('RATE_LIMIT_ABUSE');
    }
    if (events.includes(SecurityEventType.FILE_UPLOAD_VIOLATION)) {
      threatTypes.push('MALICIOUS_UPLOAD');
    }
    if (events.includes(SecurityEventType.PAYMENT_SECURITY_ALERT)) {
      threatTypes.push('PAYMENT_FRAUD');
    }

    return threatTypes;
  }

  /**
   * 自动安全响应
   */
  private autoSecurityResponse(event: SecurityEvent): void {
    const { ip, type, severity } = event;

    // 对于严重事件，自动采取防御措施
    if (severity === SecuritySeverity.CRITICAL || severity === SecuritySeverity.HIGH) {
      // 如果是IP相关的威胁，考虑加入黑名单
      const ipStats = this.suspiciousIPs.get(ip);
      if (ipStats && ipStats.count >= 5) {
        this.blacklistIP(ip, `自动响应: ${type}事件过多`);
      }
    }

    // 如果是认证失败，可以临时增加验证难度
    if (type === SecurityEventType.AUTHENTICATION_FAILURE) {
      // 这里可以触发临时验证码等机制
      logger.info('触发认证失败响应', { ip, userId: event.userId });
    }
  }

  /**
   * 触发警报
   */
  private triggerAlert(event: SecurityEvent): void {
    // 这里可以实现发送邮件、短信、Slack等通知
    logger.warn('安全警报', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      ip: event.ip,
      userId: event.userId,
      url: event.url,
      details: event.details
    });
  }

  /**
   * 触发即时警报
   */
  private triggerImmediateAlert(event: SecurityEvent): void {
    // 对于严重事件，立即通知管理员
    logger.error('严重安全警报', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      ip: event.ip,
      userId: event.userId,
      url: event.url,
      details: event.details,
      immediate: true
    });

    // 这里可以集成实时通知系统
  }

  /**
   * 清理过期数据
   */
  private cleanupExpiredData(): void {
    const now = Date.now();
    const expiryTime = 7 * 24 * 60 * 60 * 1000; // 7天

    // 清理过期的事件
    this.securityEvents = this.securityEvents.filter(
      event => now - event.timestamp.getTime() < expiryTime
    );

    // 清理过期的IP统计
    for (const [ip, stats] of this.suspiciousIPs.entries()) {
      if (now - stats.lastSeen.getTime() > expiryTime) {
        this.suspiciousIPs.delete(ip);
      }
    }

    // 清理过期的用户事件
    for (const [userId, events] of this.userSecurityEvents.entries()) {
      const filteredEvents = events.filter(
        event => now - event.timestamp.getTime() < expiryTime
      );
      if (filteredEvents.length === 0) {
        this.userSecurityEvents.delete(userId);
      } else {
        this.userSecurityEvents.set(userId, filteredEvents);
      }
    }

    logger.debug('安全监控数据清理完成');
  }
}

// 导出单例实例
export const securityMonitoringService = new SecurityMonitoringService();

/**
 * 安全监控中间件
 */
export const securityMonitoring = (req: Request, res: Response, next: Function): void => {
  // 检查IP是否在黑名单中
  if (securityMonitoringService.isIPBlacklisted(req.ip || '')) {
    logger.warn('黑名单IP访问尝试', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });

    return res.status(403).json({
      success: false,
      error: {
        code: 'IP_BLOCKED',
        message: '访问被拒绝'
      }
    });
  }

  // 检查IP信誉
  const ipReputation = securityMonitoringService.checkIPReputation(req.ip || '');
  if (ipReputation.isMalicious) {
    securityMonitoringService.logSecurityEvent(
      SecurityEventType.SUSPICIOUS_REQUEST,
      SecuritySeverity.HIGH,
      req,
      {
        reason: '恶意IP访问',
        threatTypes: ipReputation.threatTypes,
        riskScore: ipReputation.riskScore
      }
    );

    return res.status(403).json({
      success: false,
      error: {
        code: 'SUSPICIOUS_IP',
        message: '访问被拒绝'
      }
    });
  }

  // 记录正常的访问日志（可以根据需要调整频率）
  if (Math.random() < 0.01) { // 1%的采样率
    logger.debug('API访问监控', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });
  }

  next();
};