import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// 全局Prisma实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 🚀 关键修复：确保PrismaClient正确使用数据库连接池配置
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
  ] : [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
  // 🚀 使用环境变量中的连接池配置，解决测试环境连接池耗尽问题
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// 连接数据库
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('数据库连接成功');
  } catch (error) {
    logger.error('数据库连接失败:', error);
    throw error;
  }
};

// 断开数据库连接
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('数据库连接已断开');
  } catch (error) {
    logger.error('数据库断开失败:', error);
    throw error;
  }
};

// 健康检查
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('数据库健康检查失败:', error);
    return false;
  }
};

// 获取数据库连接统计信息
export const getConnectionStats = () => {
  // 返回连接池统计信息
  return {
    url: process.env.DATABASE_URL ? '***configured***' : 'not configured',
    nodeEnv: process.env.NODE_ENV || 'unknown'
  };
};

// 开发环境下使用全局实例，避免多次创建
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
