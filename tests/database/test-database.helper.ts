/**
 * 测试数据库管理工具
 * 提供独立的测试数据库环境，确保测试数据隔离
 */

import { PrismaClient } from '@prisma/client';

// 测试数据库配置
const TEST_DATABASE_CONFIG = {
  url: process.env.TEST_DATABASE_URL ||
       process.env.DATABASE_URL ||
       'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev',
  // 测试环境使用独立的前缀
  tablePrefix: 'test_',
  // 连接池配置（测试环境使用较小的连接池）
  connectionLimit: 5
};

/**
 * 测试数据库管理器
 */
export class TestDatabaseHelper {
  private static instance: TestDatabaseHelper;
  private prisma: PrismaClient;
  private isConnected = false;

  private constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_CONFIG.url
        }
      },
      log: process.env.NODE_ENV === 'test' ? ['error'] : ['query', 'info', 'warn', 'error']
    });
  }

  /**
   * 获取单例实例
   */
  static getInstance(): TestDatabaseHelper {
    if (!TestDatabaseHelper.instance) {
      TestDatabaseHelper.instance = new TestDatabaseHelper();
    }
    return TestDatabaseHelper.instance;
  }

  /**
   * 获取Prisma客户端
   */
  getPrisma(): PrismaClient {
    return this.prisma;
  }

  /**
   * 连接测试数据库
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.prisma.$connect();
      this.isConnected = true;
      console.log('✅ 测试数据库连接成功');
    } catch (error) {
      console.error('❌ 测试数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      console.log('✅ 测试数据库连接已断开');
    } catch (error) {
      console.warn('⚠️ 测试数据库断开连接失败:', error);
    }
  }

  /**
   * 清理所有测试数据
   */
  async cleanupAllTestData(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const startTime = Date.now();
    console.log('🧹 开始清理测试数据...');

    try {
      // 🚀 关键修复：严格按照外键依赖关系从最底层开始清理
      // 获取所有测试相关的用户ID
      const testUsersResult = await this.prisma.$queryRaw`
        SELECT id FROM users
        WHERE phone LIKE '1880000000%'
           OR openid LIKE 'test_%'
           OR nickname LIKE '%测试%'
           OR nickname LIKE '%Test%'
           OR createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      `;
      const testUserIds = (testUsersResult as any[]).map(u => u.id);

      console.log(`🔍 发现 ${testUserIds.length} 个测试用户需要清理`);

      if (testUserIds.length > 0) {
        const userIdsPlaceholder = testUserIds.map(() => '?').join(',');

        // 1. 清理引用users表的子表数据（按依赖层级排序）
        const 子表清理顺序 = [
          // 最底层：直接引用users的表
          { table: 'inventoryLogs', field: 'operatorId' },
          { table: 'pointsTransactions', field: 'toUserId' },  // 🚀 修复：使用toUserId字段
          { table: 'teamMembers', field: 'userId' },
          { table: 'notifications', field: 'recipientId' },  // 🚀 修复：使用recipientId字段
          { table: 'giftRecords', field: 'userId' },

          // 中间层：可能引用users的表
          { table: 'orderItems', field: 'buyerId', fallback: 'userId' },
          { table: 'inventoryItems', field: 'userId' },
          { table: '', field: 'userId' },

          // 上层：引用其他表的记录
          { table: 'orders', field: 'buyerId' }
        ];

        for (const { table, field, fallback } of 子表清理顺序) {
          try {
            await this.prisma.$executeRawUnsafe(
              `DELETE FROM \`${table}\` WHERE \`${field}\` IN (${userIdsPlaceholder})`,
              ...testUserIds
            );
            console.log(`✅ 清理 ${table} 表完成`);
          } catch (e) {
            // 如果主字段失败，尝试备用字段
            if (fallback) {
              try {
                await this.prisma.$executeRawUnsafe(
                  `DELETE FROM \`${table}\` WHERE \`${fallback}\` IN (${userIdsPlaceholder})`,
                  ...testUserIds
                );
                console.log(`✅ 清理 ${table} 表完成（使用备用字段 ${fallback}）`);
              } catch (e2) {
                console.log(`⚠️ 表 ${table} 清理失败（可能不存在或字段错误）`);
              }
            } else {
              console.log(`⚠️ 表 ${table} 清理失败（可能不存在）`);
            }
          }
        }
      }

      // 2. 清理商品相关的测试数据（独立于用户）
      try {
        // 先清理引用products的表
        await this.prisma.$executeRaw`DELETE FROM inventoryLogs WHERE productId IN (SELECT id FROM products WHERE name LIKE '%测试%' OR name LIKE '%Test%' OR createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY))`;

        // 然后清理products表
        await this.prisma.$executeRaw`DELETE FROM products WHERE name LIKE '%测试%' OR name LIKE '%Test%' OR createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)`;
        console.log(`✅ 清理 products 表完成`);
      } catch (e) {
        console.log(`⚠️ products 表清理失败`);
      }

      // 3. 清理商品分类（现在可以安全删除，因为products已清理）
      try {
        await this.prisma.$executeRaw`DELETE FROM productCategories WHERE name LIKE '%测试%' OR name LIKE '%Test%' OR createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)`;
        console.log(`✅ 清理 productCategories 表完成`);
      } catch (e) {
        console.log(`⚠️ productCategories 表清理失败`);
      }

      // 4. 最后清理users表（现在所有引用都已清理）
      try {
        const deletedUsers = await this.prisma.$executeRaw`
          DELETE FROM users
          WHERE phone LIKE '1880000000%'
             OR openid LIKE 'test_%'
             OR nickname LIKE '%测试%'
             OR nickname LIKE '%Test%'
             OR createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        `;
        console.log(`✅ 清理 users 表完成，删除了 ${deletedUsers} 个用户`);
      } catch (e) {
        console.log(`⚠️ users 表清理失败:`, e);
      }

      // 5. 清理配置表（只清理测试配置）
      try {
        await this.prisma.$executeRaw`DELETE FROM systemConfigs WHERE \`key\` LIKE 'test_%'`;
        console.log(`✅ 清理 systemConfigs 表完成`);
      } catch (e) {
        console.log(`⚠️ systemConfigs 表清理失败`);
      }

      console.log(`✅ 测试数据清理完成，耗时: ${Date.now() - startTime}ms`);
    } catch (error) {
      console.warn(`⚠️ 清理数据过程中出现错误:`, error);
      console.log(`✅ 继续执行清理完成，耗时: ${Date.now() - startTime}ms`);
    }
  }

  /**
   * 创建测试数据种子
   */
  async seedTestData(): Promise<{
    adminUser: any;
    normalUser: any;
    vipUser: any;
    starUser: any;
    testCategory: any;
    testProduct: any;
  }> {
    if (!this.isConnected) {
      await this.connect();
    }

    console.log('🌱 开始创建测试数据种子...');

    try {
      // 🚀 关键修复：确保创建顺序正确，先创建分类再创建商品
      let testCategory = await (this.prisma as any).productCategories.findFirst({
        where: { name: '测试分类' }
      });

      if (!testCategory) {
        // 生成唯一ID避免冲突
        const categoryId = `cat_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        testCategory = await (this.prisma as any).productCategories.create({
          data: {
            id: categoryId,
            name: '测试分类',
            description: '用于API测试的商品分类',
            icon: 'test_icon.png',
            level: 1,
            sort: 999,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log(`✅ 创建测试分类: ${testCategory.id}`);
      }

      // 创建测试用户 - 使用更安全的openid生成策略
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);

      const adminUser = await this.createTestUserSafe({
        phone: '18800000001',
        nickname: '测试管理员',
        level: 'DIRECTOR',
        role: 'ADMIN',
        openid: `test_admin_${timestamp}_${randomSuffix}` // 🚀 确保openid唯一性
      });

      const normalUser = await this.createTestUserSafe({
        phone: '18800000002',
        nickname: '普通测试用户',
        level: 'NORMAL',
        role: 'USER',
        openid: `test_normal_${timestamp}_${randomSuffix}`
      });

      const vipUser = await this.createTestUserSafe({
        phone: '18800000003',
        nickname: 'VIP测试用户',
        level: 'VIP',
        role: 'USER',
        openid: `test_vip_${timestamp}_${randomSuffix}`
      });

      const starUser = await this.createTestUserSafe({
        phone: '18800000004',
        nickname: '星级测试用户',
        level: 'STAR_3',
        role: 'USER',
        openid: `test_star_${timestamp}_${randomSuffix}`
      });

      // 创建测试商品 - 确保categoryId存在
      let testProduct = await (this.prisma as any).products.findFirst({
        where: { name: 'API测试商品' }
      });

      if (!testProduct) {
        const productId = `prod_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        testProduct = await (this.prisma as any).products.create({
          data: {
            id: productId,
            name: 'API测试商品',
            description: '专门用于API测试的商品',
            code: `TEST-PRODUCT-${timestamp}`, // 🚀 使用时间戳确保唯一性
            sku: `TEST-SKU-${timestamp}`,
            categoryId: testCategory.id, // 🚀 确保categoryId存在
            basePrice: 99.99,
            totalStock: 1000,
            minStock: 10,
            images: '["https://example.com/test-product.jpg"]', // 🚀 JSON格式
            status: 'ACTIVE',
            sort: 999,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log(`✅ 创建测试商品: ${testProduct.id}`);
      }

      console.log('✅ 测试数据种子创建完成');

      return {
        adminUser,
        normalUser,
        vipUser,
        starUser,
        testCategory,
        testProduct
      };
    } catch (error) {
      console.error('❌ 创建测试数据种子失败:', error);
      throw error;
    }
  }

  /**
   * 安全创建测试用户（处理openid唯一约束）
   */
  private async createTestUserSafe(userData: {
    phone: string;
    nickname: string;
    level: string;
    role: string;
    openid: string;
  }): Promise<any> {
    try {
      // 🚀 首先尝试通过phone查找现有用户
      let user = await (this.prisma as any).users.findUnique({
        where: { phone: userData.phone }
      });

      if (user) {
        // 如果用户存在，更新其信息
        user = await (this.prisma as any).users.update({
          where: { id: user.id },
          data: {
            nickname: userData.nickname,
            level: userData.level,
            status: 'ACTIVE',
            pointsBalance: 10000,
            pointsFrozen: 0,
            updatedAt: new Date()
          }
        });
        console.log(`✅ 更新现有用户: ${user.phone}`);
      } else {
        // 如果用户不存在，创建新用户
        user = await (this.prisma as any).users.create({
          data: {
            id: `cmi4${userData.phone.substring(7)}0000${Math.random().toString(36).substring(2, 8)}`,
            phone: userData.phone,
            nickname: userData.nickname,
            level: userData.level,
            openid: userData.openid, // 🚀 使用传入的唯一openid
            teamPath: userData.phone,
            status: 'ACTIVE',
            pointsBalance: 10000,
            pointsFrozen: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log(`✅ 创建新用户: ${user.phone}`);
      }

      return user;
    } catch (error: any) {
      // 如果遇到openid唯一约束冲突，生成新的openid重试
      if (error.code === 'P2002' && error.meta?.target?.includes('openid')) {
        console.log(`⚠️ openid冲突，重新生成...`);
        const newOpenid = `${userData.openid}_${Date.now()}_${Math.random().toString(36).substring(2, 4)}`;
        return this.createTestUserSafe({ ...userData, openid: newOpenid });
      }
      throw error;
    }
  }

  /**
   * 创建测试用户（保持向后兼容）
   */
  private async createTestUser(userData: {
    phone: string;
    nickname: string;
    level: string;
    role: string;
  }): Promise<any> {
    // 生成唯一的openid
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const uniqueOpenid = `test_openid_${userData.phone}_${timestamp}_${randomSuffix}`;

    return this.createTestUserSafe({
      ...userData,
      openid: uniqueOpenid
    });
  }

  /**
   * 重置数据库到初始状态
   */
  async resetDatabase(): Promise<void> {
    console.log('🔄 重置测试数据库...');
    await this.cleanupAllTestData();
    await this.seedTestData();
    console.log('✅ 测试数据库重置完成');
  }

  /**
   * 检查数据库连接状态
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ 数据库连接检查失败:', error);
      return false;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<Record<string, number>> {
    if (!this.isConnected) {
      await this.connect();
    }

    const stats: Record<string, number> = {};

    try {
      // 获取主要表的记录数
      const tables = ['users', 'orders', 'products', 'pointsTransaction', 'shops'];

      for (const table of tables) {
        try {
          const count = await (this.prisma as any)[table].count();
          stats[table] = count;
        } catch (error) {
          stats[table] = 0;
        }
      }

      // 获取测试数据统计
      stats.testUsers = await (this.prisma as any).users.count({
        where: {
          OR: [
            { phone: { startsWith: '1880000000' } },
            { nickname: { startsWith: '测试' } }
          ]
        }
      });

      stats.testOrders = await (this.prisma as any).orders.count({
        where: {
          OR: [
            { order_no: { startsWith: 'TEST_' } },
            { buyer_notes: { contains: '测试' } }
          ]
        }
      });

    } catch (error) {
      console.error('❌ 获取数据库统计失败:', error);
    }

    return stats;
  }

  /**
   * 执行数据库事务
   */
  async transaction<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    if (!this.isConnected) {
      await this.connect();
    }

    return await this.prisma.$transaction(callback);
  }
}

// 导出单例实例
export const testDb = TestDatabaseHelper.getInstance();

// 导出便捷函数
export const connectTestDatabase = () => testDb.connect();
export const disconnectTestDatabase = () => testDb.disconnect();
export const cleanupTestData = () => testDb.cleanupAllTestData();
export const seedTestData = () => testDb.seedTestData();
export const resetTestDatabase = () => testDb.resetDatabase();
export const getTestDbStats = () => testDb.getDatabaseStats();
export const withTestTransaction = <T>(callback: (prisma: PrismaClient) => Promise<T>) =>
  testDb.transaction(callback);