// 综合系统验证脚本
// 验证所有关键API和系统功能
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

// 测试令牌（真实用户）
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4bGV4YjM1dmFjMmpxNDB3bmdyMXNmY2EiLCJwaG9uZSI6IjEzODAwMTM4MDAwIiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI1NzgzOCwiZXhwIjoxNzY1MzQ0MjM4LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.d2GwpfY22E09Oilo40AVF-ETp6uewYbbvWLxZKhRYCg';
const NORMAL_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmJhZnZwMGdyZmMzOWloaHI4OWhiZ2IiLCJwaG9uZSI6IjEtNTM5LTM5NC00MDkyIHg4MTk0MCIsInJvbGUiOiJOT1JNQUwiLCJsZXZlbCI6Ik5PUk1BTCIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI1NzgzOCwiZXhwIjoxNzY1MzQ0MjM4LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.w39BrN7-bzoy8m1l0gHxOV7mCKXLoYzr8UESJHuyNo0';

// 测试结果收集器
const results = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// 测试辅助函数
async function runTest(name, testFn) {
  results.total++;
  const startTime = Date.now();

  try {
    console.log(`\n🔍 测试: ${name}`);
    const result = await testFn();
    const duration = Date.now() - startTime;

    console.log(`✅ 通过 (${duration}ms)`);
    if (result && result.data) {
      console.log(`   响应数据:`, JSON.stringify(result.data, null, 2).substring(0, 200) + '...');
    }

    results.passed++;
    results.details.push({
      name,
      status: 'PASS',
      duration,
      data: result?.data || null
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ 失败 (${duration}ms): ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误数据:`, error.response.data);
    }

    results.failed++;
    results.details.push({
      name,
      status: 'FAIL',
      duration,
      error: error.message,
      response: error.response?.data || null
    });

    throw error;
  }
}

// 请求辅助函数
async function apiRequest(method, endpoint, data = null, token = null, params = null) {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
  }

  if (params) {
    config.params = params;
  }

  return await axios(config);
}

// 开始综合系统测试
async function comprehensiveSystemTest() {
  console.log('🚀 中道商城API系统综合验证');
  console.log('=' .repeat(50));

  try {
    // 1. 系统健康检查
    await runTest('健康检查端点', async () => {
      const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      if (response.status !== 200) throw new Error(`健康检查失败: ${response.status}`);
      return response.data;
    });

    await runTest('数据库健康检查', async () => {
      const response = await axios.get(`${BASE_URL}/health/database`, { timeout: 5000 });
      if (response.status !== 200) throw new Error(`数据库健康检查失败`);
      return response.data;
    });

    // 2. JWT认证测试
    await runTest('管理员身份验证', async () => {
      const response = await apiRequest('GET', '/users/me', null, ADMIN_TOKEN);
      if (response.data.data.user.level !== 'director') throw new Error('管理员角色验证失败');
      return response.data;
    });

    await runTest('普通用户身份验证', async () => {
      const response = await apiRequest('GET', '/users/me', null, NORMAL_TOKEN);
      if (response.data.data.user.level !== 'normal') throw new Error('普通用户角色验证失败');
      return response.data;
    });

    await runTest('无效令牌测试', async () => {
      try {
        await apiRequest('GET', '/users/me', null, 'invalid.token.here');
        throw new Error('应该拒绝无效令牌');
      } catch (error) {
        if (error.response?.status === 401) {
          return { success: true, message: '正确拒绝无效令牌' };
        }
        throw error;
      }
    });

    // 3. 用户资料API测试
    await runTest('获取用户列表（管理员）', async () => {
      const response = await apiRequest('GET', '/users', null, ADMIN_TOKEN);
      if (!response.data.data || !Array.isArray(response.data.data.users)) {
        throw new Error('用户列表格式错误');
      }
      return response.data;
    });

    await runTest('用户等级系统验证', async () => {
      const response = await apiRequest('GET', '/levels/system', null, ADMIN_TOKEN);
      if (!response.data.data) {
        throw new Error('用户等级列表格式错误');
      }
      return response.data;
    });

    // 4. 积分系统API测试
    await runTest('获取用户积分余额', async () => {
      const response = await apiRequest('GET', '/points/balance', null, NORMAL_TOKEN);
      if (typeof response.data.data.balance !== 'number') {
        throw new Error('积分余额格式错误');
      }
      return response.data;
    });

    await runTest('获取积分交易记录', async () => {
      const response = await apiRequest('GET', '/points/transactions/simple', null, NORMAL_TOKEN, {
        page: 1,
        perPage: 10
      });
      if (!response.data.data || !Array.isArray(response.data.data.transactions)) {
        throw new Error('交易记录格式错误');
      }
      return response.data;
    });

    // 5. 交易记录性能测试
    await runTest('交易记录性能测试', async () => {
      const startTime = Date.now();
      const response = await apiRequest('GET', '/points/transactions/simple', null, ADMIN_TOKEN, {
        page: 1,
        perPage: 50
      });
      const duration = Date.now() - startTime;

      if (duration > 2000) {
        throw new Error(`交易记录查询太慢: ${duration}ms`);
      }

      return {
        performance: `${duration}ms`,
        count: response.data.data?.transactions?.length || 0,
        data: response.data
      };
    });

    // 6. 基本CRUD操作测试
    await runTest('产品分类API', async () => {
      const response = await apiRequest('GET', '/products/categories', null, ADMIN_TOKEN);
      if (!response.data.data || !Array.isArray(response.data.data.categories)) {
        throw new Error('产品分类格式错误');
      }
      return response.data;
    });

    await runTest('产品列表API', async () => {
      const response = await apiRequest('GET', '/products', null, NORMAL_TOKEN, {
        page: 1,
        limit: 5
      });
      if (!response.data.data || !Array.isArray(response.data.data.products)) {
        throw new Error('产品列表格式错误');
      }
      return response.data;
    });

    await runTest('积分转赠功能', async () => {
      const transferData = {
        targetPhone: '13800138002',
        amount: 10,
        message: '测试转赠'
      };

      try {
        const response = await apiRequest('POST', '/points/transfer', transferData, NORMAL_TOKEN);
        return response.data;
      } catch (error) {
        // 允许余额不足等业务错误
        if (error.response?.status === 400 && error.response?.data?.code) {
          return {
            businessError: true,
            message: error.response.data.message,
            code: error.response.data.code
          };
        }
        throw error;
      }
    });

    // 7. 系统稳定性测试
    await runTest('并发请求测试', async () => {
      const requests = [];
      const startTime = Date.now();

      // 创建10个并发请求
      for (let i = 0; i < 10; i++) {
        requests.push(apiRequest('GET', '/auth/me', null, NORMAL_TOKEN));
      }

      const results = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        throw new Error(`${failed}个并发请求失败`);
      }

      return {
        concurrentRequests: 10,
        allSucceeded: true,
        totalTime: `${duration}ms`,
        avgTime: `${duration / 10}ms`
      };
    });

    // 8. 系统配置验证
    await runTest('系统配置API', async () => {
      const response = await apiRequest('GET', '/config', null, ADMIN_TOKEN);
      if (!response.data.data) {
        throw new Error('系统配置格式错误');
      }
      return response.data;
    });

  } catch (error) {
    console.log('\n💥 测试过程中发生严重错误:', error.message);
  }

  // 生成测试报告
  generateTestReport();
}

// 生成测试报告
function generateTestReport() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 系统验证报告');
  console.log('='.repeat(50));

  console.log(`\n总测试数: ${results.total}`);
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 通过率: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  // 性能统计
  const avgTime = results.details
    .filter(d => d.status === 'PASS')
    .reduce((sum, d) => sum + d.duration, 0) / (results.passed || 1);

  console.log(`⏱️ 平均响应时间: ${avgTime.toFixed(0)}ms`);

  // 失败测试详情
  if (results.failed > 0) {
    console.log('\n❌ 失败的测试:');
    results.details
      .filter(d => d.status === 'FAIL')
      .forEach(d => {
        console.log(`   - ${d.name}: ${d.error}`);
      });
  }

  // 性能警告
  const slowTests = results.details
    .filter(d => d.status === 'PASS' && d.duration > 1000);

  if (slowTests.length > 0) {
    console.log('\n⚠️ 性能警告 (>1s):');
    slowTests.forEach(d => {
      console.log(`   - ${d.name}: ${d.duration}ms`);
    });
  }

  // 系统健康状态
  console.log('\n🏥 系统健康状态:');
  const healthChecks = ['健康检查端点', '数据库健康检查'];
  const healthPassed = results.details
    .filter(d => healthChecks.includes(d.name) && d.status === 'PASS').length;

  if (healthPassed === healthChecks.length) {
    console.log('   ✅ 系统健康检查全部通过');
  } else {
    console.log('   ❌ 部分健康检查失败');
  }

  // 认证状态
  console.log('\n🔐 认证系统状态:');
  const authTests = ['管理员身份验证', '普通用户身份验证', '无效令牌测试'];
  const authPassed = results.details
    .filter(d => authTests.includes(d.name) && d.status === 'PASS').length;

  if (authPassed === authTests.length) {
    console.log('   ✅ JWT认证系统正常工作');
  } else {
    console.log('   ❌ JWT认证系统存在问题');
  }

  // API功能状态
  console.log('\n🔌 API功能状态:');
  const apiTests = ['获取用户列表（管理员）', '获取用户积分余额', '产品列表API'];
  const apiPassed = results.details
    .filter(d => apiTests.includes(d.name) && d.status === 'PASS').length;

  if (apiPassed === apiTests.length) {
    console.log('   ✅ 核心API功能正常');
  } else {
    console.log('   ⚠️ 部分API功能可能存在问题');
  }

  // 总结和建议
  console.log('\n📋 总结和建议:');

  const passRate = (results.passed / results.total) * 100;

  if (passRate >= 90) {
    console.log('   🎉 系统状态优秀！可以进行前端集成');
  } else if (passRate >= 70) {
    console.log('   ✅ 系统状态良好，但建议修复失败的测试');
  } else {
    console.log('   ❌ 系统存在较多问题，建议先解决关键问题');
  }

  if (avgTime > 1000) {
    console.log('   ⚠️ 平均响应时间较长，建议优化性能');
  }

  if (results.failed > 0) {
    console.log('   🛠️ 请查看失败测试详情，进行相应修复');
  }

  // 生成JSON报告
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      passRate: passRate,
      avgResponseTime: avgTime
    },
    details: results.details,
    health: {
      passed: healthPassed,
      total: healthChecks.length
    },
    authentication: {
      passed: authPassed,
      total: authTests.length
    },
    api: {
      passed: apiPassed,
      total: apiTests.length
    }
  };

  // 保存报告到文件
  require('fs').writeFileSync(
    'system-validation-report.json',
    JSON.stringify(reportData, null, 2)
  );

  console.log('\n💾 详细报告已保存到: system-validation-report.json');

  console.log('\n' + '='.repeat(50));
  console.log('✨ 中道商城API系统验证完成！');
  console.log('='.repeat(50));
}

// 运行测试
comprehensiveSystemTest().catch(console.error);