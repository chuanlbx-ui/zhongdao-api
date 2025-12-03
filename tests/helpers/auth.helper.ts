/**
 * 测试认证工具
 * 提供测试用JWT token生成和用户管理功能
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';

const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev'
    }
  }
});

export interface TestUser {
  id: string;
  phone: string;
  nickname: string;
  level: 'NORMAL' | 'VIP' | 'STAR_1' | 'STAR_2' | 'STAR_3' | 'STAR_4' | 'STAR_5' | 'DIRECTOR';
  role: 'USER' | 'ADMIN';
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export class TestAuthHelper {
  private static readonly JWT_SECRET = config.jwt.secret;
  private static readonly JWT_EXPIRES_IN = config.jwt.expiresIn;
  private static readonly REFRESH_TOKEN_EXPIRES_IN = config.jwt.refreshExpiresIn;

  /**
   * 生成JWT token
   */
  private static generateToken(payload: any, expiresIn: string = this.JWT_EXPIRES_IN): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn,
      issuer: 'zhongdao-mall-test',
      audience: 'zhongdao-mall-users'
    });
  }

  /**
   * 生成访问令牌
   */
  private static generateAccessToken(user: any): string {
    return this.generateToken({
      sub: user.id,
      phone: user.phone,
      role: user.role,
      level: user.level,
      type: 'access'
    }, this.JWT_EXPIRES_IN);
  }

  /**
   * 生成刷新令牌
   */
  private static generateRefreshToken(user: any): string {
    return this.generateToken({
      sub: user.id,
      phone: user.phone,
      type: 'refresh',
      jti: `refresh_${user.id}_${Date.now()}`
    }, this.REFRESH_TOKEN_EXPIRES_IN);
  }

  /**
   * 创建测试用户
   */
  static async createTestUser(userData: {
    phone: string;
    nickname?: string;
    level?: string;
    role?: string;
    wechatOpenId?: string;
  }): Promise<TestUser> {
    const { phone, nickname, level = 'NORMAL', role = 'USER', wechatOpenId } = userData;

    // 检查用户是否已存在
    let user = await testPrisma.user.findUnique({
      where: { phone }
    });

    if (!user) {
      // 创建新用户
      const hashedPassword = await bcrypt.hash('Test123456!', 10);

      user = await testPrisma.user.create({
        data: {
          phone,
          nickname: nickname || `测试用户_${phone.slice(-4)}`,
          password: hashedPassword,
          level: level as any,
          role: role as any,
          wechat_open_id: wechatOpenId || `test_openid_${phone}`,
          wechat_union_id: `test_unionid_${phone}`,
          parent_id: null, // 测试用户通常没有父级
          team_path: phone, // 团队路径就是自己
          is_active: true,
          email_verified: true,
          phone_verified: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } else {
      // 更新现有用户
      user = await testPrisma.user.update({
        where: { id: user.id },
        data: {
          level: level as any,
          role: role as any,
          is_active: true,
          updated_at: new Date()
        }
      });
    }

    // 生成token
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      level: user.level as any,
      role: user.role as any,
      tokens: {
        accessToken,
        refreshToken
      }
    };
  }

  /**
   * 创建管理员测试用户
   */
  static async createAdminUser(): Promise<TestUser> {
    return this.createTestUser({
      phone: '18800000001',
      nickname: '测试管理员',
      level: 'DIRECTOR',
      role: 'ADMIN',
      wechatOpenId: 'test_admin_openid'
    });
  }

  /**
   * 创建普通测试用户
   */
  static async createNormalUser(): Promise<TestUser> {
    return this.createTestUser({
      phone: '18800000002',
      nickname: '测试用户',
      level: 'NORMAL',
      role: 'USER',
      wechatOpenId: 'test_user_openid'
    });
  }

  /**
   * 创建VIP测试用户
   */
  static async createVipUser(): Promise<TestUser> {
    return this.createTestUser({
      phone: '18800000003',
      nickname: 'VIP测试用户',
      level: 'VIP',
      role: 'USER',
      wechatOpenId: 'test_vip_openid'
    });
  }

  /**
   * 创建星级店长测试用户
   */
  static async createStarUser(starLevel: number = 1): Promise<TestUser> {
    return this.createTestUser({
      phone: `1880000000${3 + starLevel}`,
      nickname: `${starLevel}星级店长测试`,
      level: `STAR_${starLevel}` as any,
      role: 'USER',
      wechatOpenId: `test_star${starLevel}_openid`
    });
  }

  /**
   * 验证token有效性
   */
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET, {
        issuer: 'zhongdao-mall-test',
        audience: 'zhongdao-mall-users'
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * 生成CSRF token（用于测试）
   */
  static generateCsrfToken(): string {
    return `test_csrf_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * 清理测试用户
   */
  static async cleanupTestUsers(): Promise<void> {
    try {
      // 删除测试创建的用户
      await testPrisma.user.deleteMany({
        where: {
          OR: [
            { phone: { startsWith: '1880000000' } },
            { wechat_open_id: { startsWith: 'test_' } },
            { nickname: { startsWith: '测试用户' } }
          ]
        }
      });
      console.log('✅ 测试用户已清理');
    } catch (error) {
      console.warn('⚠️ 测试用户清理失败:', error);
    }
  }

  /**
   * 为请求添加认证头
   */
  static getAuthHeaders(user: TestUser, csrfToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${user.tokens.accessToken}`,
      'Content-Type': 'application/json'
    };

    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    return headers;
  }

  /**
   * 批量创建测试用户
   */
  static async createTestUsers(): Promise<{
    admin: TestUser;
    normal: TestUser;
    vip: TestUser;
    star1: TestUser;
    star3: TestUser;
    star5: TestUser;
  }> {
    const users = await Promise.all([
      this.createAdminUser(),
      this.createNormalUser(),
      this.createVipUser(),
      this.createStarUser(1),
      this.createStarUser(3),
      this.createStarUser(5)
    ]);

    return {
      admin: users[0],
      normal: users[1],
      vip: users[2],
      star1: users[3],
      star3: users[4],
      star5: users[5]
    };
  }
}

// 导出便捷函数
export const createTestUser = TestAuthHelper.createTestUser;
export const createAdminUser = TestAuthHelper.createAdminUser;
export const createNormalUser = TestAuthHelper.createNormalUser;
export const createTestUsers = TestAuthHelper.createTestUsers;
export const cleanupTestUsers = TestAuthHelper.cleanupTestUsers;
export const getAuthHeaders = TestAuthHelper.getAuthHeaders;