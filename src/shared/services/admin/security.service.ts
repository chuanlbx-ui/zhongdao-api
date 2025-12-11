import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { createErrorResponse, ErrorCode } from '../../types/response';
import crypto from 'crypto';

const prisma = new PrismaClient();

// 二次确认令牌存储
const confirmationTokens = new Map<string, {
  adminId: string;
  operation: string;
  data: any;
  expiresAt: number;
  ip: string;
}>();

/**
 * 管理员安全服务
 */
export class AdminSecurityService {
  /**
   * 检查IP是否在白名单中
   */
  static async isIPWhitelisted(adminId: string, ip: string): Promise<boolean> {
    try {
      // 获取管理员信息
      const admin = await prisma.admins.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          role: true,
        }
      });

      if (!admin) {
        return false;
      }

      // 获取IP白名单配置
      const ipWhitelistConfig = await prisma.systemConfigs.findUnique({
        where: { key: 'admin.ip_whitelist' },
        select: { value: true }
      });

      if (!ipWhitelistConfig) {
        // 如果没有配置IP白名单，则允许所有IP
        return true;
      }

      try {
        const ipWhitelist = JSON.parse(ipWhitelistConfig.value);

        // 如果是空数组，表示不限制IP
        if (!Array.isArray(ipWhitelist) || ipWhitelist.length === 0) {
          return true;
        }

        // 检查IP是否在白名单中
        return ipWhitelist.includes(ip) || this.isIPInRange(ip, ipWhitelist);
      } catch (error) {
        logger.error('解析IP白名单配置失败', { error });
        return true; // 解析失败时默认允许
      }
    } catch (error) {
      logger.error('检查IP白名单失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId,
        ip
      });
      return true; // 出错时默认允许
    }
  }

  /**
   * 检查IP是否在IP范围内
   */
  static isIPInRange(ip: string, ipRanges: string[]): boolean {
    for (const range of ipRanges) {
      if (range.includes('/')) {
        // CIDR格式
        if (this.isIPInCIDR(ip, range)) {
          return true;
        }
      } else if (range.includes('-')) {
        // IP范围格式（如：192.168.1.1-192.168.1.100）
        const [start, end] = range.split('-').map(s => s.trim());
        if (this.isIPInRange2(ip, start, end)) {
          return true;
        }
      } else if (range.includes('*')) {
        // 通配符格式（如：192.168.1.*）
        const pattern = range.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(ip)) {
          return true;
        }
      } else if (ip === range) {
        // 精确匹配
        return true;
      }
    }
    return false;
  }

  /**
   * 检查IP是否在CIDR范围内
   */
  static isIPInCIDR(ip: string, cidr: string): boolean {
    const [network, prefixLength] = cidr.split('/');
    const ipInt = this.ipToInt(ip);
    const networkInt = this.ipToInt(network);
    const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;

    return (ipInt & mask) === (networkInt & mask);
  }

  /**
   * 检查IP是否在范围内
   */
  static isIPInRange2(ip: string, startIP: string, endIP: string): boolean {
    const ipInt = this.ipToInt(ip);
    const startInt = this.ipToInt(startIP);
    const endInt = this.ipToInt(endIP);

    return ipInt >= startInt && ipInt <= endInt;
  }

  /**
   * IP地址转换为整数
   */
  static ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  /**
   * 生成二次确认令牌
   */
  static generateConfirmToken(
    adminId: string,
    operation: string,
    data: any,
    ip: string,
    expiresInMinutes: number = 5
  ): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000);

    confirmationTokens.set(token, {
      adminId,
      operation,
      data,
      expiresAt,
      ip
    });

    // 设置定时清理
    setTimeout(() => {
      confirmationTokens.delete(token);
    }, expiresInMinutes * 60 * 1000);

    logger.info('生成二次确认令牌', {
      adminId,
      operation,
      token: token.substring(0, 8) + '...',
      expiresInMinutes
    });

    return token;
  }

  /**
   * 验证二次确认令牌
   */
  static verifyConfirmToken(
    token: string,
    operation: string,
    ip: string
  ): { valid: boolean; data?: any; error?: string } {
    const tokenData = confirmationTokens.get(token);

    if (!tokenData) {
      return { valid: false, error: '令牌不存在或已过期' };
    }

    if (tokenData.expiresAt < Date.now()) {
      confirmationTokens.delete(token);
      return { valid: false, error: '令牌已过期' };
    }

    if (tokenData.operation !== operation) {
      return { valid: false, error: '操作不匹配' };
    }

    if (tokenData.ip !== ip) {
      return { valid: false, error: 'IP地址不匹配' };
    }

    // 验证成功，删除令牌
    confirmationTokens.delete(token);

    return {
      valid: true,
      data: tokenData.data
    };
  }

  /**
   * 检查会话是否超时
   */
  static async checkSessionTimeout(adminId: string): Promise<boolean> {
    try {
      // 获取会话超时配置
      const sessionTimeoutConfig = await prisma.systemConfigs.findUnique({
        where: { key: 'admin.session_timeout' },
        select: { value: true }
      });

      const timeoutMinutes = sessionTimeoutConfig
        ? parseInt(sessionTimeoutConfig.value)
        : 120; // 默认2小时

      // 获取管理员最后登录时间
      const admin = await prisma.admins.findUnique({
        where: { id: adminId },
        select: { lastLoginAt: true }
      });

      if (!admin || !admin.lastLoginAt) {
        return false;
      }

      const now = new Date();
      const lastLogin = new Date(admin.lastLoginAt);
      const diffMinutes = (now.getTime() - lastLogin.getTime()) / (1000 * 60);

      return diffMinutes < timeoutMinutes;
    } catch (error) {
      logger.error('检查会话超时失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId
      });
      return true; // 出错时默认有效
    }
  }

  /**
   * 更新管理员最后活动时间
   */
  static async updateLastActivity(adminId: string, ip: string): Promise<void> {
    try {
      await prisma.admins.update({
        where: { id: adminId },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: ip,
          updatedAt: new Date(),
        }
      });
    } catch (error) {
      logger.error('更新管理员最后活动时间失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId,
        ip
      });
    }
  }

  /**
   * 检查是否为敏感操作
   */
  static isSensitiveOperation(operation: string): boolean {
    const sensitiveOperations = [
      'delete_user',
      'bulk_delete',
      'reset_password',
      'adjust_funds',
      'system_config_change',
      'role_change',
      'approve_withdraw',
      'batch_pay_commissions',
      'export_sensitive_data',
    ];

    return sensitiveOperations.some(op => operation.includes(op));
  }

  /**
   * 记录安全事件
   */
  static async logSecurityEvent(event: {
    adminId: string;
    type: 'LOGIN_FAILED' | 'IP_BLOCKED' | 'SESSION_TIMEOUT' | 'SUSPICIOUS_OPERATION' | 'TOKEN_INVALID';
    ip: string;
    userAgent?: string;
    details?: any;
  }): Promise<void> {
    try {
      await prisma.securityLogs.create({
        data: {
          id: `security_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          adminId: event.adminId,
          type: event.type,
          ipAddress: event.ip,
          userAgent: event.userAgent,
          details: event.details ? JSON.stringify(event.details) : null,
          createdAt: new Date(),
        }
      });

      logger.warn('安全事件', event);
    } catch (error) {
      logger.error('记录安全事件失败', {
        error: error instanceof Error ? error.message : '未知错误',
        event
      });
    }
  }

  /**
   * 获取管理员安全设置
   */
  static async getAdminSecuritySettings(adminId: string) {
    try {
      const [
        ipWhitelistConfig,
        sessionTimeoutConfig,
        require2FAConfig,
        sensitiveOperationsConfig
      ] = await Promise.all([
        prisma.systemConfigs.findUnique({
          where: { key: 'admin.ip_whitelist' },
          select: { value: true }
        }),
        prisma.systemConfigs.findUnique({
          where: { key: 'admin.session_timeout' },
          select: { value: true }
        }),
        prisma.systemConfigs.findUnique({
          where: { key: 'admin.require_2fa' },
          select: { value: true }
        }),
        prisma.systemConfigs.findUnique({
          where: { key: 'admin.sensitive_operations' },
          select: { value: true }
        })
      ]);

      return {
        ipWhitelist: ipWhitelistConfig ? JSON.parse(ipWhitelistConfig.value) : [],
        sessionTimeout: sessionTimeoutConfig ? parseInt(sessionTimeoutConfig.value) : 120,
        require2FA: require2FAConfig ? require2FAConfig.value === 'true' : false,
        sensitiveOperations: sensitiveOperationsConfig
          ? JSON.parse(sensitiveOperationsConfig.value)
          : [
              'delete_user',
              'bulk_delete',
              'reset_password',
              'adjust_funds',
              'system_config_change'
            ]
      };
    } catch (error) {
      logger.error('获取管理员安全设置失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId
      });
      return null;
    }
  }

  /**
   * 清理过期的确认令牌
   */
  static cleanupExpiredTokens(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [token, data] of confirmationTokens.entries()) {
      if (data.expiresAt < now) {
        confirmationTokens.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`清理了${cleanedCount}个过期的确认令牌`);
    }

    return cleanedCount;
  }
}

/**
 * IP白名单检查中间件
 */
export const requireIPWhitelist = async (req: any, res: any, next: any) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json(
        createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          '需要管理员认证'
        )
      );
    }

    const ip = req.ip || req.connection.remoteAddress;
    const isWhitelisted = await AdminSecurityService.isIPWhitelisted(req.user.id, ip);

    if (!isWhitelisted) {
      // 记录安全事件
      await AdminSecurityService.logSecurityEvent({
        adminId: req.user.id,
        type: 'IP_BLOCKED',
        ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(403).json(
        createErrorResponse(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'IP地址不在白名单中',
          { ip }
        )
      );
    }

    next();
  } catch (error) {
    logger.error('IP白名单检查失败', {
      error: error instanceof Error ? error.message : '未知错误',
      userId: req.user?.id
    });

    res.status(500).json(
      createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'IP白名单检查失败'
      )
    );
  }
};

/**
 * 会话超时检查中间件
 */
export const checkSessionTimeout = async (req: any, res: any, next: any) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json(
        createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          '需要管理员认证'
        )
      );
    }

    const isActive = await AdminSecurityService.checkSessionTimeout(req.user.id);

    if (!isActive) {
      // 记录安全事件
      await AdminSecurityService.logSecurityEvent({
        adminId: req.user.id,
        type: 'SESSION_TIMEOUT',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(401).json(
        createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          '会话已超时，请重新登录'
        )
      );
    }

    // 更新最后活动时间
    await AdminSecurityService.updateLastActivity(
      req.user.id,
      req.ip || req.connection.remoteAddress
    );

    next();
  } catch (error) {
    logger.error('会话超时检查失败', {
      error: error instanceof Error ? error.message : '未知错误',
      userId: req.user?.id
    });

    res.status(500).json(
      createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '会话检查失败'
      )
    );
  }
};

/**
 * 二次确认中间件工厂
 */
export const requireConfirmation = (operation: string) => {
  return (req: any, res: any, next: any) => {
    const confirmToken = req.headers['x-confirm-token'] as string;
    const ip = req.ip || req.connection.remoteAddress;

    if (!confirmToken) {
      return res.status(400).json(
        createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          '敏感操作需要二次确认',
          {
            needConfirmation: true,
            operation
          }
        )
      );
    }

    const verification = AdminSecurityService.verifyConfirmToken(
      confirmToken,
      operation,
      ip
    );

    if (!verification.valid) {
      // 记录安全事件
      AdminSecurityService.logSecurityEvent({
        adminId: req.user?.id,
        type: 'TOKEN_INVALID',
        ip,
        userAgent: req.get('User-Agent'),
        details: { operation, error: verification.error }
      }).catch(error => {
        logger.error('记录安全事件失败', { error });
      });

      return res.status(400).json(
        createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          verification.error || '二次确认失败'
        )
      );
    }

    // 将验证通过的数据附加到请求对象
    req.confirmationData = verification.data;
    next();
  };
};

/**
 * 敏感操作检查中间件
 */
export const checkSensitiveOperation = (operation: string) => {
  return (req: any, res: any, next: any) => {
    const isSensitive = AdminSecurityService.isSensitiveOperation(operation);

    if (isSensitive) {
      // 对于敏感操作，检查是否已有二次确认令牌
      const confirmToken = req.headers['x-confirm-token'] as string;

      if (!confirmToken) {
        // 生成二次确认令牌
        const token = AdminSecurityService.generateConfirmToken(
          req.user.id,
          operation,
          {
            method: req.method,
            url: req.originalUrl,
            body: req.body,
            params: req.params,
            query: req.query
          },
          req.ip || req.connection.remoteAddress
        );

        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '敏感操作需要二次确认',
            {
              needConfirmation: true,
              operation,
              confirmToken: token
            }
          )
        );
      }

      // 验证二次确认令牌
      const verification = AdminSecurityService.verifyConfirmToken(
        confirmToken,
        operation,
        req.ip || req.connection.remoteAddress
      );

      if (!verification.valid) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            verification.error || '二次确认失败'
          )
        );
      }

      req.confirmationData = verification.data;
    }

    next();
  };
};

// 定期清理过期的令牌
setInterval(() => {
  AdminSecurityService.cleanupExpiredTokens();
}, 5 * 60 * 1000); // 每5分钟清理一次