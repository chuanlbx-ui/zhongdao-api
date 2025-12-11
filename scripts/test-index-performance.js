#!/usr/bin/env node

/**
 * 索引性能测试脚本
 * 用于测试和验证数据库索引优化效果
 */

const { PrismaClient } = require('@prisma/client');
const { performance } = require('perf_hooks');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev'
    }
  }
});

// 测试结果存储
const testResults = {
  beforeOptimization: {},
  afterOptimization: {},
  improvements: {}
};

// 测试查询集合
const testQueries = {
  // 用户相关查询
  getUserDirectTeam: async (userId) => {
    const start = performance.now();
    const result = await prisma.users.findMany({
      where: { parentId: userId },
      select: {
        id: true,
        nickname: true,
        level: true,
        status: true,
        createdAt: true,
        totalSales: true,
        teamCount: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const end = performance.now();
    return { time: end - start, count: result.length };
  },

  // 积分交易查询
  getUserPointsTransactions: async (userId) => {
    const start = performance.now();
    const result = await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      select: {
        id: true,
        transactionNo: true,
        amount: true,
        type: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const end = performance.now();
    return { time: end - start, count: result.length };
  },

  // 产品查询
  getProductsByCategory: async (categoryId) => {
    const start = performance.now();
    const result = await prisma.products.findMany({
      where: {
        categoryId: categoryId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        basePrice: true,
        totalStock: true,
        isFeatured: true,
        sort: true,
        createdAt: true
      },
      orderBy: [
        { sort: 'asc' },
        { createdAt: 'desc' }
      ],
      take: 20
    });
    const end = performance.now();
    return { time: end - start, count: result.length };
  },

  // 订单查询
  getUserOrders: async (userId) => {
    const start = performance.now();
    const result = await prisma.orders.findMany({
      where: { buyerId: userId },
      select: {
        id: true,
        orderNo: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const end = performance.now();
    return { time: end - start, count: result.length };
  },

  // 库存日志查询
  getInventoryLogs: async (productId) => {
    const start = performance.now();
    const result = await prisma.inventoryLogs.findMany({
      where: { productId: productId },
      select: {
        id: true,
        operationType: true,
        quantity: true,
        quantityBefore: true,
        quantityAfter: true,
        warehouseType: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const end = performance.now();
    return { time: end - start, count: result.length };
  },

  // 团队业绩查询
  getTeamPerformance: async () => {
    const start = performance.now();
    const result = await prisma.performanceMetrics.findMany({
      where: {
        period: new Date().toISOString().slice(0, 7) // 当前月份
      },
      select: {
        userId: true,
        personalSales: true,
        teamSales: true,
        currentRole: true,
        progressPercentage: true
      },
      orderBy: { personalSales: 'desc' },
      take: 50
    });
    const end = performance.now();
    return { time: end - start, count: result.length };
  },

  // 复杂的团队层级查询
  getTeamHierarchy: async (userId) => {
    const start = performance.now();
    const result = await prisma.users.findMany({
      where: {
        teamPath: {
          contains: userId
        },
        status: 'ACTIVE'
      },
      select: {
        id: true,
        nickname: true,
        level: true,
        teamLevel: true,
        parentId: true,
        totalSales: true,
        teamCount: true,
        createdAt: true
      },
      orderBy: [
        { teamLevel: 'asc' },
        { createdAt: 'asc' }
      ],
      take: 100
    });
    const end = performance.now();
    return { time: end - start, count: result.length };
  }
};

// 执行性能测试
async function runPerformanceTests(label = '') {
  console.log(`\n${label ? label + ' - ' : ''}开始性能测试...\n`);

  // 获取测试数据
  const testUserId = await getTestUserId();
  const testCategoryId = await getTestCategoryId();
  const testProductId = await getTestProductId();

  const results = {};

  for (const [queryName, queryFn] of Object.entries(testQueries)) {
    console.log(`测试查询: ${queryName}`);

    // 每个查询运行3次取平均值
    const times = [];
    const counts = [];

    for (let i = 0; i < 3; i++) {
      let result;
      switch (queryName) {
        case 'getUserDirectTeam':
          result = await queryFn(testUserId);
          break;
        case 'getUserPointsTransactions':
          result = await queryFn(testUserId);
          break;
        case 'getProductsByCategory':
          result = await queryFn(testCategoryId);
          break;
        case 'getUserOrders':
          result = await queryFn(testUserId);
          break;
        case 'getInventoryLogs':
          result = await queryFn(testProductId);
          break;
        case 'getTeamPerformance':
          result = await queryFn();
          break;
        case 'getTeamHierarchy':
          result = await queryFn(testUserId);
          break;
      }

      times.push(result.time);
      counts.push(result.count);

      // 短暂延迟避免压力
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

    results[queryName] = {
      avgTime: Math.round(avgTime * 100) / 100,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      avgCount: Math.round(avgCount)
    };

    console.log(`  - 平均耗时: ${avgTime.toFixed(2)}ms`);
    console.log(`  - 返回记录: ${avgCount}`);
  }

  return results;
}

// 获取测试用的用户ID
async function getTestUserId() {
  const user = await prisma.users.findFirst({
    select: { id: true }
  });
  return user?.id || 'test-user-id';
}

// 获取测试用的分类ID
async function getTestCategoryId() {
  const category = await prisma.productCategories.findFirst({
    select: { id: true }
  });
  return category?.id || 'test-category-id';
}

// 获取测试用的产品ID
async function getTestProductId() {
  const product = await prisma.products.findFirst({
    select: { id: true }
  });
  return product?.id || 'test-product-id';
}

// 生成测试报告
function generateReport() {
  console.log('\n==================== 性能测试报告 ====================');
  console.log('测试时间:', new Date().toLocaleString());
  console.log('=====================================================\n');

  // 优化前结果
  if (Object.keys(testResults.beforeOptimization).length > 0) {
    console.log('【优化前性能】');
    for (const [query, result] of Object.entries(testResults.beforeOptimization)) {
      console.log(`  ${query}:`);
      console.log(`    - 平均耗时: ${result.avgTime}ms`);
      console.log(`    - 返回记录: ${result.avgCount}`);
    }
    console.log('');
  }

  // 优化后结果
  if (Object.keys(testResults.afterOptimization).length > 0) {
    console.log('【优化后性能】');
    for (const [query, result] of Object.entries(testResults.afterOptimization)) {
      console.log(`  ${query}:`);
      console.log(`    - 平均耗时: ${result.avgTime}ms`);
      console.log(`    - 返回记录: ${result.avgCount}`);
    }
    console.log('');
  }

  // 性能改进
  if (Object.keys(testResults.improvements).length > 0) {
    console.log('【性能改进】');
    for (const [query, improvement] of Object.entries(testResults.improvements)) {
      const { beforeTime, afterTime, improvementPercent } = improvement;
      const arrow = improvementPercent > 0 ? '↑' : '↓';
      console.log(`  ${query}:`);
      console.log(`    - 优化前: ${beforeTime}ms`);
      console.log(`    - 优化后: ${afterTime}ms`);
      console.log(`    - 性能变化: ${arrow} ${Math.abs(improvementPercent)}%`);
    }
    console.log('');
  }

  // 总结
  if (Object.keys(testResults.improvements).length > 0) {
    const improvements = Object.values(testResults.improvements);
    const avgImprovement = improvements.reduce((sum, imp) => sum + imp.improvementPercent, 0) / improvements.length;
    console.log('【总结】');
    console.log(`  - 测试查询数: ${improvements.length}`);
    console.log(`  - 平均性能提升: ${avgImprovement.toFixed(2)}%`);

    const significantImprovements = improvements.filter(imp => imp.improvementPercent > 30);
    if (significantImprovements.length > 0) {
      console.log(`  - 显著提升查询数(>30%): ${significantImprovements.length}`);
    }
  }

  console.log('\n=====================================================');
}

// 计算性能改进
function calculateImprovements() {
  for (const queryName of Object.keys(testQueries)) {
    if (testResults.beforeOptimization[queryName] && testResults.afterOptimization[queryName]) {
      const beforeTime = testResults.beforeOptimization[queryName].avgTime;
      const afterTime = testResults.afterOptimization[queryName].avgTime;
      const improvementPercent = ((beforeTime - afterTime) / beforeTime) * 100;

      testResults.improvements[queryName] = {
        beforeTime,
        afterTime,
        improvementPercent
      };
    }
  }
}

// 主函数
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'before':
        console.log('执行优化前性能测试...');
        testResults.beforeOptimization = await runPerformanceTests('优化前');
        console.log('\n优化前测试完成，请执行索引优化脚本，然后运行: node test-index-performance.js after');
        break;

      case 'after':
        console.log('执行优化后性能测试...');
        testResults.afterOptimization = await runPerformanceTests('优化后');
        calculateImprovements();
        generateReport();
        break;

      case 'quick':
        console.log('执行快速性能测试...');
        testResults.afterOptimization = await runPerformanceTests('快速测试');
        generateReport();
        break;

      default:
        console.log('用法:');
        console.log('  node test-index-performance.js before  - 优化前测试');
        console.log('  node test-index-performance.js after   - 优化后测试');
        console.log('  node test-index-performance.js quick   - 快速测试');
    }
  } catch (error) {
    console.error('测试执行失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行主函数
main();