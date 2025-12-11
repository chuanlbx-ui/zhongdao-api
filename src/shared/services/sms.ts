import { logger } from '../utils/logger';
import { prisma } from '../database/client';

// 短信验证码接口
export interface SMSVerification {
  id: string;
  phone: string;
  code: string;
  type: 'bind' | 'unbind' | 'login' | 'transfer';
  attempts: number;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

// 使用环境变量控制存储方式
const USE_DATABASE_STORAGE = process.env.NODE_ENV === 'production' || process.env.USE_DATABASE_SMS === 'true';
const tempSMSStore = new Map<string, SMSVerification>();

// 短信服务类
export class SMSService {
  // 生成6位验证码
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // 发送短信验证码（模拟实现）
  async sendVerificationCode(phone: string, type: 'bind' | 'unbind' | 'login' | 'transfer' = 'bind'): Promise<boolean> {
    try {
      // 检查手机号格式
      if (!this.isValidPhone(phone)) {
        throw new Error('手机号格式不正确');
      }

      // 检查发送频率限制
      const canSend = await this.checkRateLimit(phone);
      if (!canSend) {
        throw new Error('发送过于频繁，请稍后再试');
      }

      // 检查是否已被其他用户绑定
      if (type === 'bind') {
        const existingUser = await prisma.users.findUnique({
          where: { phone }
        });

        if (existingUser) {
          throw new Error('该手机号已被其他用户绑定');
        }
      }

      // 生成验证码
      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后过期

      // 保存验证码到临时存储
      const verificationId = Math.random().toString(36).substring(2);
      const verification: SMSVerification = {
        id: verificationId,
        phone,
        code,
        type,
        attempts: 0,
        isUsed: false,
        expiresAt,
        createdAt: new Date()
      };

      tempSMSStore.set(`${phone}_${type}`, verification);

      // 模拟发送短信（实际项目中应该调用短信服务商API）
      const success = await this.mockSendSMS(phone, code, type);

      if (success) {
        logger.info('短信验证码发送成功', {
          phone: this.maskPhone(phone),
          type,
          requestId: this.generateRequestId()
        });
      }

      return success;

    } catch (error) {
      logger.error('发送短信验证码失败', {
        phone: this.maskPhone(phone),
        type,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 验证短信验证码（临时实现）
  async verifyCode(phone: string, code: string, type: 'bind' | 'unbind' | 'login' | 'transfer' = 'bind'): Promise<boolean> {
    try {
      // 从临时存储查找验证码
      const key = `${phone}_${type}`;
      const verification = tempSMSStore.get(key);

      if (!verification) {
        throw new Error('验证码不存在或已过期');
      }

      // 检查是否过期
      if (new Date() > verification.expiresAt) {
        tempSMSStore.delete(key);
        throw new Error('验证码已过期');
      }

      // 检查是否已使用
      if (verification.isUsed) {
        throw new Error('验证码已被使用');
      }

      // 检查尝试次数
      if (verification.attempts >= 3) {
        tempSMSStore.delete(key);
        throw new Error('验证码尝试次数过多，请重新获取');
      }

      // 更新尝试次数
      verification.attempts += 1;

      if (verification.code !== code) {
        logger.warn('短信验证码验证失败', {
          phone: this.maskPhone(phone),
          type,
          attempts: verification.attempts
        });
        return false;
      }

      // 标记为已使用
      verification.isUsed = true;

      logger.info('短信验证码验证成功', {
        phone: this.maskPhone(phone),
        type
      });

      return true;

    } catch (error) {
      logger.error('验证短信验证码失败', {
        phone: this.maskPhone(phone),
        type,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 检查发送频率限制（临时简化实现）
  private async checkRateLimit(phone: string): Promise<boolean> {
    // 临时使用内存存储（实际应该用数据库）
    // TODO: 等Prisma客户端问题解决后改回数据库实现
    return true;
  }

  // 验证手机号格式
  private isValidPhone(phone: string): boolean {
    // 中国大陆手机号正则表达式
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  // 模拟发送短信
  private async mockSendSMS(phone: string, code: string, type: string): Promise<boolean> {
    // 开发环境下打印到控制台
    if (process.env.NODE_ENV === 'development') {
// [DEBUG REMOVED]       console.log(`📱 [模拟短信] 发送到 ${phone}:`);
// [DEBUG REMOVED]       console.log(`🔢 验证码: ${code}`);
// [DEBUG REMOVED]       console.log(`📝 用途: ${type}`);
// [DEBUG REMOVED]       console.log(`⏰ 有效期: 5分钟`);
// [DEBUG REMOVED]       console.log('---');
    }

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 100));

    return true;
  }

  // 手机号脱敏
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 11) return phone;
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  // 生成请求ID
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // 清理过期验证码
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const result = await prisma.smsVerifications.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      if (result.count > 0) {
        logger.info('清理过期短信验证码', {
          count: result.count
        });
      }
    } catch (error) {
      logger.error('清理过期验证码失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
}

// 导出单例实例
export const smsService = new SMSService();

// 定时清理过期验证码（每小时执行一次）
setInterval(() => {
  smsService.cleanupExpiredCodes();
}, 60 * 60 * 1000);