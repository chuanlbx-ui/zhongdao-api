const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

async function debugShopsError() {
  // 设置环境变量
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_CSRF = 'true';
  process.env.JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev'
      }
    }
  });

  try {
    // 查看数据库中是否已有用户
    const users = await prisma.users.findMany({
      where: { phone: { startsWith: '1880000' } },
      take: 5
    });
    console.log('测试用户:', users.map(u => ({ id: u.id, phone: u.phone, level: u.level })));

    // 动态导入应用（先编译）
    const { execSync } = require('child_process');
    try {
      execSync('npm run build', { stdio: 'inherit' });
    } catch (e) {
      console.log('构建失败，尝试使用开发模式');
    }
    const { default: app } = await import('./dist/index.js');

    // 测试店铺创建
    const vipUser = users.find(u => u.level === 'VIP');
    if (!vipUser) {
      console.log('没有找到VIP用户，创建一个...');
      // 创建VIP用户
      const bcrypt = require('bcryptjs');
      const { createId } = require('@paralleldrive/cuid2');

      const newVipUser = await prisma.users.create({
        data: {
          id: `cmi${createId()}`,
          phone: '18800000100',
          password: await bcrypt.hash('123456', 10),
          nickname: '测试VIP用户',
          level: 'VIP',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('创建的VIP用户:', newVipUser);
    }

    console.log('\n开始测试店铺创建...');

    const response = await request(app)
      .post('/api/v1/shops/apply')
      .set('Authorization', `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc`)
      .send({
        shopType: 'CLOUD',
        shopName: '测试云店',
        contactName: '测试联系人',
        contactPhone: '13800138001',
        address: '测试地址',
        description: '店铺描述'
      });

    console.log('响应状态:', response.status);
    console.log('响应体:', response.body);

  } catch (error) {
    console.error('调试错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugShopsError();