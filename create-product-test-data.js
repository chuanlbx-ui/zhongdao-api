const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
    }
  }
});

async function createTestData() {
  try {
    console.log('🌱 创建商品分类测试数据...');

    // 创建一级分类
    const category1 = await prisma.productCategories.create({
      data: {
        id: `cmi${Date.now()}`,
        name: '测试分类1',
        level: 1,
        isActive: true,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ 创建一级分类成功:', category1.name);

    // 创建二级分类
    const category2 = await prisma.productCategories.create({
      data: {
        id: `cmi${Date.now() + 1}`,
        name: '测试分类1-1',
        parentId: category1.id,
        level: 2,
        isActive: true,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ 创建二级分类成功:', category2.name);

    // 创建商品标签
    const tag1 = await prisma.productTags.create({
      data: {
        id: `cmi${Date.now() + 2}`,
        name: '新品',
        color: '#FF0000',
        description: '新品标签',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ 创建商品标签成功:', tag1.name);

    // 创建测试商品
    const product = await prisma.products.create({
      data: {
        id: `cmi${Date.now() + 3}`,
        code: `TEST_${Date.now()}`,
        name: '测试商品',
        sku: `TEST_SKU_${Date.now()}`,
        basePrice: 199.99,
        status: 'ACTIVE',
        categoryId: category1.id,
        images: '[]',
        isFeatured: false,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ 创建测试商品成功:', product.name);

    console.log('🎉 测试数据创建完成！');

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();