/**
 * 性能监控测试脚本
 * 用于验证性能监控系统的各项功能
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENT_REQUESTS = 50;
const TEST_DURATION = 30000; // 30秒

// 测试统计
const stats = {
  totalRequests: 0,
  successRequests: 0,
  errorRequests: 0,
  responseTimes: [],
  errors: []
};

/**
 * 发送测试请求
 */
async function sendRequest() {
  const startTime = performance.now();
  stats.totalRequests++;

  try {
    // 随机选择不同的API端点
    const endpoints = [
      '/health',
      '/api/v1',
      '/api/v1/products',
      '/api/v1/users/me',
      '/api/v1/shops',
      '/api/v1/points/balance'
    ];

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      timeout: 5000,
      validateStatus: () => true // 接受所有状态码
    });

    const responseTime = performance.now() - startTime;
    stats.responseTimes.push(responseTime);
    stats.successRequests++;

    console.log(`✅ ${endpoint} - ${response.status} - ${responseTime.toFixed(2)}ms`);
  } catch (error) {
    const responseTime = performance.now() - startTime;
    stats.responseTimes.push(responseTime);
    stats.errorRequests++;
    stats.errors.push(error.message);

    console.log(`❌ Request failed - ${responseTime.toFixed(2)}ms - ${error.message}`);
  }
}

/**
 * 并发发送请求
 */
async function sendConcurrentRequests(count) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(sendRequest());
  }
  await Promise.all(promises);
}

/**
 * 获取性能指标
 */
async function getPerformanceMetrics() {
  try {
    // 获取Prometheus指标
    const metricsResponse = await axios.get(`${BASE_URL}/api/v1/performance/metrics`);
    console.log('\n📊 Prometheus Metrics:');
    console.log(metricsResponse.data.split('\n').slice(0, 10).join('\n'));

    // 获取性能报告
    const reportResponse = await axios.get(`${BASE_URL}/api/v1/performance/report`);
    console.log('\n📈 Performance Report:');
    console.log(JSON.stringify(reportResponse.data.data.summary, null, 2));

    // 获取健康状态
    const healthResponse = await axios.get(`${BASE_URL}/api/v1/performance/health`);
    console.log('\n💓 Health Status:');
    console.log(JSON.stringify(healthResponse.data.data, null, 2));
  } catch (error) {
    console.error('Failed to fetch performance metrics:', error.message);
  }
}

/**
 * 生成测试统计报告
 */
function generateReport() {
  if (stats.responseTimes.length === 0) {
    console.log('\n没有完成的请求');
    return;
  }

  const sortedTimes = stats.responseTimes.sort((a, b) => a - b);
  const avg = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
  const min = sortedTimes[0];
  const max = sortedTimes[sortedTimes.length - 1];
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

  console.log('\n' + '='.repeat(50));
  console.log('📊 测试统计报告');
  console.log('='.repeat(50));
  console.log(`总请求数: ${stats.totalRequests}`);
  console.log(`成功请求: ${stats.successRequests}`);
  console.log(`失败请求: ${stats.errorRequests}`);
  console.log(`成功率: ${(stats.successRequests / stats.totalRequests * 100).toFixed(2)}%`);
  console.log('\n响应时间统计 (ms):');
  console.log(`  平均值: ${avg.toFixed(2)}`);
  console.log(`  最小值: ${min.toFixed(2)}`);
  console.log(`  最大值: ${max.toFixed(2)}`);
  console.log(`  P50:   ${p50.toFixed(2)}`);
  console.log(`  P95:   ${p95.toFixed(2)}`);
  console.log(`  P99:   ${p99.toFixed(2)}`);

  if (stats.errors.length > 0) {
    console.log('\n错误统计:');
    const errorCounts = {};
    stats.errors.forEach(err => {
      errorCounts[err] = (errorCounts[err] || 0) + 1;
    });
    Object.entries(errorCounts).forEach(([err, count]) => {
      console.log(`  ${err}: ${count}次`);
    });
  }
}

/**
 * 主测试函数
 */
async function runTest() {
  console.log('🚀 开始性能监控测试');
  console.log(`目标服务器: ${BASE_URL}`);
  console.log(`并发数: ${CONCURRENT_REQUESTS}`);
  console.log(`测试时长: ${TEST_DURATION/1000}秒`);
  console.log('='.repeat(50));

  // 启动前获取基准指标
  console.log('\n📥 获取基准性能指标...');
  await getPerformanceMetrics();

  // 运行负载测试
  console.log('\n⚡ 开始负载测试...');
  const testStart = Date.now();
  const testInterval = setInterval(async () => {
    await sendConcurrentRequests(CONCURRENT_REQUESTS);

    // 检查是否达到测试时长
    if (Date.now() - testStart >= TEST_DURATION) {
      clearInterval(testInterval);

      // 等待一下让监控数据更新
      setTimeout(async () => {
        console.log('\n⏹️ 测试完成');

        // 获取测试后指标
        console.log('\n📤 获取测试后性能指标...');
        await getPerformanceMetrics();

        // 生成测试报告
        generateReport();

        console.log('\n✨ 性能监控测试完成');
        process.exit(0);
      }, 2000);
    }
  }, 1000); // 每秒发送一批请求
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行测试
runTest().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});