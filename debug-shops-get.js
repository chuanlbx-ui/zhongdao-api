const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

async function debugShopsGet() {
  // 设置环境变量
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_CSRF = 'true';
  process.env.JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('调试GET /shops接口...');

    // 查看数据库结构
    console.log('\n1. 检查shops表结构:');
    const shopColumns = await prisma.$queryRaw`DESCRIBE shops`;
    console.log('shops表字段:', shopColumns.map(col => col.Field));

    // 查看users表结构
    console.log('\n2. 检查users表结构:');
    const userColumns = await prisma.$queryRaw`DESCRIBE users`;
    console.log('users表字段:', userColumns.map(col => col.Field));

    // 测试简单查询
    console.log('\n3. 测试简单查询:');
    try {
      const shopCount = await prisma.shops.count();
      console.log(`shops表记录数: ${shopCount}`);

      const userCount = await prisma.users.count();
      console.log(`users表记录数: ${userCount}`);
    } catch (error) {
      console.error('简单查询失败:', error);
    }

    // 测试复杂查询
    console.log('\n4. 测试复杂查询:');
    try {
      const shops = await prisma.shops.findMany({
        take: 1,
        orderBy: { createdAt: 'desc' }
      });
      console.log('查询成功，返回记录数:', shops.length);
    } catch (error) {
      console.error('复杂查询失败:', error);
      console.error('错误详情:', error.message);
    }

    // 测试带where条件的查询
    console.log('\n5. 测试带where条件的查询:');
    try {
      const userId = 'cmi4lsx0h0000ed8w12ac6jns'; // 测试用户ID
      const shops = await prisma.shops.findMany({
        where: { userId: userId },
        take: 1
      });
      console.log('带条件查询成功，返回记录数:', shops.length);
    } catch (error) {
      console.error('带条件查询失败:', error);
      console.error('错误详情:', error.message);
    }

    // 动态导入应用
    console.log('\n6. 测试API接口:');
    const { default: app } = await import('./dist/index.js');

    const response = await request(app)
      .get('/api/v1/shops?page=1&perPage=10')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc');

    console.log('API响应状态:', response.status);
    console.log('API响应体:', response.body);

    if (response.status === 500) {
      console.log('\n7. 分析500错误原因:');
      console.log('- 可能是数据库字段不匹配');
      console.log('- 可能是Prisma查询语法错误');
      console.log('- 可能是数据处理逻辑错误');
    }

  } catch (error) {
    console.error('调试过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugShopsGet();