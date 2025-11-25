import axios from 'axios';
import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import { generateToken, generateRefreshToken } from '../middleware/auth';
import { UserLevel, UserStatus } from '@prisma/client';

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

// 登录结果接口
interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    openid: string;
    nickname: string;
    avatarUrl: string;
    level: UserLevel;
    status: string;
    isNewUser: boolean;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
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

  constructor() {
    this.appId = process.env.WECHAT_APP_ID || '';
    this.appSecret = process.env.WECHAT_APP_SECRET || '';

    if (!this.appId || !this.appSecret) {
      logger.warn('微信认证配置不完整', {
        hasAppId: !!this.appId,
        hasAppSecret: !!this.appSecret
      });
    }
  }

  /**
   * 微信小程序登录
   */
  async login(code: string, userInfo?: Partial<WechatUserInfo>): Promise<LoginResult> {
    try {
      // 验证配置
      if (!this.appId || !this.appSecret) {
        return {
          success: false,
          error: 'WECHAT_CONFIG_MISSING',
          message: '微信认证配置缺失'
        };
      }

      // 调用微信API获取session_key和openid
      const sessionData = await this.getWechatSession(code);

      if (!sessionData.openid) {
        return {
          success: false,
          error: 'WECHAT_CODE_INVALID',
          message: sessionData.errmsg || '微信授权码无效'
        };
      }

      // 查找或创建用户
      const userResult = await this.findOrCreateUser(sessionData.openid, userInfo);

      if (!userResult.success) {
        return userResult;
      }

      // 生成JWT Token
      const tokenPayload = {
        sub: userResult.user!.id,
        scope: ['active', 'user'],
        level: userResult.user!.level
      };

      const accessToken = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      logger.info('微信登录成功', {
        userId: userResult.user!.id,
        openid: sessionData.openid,
        isNewUser: userResult.user!.isNewUser
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
        }
      };
    } catch (error) {
      logger.error('微信登录失败', {
        error: error instanceof Error ? error.message : '未知错误',
        code
      });

      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: '微信登录失败'
      };
    }
  }

  /**
   * 获取微信会话信息
   */
  private async getWechatSession(code: string): Promise<WechatSessionResponse> {
    const url = `${this.baseUrl}/sns/jscode2session`;

    try {
      const response = await axios.get<WechatSessionResponse>(url, {
        params: {
          appid: this.appId,
          secret: this.appSecret,
          js_code: code,
          grant_type: 'authorization_code'
        },
        timeout: 10000
      });

      if (response.data.errcode) {
        logger.warn('微信API返回错误', {
          errcode: response.data.errcode,
          errmsg: response.data.errmsg
        });
      }

      return response.data;
    } catch (error) {
      logger.error('调用微信API失败', {
        error: error instanceof Error ? error.message : '网络错误',
        url,
        appId: this.appId
      });
      throw new Error('微信API调用失败');
    }
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
      let user = await prisma.user.findUnique({
        where: { openid }
      });

      let isNewUser = false;

      if (!user) {
        // 创建新用户
        const newUser = {
          openid,
          nickname: userInfo?.nickname || '微信用户',
          avatarUrl: userInfo?.avatarUrl || '',
          level: UserLevel.NORMAL,
          status: UserStatus.ACTIVE,
          teamPath: null,
          refereeId: null
        };

        user = await prisma.user.create({
          data: newUser
        });

        isNewUser = true;

        logger.info('创建新用户', {
          userId: user.id,
          openid,
          nickname: user.nickname
        });
      } else {
        // 更新用户信息（如果有提供新信息）
        if (userInfo && (userInfo.nickname || userInfo.avatarUrl)) {
          const updateData: any = {};
          if (userInfo.nickname) updateData.nickname = userInfo.nickname;
          if (userInfo.avatarUrl) updateData.avatarUrl = userInfo.avatarUrl;

          user = await prisma.user.update({
            where: { id: user.id },
            data: updateData
          });
        }
      }

      // 检查用户状态
      if (user.status !== 'ACTIVE') {
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
        openid
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
  async verifyUserInfo(sessionKey: string, rawData: string, signature: string): Promise<boolean> {
    try {
      const crypto = await import('crypto');
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
   * 解密微信手机号
   */
  async decryptPhoneNumber(sessionKey: string, encryptedData: string, iv: string): Promise<any> {
    try {
      const crypto = await import('crypto');
      const decipher = crypto.createDecipheriv('aes-128-cbc',
        Buffer.from(sessionKey, 'base64'),
        Buffer.from(iv, 'base64')
      );

      decipher.setAutoPadding(true);

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('解密微信手机号失败', {
        error: error instanceof Error ? error.message : '解密错误'
      });
      throw new Error('手机号解密失败');
    }
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

      // 尝试获取Access Token来验证配置
      const accessToken = await this.getAccessToken();

      return {
        status: 'healthy',
        message: '微信认证服务正常',
        details: {
          hasAccessToken: !!accessToken,
          appId: this.appId.substring(0, 8) + '...'
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