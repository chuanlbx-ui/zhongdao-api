/**
 * 监控系统测试脚本
 * 验证监控系统的各个组件是否正常工作
 */

const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3000';

// 测试结果存储
const testResults = {
  healthCheck: { success: false, time: 0 },
  detailedHealth: { success: false, time: 0 },
  monitoringDashboard: { success: false, time: 0 },
  systemOverview: { success: false, time: 0 },
  realtimeData: { success: false, time: 0 },
  alerts: { success: false, time: 0 },
  businessMetrics: { success: false, time: 0 },
  performanceMetrics: { success: false, time: 0 }
};

// 执行HTTP请求
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();

    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = performance.now();
        const time = Math.round(endTime - startTime);

        try {
          const jsonData = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data: jsonData,
            time
          });
        } catch (e) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            error: 'Invalid JSON',
            time
          });
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// 测试函数
async function runTests() {
  console.log('🔍 开始测试监控系统...\n');

  // 1. 测试基础健康检查
  console.log('1️⃣ 测试基础健康检查 /health');
  try {
    const result = await makeRequest('/health');
    testResults.healthCheck = {
      success: result.success && result.data.success,
      time: result.time
    };
    console.log(`   ${testResults.healthCheck.success ? '✅' : '❌'} ${result.time}ms`);
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  // 2. 测试详细健康检查
  console.log('\n2️⃣ 测试详细健康检查 /api/v1/health/detailed');
  try {
    const result = await makeRequest('/api/v1/health/detailed');
    testResults.detailedHealth = {
      success: result.success && result.data.success,
      time: result.time
    };
    console.log(`   ${testResults.detailedHealth.success ? '✅' : '❌'} ${result.time}ms`);
    if (result.data.data) {
      const { checks, summary } = result.data.data;
      console.log(`   检查项: ${summary?.total || 0}个, 健康: ${summary?.healthy || 0}个`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  // 3. 测试监控仪表板
  console.log('\n3️⃣ 测试监控仪表板 /api/v1/monitoring/dashboard');
  try {
    const result = await makeRequest('/api/v1/monitoring/dashboard');
    testResults.monitoringDashboard = {
      success: result.success && result.data.success,
      time: result.time
    };
    console.log(`   ${testResults.monitoringDashboard.success ? '✅' : '❌'} ${result.time}ms`);
    if (result.data.data) {
      const { summary, charts } = result.data.data;
      console.log(`   CPU: ${summary?.system?.cpu || 'N/A'}%, 内存: ${summary?.system?.memory || 'N/A'}%`);
      console.log(`   请求数: ${summary?.performance?.requests || 'N/A'}, 错误数: ${summary?.performance?.errors || 'N/A'}`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  // 4. 测试系统概览
  console.log('\n4️⃣ 测试系统概览 /api/v1/monitoring/overview');
  try {
    const result = await makeRequest('/api/v1/monitoring/overview');
    testResults.systemOverview = {
      success: result.success && result.data.success,
      time: result.time
    };
    console.log(`   ${testResults.systemOverview.success ? '✅' : '❌'} ${result.time}ms`);
    if (result.data.data) {
      const { status, resources, performance } = result.data.data;
      console.log(`   系统状态: ${status || 'N/A'}`);
      console.log(`   资源状态 - CPU: ${resources?.cpu?.status || 'N/A'}, 内存: ${resources?.memory?.status || 'N/A'}`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  // 5. 测试实时数据
  console.log('\n5️⃣ 测试实时数据 /api/v1/monitoring/realtime');
  try {
    const result = await makeRequest('/api/v1/monitoring/realtime');
    testResults.realtimeData = {
      success: result.success && result.data.success,
      time: result.time
    };
    console.log(`   ${testResults.realtimeData.success ? '✅' : '❌'} ${result.time}ms`);
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  // 6. 测试告警列表
  console.log('\n6️⃣ 测试告警列表 /api/v1/monitoring/alerts');
  try {
    const result = await makeRequest('/api/v1/monitoring/alerts');
    testResults.alerts = {
      success: result.success && result.data.success,
      time: result.time
    };
    console.log(`   ${testResults.alerts.success ? '✅' : '❌'} ${result.time}ms`);
    if (result.data.data && Array.isArray(result.data.data)) {
      console.log(`   告警数量: ${result.data.data.length}`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  // 7. 测试业务指标
  console.log('\n7️⃣ 测试业务指标 /api/v1/monitoring/business');
  try {
    const result = await makeRequest('/api/v1/monitoring/business');
    testResults.businessMetrics = {
      success: result.success && result.data.success,
      time: result.time
    };
    console.log(`   ${testResults.businessMetrics.success ? '✅' : '❌'} ${result.time}ms`);
    if (result.data.data) {
      const { users, orders } = result.data.data;
      console.log(`   总用户数: ${users?.total || 'N/A'}, 活跃用户(日): ${users?.active?.daily || 'N/A'}`);
      console.log(`   总订单数: ${orders?.total || 'N/A'}, 收入: ${orders?.revenue || 'N/A'}`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  // 8. 测试完整的性能指标
  console.log('\n8️⃣ 测试完整的性能指标 /api/v1/monitoring/metrics');
  try {
    const result = await makeRequest('/api/v1/monitoring/metrics');
    testResults.performanceMetrics = {
      success: result.success && result.data.success,
      time: result.time
    };
    console.log(`   ${testResults.performanceMetrics.success ? '✅' : '❌'} ${result.time}ms`);
    if (result.data.data) {
      const { status, performance, system, business } = result.data.data;
      console.log(`   组件状态: ${Object.values(status.components).filter(v => v).length}/${Object.keys(status.components).length} 正常`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  // 打印测试总结
  console.log('\n📊 测试总结:');
  console.log('='.repeat(50));

  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(r => r.success).length;
  const totalTime = Object.values(testResults).reduce((sum, r) => sum + r.time, 0);

  console.log(`总测试数: ${totalTests}`);
  console.log(`通过: ${passedTests}`);
  console.log(`失败: ${totalTests - passedTests}`);
  console.log(`总响应时间: ${totalTime}ms`);
  console.log(`平均响应时间: ${Math.round(totalTime / totalTests)}ms`);

  console.log('\n详细信息:');
  Object.entries(testResults).forEach(([name, result]) => {
    const status = result.success ? '✅' : '❌';
    const time = `${result.time}ms`;
    console.log(`${status} ${name.padEnd(20)} ${time}`);
  });

  // 性能评估
  console.log('\n🏃 性能评估:');
  if (totalTime / totalTests < 100) {
    console.log('✅ 优秀: 平均响应时间小于100ms');
  } else if (totalTime / totalTests < 300) {
    console.log('⚠️ 良好: 平均响应时间小于300ms');
  } else {
    console.log('❌ 需要优化: 平均响应时间超过300ms');
  }

  console.log('\n✨ 监控系统测试完成！');

  // 退出码
  process.exit(passedTests === totalTests ? 0 : 1);
}

// 运行测试
runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});