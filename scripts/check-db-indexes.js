#!/usr/bin/env node

/**
 * 检查数据库索引
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev'
    }
  }
});

async function checkIndexes() {
  console.log('🔍 检查数据库索引...\n');

  const tables = [
    'productCategories',
    'productTags',
    'products',
    'pointsTransactions',
    'orders',
    'inventoryLogs'
  ];

  for (const table of tables) {
    try {
      const result = await prisma.$queryRawUnsafe(`SHOW INDEX FROM ${table}`);
      console.log(`\n📋 ${table} 表的索引:`);

      if (Array.isArray(result) && result.length > 0) {
        result.forEach(index => {
          console.log(`  - ${index.Key_name}: ${index.Column_name} (${index.Index_type})`);
        });
      } else {
        console.log('  ⚠️  无索引或表不存在');
      }
    } catch (error) {
      console.log(`\n❌ 检查 ${table} 表时出错: ${error.message}`);
    }
  }

  // 检查表是否被正确引用
  console.log('\n📊 检查表的存在性:');

  const tablesToCheck = [
    'productCategories',
    'productTags',
    'products',
    'pointsTransactions',
    'orders',
    'users',
    'inventoryLogs',
    'inventoryStocks'
  ];

  for (const table of tablesToCheck) {
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ✓ ${table}: ${count[0]?.count || 0} 条记录`);
    } catch (error) {
      console.log(`  ❌ ${table}: 表不存在或无法访问`);
    }
  }

  // 生成索引建议
  console.log('\n💡 索引优化建议:');
  console.log('1. productCategories: 添加 parentId, level, isActive 索引');
  console.log('2. productTags: 添加 name, sort 索引');
  console.log('3. products: 添加 status, categoryId, price 索引');
  console.log('4. pointsTransactions: 添加 userId, type, createdAt 索引');
  console.log('5. orders: 添加 buyerId, status, createdAt 索引');
  console.log('6. inventoryLogs: 添加 productId, warehouseId, type 索引');

  await prisma.$disconnect();
}

checkIndexes().catch(console.error);