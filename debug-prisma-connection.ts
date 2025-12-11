import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// 加载环境变量
config({ path: '.env.development' });

console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已设置' : '未设置');

// 直接创建PrismaClient实例
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn']
});

async function debugPrisma() {
  try {
    console.log('\n尝试连接数据库...');
    await prisma.$connect();
    console.log('数据库连接成功!');

    console.log('\n测试查询...');

    // 测试原始查询
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('原始查询结果:', result);

    // 测试user表是否存在
    try {
      const userCount = await prisma.user.count();
      console.log('\n用户总数:', userCount);

      if (userCount > 0) {
        const firstUser = await prisma.user.findFirst({
          select: {
            id: true,
            phone: true,
            nickname: true
          }
        });
        console.log('第一个用户:', firstUser);
      } else {
        console.log('没有用户数据');
      }
    } catch (error) {
      console.error('查询用户表失败:', error);

      // 检查表是否存在
      const tables = await prisma.$queryRaw`SHOW TABLES`;
      console.log('数据库中的表:', tables);
    }

    // 测试交易记录表
    try {
      const transactionCount = await prisma.pointsTransactions.count();
      console.log('\n交易记录总数:', transactionCount);
    } catch (error) {
      console.error('查询交易记录表失败:', error);
    }

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPrisma();