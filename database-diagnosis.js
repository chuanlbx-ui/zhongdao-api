/**
 * 数据库诊断脚本
 * 用于诊断积分API的数据库相关问题
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.development' });

console.log('='.repeat(60));
console.log('数据库诊断报告 - 中道商城系统');
console.log('='.repeat(60));

const prisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function runDiagnosis() {
  const startTime = Date.now();

  try {
    // 1. 检查数据库连接
    console.log('\n1. 数据库连接检查');
    console.log('-'.repeat(30));
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    console.log(`📍 连接URL: ${process.env.DATABASE_URL.substring(0, 50)}...`);

    // 2. 检查数据库结构
    console.log('\n2. 数据库结构检查');
    console.log('-'.repeat(30));

    // 检查关键表是否存在
    const tables = ['users', 'pointsTransactions', 'orders', 'products', 'shops'];
    for (const table of tables) {
      try {
        const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ 表 ${table} 存在，记录数: ${count[0].count}`);
      } catch (error) {
        console.log(`❌ 表 ${table} 不存在或访问失败: ${error.message}`);
      }
    }

    // 3. 检查表结构（重点检查pointsTransactions）
    console.log('\n3. pointsTransactions 表结构检查');
    console.log('-'.repeat(30));

    try {
      const columns = await prisma.$queryRawUnsafe(`
        DESCRIBE pointsTransactions
      `);
      console.log('\n字段列表:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : ''} ${col.Key ? `(${col.Key})` : ''}`);
      });
    } catch (error) {
      console.log(`❌ 无法获取pointsTransactions表结构: ${error.message}`);
    }

    // 4. 检查索引
    console.log('\n4. 索引检查');
    console.log('-'.repeat(30));

    try {
      const indexes = await prisma.$queryRawUnsafe(`
        SHOW INDEX FROM pointsTransactions
      `);
      console.log('\n现有索引:');
      indexes.forEach(idx => {
        console.log(`  - ${idx.Key_name}: ${idx.Column_name} (${idx.Index_type})`);
      });
    } catch (error) {
      console.log(`❌ 无法获取索引信息: ${error.message}`);
    }

    // 5. 检查用户数据
    console.log('\n5. 用户数据检查');
    console.log('-'.repeat(30));

    try {
      const userCount = await prisma.users.count();
      console.log(`✅ 总用户数: ${userCount}`);

      // 检查用户ID格式
      const sampleUsers = await prisma.users.findMany({
        select: {
          id: true,
          phone: true,
          nickname: true,
          level: true,
          pointsBalance: true,
          pointsFrozen: true,
          status: true
        },
        take: 5
      });

      console.log('\n用户样本:');
      sampleUsers.forEach(user => {
        console.log(`  - ID: ${user.id}`);
        console.log(`    手机: ${user.phone}`);
        console.log(`    昵称: ${user.nickname}`);
        console.log(`    等级: ${user.level}`);
        console.log(`    积分: ${user.pointsBalance} (冻结: ${user.pointsFrozen})`);
        console.log(`    状态: ${user.status}`);
        console.log('');
      });
    } catch (error) {
      console.log(`❌ 用户数据检查失败: ${error.message}`);
    }

    // 6. 检查积分交易记录
    console.log('\n6. 积分交易记录检查');
    console.log('-'.repeat(30));

    try {
      const transactionCount = await prisma.pointsTransactions.count();
      console.log(`✅ 总交易记录数: ${transactionCount}`);

      // 检查最近的交易记录
      const recentTransactions = await prisma.pointsTransactions.findMany({
        select: {
          id: true,
          transactionNo: true,
          fromUserId: true,
          toUserId: true,
          amount: true,
          type: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      console.log('\n最近交易记录:');
      recentTransactions.forEach(tx => {
        console.log(`  - 交易号: ${tx.transactionNo}`);
        console.log(`    从: ${tx.fromUserId || 'SYSTEM'}`);
        console.log(`    到: ${tx.toUserId}`);
        console.log(`    金额: ${tx.amount}`);
        console.log(`    类型: ${tx.type}`);
        console.log(`    状态: ${tx.status}`);
        console.log(`    时间: ${tx.createdAt}`);
        console.log('');
      });
    } catch (error) {
      console.log(`❌ 积分交易记录检查失败: ${error.message}`);
    }

    // 7. 性能测试
    console.log('\n7. 性能测试');
    console.log('-'.repeat(30));

    try {
      // 测试查询用户
      console.log('测试用户查询性能...');
      const start = Date.now();
      await prisma.users.findFirst({
        select: { id: true, phone: true }
      });
      console.log(`✅ 用户查询耗时: ${Date.now() - start}ms`);

      // 测试查询积分交易
      console.log('测试积分交易查询性能...');
      const start2 = Date.now();
      await prisma.pointsTransactions.findFirst({
        select: { id: true, transactionNo: true }
      });
      console.log(`✅ 积分交易查询耗时: ${Date.now() - start2}ms`);

      // 测试关联查询
      console.log('测试用户积分交易关联查询性能...');
      const start3 = Date.now();
      await prisma.pointsTransactions.findMany({
        include: {
          toUser: {
            select: { id: true, phone: true, nickname: true }
          }
        },
        take: 10
      });
      console.log(`✅ 关联查询耗时: ${Date.now() - start3}ms`);
    } catch (error) {
      console.log(`❌ 性能测试失败: ${error.message}`);
    }

    // 8. 检查可能的问题
    console.log('\n8. 问题诊断');
    console.log('-'.repeat(30));

    // 检查用户ID是否存在null值
    try {
      const nullUserIdCount = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM pointsTransactions WHERE toUserId IS NULL
      `);
      if (nullUserIdCount[0].count > 0) {
        console.log(`⚠️ 发现 ${nullUserIdCount[0].count} 条记录的 toUserId 为 NULL`);
      }
    } catch (error) {
      console.log(`❌ 检查NULL用户ID失败: ${error.message}`);
    }

    // 检查是否存在无效的用户引用
    try {
      const invalidUserCount = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM pointsTransactions pt
        LEFT JOIN users u ON pt.toUserId = u.id
        WHERE pt.toUserId IS NOT NULL AND u.id IS NULL
      `);
      if (invalidUserCount[0].count > 0) {
        console.log(`⚠️ 发现 ${invalidUserCount[0].count} 条记录引用了不存在的用户`);
      }
    } catch (error) {
      console.log(`❌ 检查无效用户引用失败: ${error.message}`);
    }

    // 检查数据库字符集
    try {
      const charset = await prisma.$queryRawUnsafe(`
        SELECT DEFAULT_CHARACTER_SET_NAME as charset
        FROM information_schema.SCHEMATA
        WHERE SCHEMA_NAME = DATABASE()
      `);
      console.log(`✅ 数据库字符集: ${charset[0].charset}`);
    } catch (error) {
      console.log(`❌ 检查字符集失败: ${error.message}`);
    }

  } catch (error) {
    console.log('\n❌ 诊断过程中发生错误:');
    console.log(error.message);
    console.log(error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ 诊断完成，总耗时:', Date.now() - startTime, 'ms');
  }
}

// 运行诊断
runDiagnosis().catch(console.error);