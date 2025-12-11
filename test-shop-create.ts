import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
    }
  }
});

async function testShopCreate() {
  try {
    console.log('开始测试店铺创建...');

    // 查找一个VIP用户
    const vipUser = await prisma.users.findFirst({
      where: { level: 'VIP' }
    });

    if (!vipUser) {
      console.log('没有找到VIP用户，创建一个...');
      const bcrypt = require('bcryptjs');
      const newVipUser = await prisma.users.create({
        data: {
          id: `cmi${createId()}`,
          phone: '18800000999',
          password: await bcrypt.hash('123456', 10),
          nickname: '测试VIP用户',
          level: 'VIP',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('创建的VIP用户:', newVipUser);
    } else {
      console.log('找到VIP用户:', vipUser);
    }

    // 尝试创建店铺
    console.log('\n尝试创建店铺...');
    const shop = await prisma.shops.create({
      data: {
        id: `cmi${createId()}`,
        userId: vipUser.id,
        shopType: 'CLOUD',
        shopName: '测试云店',
        shopDescription: '测试描述',
        contactName: '测试联系人',
        contactPhone: '13800138001',
        address: '测试地址',
        status: 'ACTIVE',
        shopLevel: 1,
        updatedAt: new Date()
      }
    });

    console.log('店铺创建成功:', shop);

  } catch (error) {
    console.error('店铺创建失败:', error);
    console.error('错误详情:', error.message);
    if (error.code === 'P2002') {
      console.error('Prisma错误详情:', error.meta);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testShopCreate();