const { PrismaClient } = require('@prisma/client');

async function verifyDatabase() {
  console.log('🔍 验证数据库连接和表结构...\n');

  const prisma = new PrismaClient();

  try {
    // 测试数据库连接
    console.log('1. 测试数据库连接...');
    await prisma.$connect();
    console.log('   ✅ 数据库连接成功！');

    // 检查关键表是否存在
    console.log('\n2. 检查关键表是否存在...');
    const tables = [
      'users',
      'shops',
      'products',
      'productCategories',
      'pointsTransactions',
      'orders',
      'inventoryItems'
    ];

    for (const tableName of tables) {
      try {
        // 使用原生查询检查表是否存在
        const result = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '${tableName}'`
        );

        if (result[0].count > 0) {
          console.log(`   ✅ 表 "${tableName}" 存在`);

          // 获取记录数
          const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM ${tableName}`);
          console.log(`      记录数: ${count[0].cnt}`);
        } else {
          console.log(`   ❌ 表 "${tableName}" 不存在！`);
        }
      } catch (error) {
        console.log(`   ⚠️  检查表 "${tableName}" 时出错: ${error.message}`);
      }
    }

    // 测试Prisma模型操作
    console.log('\n3. 测试Prisma模型操作...');

    // 测试users表
    try {
      const userCount = await prisma.users.count();
      console.log(`   ✅ prisma.users.count() 成功: ${userCount} 个用户`);
    } catch (error) {
      console.log(`   ❌ prisma.users 失败: ${error.message}`);
    }

    // 测试products表
    try {
      const productCount = await prisma.products.count();
      console.log(`   ✅ prisma.products.count() 成功: ${productCount} 个商品`);
    } catch (error) {
      console.log(`   ❌ prisma.products 失败: ${error.message}`);
    }

    // 测试test-data-manager
    console.log('\n4. 测试test-data-manager...');
    try {
      const { TestDataManager } = require('../../src/scripts/test-data-manager');
      const dataManager = new TestDataManager({ dryRun: true });

      console.log('   ✅ TestDataManager 初始化成功');

      // 测试获取数据统计
      const stats = await dataManager.getDataStats();
      console.log('   ✅ getDataStats() 成功');
      console.log('   统计结果:', stats);

    } catch (error) {
      console.log(`   ❌ test-data-manager 测试失败: ${error.message}`);
      console.log(`   错误堆栈: ${error.stack}`);
    }

  } catch (error) {
    console.error('\n❌ 数据库验证失败:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ 数据库验证完成');
  }
}

// 运行验证
verifyDatabase().catch(console.error);