/**
 * 测试认证工具
 * 提供测试用JWT token生成和用户管理功能
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

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
  private static readonly JWT_SECRET = process.env.JWT_SECRET || '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';
  private static readonly JWT_EXPIRES_IN = '24h';
  private static readonly REFRESH_TOKEN_EXPIRES_IN = '7d';

  // 全局缓存，避免重复创建用户
  private static userCache = new Map<string, TestUser>();

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
    // 根据用户等级判断角色
    const role = user.level === 'DIRECTOR' ? 'ADMIN' : 'USER';

    return this.generateToken({
      sub: user.id,
      phone: user.phone,
      role,
      level: user.level,
      scope: ['active', 'user'],
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
   * 创建测试用户（带缓存，处理openid唯一约束）
   */
  static async createTestUser(userData: {
    phone: string;
    nickname?: string;
    level?: string;
    role?: string;
    wechatOpenId?: string;
  }): Promise<TestUser> {
    const { phone, nickname, level = 'NORMAL', role = 'USER', wechatOpenId } = userData;

    // 检查缓存
    const cacheKey = `${level}_${phone || 'auto'}`;
    if (this.userCache.has(cacheKey)) {
      return this.userCache.get(cacheKey)!;
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2);

    try {
      // 🚀 关键修复：优先通过phone查找用户，避免openid冲突
      let user = await testPrisma.users.findUnique({
        where: { phone }
      });

      // 生成唯一的openid
      const uniqueOpenid = wechatOpenId || `test_openid_${phone}_${timestamp}_${randomStr}`;

      if (!user) {
        // 创建新用户 - 🚀 移除password字段（微信小程序不需要）
        user = await testPrisma.users.create({
          data: {
            id: createId(),
            phone: phone || `test_phone_${timestamp}_${randomStr}`,
            nickname: nickname || `测试用户_${randomStr}`,
            level: level as any,
            openid: uniqueOpenid, // 🚀 使用唯一openid
            parentId: null, // 测试用户通常没有父级
            teamPath: phone || `test_path_${timestamp}_${randomStr}`, // 团队路径就是自己
            status: 'ACTIVE',
            pointsBalance: 10000, // 🚀 增加积分余额用于测试
            pointsFrozen: 0,
            referralCode: `TEST${randomStr}_${timestamp}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log(`✅ 创建新测试用户: ${user.phone} (${user.level})`);
      } else {
        // 更新现有用户
        user = await testPrisma.users.update({
          where: { id: user.id },
          data: {
            nickname: nickname || user.nickname,
            level: level as any,
            status: 'ACTIVE',
            pointsBalance: 10000, // 重置积分余额
            pointsFrozen: 0,
            updatedAt: new Date()
          }
        });
        console.log(`✅ 更新现有测试用户: ${user.phone} (${user.level})`);
      }

      // 生成token
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // 根据用户等级判断角色
      const userRole = user.level === 'DIRECTOR' ? 'ADMIN' : 'USER';

      const testUser: TestUser = {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname || '',
        level: user.level as any,
        role: userRole as any,
        tokens: {
          accessToken,
          refreshToken
        }
      };

      // 保存到缓存
      this.userCache.set(cacheKey, testUser);

      return testUser;
    } catch (error: any) {
      // 🚀 处理openid唯一约束冲突
      if (error.code === 'P2002' && error.meta?.target?.includes('openid')) {
        console.log(`⚠️ openid冲突，重新生成并重试...`);
        // 生成新的openid并重试
        const newOpenid = `test_openid_${phone}_${timestamp}_${randomStr}_${Date.now()}`;
        return TestAuthHelper.createTestUser({
          ...userData,
          wechatOpenId: newOpenid
        });
      }
      throw error;
    }
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
      const JWT_SECRET = TestAuthHelper.JWT_SECRET;
      return jwt.verify(token, JWT_SECRET, {
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
      // 🚀 修复：使用原始SQL避免外键约束问题，严格按照依赖顺序清理
      // 获取测试用户ID
      const testUsersResult = await testPrisma.$queryRaw`
        SELECT id FROM users
        WHERE phone LIKE '1880000000%'
           OR openid LIKE 'test_%'
           OR nickname LIKE '测试用户%'
      `;
      const testUserIds = (testUsersResult as any[]).map(u => u.id);

      if (testUserIds.length > 0) {
        const userIdsPlaceholder = testUserIds.map(() => '?').join(',');

        // 1. 先清理引用users表的子表数据（按依赖层级排序）
        const 子表清理顺序 = [
          // 最底层：直接引用users的表
          { table: 'inventoryLogs', field: 'operatorId' },
          { table: 'pointsTransactions', field: 'userId' },
          // 🚀 移除userPoints表引用，因为积分字段在users表内
          { table: 'teamMembers', field: 'userId' },
          { table: 'shopManagers', field: 'userId' },
          { table: 'commissions', field: 'userId' },
          { table: 'notifications', field: 'userId' },
          { table: 'giftRecords', field: 'userId' },

          // 中间层：可能引用users的表
          { table: 'orderItems', field: 'buyerId', fallback: 'userId' },
          { table: 'inventoryItems', field: 'userId' },
          { table: 'productReviews', field: 'userId' },

          // 上层：引用其他表的记录
          { table: 'orders', field: 'buyerId' }
        ];

        for (const { table, field, fallback } of 子表清理顺序) {
          try {
            await testPrisma.$executeRawUnsafe(
              `DELETE FROM \`${table}\` WHERE \`${field}\` IN (${userIdsPlaceholder})`,
              ...testUserIds
            );
          } catch (e) {
            // 如果主字段失败，尝试备用字段
            if (fallback) {
              try {
                await testPrisma.$executeRawUnsafe(
                  `DELETE FROM \`${table}\` WHERE \`${fallback}\` IN (${userIdsPlaceholder})`,
                  ...testUserIds
                );
              } catch (e2) {
                // 表可能不存在或字段名不对，忽略
              }
            }
          }
        }
      }

      // 2. 最后清理users表
      const deletedUsers = await testPrisma.$executeRaw`
        DELETE FROM users
        WHERE phone LIKE '1880000000%'
           OR openid LIKE 'test_%'
           OR nickname LIKE '测试用户%'
      `;
      console.log(`✅ 测试用户已清理，删除了 ${deletedUsers} 个用户`);
    } catch (error) {
      console.warn('⚠️ 测试用户清理失败:', error);
    }
  }

  /**
   * 创建测试用户（简化版本）
   */
  static async createTestUserByType(type: 'normal' | 'vip' | 'star1' | 'star2' | 'star3' | 'admin' | 'director' = 'normal'): Promise<TestUser> {
    const phoneMap = {
      'normal': '18800000002',
      'vip': '18800000003',
      'star1': '18800000004',
      'star2': '18800000005',
      'star3': '18800000006',
      'admin': '18800000001',
      'director': '18800000007'
    };

    const levelMap = {
      'normal': 'NORMAL',
      'vip': 'VIP',
      'star1': 'STAR_1',
      'star2': 'STAR_2',
      'star3': 'STAR_3',
      'admin': 'DIRECTOR',
      'director': 'DIRECTOR'
    };

    const roleMap = {
      'normal': 'USER',
      'vip': 'USER',
      'star1': 'USER',
      'star2': 'USER',
      'star3': 'USER',
      'admin': 'ADMIN',
      'director': 'ADMIN'
    };

    return TestAuthHelper.createTestUser({
      phone: phoneMap[type],
      nickname: `测试${type}用户`,
      level: levelMap[type],
      role: roleMap[type],
      wechatOpenId: `test_${type}_openid`
    });
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
      TestAuthHelper.createAdminUser(),
      TestAuthHelper.createNormalUser(),
      TestAuthHelper.createVipUser(),
      TestAuthHelper.createStarUser(1),
      TestAuthHelper.createStarUser(3),
      TestAuthHelper.createStarUser(5)
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
export const createTestUser = TestAuthHelper.createTestUserByType;
export const createAdminUser = TestAuthHelper.createAdminUser;
export const createNormalUser = TestAuthHelper.createNormalUser;
export const createTestUsers = TestAuthHelper.createTestUsers;
export const cleanupTestUsers = TestAuthHelper.cleanupTestUsers;
export const getAuthHeaders = TestAuthHelper.getAuthHeaders;
export const verifyToken = TestAuthHelper.verifyToken;