/**
 * 支付安全模块
 * 负责签名验证、加密解密和安全审计
 */

import { createHash, createHmac, randomBytes, createCipher, createDecipher } from 'crypto';
import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { PaymentChannel } from './types';

export interface SecurityConfig {
  enableSignatureVerification: boolean;
  enableDuplicateCheck: boolean;
  enableIpWhitelist: boolean;
  enableRiskControl: boolean;
  maxAmountPerTransaction: number;
  maxTransactionPerMinute: number;
  maxTransactionPerHour: number;
  allowedIps: string[];
  signKey: string;
  signType: 'MD5' | 'HMAC-SHA256';
}

export interface SignatureData {
  data: any;
  signature: string;
  signType?: string;
}

export interface SecurityAudit {
  paymentId: string;
  action: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  riskScore: number;
  riskFactors: string[];
  timestamp: Date;
}

export interface RiskControlResult {
  allowed: boolean;
  riskScore: number;
  riskFactors: string[];
  reason?: string;
}

/**
 * 支付安全类
 */
export class PaymentSecurity {
  private static instance: PaymentSecurity;
  private config: SecurityConfig;
  private transactionCache: Map<string, number[]> = new Map();

  private constructor() {
    this.config = this.loadSecurityConfig();
    this.startCacheCleanup();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PaymentSecurity {
    if (!PaymentSecurity.instance) {
      PaymentSecurity.instance = new PaymentSecurity();
    }
    return PaymentSecurity.instance;
  }

  /**
   * 加载安全配置
   */
  private loadSecurityConfig(): SecurityConfig {
    return {
      enableSignatureVerification: process.env.PAYMENT_ENABLE_SIGNATURE === 'true',
      enableDuplicateCheck: process.env.PAYMENT_ENABLE_DUPLICATE_CHECK === 'true',
      enableIpWhitelist: process.env.PAYMENT_ENABLE_IP_WHITELIST === 'true',
      enableRiskControl: process.env.PAYMENT_ENABLE_RISK_CONTROL === 'true',
      maxAmountPerTransaction: parseInt(process.env.PAYMENT_MAX_AMOUNT || '50000'),
      maxTransactionPerMinute: parseInt(process.env.PAYMENT_MAX_PER_MINUTE || '10'),
      maxTransactionPerHour: parseInt(process.env.PAYMENT_MAX_PER_HOUR || '100'),
      allowedIps: (process.env.PAYMENT_ALLOWED_IPS || '').split(',').filter(Boolean),
      signKey: process.env.PAYMENT_SIGN_KEY || '',
      signType: (process.env.PAYMENT_SIGN_TYPE as 'MD5' | 'HMAC-SHA256') || 'MD5'
    };
  }

  /**
   * 验证签名
   */
  public verifySignature(
    channel: PaymentChannel,
    data: any,
    signature: string,
    signType?: string
  ): boolean {
    if (!this.config.enableSignatureVerification) {
      logger.warn('签名验证已禁用', { channel });
      return true;
    }

    try {
      const expectedSignature = this.generateSignature(data, channel, signType);
      const isValid = expectedSignature === signature;

      logger.debug('签名验证结果', {
        channel,
        isValid,
        expected: expectedSignature,
        received: signature
      });

      return isValid;

    } catch (error) {
      logger.error('签名验证失败', {
        channel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 生成签名
   */
  public generateSignature(
    data: any,
    channel: PaymentChannel,
    signType?: string
  ): string {
    try {
      // 获取渠道密钥
      const signKey = this.getChannelSignKey(channel);
      if (!signKey) {
        throw new Error('未找到渠道签名密钥');
      }

      // 排序参数
      const sortedParams = this.sortAndFilterParams(data);
      const stringToSign = this.buildStringToSign(sortedParams);

      // 根据签名类型生成签名
      const type = signType || this.config.signType;

      switch (type) {
        case 'HMAC-SHA256':
          return this.hmacSha256(stringToSign, signKey);
        case 'MD5':
        default:
          return this.md5(stringToSign + signKey);
      }

    } catch (error) {
      logger.error('生成签名失败', {
        channel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 验证请求来源IP
   */
  public verifyIp(ip: string, channel?: PaymentChannel): boolean {
    if (!this.config.enableIpWhitelist) {
      return true;
    }

    if (!ip) {
      return false;
    }

    const allowedIps = channel
      ? this.getChannelAllowedIps(channel)
      : this.config.allowedIps;

    if (allowedIps.length === 0) {
      return true;
    }

    const isAllowed = allowedIps.includes(ip) || allowedIps.includes('*');

    logger.debug('IP验证结果', {
      ip,
      channel,
      isAllowed,
      allowedIps
    });

    return isAllowed;
  }

  /**
   * 风险控制检查
   */
  public async riskControlCheck(
    userId: string,
    amount: number,
    ip?: string,
    userAgent?: string
  ): Promise<RiskControlResult> {
    const riskScore = 0;
    const riskFactors: string[] = [];

    try {
      if (!this.config.enableRiskControl) {
        return {
          allowed: true,
          riskScore: 0,
          riskFactors: []
        };
      }

      // 1. 检查单笔交易金额
      if (amount > this.config.maxAmountPerTransaction) {
        riskFactors.push('SINGLE_AMOUNT_EXCEEDED');
        riskScore += 30;
      }

      // 2. 检查交易频率
      const frequencyCheck = await this.checkTransactionFrequency(userId);
      if (!frequencyCheck.allowed) {
        riskFactors.push(...frequencyCheck.riskFactors);
        riskScore += frequencyCheck.riskScore;
      }

      // 3. 检查历史行为
      const behaviorCheck = await this.checkUserBehavior(userId);
      if (!behaviorCheck.allowed) {
        riskFactors.push(...behaviorCheck.riskFactors);
        riskScore += behaviorCheck.riskScore;
      }

      // 4. IP风险检查
      if (ip) {
        const ipCheck = await this.checkIpRisk(ip, userId);
        if (!ipCheck.allowed) {
          riskFactors.push(...ipCheck.riskFactors);
          riskScore += ipCheck.riskScore;
        }
      }

      // 5. 设备指纹检查
      if (userAgent) {
        const deviceCheck = await this.checkDeviceRisk(userAgent, userId);
        if (!deviceCheck.allowed) {
          riskFactors.push(...deviceCheck.riskFactors);
          riskScore += deviceCheck.riskScore;
        }
      }

      const allowed = riskScore < 50; // 风险阈值50

      // 记录风险审计
      await this.auditRisk({
        paymentId: '', // 稍后更新
        action: 'RISK_CHECK',
        userId,
        ip,
        userAgent,
        riskScore,
        riskFactors,
        timestamp: new Date()
      });

      logger.info('风险控制检查完成', {
        userId,
        amount,
        riskScore,
        riskFactors,
        allowed
      });

      return {
        allowed,
        riskScore,
        riskFactors,
        reason: allowed ? undefined : this.getRiskReason(riskFactors)
      };

    } catch (error) {
      logger.error('风险控制检查失败', {
        userId,
        amount,
        error: error instanceof Error ? error.message : '未知错误'
      });

      // 安全起见，失败时拒绝交易
      return {
        allowed: false,
        riskScore: 100,
        riskFactors: ['SYSTEM_ERROR'],
        reason: '系统错误，请稍后重试'
      };
    }
  }

  /**
   * 加密敏感数据
   */
  public encryptSensitiveData(data: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = this.getEncryptionKey();
      const iv = randomBytes(16);

      const cipher = createCipher(algorithm, key);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 将IV附加到加密数据前
      return iv.toString('hex') + ':' + encrypted;

    } catch (error) {
      logger.error('加密数据失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 解密敏感数据
   */
  public decryptSensitiveData(encryptedData: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = this.getEncryptionKey();

      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('无效的加密数据格式');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      logger.error('解密数据失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // ===== 私有方法 =====

  /**
   * 获取渠道签名密钥
   */
  private getChannelSignKey(channel: PaymentChannel): string | null {
    switch (channel) {
      case PaymentChannel.WECHAT:
        return process.env.WECHAT_PAY_KEY || null;
      case PaymentChannel.ALIPAY:
        return process.env.ALIPAY_PRIVATE_KEY || null;
      default:
        return this.config.signKey || null;
    }
  }

  /**
   * 获取渠道允许的IP
   */
  private getChannelAllowedIps(channel: PaymentChannel): string[] {
    switch (channel) {
      case PaymentChannel.WECHAT:
        return (process.env.WECHAT_PAY_ALLOWED_IPS || '').split(',').filter(Boolean);
      case PaymentChannel.ALIPAY:
        return (process.env.ALIPAY_ALLOWED_IPS || '').split(',').filter(Boolean);
      default:
        return this.config.allowedIps;
    }
  }

  /**
   * 排序和过滤参数
   */
  private sortAndFilterParams(data: any): Record<string, any> {
    const params: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // 跳过空值和签名
      if (value === null || value === undefined || key === 'sign' || key === 'signature') {
        continue;
      }

      // 转换为数组
      if (Array.isArray(value)) {
        params[key] = value.join(',');
      } else {
        params[key] = value;
      }
    }

    // 按键名排序
    return Object.keys(params)
      .sort()
      .reduce((sorted: Record<string, any>, key) => {
        sorted[key] = params[key];
        return sorted;
      }, {});
  }

  /**
   * 构建待签名字符串
   */
  private buildStringToSign(params: Record<string, any>): string {
    return Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  /**
   * HMAC-SHA256签名
   */
  private hmacSha256(data: string, key: string): string {
    return createHmac('sha256', key)
      .update(data, 'utf8')
      .digest('hex');
  }

  /**
   * MD5签名
   */
  private md5(data: string): string {
    return createHash('md5')
      .update(data, 'utf8')
      .digest('hex');
  }

  /**
   * 获取加密密钥
   */
  private getEncryptionKey(): Buffer {
    const key = process.env.PAYMENT_ENCRYPTION_KEY || 'default-key-32-chars-long!!';
    return Buffer.from(key.padEnd(32, '0').substring(0, 32), 'utf8');
  }

  /**
   * 检查交易频率
   */
  private async checkTransactionFrequency(userId: string): Promise<RiskControlResult> {
    const now = Date.now();
    const userTransactions = this.transactionCache.get(userId) || [];

    // 清理过期的交易记录（1小时前）
    const oneHourAgo = now - 60 * 60 * 1000;
    const validTransactions = userTransactions.filter(time => time > oneHourAgo);

    // 更新缓存
    this.transactionCache.set(userId, validTransactions);

    // 检查分钟级频率
    const oneMinuteAgo = now - 60 * 1000;
    const minuteTransactions = validTransactions.filter(time => time > oneMinuteAgo);
    if (minuteTransactions.length >= this.config.maxTransactionPerMinute) {
      return {
        allowed: false,
        riskScore: 40,
        riskFactors: ['HIGH_FREQUENCY_PER_MINUTE']
      };
    }

    // 检查小时级频率
    if (validTransactions.length >= this.config.maxTransactionPerHour) {
      return {
        allowed: false,
        riskScore: 30,
        riskFactors: ['HIGH_FREQUENCY_PER_HOUR']
      };
    }

    // 记录本次交易
    validTransactions.push(now);
    this.transactionCache.set(userId, validTransactions);

    return {
      allowed: true,
      riskScore: 0,
      riskFactors: []
    };
  }

  /**
   * 检查用户历史行为
   */
  private async checkUserBehavior(userId: string): Promise<RiskControlResult> {
    try {
      // 查询用户历史支付记录
      const [recentPayments, failedPayments, totalAmount] = await Promise.all([
        prisma.paymentRecords.count({
          where: {
            userId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.paymentRecords.count({
          where: {
            userId,
            status: 'FAILED',
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
          }
        }),
        prisma.paymentRecords.aggregate({
          where: {
            userId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            },
          },
          _sum: { amount: true }
        })
      ]);

      const riskFactors: string[] = [];
      let riskScore = 0;

      // 检查24小时内的支付次数
      if (recentPayments > 20) {
        riskFactors.push('TOO_MANY_PAYMENTS_24H');
        riskScore += 20;
      }

      // 检查1小时内的失败次数
      if (failedPayments > 3) {
        riskFactors.push('MANY_FAILED_PAYMENTS_1H');
        riskScore += 30;
      }

      // 检查24小时内的总金额
      if ((totalAmount._sum.amount || 0) > 100000) {
        riskFactors.push('HIGH_AMOUNT_24H');
        riskScore += 25;
      }

      return {
        allowed: riskScore < 40,
        riskScore,
        riskFactors
      };

    } catch (error) {
      logger.error('检查用户行为失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        allowed: false,
        riskScore: 20,
        riskFactors: ['BEHAVIOR_CHECK_FAILED']
      };
    }
  }

  /**
   * 检查IP风险
   */
  private async checkIpRisk(ip: string, userId: string): Promise<RiskControlResult> {
    try {
      // 检查IP是否在黑名单中
      const blacklisted = await prisma.ipBlacklist.findUnique({
        where: { ip }
      });

      if (blacklisted) {
        return {
          allowed: false,
          riskScore: 100,
          riskFactors: ['IP_BLACKLISTED']
        };
      }

      // 检查IP在最近24小时内的使用情况
      const ipUsage = await prisma.paymentRecords.count({
        where: {
          clientIp: ip,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });

      // 检查多个账户使用同一IP
      const ipUsers = await prisma.paymentRecords.groupBy({
        by: ['userId'],
        where: {
          clientIp: ip,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
        },
        _count: { userId: true }
      });

      const riskFactors: string[] = [];
      let riskScore = 0;

      if (ipUsage > 100) {
        riskFactors.push('HIGH_IP_USAGE');
        riskScore += 25;
      }

      if (ipUsers.length > 10) {
        riskFactors.push('MANY_USERS_SAME_IP');
        riskScore += 20;
      }

      return {
        allowed: riskScore < 40,
        riskScore,
        riskFactors
      };

    } catch (error) {
      logger.error('检查IP风险失败', {
        ip,
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        allowed: true,
        riskScore: 0,
        riskFactors: []
      };
    }
  }

  /**
   * 检查设备风险
   */
  private async checkDeviceRisk(userAgent: string, userId: string): Promise<RiskControlResult> {
    try {
      // 检查UserAgent是否在黑名单中
      const blacklisted = await prisma.userAgentBlacklist.findUnique({
        where: { userAgent }
      });

      if (blacklisted) {
        return {
          allowed: false,
          riskScore: 100,
          riskFactors: ['USER_AGENT_BLACKLISTED']
        };
      }

      // 检查设备在最近24小时内的使用情况
      const deviceUsage = await prisma.paymentRecords.count({
        where: {
          userAgent,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });

      // 检查设备是否被多个账户使用
      const deviceUsers = await prisma.paymentRecords.groupBy({
        by: ['userId'],
        where: {
          userAgent,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
        },
        _count: { userId: true }
      });

      const riskFactors: string[] = [];
      let riskScore = 0;

      if (deviceUsage > 50) {
        riskFactors.push('HIGH_DEVICE_USAGE');
        riskScore += 15;
      }

      if (deviceUsers.length > 5) {
        riskFactors.push('MANY_USERS_SAME_DEVICE');
        riskScore += 25;
      }

      return {
        allowed: riskScore < 40,
        riskScore,
        riskFactors
      };

    } catch (error) {
      logger.error('检查设备风险失败', {
        userAgent,
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        allowed: true,
        riskScore: 0,
        riskFactors: []
      };
    }
  }

  /**
   * 获取风险原因
   */
  private getRiskReason(riskFactors: string[]): string {
    const reasonMap: Record<string, string> = {
      'SINGLE_AMOUNT_EXCEEDED': '单笔交易金额超过限制',
      'HIGH_FREQUENCY_PER_MINUTE': '交易频率过高（每分钟）',
      'HIGH_FREQUENCY_PER_HOUR': '交易频率过高（每小时）',
      'TOO_MANY_PAYMENTS_24H': '24小时内交易次数过多',
      'MANY_FAILED_PAYMENTS_1H': '1小时内支付失败次数过多',
      'HIGH_AMOUNT_24H': '24小时内交易金额过高',
      'IP_BLACKLISTED': 'IP地址在黑名单中',
      'HIGH_IP_USAGE': 'IP地址使用频率过高',
      'MANY_USERS_SAME_IP': 'IP地址被过多账户使用',
      'USER_AGENT_BLACKLISTED': '设备标识在黑名单中',
      'HIGH_DEVICE_USAGE': '设备使用频率过高',
      'MANY_USERS_SAME_DEVICE': '设备被过多账户使用',
      'SYSTEM_ERROR': '系统错误'
    };

    return riskFactors
      .map(factor => reasonMap[factor] || factor)
      .join('; ');
  }

  /**
   * 风险审计
   */
  private async auditRisk(audit: SecurityAudit): Promise<void> {
    try {
      await prisma.paymentSecurityAudit.create({
        data: {
          paymentId: audit.paymentId,
          action: audit.action,
          userId: audit.userId,
          ip: audit.ip,
          userAgent: audit.userAgent,
          riskScore: audit.riskScore,
          riskFactors: audit.riskFactors,
          createdAt: audit.timestamp
        }
      });
    } catch (error) {
      logger.error('记录风险审计失败', {
        audit,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 启动缓存清理
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      for (const [userId, transactions] of this.transactionCache.entries()) {
        const validTransactions = transactions.filter(time => time > oneHourAgo);
        if (validTransactions.length === 0) {
          this.transactionCache.delete(userId);
        } else {
          this.transactionCache.set(userId, validTransactions);
        }
      }
    }, 10 * 60 * 1000); // 每10分钟清理一次
  }
}

// 导出单例实例
export const paymentSecurity = PaymentSecurity.getInstance();