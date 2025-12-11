import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { users_level, users_status } from '@prisma/client';
import { createUserNumber } from '../../modules/user/user-number.service';

// 微信API响应接口
interface WechatSessionResponse {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

// 微信用户信息接口
interface WechatUserInfo {
  openid: string;
  nickname: string;
  avatarUrl: string;
  gender: number;
  city: string;
  province: string;
  country: string;
  language: string;
}

// 解密的微信用户信息
interface DecryptedUserInfo {
  openId: string;
  nickName: string;
  gender: number;
  city: string;
  province: string;
  country: string;
  avatarUrl: string;
  watermark: {
    timestamp: number;
    appid: string;
  };
}

// 解密的手机号信息
interface DecryptedPhoneInfo {
  phoneNumber: string;
  purePhoneNumber: string;
  countryCode: string;
  watermark: {
    timestamp: number;
    appid: string;
  };
}

// 登录结果接口
interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    openid: string;
    nickname: string;
    avatarUrl: string;
    level: users_level;
    status: users_status;
    isNewUser: boolean;
    userNumber?: string;
    phone?: string;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
  sessionKey?: string;
  error?: string;
  message?: string;
}

/**
 * 微信认证服务
 */
export class WechatAuthService {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl = 'https://api.weixin.qq.com';
  private readonly loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
  private readonly maxAttempts = 5;
  private readonly lockoutDuration = 15 * 60 * 1000; // 15分钟

  constructor() {
    this.appId = process.env.WECHAT_APP_ID || '';
    this.appSecret = process.env.WECHAT_APP_SECRET || '';

    if (!this.appId || !this.appSecret) {
      logger.warn('微信认证配置不完整', {
        hasAppId: !!this.appId,
        hasAppSecret: !!this.appSecret
      });
    } else {
      logger.info('微信认证服务初始化成功', {
        appId: this.appId.substring(0, 8) + '...'
      });
    }
  }

  /**
   * 微信小程序登录
   */
  async login(
    code: string,
    userInfo?: Partial<WechatUserInfo>,
    encryptedData?: string,
    iv?: string
  ): Promise<LoginResult> {
    try {
      // 验证配置
      if (!this.appId || !this.appSecret) {
        return {
          success: false,
          error: 'WECHAT_CONFIG_MISSING',
          message: '微信认证配置缺失'
        };
      }

      // 验证code参数
      if (!code || code.length < 10) {
        return {
          success: false,
          error: 'INVALID_CODE',
          message: '授权码无效'
        };
      }

      // 检查登录频率限制（基于IP）
      const clientIp = 'unknown'; // 在实际使用中应该从请求中获取
      if (this.isRateLimited(clientIp)) {
        return {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: '登录尝试过于频繁，请稍后再试'
        };
      }

      // 调用微信API获取session_key和openid
      const sessionData = await this.getWechatSession(code);

      if (!sessionData.openid || sessionData.errcode) {
        this.recordFailedAttempt(clientIp);
        return {
          success: false,
          error: 'WECHAT_CODE_INVALID',
          message: sessionData.errmsg || '微信授权码无效或已过期'
        };
      }

      // 验证用户信息（如果提供了加密数据）
      let verifiedUserInfo = userInfo;
      if (encryptedData && iv && sessionData.session_key) {
        const isValid = this.verifyUserInfo(sessionData.session_key, encryptedData, iv);
        if (!isValid) {
          return {
            success: false,
            error: 'INVALID_USER_DATA',
            message: '用户信息验证失败'
          };
        }

        // 解密用户信息
        try {
          const decryptedInfo = this.decryptUserInfo(sessionData.session_key, encryptedData, iv);
          verifiedUserInfo = {
            openid: decryptedInfo.openId,
            nickname: decryptedInfo.nickName,
            avatarUrl: decryptedInfo.avatarUrl,
            gender: decryptedInfo.gender,
            city: decryptedInfo.city,
            province: decryptedInfo.province,
            country: decryptedInfo.country,
            language: 'zh_CN'
          };
        } catch (error) {
          logger.warn('解密用户信息失败，使用默认信息', { error });
        }
      }

      // 查找或创建用户
      const userResult = await this.findOrCreateUser(sessionData.openid, verifiedUserInfo);

      if (!userResult.success) {
        return userResult;
      }

      // 生成JWT Token
      const tokenPayload = {
        sub: userResult.user!.id,
        scope: ['active', 'user'],
        level: userResult.user!.level,
        role: 'USER'
      };

      const accessToken = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // 清除失败尝试记录
      this.clearFailedAttempts(clientIp);

      logger.info('微信登录成功', {
        userId: userResult.user!.id,
        openid: sessionData.openid,
        isNewUser: userResult.isNewUser,
        nickname: userResult.user!.nickname
      });

      return {
        success: true,
        user: {
          ...userResult.user!,
          isNewUser: userResult.isNewUser!
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        },
        sessionKey: sessionData.session_key // 返回session_key用于后续解密
      };
    } catch (error) {
      logger.error('微信登录失败', {
        error: error instanceof Error ? error.message : '未知错误',
        code: code ? code.substring(0, 10) + '...' : 'none'
      });

      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: '微信登录失败，请稍后重试'
      };
    }
  }

  /**
   * 获取微信会话信息
   */
  private async getWechatSession(code: string): Promise<WechatSessionResponse> {
    const url = `${this.baseUrl}/sns/jscode2session';
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get<WechatSessionResponse>(url, {
          params: {
            appid: this.appId,
            secret: this.appSecret,
            js_code: code,
            grant_type: 'authorization_code'
          },
          timeout: parseInt(process.env.WECHAT_LOGIN_TIMEOUT || '10000'),
          headers: {
            'User-Agent': 'Zhongdao-Mall/1.0'
          }
        });

        // 检查微信API返回的错误
        if (response.data.errcode) {
          const errorCode = response.data.errcode;
          const errorMsg = response.data.errmsg || '未知错误';

          // 记录API错误
          logger.warn('微信API返回错误', {
            errcode: errorCode,
            errmsg: errorMsg,
            attempt,
            code: code.substring(0, 10) + '...'
          });

          // 某些错误不需要重试
          if (errorCode === 40029 || errorCode === 40125) {
            throw new Error(`授权码无效: ${errorMsg}`);
          }

          // 其他错误可以重试
          if (attempt === maxRetries) {
            throw new Error(`微信API错误: ${errorMsg}`);
          }

          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        // 验证返回数据
        if (!response.data.openid || !response.data.session_key) {
          throw new Error('微信API返回数据不完整');
        }

        logger.info('微信会话获取成功', {
          openid: response.data.openid,
          hasUnionid: !!response.data.unionid,
          attempt
        });

        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('网络错误');

        if (attempt === maxRetries) {
          logger.error('调用微信API失败，已达到最大重试次数', {
            error: lastError.message,
            url,
            appId: this.appId.substring(0, 8) + '...',
            attempts: maxRetries
          });
          throw lastError;
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw lastError || new Error('微信API调用失败');
  }

  /**
   * 查找或创建用户
   */
  private async findOrCreateUser(
    openid: string,
    userInfo?: Partial<WechatUserInfo>
  ): Promise<{ success: boolean; user?: any; isNewUser?: boolean; error?: string; message?: string }> {
    try {
      // 先查找现有用户
      let user = await prisma.users.findUnique({
        where: { openid }
      });

      let isNewUser = false;

      if (!user) {
        // 创建新用户
        const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // 生成用户编号
        const userNumber = await createUserNumber();

        const newUser = {
          id: userId,
          openid,
          userNumber, // 添加用户编号
          nickname: this.sanitizeNickname(userInfo?.nickname) || '微信用户',
          avatarUrl: userInfo?.avatarUrl || '',
          level: users_level.NORMAL,
          status: users_status.ACTIVE,
          teamPath: null,
          parentId: null
        };

        user = await prisma.users.create({
          data: newUser
        });

        isNewUser = true;

        logger.info('创建新用户', {
          userId: user.id,
          userNumber: user.userNumber,
          openid,
          nickname: user.nickname
        });
      } else {
        // 更新用户信息（如果有提供新信息）
        if (userInfo && (userInfo.nickname || userInfo.avatarUrl)) {
          const updateData: any = {};
          if (userInfo.nickname) {
            updateData.nickname = this.sanitizeNickname(userInfo.nickname);
          }
          if (userInfo.avatarUrl) {
            updateData.avatarUrl = userInfo.avatarUrl;
          }

          // 只在有实际更新时才执行更新
          if (Object.keys(updateData).length > 0) {
            user = await prisma.users.update({
              where: { id: user.id },
              data: updateData
            });

            logger.info('更新用户信息', {
              userId: user.id,
              userNumber: user.userNumber,
              updatedFields: Object.keys(updateData)
            });
          }
        }
      }

      // 检查用户状态
      if (user.status !== users_status.ACTIVE) {
        return {
          success: false,
          error: 'USER_INACTIVE',
          message: '用户状态异常，无法登录'
        };
      }

      return {
        success: true,
        user: {
          id: user.id,
          openid: user.openid,
          userNumber: user.userNumber, // 包含用户编号
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          level: user.level,
          status: user.status
        },
        isNewUser
      };
    } catch (error) {
      logger.error('查找或创建用户失败', {
        error: error instanceof Error ? error.message : '数据库错误',
        openid,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: '用户数据处理失败'
      };
    }
  }

  /**
   * 验证微信用户信息
   */
  verifyUserInfo(sessionKey: string, rawData: string, signature: string): boolean {
    try {
      const hashedData = crypto
        .createHash('sha1')
        .update(`${rawData}${sessionKey}`)
        .digest('hex');

      return hashedData === signature;
    } catch (error) {
      logger.error('验证微信用户信息失败', {
        error: error instanceof Error ? error.message : '加密错误'
      });
      return false;
    }
  }

  /**
   * 解密微信用户信息
   */
  decryptUserInfo(sessionKey: string, encryptedData: string, iv: string): DecryptedUserInfo {
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc',
        Buffer.from(sessionKey, 'base64'),
        Buffer.from(iv, 'base64')
      );

      decipher.setAutoPadding(true);

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      const result = JSON.parse(decrypted) as DecryptedUserInfo;

      // 验证水印
      if (result.watermark.appid !== this.appId) {
        throw new Error('用户信息水印验证失败');
      }

      // 检查时间戳，防止重放攻击（5分钟有效期）
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - result.watermark.timestamp) > 300) {
        throw new Error('用户信息已过期');
      }

      return result;
    } catch (error) {
      logger.error('解密微信用户信息失败', {
        error: error instanceof Error ? error.message : '解密错误'
      });
      throw new Error('用户信息解密失败');
    }
  }

  /**
   * 解密微信手机号
   */
  async decryptPhoneNumber(sessionKey: string, encryptedData: string, iv: string): Promise<DecryptedPhoneInfo> {
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc',
        Buffer.from(sessionKey, 'base64'),
        Buffer.from(iv, 'base64')
      );

      decipher.setAutoPadding(true);

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      const result = JSON.parse(decrypted) as DecryptedPhoneInfo;

      // 验证水印
      if (result.watermark.appid !== this.appId) {
        throw new Error('手机号信息水印验证失败');
      }

      // 检查时间戳，防止重放攻击（5分钟有效期）
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - result.watermark.timestamp) > 300) {
        throw new Error('手机号信息已过期');
      }

      return result;
    } catch (error) {
      logger.error('解密微信手机号失败', {
        error: error instanceof Error ? error.message : '解密错误'
      });
      throw new Error('手机号解密失败');
    }
  }

  /**
   * 清理昵称中的特殊字符
   */
  private sanitizeNickname(nickname?: string): string | null {
    if (!nickname) return null;

    // 移除特殊字符，保留中文、英文、数字、常见符号
    return nickname
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\-_~]/g, '')
      .substring(0, 50) // 限制长度
      .trim() || null;
  }

  /**
   * 检查是否被限流
   */
  private isRateLimited(clientIp: string): boolean {
    const attempts = this.loginAttempts.get(clientIp);

    if (!attempts) {
      return false;
    }

    // 如果还在锁定期内
    if (Date.now() - attempts.lastAttempt < this.lockoutDuration) {
      return attempts.count >= this.maxAttempts;
    }

    // 锁定期已过，清除记录
    this.loginAttempts.delete(clientIp);
    return false;
  }

  /**
   * 记录失败尝试
   */
  private recordFailedAttempt(clientIp: string): void {
    const attempts = this.loginAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.loginAttempts.set(clientIp, attempts);

    logger.warn('记录登录失败尝试', {
      clientIp,
      count: attempts.count,
      maxAttempts: this.maxAttempts
    });
  }

  /**
   * 清除失败尝试记录
   */
  private clearFailedAttempts(clientIp: string): void {
    this.loginAttempts.delete(clientIp);
  }

  /**
   * 获取微信Access Token（用于服务端调用）
   */
  async getAccessToken(): Promise<string> {
    try {
      const url = `${this.baseUrl}/cgi-bin/token`;

      const response = await axios.get(url, {
        params: {
          grant_type: 'client_credential',
          appid: this.appId,
          secret: this.appSecret
        },
        timeout: 10000
      });

      if (response.data.errcode) {
        throw new Error(`获取Access Token失败: ${response.data.errmsg}`);
      }

      return response.data.access_token;
    } catch (error) {
      logger.error('获取微信Access Token失败', {
        error: error instanceof Error ? error.message : '网络错误'
      });
      throw new Error('获取微信Access Token失败');
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken(refreshToken: string): Promise<LoginResult> {
    try {
      // 验证refresh token
      const payload = verifyRefreshToken(refreshToken);

      if (!payload || !payload.sub) {
        return {
          success: false,
          error: 'INVALID_REFRESH_TOKEN',
          message: '刷新Token无效'
        };
      }

      // 查找用户
      const user = await prisma.users.findUnique({
        where: { id: payload.sub as string }
      });

      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        };
      }

      // 检查用户状态
      if (user.status !== users_status.ACTIVE) {
        return {
          success: false,
          error: 'USER_INACTIVE',
          message: '用户状态异常'
        };
      }

      // 生成新的Token
      const newPayload = {
        sub: user.id,
        scope: ['active', 'user'],
        level: user.level,
        role: 'USER'
      };

      const newAccessToken = generateToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      logger.info('Token刷新成功', {
        userId: user.id,
        userNumber: user.userNumber
      });

      return {
        success: true,
        user: {
          id: user.id,
          openid: user.openid,
          userNumber: user.userNumber,
          nickname: user.nickname || '',
          avatarUrl: user.avatarUrl || '',
          level: user.level,
          status: user.status,
          isNewUser: false
        },
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
      };
    } catch (error) {
      logger.error('Token刷新失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: 'REFRESH_TOKEN_FAILED',
        message: 'Token刷新失败'
      };
    }
  }

  /**
   * 绑定手机号
   */
  async bindPhone(
    userId: string,
    sessionKey: string,
    encryptedData: string,
    iv: string
  ): Promise<{ success: boolean; phone?: string; error?: string; message?: string }> {
    try {
      // 解密手机号
      const phoneInfo = await this.decryptPhoneNumber(sessionKey, encryptedData, iv);

      // 检查手机号是否已被绑定
      const existingUser = await prisma.users.findUnique({
        where: { phone: phoneInfo.phoneNumber }
      });

      if (existingUser && existingUser.id !== userId) {
        return {
          success: false,
          error: 'PHONE_ALREADY_BOUND',
          message: '该手机号已被其他用户绑定'
        };
      }

      // 更新用户手机号
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: { phone: phoneInfo.phoneNumber }
      });

      logger.info('用户手机号绑定成功', {
        userId,
        userNumber: updatedUser.userNumber,
        phone: phoneInfo.phoneNumber
      });

      return {
        success: true,
        phone: phoneInfo.phoneNumber
      };
    } catch (error) {
      logger.error('绑定手机号失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId
      });

      return {
        success: false,
        error: 'BIND_PHONE_FAILED',
        message: '手机号绑定失败'
      };
    }
  }

  /**
   * 检查服务状态
   */
  async checkHealth(): Promise<{ status: 'healthy' | 'error'; message: string; details?: any }> {
    try {
      if (!this.appId || !this.appSecret) {
        return {
          status: 'error',
          message: '微信认证配置缺失',
          details: {
            hasAppId: !!this.appId,
            hasAppSecret: !!this.appSecret
          }
        };
      }

      // 检查数据库连接
      await prisma.$queryRaw`SELECT 1`;

      // 尝试获取Access Token来验证配置
      const accessToken = await this.getAccessToken();

      return {
        status: 'healthy',
        message: '微信认证服务正常',
        details: {
          hasAccessToken: !!accessToken,
          appId: this.appId.substring(0, 8) + '...',
          database: 'connected',
          rateLimitEntries: this.loginAttempts.size
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: '微信认证服务异常',
        details: {
          error: error instanceof Error ? error.message : '未知错误'
        }
      };
    }
  }
}

// 导出单例实例
export const wechatAuthService = new WechatAuthService();