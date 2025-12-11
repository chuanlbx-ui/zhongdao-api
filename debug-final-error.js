const { PrismaClient } = require('@prisma/client');

async function debugFinalError() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('调试最后的统计接口500错误...\n');

    // 获取一个店铺ID进行测试
    const shop = await prisma.shops.findFirst({
      select: { id: true }
    });

    if (shop) {
      console.log('测试店铺ID:', shop.id);

      try {
        // 测试1: 产品计数查询
        console.log('\n1. 测试产品计数:');
        const totalProducts = await prisma.products.count({
          where: { shopId: shop.id }
        });
        console.log('✅ 产品计数成功:', totalProducts);

        // 测试2: 产品价格聚合查询
        console.log('\n2. 测试产品价格聚合:');
        const productsValue = await prisma.products.aggregate({
          where: { shopId: shop.id },
          _sum: { price: true }
        });
        console.log('✅ 产品价格聚合成功:', productsValue._sum.price);

        // 测试3: 查看products表结构
        console.log('\n3. 查看产品记录:');
        const sampleProducts = await prisma.products.findMany({
          where: { shopId: shop.id },
          take: 2,
          select: { id: true, name: true, price: true, shopId: true }
        });
        console.log('示例产品:', sampleProducts);

        // 测试4: 检查price字段类型
        if (sampleProducts.length > 0) {
          const product = sampleProducts[0];
          console.log('产品价格类型:', typeof product.price);
          console.log('产品价格值:', product.price);
        }

      } catch (error) {
        console.error('❌ 统计查询失败:');
        console.error('错误代码:', error.code);
        console.error('错误消息:', error.message);
        if (error.meta) {
          console.error('错误元数据:', error.meta);
        }
      }
    } else {
      console.log('没有找到店铺');
    }

  } catch (e) {
    console.error('查询失败:', e);
  } finally {
    await prisma.$disconnect();
  }
}

debugFinalError();