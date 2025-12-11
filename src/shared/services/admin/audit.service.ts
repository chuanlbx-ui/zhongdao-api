import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { Request } from 'express';

const prisma = new PrismaClient();

// 审计日志类型
export enum AuditLogType {
  LOGIN = 'LOGIN',                    // 登录
  LOGOUT = 'LOGOUT',                  // 登出
  CREATE = 'CREATE',                  // 创建
  UPDATE = 'UPDATE',                  // 更新
  DELETE = 'DELETE',                  // 删除
  VIEW = 'VIEW',                      // 查看
  EXPORT = 'EXPORT',                  // 导出
  APPROVE = 'APPROVE',                // 审批
  REJECT = 'REJECT',                  // 拒绝
  SUSPEND = 'SUSPEND',                // 停用
  ACTIVATE = 'ACTIVATE',              // 激活
  RESET_PASSWORD = 'RESET_PASSWORD',  // 重置密码
  CHANGE_ROLE = 'CHANGE_ROLE',        // 更改角色
  SENSITIVE_OPERATION = 'SENSITIVE_OPERATION', // 敏感操作
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',    // 系统配置
  DATA_IMPORT = 'DATA_IMPORT',        // 数据导入
  BULK_OPERATION = 'BULK_OPERATION',  // 批量操作
}

// 审计日志级别
export enum AuditLogLevel {
  INFO = 'INFO',          // 普通信息
  WARNING = 'WARNING',    // 警告
  ERROR = 'ERROR',        // 错误
  CRITICAL = 'CRITICAL',  // 严重
}

// 审计日志接口
export interface AuditLogData {
  adminId: string;
  adminName?: string;
  type: AuditLogType;
  level: AuditLogLevel;
  module: string;          // 模块名称（如：user, order, product）
  action: string;          // 具体操作（如：create_user, update_product）
  targetId?: string;       // 操作目标ID
  targetType?: string;     // 操作目标类型
  description?: string;    // 操作描述
  details?: any;           // 详细信息（JSON格式）
  ipAddress?: string;      // IP地址
  userAgent?: string;      // 用户代理
  result?: 'SUCCESS' | 'FAILED';  // 操作结果
  errorMessage?: string;   // 错误信息
  duration?: number;       // 操作耗时（毫秒）
}

// 审计日志服务
export class AuditService {
  /**
   * 记录审计日志
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      const auditLog = await prisma.auditLogs.create({
        data: {
          id: this.generateLogId(),
          adminId: data.adminId,
          adminName: data.adminName,
          type: data.type,
          level: data.level,
          module: data.module,
          action: data.action,
          targetId: data.targetId,
          targetType: data.targetType,
          description: data.description,
          details: data.details ? JSON.stringify(data.details) : null,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          result: data.result || 'SUCCESS',
          errorMessage: data.errorMessage,
          duration: data.duration,
          createdAt: new Date(),
        }
      });

      // 记录到系统日志
      this.logToSystem(auditLog);

      // 检查是否需要实时告警
      await this.checkAlerts(auditLog);
    } catch (error) {
      logger.error('记录审计日志失败', {
        error: error instanceof Error ? error.message : '未知错误',
        data
      });
      // 审计日志记录失败不应该影响主业务流程
    }
  }

  /**
   * 从请求上下文记录审计日志
   */
  static async logFromRequest(
    req: Request,
    type: AuditLogType,
    module: string,
    action: string,
    options: Partial<AuditLogData> = {}
  ): Promise<void> {
    const startTime = Date.now();

    // 设置响应结束后的日志记录
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;

      // 异步记录审计日志
      AuditService.log({
        adminId: req.user?.id || 'anonymous',
        adminName: req.user?.nickname || req.user?.username,
        type,
        level: type === AuditLogLevel.ERROR || type === AuditLogLevel.CRITICAL
          ? AuditLogLevel.ERROR
          : AuditLogLevel.INFO,
        module,
        action,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        duration,
        result: res.statusCode < 400 ? 'SUCCESS' : 'FAILED',
        ...options
      }).catch(error => {
        logger.error('异步记录审计日志失败', { error });
      });

      originalSend.call(this, data);
    };
  }

  /**
   * 批量记录审计日志
   */
  static async logBatch(logs: AuditLogData[]): Promise<void> {
    try {
      const auditLogs = logs.map(log => ({
        id: this.generateLogId(),
        adminId: log.adminId,
        adminName: log.adminName,
        type: log.type,
        level: log.level,
        module: log.module,
        action: log.action,
        targetId: log.targetId,
        targetType: log.targetType,
        description: log.description,
        details: log.details ? JSON.stringify(log.details) : null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        result: log.result || 'SUCCESS',
        errorMessage: log.errorMessage,
        duration: log.duration,
        createdAt: new Date(),
      }));

      await prisma.auditLogs.createMany({
        data: auditLogs
      });

      // 记录到系统日志
      logger.info(`批量记录了 ${logs.length} 条审计日志`, {
        count: logs.length,
        adminId: logs[0]?.adminId
      });
    } catch (error) {
      logger.error('批量记录审计日志失败', {
        error: error instanceof Error ? error.message : '未知错误',
        count: logs.length
      });
    }
  }

  /**
   * 查询审计日志
   */
  static async queryLogs(options: {
    adminId?: string;
    module?: string;
    type?: AuditLogType;
    level?: AuditLogLevel;
    startDate?: Date;
    endDate?: Date;
    targetId?: string;
    targetType?: string;
    keyword?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      adminId,
      module,
      type,
      level,
      startDate,
      endDate,
      targetId,
      targetType,
      keyword,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const where: any = {};

    if (adminId) where.adminId = adminId;
    if (module) where.module = module;
    if (type) where.type = type;
    if (level) where.level = level;
    if (targetId) where.targetId = targetId;
    if (targetType) where.targetType = targetType;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (keyword) {
      where.OR = [
        { action: { contains: keyword } },
        { description: { contains: keyword } },
        { adminName: { contains: keyword } }
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLogs.count({ where }),
      prisma.auditLogs.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          adminId: true,
          adminName: true,
          type: true,
          level: true,
          module: true,
          action: true,
          targetId: true,
          targetType: true,
          description: true,
          details: true,
          ipAddress: true,
          userAgent: true,
          result: true,
          errorMessage: true,
          duration: true,
          createdAt: true,
        }
      })
    ]);

    // 解析details字段
    const formattedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs: formattedLogs,
    };
  }

  /**
   * 获取审计日志统计
   */
  static async getStatistics(options: {
    adminId?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const { adminId, startDate, endDate, groupBy = 'day' } = options;

    const where: any = {};
    if (adminId) where.adminId = adminId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // 按类型统计
    const typeStats = await prisma.auditLogs.groupBy({
      by: ['type'],
      where,
      _count: {
        id: true
      }
    });

    // 按模块统计
    const moduleStats = await prisma.auditLogs.groupBy({
      by: ['module'],
      where,
      _count: {
        id: true
      }
    });

    // 按级别统计
    const levelStats = await prisma.auditLogs.groupBy({
      by: ['level'],
      where,
      _count: {
        id: true
      }
    });

    // 按时间统计
    let timeStats: any[] = [];
    if (groupBy) {
      const dateFormat = {
        day: '%Y-%m-%d',
        week: '%Y-%u',
        month: '%Y-%m'
      }[groupBy];

      timeStats = await prisma.$queryRaw`
        SELECT DATE_FORMAT(createdAt, ${dateFormat}) as timeGroup,
               COUNT(*) as count
        FROM auditLogs
        WHERE ${adminId ? prisma.$queryRaw`adminId = ${adminId}` : prisma.$queryRaw`1=1`}
          ${startDate ? prisma.$queryRaw`AND createdAt >= ${startDate}` : ``}
          ${endDate ? prisma.$queryRaw`AND createdAt <= ${endDate}` : ``}
        GROUP BY timeGroup
        ORDER BY timeGroup DESC
        LIMIT 30
      `;
    }

    return {
      typeStats: typeStats.map(stat => ({
        type: stat.type,
        count: stat._count.id
      })),
      moduleStats: moduleStats.map(stat => ({
        module: stat.module,
        count: stat._count.id
      })),
      levelStats: levelStats.map(stat => ({
        level: stat.level,
        count: stat._count.id
      })),
      timeStats,
    };
  }

  /**
   * 导出审计日志
   */
  static async exportLogs(options: {
    format?: 'csv' | 'excel' | 'json';
    filters?: any;
  }): Promise<Buffer> {
    // 实现导出逻辑
    // 这里可以使用csv-writer、xlsx等库
    throw new Error('导出功能待实现');
  }

  /**
   * 清理过期审计日志
   */
  static async cleanupExpiredLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.auditLogs.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          level: {
            not: AuditLogLevel.CRITICAL // 保留严重级别的日志
          }
        }
      });

      logger.info(`清理了 ${result.count} 条过期审计日志`, {
        cutoffDate,
        retentionDays
      });

      return result.count;
    } catch (error) {
      logger.error('清理过期审计日志失败', {
        error: error instanceof Error ? error.message : '未知错误',
        retentionDays
      });
      throw error;
    }
  }

  /**
   * 生成日志ID
   */
  private static generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 记录到系统日志
   */
  private static logToSystem(auditLog: any): void {
    const logLevel = {
      [AuditLogLevel.INFO]: 'info',
      [AuditLogLevel.WARNING]: 'warn',
      [AuditLogLevel.ERROR]: 'error',
      [AuditLogLevel.CRITICAL]: 'error',
    }[auditLog.level] || 'info';

    logger[logLevel]('审计日志', {
      id: auditLog.id,
      adminId: auditLog.adminId,
      adminName: auditLog.adminName,
      type: auditLog.type,
      module: auditLog.module,
      action: auditLog.action,
      targetId: auditLog.targetId,
      result: auditLog.result,
      duration: auditLog.duration,
    });
  }

  /**
   * 检查是否需要实时告警
   */
  private static async checkAlerts(auditLog: any): Promise<void> {
    // 检查严重级别的操作
    if (auditLog.level === AuditLogLevel.CRITICAL) {
      // 发送实时告警
      await this.sendAlert({
        type: 'CRITICAL_OPERATION',
        message: `检测到严重操作：${auditLog.action}`,
        data: auditLog
      });
    }

    // 检查敏感操作
    const sensitiveActions = [
      'delete_user',
      'bulk_delete',
      'system_config_change',
      'role_change',
      'password_reset'
    ];

    if (sensitiveActions.includes(auditLog.action)) {
      await this.sendAlert({
        type: 'SENSITIVE_OPERATION',
        message: `检测到敏感操作：${auditLog.action}`,
        data: auditLog
      });
    }

    // 检查异常模式
    await this.checkAbnormalPatterns(auditLog);
  }

  /**
   * 发送告警
   */
  private static async sendAlert(alert: {
    type: string;
    message: string;
    data: any;
  }): Promise<void> {
    // 实现告警发送逻辑
    // 可以通过邮件、短信、钉钉、企业微信等方式发送
    logger.warn('审计告警', alert);
  }

  /**
   * 检查异常模式
   */
  private static async checkAbnormalPatterns(auditLog: any): Promise<void> {
    // 检查短时间内的批量操作
    const recentLogs = await prisma.auditLogs.count({
      where: {
        adminId: auditLog.adminId,
        action: auditLog.action,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // 最近5分钟
        }
      }
    });

    if (recentLogs > 10) {
      await this.sendAlert({
        type: 'ABNORMAL_PATTERN',
        message: `检测到异常批量操作：${auditLog.action} 在5分钟内执行了 ${recentLogs} 次`,
        data: auditLog
      });
    }
  }
}

// 创建审计日志中间件
export const auditMiddleware = (type: AuditLogType, module: string, action: string) => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // 保存原始的send方法
    const originalSend = res.send;

    // 重写send方法以记录审计日志
    res.send = function(data: any) {
      const duration = Date.now() - startTime;

      // 异步记录审计日志
      AuditService.log({
        adminId: req.user?.id,
        adminName: req.user?.nickname || req.user?.username,
        type,
        level: res.statusCode >= 400 ? AuditLogLevel.ERROR : AuditLogLevel.INFO,
        module,
        action,
        targetId: req.params.id || req.body.id,
        targetType: module,
        description: `${action} ${module}`,
        details: {
          method: req.method,
          url: req.originalUrl,
          params: req.params,
          query: req.query,
          // 不记录敏感信息
          body: sanitizeRequestBody(req.body),
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        result: res.statusCode < 400 ? 'SUCCESS' : 'FAILED',
        duration,
      }).catch(error => {
        logger.error('审计中间件记录失败', { error });
      });

      // 调用原始send方法
      return originalSend.call(this, data);
    };

    next();
  };
};

// 清理请求体中的敏感信息
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'oldPassword',
    'newPassword',
    'confirmPassword',
    'token',
    'secret',
    'key',
    'authorization',
    'access_token',
    'refresh_token'
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}