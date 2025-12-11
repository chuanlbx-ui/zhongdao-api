/**
 * 数据库测试隔离工具
 * 确保每个测试都有独立的数据库环境，避免测试之间的数据污染
 */

import { PrismaClient } from '@prisma/client';
import { TestDatabaseHelper } from '../database/test-database.helper';

interface IsolationContext {
  id: string;
  startTime: number;
  snapshots: Map<string, any>;
  transaction?: any;
}

export class DatabaseIsolation {
  private prisma: PrismaClient;
  private contexts: Map<string, IsolationContext> = new Map();
  private globalSnapshot: any = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 开始测试隔离上下文
   */
  async startIsolation(testName: string): Promise<string> {
    const contextId = `${testName}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const context: IsolationContext = {
      id: contextId,
      startTime: Date.now(),
      snapshots: new Map()
    };

    // 如果是第一个测试，创建全局快照
    if (this.contexts.size === 0) {
      await this.createGlobalSnapshot();
    }

    // 创建测试事务（可选，更严格的隔离）
    if (process.env.USE_DB_TRANSACTION_FOR_ISOLATION === 'true') {
      context.transaction = await this.prisma.$beginTransaction();
    }

    this.contexts.set(contextId, context);
    console.log(`🔒 开始数据库隔离: ${contextId}`);

    return contextId;
  }

  /**
   * 结束测试隔离上下文
   */
  async endIsolation(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Isolation context not found: ${contextId}`);
    }

    try {
      // 如果使用了事务，回滚事务
      if (context.transaction) {
        await context.transaction.rollback();
        await context.transaction.commit();
      } else {
        // 否则恢复到全局快照
        await this.restoreFromGlobalSnapshot();
      }

      const duration = Date.now() - context.startTime;
      console.log(`🔓 结束数据库隔离: ${contextId}, 耗时: ${duration}ms`);
    } catch (error) {
      console.error(`❌ 结束隔离失败: ${contextId}`, error);
      throw error;
    } finally {
      this.contexts.delete(contextId);
    }
  }

  /**
   * 创建全局快照
   */
  private async createGlobalSnapshot(): Promise<void> {
    console.log('📸 创建全局数据库快照...');

    this.globalSnapshot = {
      timestamp: Date.now(),
      data: new Map()
    };

    // 获取所有需要隔离的表
    const tables = [
      'users', 'productCategories', 'products', 'shops',
      'orders', 'orderItems', 'pointsTransactions', 'commissions',
      'notifications', 'inventoryLogs', 'teamMembers'
    ];

    for (const table of tables) {
      try {
        // 检查表是否存在
        const tableName = this.prisma._getDataModel().models.find((m: any) =>
          m.name.toLowerCase() === table.toLowerCase()
        )?.name || table;

        const records = await (this.prisma as any)[tableName].findMany({
          where: {
            OR: [
              { phone: { startsWith: '18800000' } },
              { nickname: { contains: '测试' } },
              { openid: { startsWith: 'test_' } },
              { orderNo: { startsWith: 'TEST-' } },
              { id: { startsWith: 'test_' } }
            ]
          }
        });

        this.globalSnapshot.data.set(table, records);
        console.log(`  - 快照 ${table}: ${records.length} 条记录`);
      } catch (error) {
        console.log(`  - 跳过表 ${table}: ${error}`);
      }
    }
  }

  /**
   * 从全局快照恢复
   */
  private async restoreFromGlobalSnapshot(): Promise<void> {
    if (!this.globalSnapshot) {
      console.warn('⚠️ 全局快照不存在，跳过恢复');
      return;
    }

    console.log('🔄 从全局快照恢复数据库...');

    // 按依赖关系顺序清理
    const cleanupOrder = [
      'commissions', 'pointsTransactions', 'orderItems', 'orders',
      'inventoryLogs', 'teamMembers', 'notifications',
      'shops', 'products', 'productCategories', 'users'
    ];

    // 清理测试数据
    for (const table of cleanupOrder) {
      try {
        const tableName = this.prisma._getDataModel().models.find((m: any) =>
          m.name.toLowerCase() === table.toLowerCase()
        )?.name || table;

        await (this.prisma as any)[tableName].deleteMany({
          where: {
            OR: [
              { phone: { startsWith: '18800000' } },
              { nickname: { contains: '测试' } },
              { openid: { startsWith: 'test_' } },
              { orderNo: { startsWith: 'TEST-' } },
              { id: { startsWith: 'test_' } }
            ]
          }
        });
      } catch (error) {
        console.log(`  - 跳过清理表 ${table}: ${error}`);
      }
    }
  }

  /**
   * 在隔离上下文中执行操作
   */
  async executeInIsolation<T>(
    contextId: string,
    operation: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Isolation context not found: ${contextId}`);
    }

    // 如果有事务，使用事务的prisma
    const prisma = context.transaction?.prisma || this.prisma;
    return await operation(prisma);
  }

  /**
   * 获取隔离上下文信息
   */
  getContextInfo(contextId: string): IsolationContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * 获取所有活跃的隔离上下文
   */
  getActiveContexts(): IsolationContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * 清理所有隔离上下文（通常在测试套件结束时调用）
   */
  async cleanupAllContexts(): Promise<void> {
    console.log(`🧹 清理 ${this.contexts.size} 个隔离上下文...`);

    for (const [contextId] of this.contexts) {
      try {
        await this.endIsolation(contextId);
      } catch (error) {
        console.error(`清理上下文失败: ${contextId}`, error);
      }
    }

    this.contexts.clear();
    this.globalSnapshot = null;
  }

  /**
   * 验证数据库隔离状态
   */
  async validateIsolation(): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];

    // 检查是否有活跃的上下文
    if (this.contexts.size > 0) {
      issues.push(`发现 ${this.contexts.size} 个未清理的隔离上下文`);
    }

    // 检查测试数据泄漏
    const tables = ['users', 'orders', 'products'];
    for (const table of tables) {
      try {
        const tableName = this.prisma._getDataModel().models.find((m: any) =>
          m.name.toLowerCase() === table.toLowerCase()
        )?.name || table;

        const count = await (this.prisma as any)[tableName].count({
          where: {
            OR: [
              { phone: { startsWith: '18800000' } },
              { nickname: { contains: '测试' } }
            ]
          }
        });

        if (count > 0) {
          issues.push(`表 ${table} 中发现 ${count} 条测试数据泄漏`);
        }
      } catch (error) {
        // 忽略表不存在的错误
      }
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }
}

/**
 * 测试隔离装饰器
 */
export function withDatabaseIsolation(testName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const isolation = this.databaseIsolation || new DatabaseIsolation(this.prisma);
      const contextId = await isolation.startIsolation(`${testName}_${propertyKey}`);

      try {
        const result = await originalMethod.apply(this, args);
        await isolation.endIsolation(contextId);
        return result;
      } catch (error) {
        await isolation.endIsolation(contextId);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Vitest测试钩子辅助函数
 */
export function createDatabaseIsolationHooks(prisma: PrismaClient) {
  const isolation = new DatabaseIsolation(prisma);

  return {
    beforeAll: async () => {
      // 测试套件开始前的准备工作
      console.log('🔧 初始化数据库隔离...');
    },

    afterAll: async () => {
      // 测试套件结束后的清理工作
      await isolation.cleanupAllContexts();

      // 验证隔离状态
      const validation = await isolation.validateIsolation();
      if (!validation.passed) {
        console.warn('⚠️ 数据库隔离验证失败:', validation.issues);
      }
    },

    beforeEach: async (testName: string) => {
      // 每个测试开始前
      const contextId = await isolation.startIsolation(testName);
      return contextId;
    },

    afterEach: async (contextId: string) => {
      // 每个测试结束后
      if (contextId) {
        await isolation.endIsolation(contextId);
      }
    }
  };
}

export default DatabaseIsolation;