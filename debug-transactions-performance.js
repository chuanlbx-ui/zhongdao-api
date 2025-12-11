#!/usr/bin/env node

/**
 * 交易API性能诊断脚本
 * 直接测试数据库查询性能，定位瓶颈
 */

const { PrismaClient } = require('@prisma/client');
const { performance } = require('perf_hooks');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// 测试用户ID（使用实际存在的用户）
const TEST_USER_ID = 'crho9e2hrp50xqkh2xum9rbp';

async function analyzeTransactionPerformance() {
  console.log('='.repeat(60));
  console.log('交易API性能诊断开始');
  console.log('='.repeat(60));

  try {
    // 1. 检查表数据量
    console.log('\n1. 检查points_transactions表数据量...');
    const totalCount = await prisma.pointsTransactions.count();
    console.log(`总记录数: ${totalCount}`);

    // 按用户分布检查
    const userTransactionCount = await prisma.pointsTransactions.groupBy({
      by: ['fromUserId'],
      where: {
        OR: [
          { fromUserId: TEST_USER_ID },
          { toUserId: TEST_USER_ID }
        ]
      },
      _count: true
    });
    console.log(`测试用户相关记录数: ${userTransactionCount.reduce((sum, item) => sum + item._count, 0)}`);

    // 2. 检查现有索引
    console.log('\n2. 检查数据库索引...');
    const indexCheck = await prisma.$queryRaw`SHOW INDEX FROM pointsTransactions`;
    console.log('现有索引:');
    indexCheck.forEach(idx => {
      console.log(`- ${idx.Key_name}: ${idx.Column_name} (${idx.Index_type})`);
    });

    // 3. 测试简单查询性能
    console.log('\n3. 测试简单查询性能...');

    // 3.1 测试基本的OR查询
    console.log('\n3.1 基本OR查询 (fromUserId OR toUserId):');
    let startTime = performance.now();
    const basicQuery = await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: TEST_USER_ID },
          { toUserId: TEST_USER_ID }
        ]
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        amount: true,
        type: true,
        createdAt: true
      }
    });
    let endTime = performance.now();
    console.log(`查询时间: ${Math.round(endTime - startTime)}ms`);
    console.log(`返回记录数: ${basicQuery.length}`);

    // 3.2 测试带类型过滤的查询
    console.log('\n3.2 带类型过滤查询:');
    startTime = performance.now();
    const typeQuery = await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: TEST_USER_ID },
          { toUserId: TEST_USER_ID }
        ],
        type: 'TRANSFER'
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        amount: true,
        type: true,
        createdAt: true
      }
    });
    endTime = performance.now();
    console.log(`查询时间: ${Math.round(endTime - startTime)}ms`);
    console.log(`返回记录数: ${typeQuery.length}`);

    // 3.3 测试带日期范围的查询
    console.log('\n3.3 带日期范围查询:');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    startTime = performance.now();
    const dateQuery = await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: TEST_USER_ID },
          { toUserId: TEST_USER_ID }
        ],
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        amount: true,
        type: true,
        createdAt: true
      }
    });
    endTime = performance.now();
    console.log(`查询时间: ${Math.round(endTime - startTime)}ms`);
    console.log(`返回记录数: ${dateQuery.length}`);

    // 4. 测试分页查询性能
    console.log('\n4. 测试分页查询性能...');

    // 4.1 测试偏移量查询
    for (let page of [1, 5, 10]) {
      console.log(`\n4.1 测试第${page}页查询 (偏移量: ${(page-1)*20}):`);
      startTime = performance.now();
      const pageQuery = await prisma.pointsTransactions.findMany({
        where: {
          OR: [
            { fromUserId: TEST_USER_ID },
            { toUserId: TEST_USER_ID }
          ]
        },
        skip: (page - 1) * 20,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fromUserId: true,
          toUserId: true,
          amount: true,
          type: true,
          createdAt: true
        }
      });
      endTime = performance.now();
      console.log(`查询时间: ${Math.round(endTime - startTime)}ms`);
      console.log(`返回记录数: ${pageQuery.length}`);
    }

    // 5. 测试当前UNION ALL实现的问题
    console.log('\n5. 测试当前UNION ALL查询...');

    const baseQuery = `
      (SELECT
        id, transactionNo, amount, type, description, status,
        createdAt, completedAt, fromUserId, toUserId, metadata,
        CASE WHEN toUserId = '${TEST_USER_ID}' THEN 1 ELSE 0 END as isIncoming,
        CASE WHEN fromUserId = '${TEST_USER_ID}' THEN 1 ELSE 0 END as isOutgoing
       FROM pointsTransactions
       WHERE (fromUserId = '${TEST_USER_ID}' OR toUserId = '${TEST_USER_ID}'))
    `;

    console.log('\n5.1 测试UNION ALL主查询...');
    startTime = performance.now();
    try {
      const unionQuery = await prisma.$queryRaw`
        SELECT * FROM (
          ${baseQuery}
        ) AS combined
        ORDER BY createdAt DESC
        LIMIT 20 OFFSET 0
      `;
      endTime = performance.now();
      console.log(`UNION ALL查询时间: ${Math.round(endTime - startTime)}ms`);
      console.log(`返回记录数: ${unionQuery.length}`);
    } catch (error) {
      console.log(`UNION ALL查询失败: ${error.message}`);
    }

    console.log('\n5.2 测试计数查询...');
    startTime = performance.now();
    try {
      const countQuery = await prisma.$queryRaw`
        SELECT COUNT(*) as total FROM (
          SELECT id FROM pointsTransactions
          WHERE (fromUserId = ${TEST_USER_ID} OR toUserId = ${TEST_USER_ID})
          LIMIT 10000
        ) as limited
      `;
      endTime = performance.now();
      console.log(`计数查询时间: ${Math.round(endTime - startTime)}ms`);
      console.log(`总数: ${countQuery[0]?.total || 0}`);
    } catch (error) {
      console.log(`计数查询失败: ${error.message}`);
    }

    // 6. 测试改进的查询方案
    console.log('\n6. 测试改进的查询方案...');

    // 6.1 使用两个独立查询替代UNION ALL
    console.log('\n6.1 使用两个独立查询...');
    startTime = performance.now();
    const [incoming, outgoing] = await Promise.all([
      prisma.pointsTransactions.findMany({
        where: { toUserId: TEST_USER_ID },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          transactionNo: true,
          amount: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
          completedAt: true,
          fromUserId: true,
          toUserId: true,
          metadata: true
        }
      }),
      prisma.pointsTransactions.findMany({
        where: { fromUserId: TEST_USER_ID },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          transactionNo: true,
          amount: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
          completedAt: true,
          fromUserId: true,
          toUserId: true,
          metadata: true
        }
      })
    ]);
    endTime = performance.now();

    // 合并并排序
    const combined = [...incoming, ...outgoing]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    console.log(`双查询方案时间: ${Math.round(endTime - startTime)}ms`);
    console.log(`返回记录数: ${combined.length}`);
    console.log(`入账记录: ${incoming.length}, 出账记录: ${outgoing.length}`);

    // 7. 性能建议
    console.log('\n7. 性能优化建议...');

    if (totalCount > 100000) {
      console.log('- 数据量较大，建议实施分区策略');
    }

    console.log('- 建议创建复合索引:');
    console.log('  CREATE INDEX idx_points_transactions_from_user_date ON points_transactions(fromUserId, createdAt);');
    console.log('  CREATE INDEX idx_points_transactions_to_user_date ON points_transactions(toUserId, createdAt);');
    console.log('  CREATE INDEX idx_points_transactions_type_date ON points_transactions(type, createdAt);');

    console.log('- 建议优化查询策略:');
    console.log('  1. 使用两个独立查询替代复杂的UNION ALL');
    console.log('  2. 实现查询结果缓存');
    console.log('  3. 对于大数据量分页，使用游标分页替代偏移量分页');

  } catch (error) {
    console.error('诊断过程中发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 主函数
async function main() {
  try {
    await analyzeTransactionPerformance();
    console.log('\n诊断完成!');
    process.exit(0);
  } catch (error) {
    console.error('诊断失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { analyzeTransactionPerformance };