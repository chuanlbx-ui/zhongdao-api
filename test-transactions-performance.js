#!/usr/bin/env node

/**
 * 交易API性能测试脚本
 * 测试 /api/v1/points/transactions 端点性能
 */

const request = require('supertest');
const { app } = require('../dist/index.js');
const { performance } = require('perf_hooks');

// 测试配置
const API_BASE_URL = 'http://localhost:3000';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzYxYTNjYi1jNWIyLTQ5NzQtOGU3ZC1kMWFkMGVkNzljMmIiLCJyb2xlIjoiTm9ybWFsIiwiaWF0IjoxNzM2MzkwMjAwLCJleHAiOjE3MzY0NzY2MDB9.test-key'; // 使用有效的测试token

async function testTransactionsAPI() {
  console.log('='.repeat(60));
  console.log('交易API性能测试开始');
  console.log('='.repeat(60));

  const testCases = [
    {
      name: '基础分页查询 (第1页, 20条)',
      query: { page: 1, perPage: 20 },
      description: '测试最基本的分页查询性能'
    },
    {
      name: '中等数据量查询 (第5页, 50条)',
      query: { page: 5, perPage: 50 },
      description: '测试中等数据量的查询性能'
    },
    {
      name: '大数据量查询 (第10页, 100条)',
      query: { page: 10, perPage: 100 },
      description: '测试大数据量查询的性能瓶颈'
    },
    {
      name: '类型过滤查询 (TRANSFER类型)',
      query: { page: 1, perPage: 20, type: 'TRANSFER' },
      description: '测试带类型过滤的查询性能'
    },
    {
      name: '日期范围查询 (最近7天)',
      query: {
        page: 1,
        perPage: 20,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      description: '测试日期范围过滤的查询性能'
    },
    {
      name: '复合条件查询',
      query: {
        page: 1,
        perPage: 20,
        type: 'PURCHASE',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      description: '测试多条件复合查询的性能'
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n测试案例: ${testCase.name}`);
    console.log(`描述: ${testCase.description}`);
    console.log(`参数: ${JSON.stringify(testCase.query)}`);

    // 构建查询字符串
    const queryString = Object.entries(testCase.query)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    try {
      const startTime = performance.now();

      const response = await request(app)
        .get(`/api/v1/points/transactions?${queryString}`)
        .set('Authorization', `Bearer ${TEST_TOKEN}`)
        .set('Content-Type', 'application/json');

      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      console.log(`状态码: ${response.status}`);
      console.log(`响应时间: ${responseTime}ms`);

      if (response.body && response.body.data) {
        const { transactions, pagination, isFallback } = response.body.data;
        console.log(`返回记录数: ${transactions ? transactions.length : 0}`);
        console.log(`总数: ${pagination ? pagination.total : 0}`);
        console.log(`是否降级: ${isFallback ? '是' : '否'}`);

        // 检查是否有性能警告
        if (responseTime > 5000) {
          console.log('⚠️  警告: 响应时间超过5秒!');
        } else if (responseTime > 2000) {
          console.log('⚠️  警告: 响应时间超过2秒!');
        } else if (responseTime < 500) {
          console.log('✅ 性能良好: 响应时间小于500ms');
        }
      }

      results.push({
        name: testCase.name,
        query: testCase.query,
        responseTime,
        status: response.status,
        success: response.status === 200,
        dataCount: response.body?.data?.transactions?.length || 0,
        isFallback: response.body?.data?.isFallback || false
      });

    } catch (error) {
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      console.log(`❌ 请求失败: ${error.message}`);
      console.log(`失败时间: ${responseTime}ms`);

      results.push({
        name: testCase.name,
        query: testCase.query,
        responseTime,
        status: 'ERROR',
        success: false,
        error: error.message,
        dataCount: 0
      });
    }

    // 测试间隔，避免过载
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 生成性能报告
  console.log('\n' + '='.repeat(60));
  console.log('性能测试报告');
  console.log('='.repeat(60));

  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);

  console.log(`\n总测试数: ${results.length}`);
  console.log(`成功: ${successfulTests.length}`);
  console.log(`失败: ${failedTests.length}`);

  if (successfulTests.length > 0) {
    const avgResponseTime = Math.round(
      successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length
    );
    const maxResponseTime = Math.max(...successfulTests.map(r => r.responseTime));
    const minResponseTime = Math.min(...successfulTests.map(r => r.responseTime));

    console.log(`\n响应时间统计:`);
    console.log(`- 平均响应时间: ${avgResponseTime}ms`);
    console.log(`- 最大响应时间: ${maxResponseTime}ms`);
    console.log(`- 最小响应时间: ${minResponseTime}ms`);

    // 性能分级
    if (avgResponseTime > 5000) {
      console.log('\n🔴 性能评级: 严重问题 (平均响应时间 > 5秒)');
    } else if (avgResponseTime > 2000) {
      console.log('\n🟡 性能评级: 需要优化 (平均响应时间 > 2秒)');
    } else if (avgResponseTime > 1000) {
      console.log('\n🟠 性能评级: 可接受 (平均响应时间 > 1秒)');
    } else {
      console.log('\n🟢 性能评级: 良好 (平均响应时间 < 1秒)');
    }
  }

  // 详细结果
  console.log('\n详细测试结果:');
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.name}`);
    console.log(`   查询参数: ${JSON.stringify(result.query)}`);
    console.log(`   状态: ${result.success ? '✅ 成功' : '❌ 失败'} (${result.status})`);
    console.log(`   响应时间: ${result.responseTime}ms`);
    console.log(`   返回记录数: ${result.dataCount}`);
    if (result.isFallback) {
      console.log(`   ⚠️  使用了降级查询`);
    }
    if (result.error) {
      console.log(`   错误信息: ${result.error}`);
    }
  });

  // 性能建议
  console.log('\n性能优化建议:');
  const slowTests = successfulTests.filter(r => r.responseTime > 2000);
  if (slowTests.length > 0) {
    console.log('- 检测到慢查询，建议检查数据库索引');
    console.log('- 考虑添加查询缓存机制');
    console.log('- 优化UNION ALL查询逻辑');
    console.log('- 考虑分页预加载或虚拟滚动');
  }

  const fallbackTests = successfulTests.filter(r => r.isFallback);
  if (fallbackTests.length > 0) {
    console.log('- 检测到降级查询，说明主查询存在超时问题');
    console.log('- 建议增加查询超时时间或优化查询复杂度');
  }

  console.log('\n测试完成!');

  return results;
}

// 数据库索引检查
async function checkDatabaseIndexes() {
  console.log('\n检查数据库索引...');

  try {
    // 检查points_transactions表的索引
    const indexQuery = `
      SHOW INDEX FROM points_transactions
      WHERE Column_name IN ('fromUserId', 'toUserId', 'type', 'createdAt')
    `;

    console.log('建议的数据库索引:');
    console.log('1. (fromUserId, createdAt) - 复合索引');
    console.log('2. (toUserId, createdAt) - 复合索引');
    console.log('3. (type, createdAt) - 复合索引');
    console.log('4. (fromUserId, toUserId, createdAt) - 三复合索引');

  } catch (error) {
    console.log('无法检查数据库索引:', error.message);
  }
}

// 主函数
async function main() {
  try {
    await testTransactionsAPI();
    await checkDatabaseIndexes();

    console.log('\n退出测试程序...');
    process.exit(0);
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { testTransactionsAPI, checkDatabaseIndexes };