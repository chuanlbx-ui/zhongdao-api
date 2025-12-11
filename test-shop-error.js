const { PrismaClient } = require('@prisma/client');

async function testShopError() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('测试VIP用户创建店铺的具体错误...\n');

    // VIP用户ID
    const vipUserId = 'r9rp95henxbdr7dr0k0ce42p';

    // 检查用户是否已有店铺
    console.log('1. 检查VIP用户是否已有店铺:');
    const existingShops = await prisma.shops.findMany({
      where: { userId: vipUserId },
      select: { id: true, shopType: true, shopName: true }
    });

    if (existingShops.length > 0) {
      console.log('用户已有店铺:');
      existingShops.forEach(shop => {
        console.log(`- ${shop.shopType}: ${shop.shopName} (${shop.id})`);
      });
    } else {
      console.log('用户没有店铺');
    }

    // 尝试手动创建店铺
    console.log('\n2. 手动创建店铺测试:');
    const { createId } = require('@paralleldrive/cuid2');

    try {
      const shop = await prisma.shops.create({
        data: {
          id: `cmi${createId()}`,
          userId: vipUserId,
          shopType: 'CLOUD',
          shopName: '测试云店',
          shopDescription: '测试描述',
          contactName: '测试联系人',
          contactPhone: '13800138001',
          address: '测试地址',
          status: 'PENDING',
          shopLevel: 1,
          updatedAt: new Date()
        }
      });
      console.log('✅ 店铺创建成功:', shop.id);

      // 清理测试数据
      await prisma.shops.delete({ where: { id: shop.id } });
      console.log('✅ 测试数据已清理');

    } catch (error) {
      console.error('❌ 店铺创建失败:');
      console.error('错误代码:', error.code);
      console.error('错误消息:', error.message);
      if (error.meta) {
        console.error('错误元数据:', error.meta);
      }
    }

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testShopError();