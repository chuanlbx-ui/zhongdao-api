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
    const tables = [
      // 按照外键依赖顺序删除（先删除依赖表）
      { name: 'user_sessions', model: 'userSession' },
      { name: 'points_transactions', model: 'pointsTransaction' },
      { name: 'commissions', model: 'commission' },
      { name: 'orders', model: 'order' },
      { name: 'order_items', model: 'orderItem' },
      { name: 'inventory_items', model: 'inventoryItem' },
      { name: 'stock_records', model: 'stockRecord' },
      { name: 'shop_performance', model: 'shopPerformance' },
      { name: 'user_points', model: 'userPoints' },
      { name: 'shops', model: 'shop' },
      { name: 'team_relationships', model: 'teamRelationship' },
      { name: 'user', model: 'user' },
      // 清理配置和系统数据（保留必要的系统配置）
      { name: 'system_configs', model: 'systemConfig', condition: { key: { startsWith: 'test_' } } }
    ];

    console.log('🧹 开始清理测试数据...');

    for (const table of tables) {
      try {
        let whereClause: any = {};

        // 根据表名构建不同的清理条件
        if (table.condition) {
          whereClause = table.condition;
        } else if (table.name.includes('user')) {
          whereClause = {
            OR: [
              { phone: { startsWith: '1880000000' } },
              { wechat_open_id: { startsWith: 'test_' } },
              { wechat_union_id: { startsWith: 'test_' } },
              { nickname: { startsWith: '测试' } },
              { nickname: { startsWith: 'Test' } },
              { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // 最近24小时的数据
            ]
          };
        } else if (table.name.includes('order')) {
          whereClause = {
            OR: [
              { order_no: { startsWith: 'TEST_' } },
              { order_no: { startsWith: 'test_' } },
              { buyer_notes: { contains: '测试' } },
              { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            ]
          };
        } else if (table.name.includes('points')) {
          whereClause = {
            OR: [
              { description: { contains: 'test_' } },
              { description: { contains: '测试' } },
              { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            ]
          };
        } else {
          // 通用条件：清理最近24小时的数据和包含test_前缀的数据
          whereClause = {
            OR: [
              { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            ]
          };

          // 为有名称字段的表添加test_前缀检查
          if (['shops'].includes(table.name)) {
            whereClause.OR.push({ name: { startsWith: 'test_' } });
            whereClause.OR.push({ name: { contains: '测试' } });
          }
        }

        // 执行删除操作
        if (Object.keys(whereClause).length > 0 || table.condition) {
          const result = await (this.prisma as any)[table.model].deleteMany({
            where: table.condition || whereClause
          });

          if (result.count > 0) {
            console.log(`✓ 清理 ${table.name}: ${result.count} 条记录`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ 清理 ${table.name} 失败:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`🎉 测试数据清理完成，耗时: ${duration}ms`);
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
      // 创建测试用户
      const adminUser = await this.createTestUser({
        phone: '18800000001',
        nickname: '测试管理员',
        level: 'DIRECTOR',
        role: 'ADMIN'
      });

      const normalUser = await this.createTestUser({
        phone: '18800000002',
        nickname: '普通测试用户',
        level: 'NORMAL',
        role: 'USER'
      });

      const vipUser = await this.createTestUser({
        phone: '18800000003',
        nickname: 'VIP测试用户',
        level: 'VIP',
        role: 'USER'
      });

      const starUser = await this.createTestUser({
        phone: '18800000004',
        nickname: '星级测试用户',
        level: 'STAR_3',
        role: 'USER'
      });

      // 创建测试商品分类
      const testCategory = await (this.prisma as any).productCategory.upsert({
        where: { name: '测试分类' },
        update: {},
        create: {
          name: '测试分类',
          description: '用于API测试的商品分类',
          icon: 'test_icon.png',
          level: 1,
          sort_order: 999,
          status: 'ACTIVE'
        }
      });

      // 创建测试商品
      const testProduct = await (this.prisma as any).product.upsert({
        where: { name: 'API测试商品' },
        update: {},
        create: {
          name: 'API测试商品',
          description: '专门用于API测试的商品',
          category_id: testCategory.id,
          base_price: 99.99,
          vip_price: 89.99,
          star_price: 79.99,
          director_price: 69.99,
          total_stock: 1000,
          min_stock: 10,
          current_stock: 950,
          images: 'https://example.com/test-product.jpg',
          status: 'ACTIVE',
          sort_order: 999
        }
      });

      // 初始化用户积分
      await (this.prisma as any).userPoints.upsert({
        where: { user_id: normalUser.id },
        update: {},
        create: {
          user_id: normalUser.id,
          balance: 10000,
          frozen_balance: 0,
          total_earned: 10000,
          total_spent: 0
        }
      });

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
   * 创建测试用户
   */
  private async createTestUser(userData: {
    phone: string;
    nickname: string;
    level: string;
    role: string;
  }): Promise<any> {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Test123456!', 10);

    return await (this.prisma as any).user.upsert({
      where: { phone: userData.phone },
      update: {
        nickname: userData.nickname,
        level: userData.level,
        role: userData.role,
        updated_at: new Date()
      },
      create: {
        phone: userData.phone,
        nickname: userData.nickname,
        password: hashedPassword,
        level: userData.level,
        role: userData.role,
        wechat_open_id: `test_openid_${userData.phone}`,
        wechat_union_id: `test_unionid_${userData.phone}`,
        team_path: userData.phone,
        is_active: true,
        email_verified: true,
        phone_verified: true
      }
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
      const tables = ['user', 'order', 'product', 'pointsTransaction', 'shop'];

      for (const table of tables) {
        try {
          const count = await (this.prisma as any)[table].count();
          stats[table] = count;
        } catch (error) {
          stats[table] = 0;
        }
      }

      // 获取测试数据统计
      stats.testUsers = await (this.prisma as any).user.count({
        where: {
          OR: [
            { phone: { startsWith: '1880000000' } },
            { nickname: { startsWith: '测试' } }
          ]
        }
      });

      stats.testOrders = await (this.prisma as any).order.count({
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