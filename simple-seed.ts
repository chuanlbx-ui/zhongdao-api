import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function generateSimpleTestData() {
  console.log('🚀 开始生成简化版测试数据...');

  try {
    // 0. 清理现有数据
    console.log('\n🗑️ 清理现有数据...');
    const tables = [
      'notificationChannels', 'notifications', 'pointsTransactions',
      'orderItems', 'orders', 'inventoryItems', 'products',
      'productCategories', 'shops', 'users'
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table};`);
        console.log(`  ✓ 清理表: ${table}`);
      } catch (error) {
        console.log(`  ⚠️ 跳过表: ${table}`);
      }
    }
    console.log('✅ 数据清理完成');
    // 1. 创建管理员用户
    console.log('\n👑 创建管理员用户...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.users.create({
      data: {
        id: createId(),
        openid: 'admin_openid_001',
        nickname: '系统管理员',
        phone: '13800138000',
        level: 'DIRECTOR',
        status: 'ACTIVE',
        pointsBalance: 100000,
        referralCode: 'ADMIN01',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log(`  ✓ 管理员创建成功: ${admin.nickname}`);

    // 2. 创建普通用户
    console.log('\n👥 创建普通用户...');
    for (let i = 0; i < 10; i++) {
      await prisma.users.create({
        data: {
          id: createId(),
          openid: `user_${i}_${faker.string.alphanumeric(20)}`,
          nickname: faker.person.fullName(),
          phone: faker.phone.number('1##########'),
          level: 'NORMAL',
          status: 'ACTIVE',
          pointsBalance: faker.number.float({ min: 0, max: 5000, fractionDigits: 2 }),
          referralCode: faker.string.alphanumeric(8).toUpperCase(),
          createdAt: faker.date.past({ days: 30 }),
          updatedAt: new Date()
        }
      });
    }
    console.log('  ✓ 已创建10个普通用户');

    // 3. 创建VIP用户
    console.log('\n⭐ 创建VIP用户...');
    for (let i = 0; i < 3; i++) {
      await prisma.users.create({
        data: {
          id: createId(),
          openid: `vip_${i}_${faker.string.alphanumeric(20)}`,
          nickname: faker.person.fullName(),
          phone: faker.phone.number('1##########'),
          level: 'VIP',
          status: 'ACTIVE',
          pointsBalance: faker.number.float({ min: 5000, max: 20000, fractionDigits: 2 }),
          referralCode: faker.string.alphanumeric(8).toUpperCase(),
          createdAt: faker.date.past({ days: 60 }),
          updatedAt: new Date()
        }
      });
    }
    console.log('  ✓ 已创建3个VIP用户');

    // 4. 创建商品分类
    console.log('\n📂 创建商品分类...');
    const categories = [];
    const categoryNames = ['护肤品', '保健品', '食品饮料'];

    for (let i = 0; i < categoryNames.length; i++) {
      const category = await prisma.productCategories.create({
        data: {
          id: createId(),
          name: categoryNames[i],
          level: 1,
          sort: i,
          icon: faker.helpers.arrayElement(['skincare', 'health', 'food']),
          description: `${categoryNames[i]}相关产品`,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      categories.push(category);
    }
    console.log(`  ✓ 已创建${categories.length}个商品分类`);

    // 5. 创建商品
    console.log('\n🛍️ 创建商品...');
    for (let i = 0; i < 20; i++) {
      const category = faker.helpers.arrayElement(categories);
      await prisma.products.create({
        data: {
          id: createId(),
          name: faker.commerce.productName(),
          code: `PRD${faker.string.alphanumeric(8).toUpperCase()}`,
          sku: `SKU${faker.string.alphanumeric(8).toUpperCase()}`,
          description: faker.commerce.productDescription(),
          basePrice: faker.number.float({ min: 50, max: 2000, fractionDigits: 2 }),
          totalStock: faker.number.int({ min: 10, max: 1000 }),
          minStock: 10,
          images: JSON.stringify([faker.image.url({ width: 800, height: 600 })]),
          status: 'ACTIVE',
          categoryId: category.id,
          isFeatured: faker.datatype.boolean({ probability: 0.1 }),
          sort: i,
          createdAt: faker.date.past({ days: 30 }),
          updatedAt: new Date()
        }
      });
    }
    console.log('  ✓ 已创建20个商品');

    // 6. 创建云店
    console.log('\n🏪 创建云店...');
    const users = await prisma.users.findMany({ where: { level: 'VIP' } });
    for (let i = 0; i < Math.min(users.length, 3); i++) {
      await prisma.shops.create({
        data: {
          id: createId(),
          userId: users[i].id,
          shopType: 'CLOUD',
          shopName: `${users[i].nickname}的云店`,
          shopLevel: faker.number.int({ min: 1, max: 6 }),
          status: 'ACTIVE',
          contactName: users[i].nickname,
          contactPhone: users[i].phone || '',
          address: faker.location.streetAddress(),
          createdAt: faker.date.past({ days: 30 }),
          updatedAt: new Date()
        }
      });
    }
    console.log(`  ✓ 已创建3个云店`);

    // 7. 积分交易记录暂时跳过
    console.log('\n💰 积分交易记录暂时跳过...');

    console.log('\n✅ 简化版测试数据生成完成！');

    // 生成统计报告
    const userCount = await prisma.users.count();
    const productCount = await prisma.products.count();
    const shopCount = await prisma.shops.count();
    const categoryCount = await prisma.productCategories.count();

    console.log('\n📊 数据统计：');
    console.log(`  👤 用户总数: ${userCount}`);
    console.log(`    - 管理员: 1人`);
    console.log(`    - VIP用户: 3人`);
    console.log(`    - 普通用户: 10人`);
    console.log(`  📂 商品分类: ${categoryCount}个`);
    console.log(`  🛍️ 商品总数: ${productCount}`);
    console.log(`  🏪 店铺总数: ${shopCount}`);
    console.log('\n🎉 测试数据生成成功！现在可以使用管理员账号登录系统了。');

  } catch (error) {
    console.error('❌ 生成数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行生成器
generateSimpleTestData().catch(console.error);