/**
 * 中道商城API系统快速稳定性测试
 * 简化版本，用于快速验证系统稳定性
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  testEndpoints: [
    { name: 'Health Check', path: '/health', method: 'GET', expectedStatus: 200 },
    { name: 'Product List', path: '/api/v1/products/list', method: 'GET', expectedStatus: 200 },
    { name: 'Product Categories', path: '/api/v1/products/categories', method: 'GET', expectedStatus: 200 },
    { name: 'Auth Status', path: '/api/v1/auth/status', method: 'GET', expectedStatus: 200 },
    { name: 'User Profile', path: '/api/v1/user/profile', method: 'GET', expectedStatus: 401 }, // 未授权是正常的
  ],
  concurrentUsers: [10, 50, 100, 200, 500],
  testDuration: 30000, // 30秒
  thresholds: {
    responseTime95: 200, // ms
    errorRate: 0.05, // 5%
    cpuUsage: 80, // %
    memoryUsage: 1024, // MB
  }
};

class QuickStabilityTest {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      endpoints: [],
      loadTest: {},
      systemHealth: {},
      summary: {}
    };
  }

  async runTest() {
    console.log('\n🚀 开始中道商城API快速稳定性测试');
    console.log('='.repeat(60));

    // 1. 端点基础测试
    console.log('\n📡 第1步：端点连通性测试');
    await this.testEndpoints();

    // 2. 负载测试
    console.log('\n⚡ 第2步：负载测试');
    await this.runLoadTest();

    // 3. 系统健康检查
    console.log('\n💻 第3步：系统健康检查');
    await this.checkSystemHealth();

    // 4. 生成报告
    console.log('\n📊 第4步：生成测试报告');
    this.generateReport();

    console.log('\n✅ 快速稳定性测试完成');
  }

  async testEndpoints() {
    const endpointResults = [];

    for (const endpoint of TEST_CONFIG.testEndpoints) {
      console.log(`  🔍 测试: ${endpoint.name}`);

      const result = await this.testEndpoint(endpoint);
      endpointResults.push(result);

      const status = result.success ? '✅' : '❌';
      console.log(`    ${status} ${endpoint.name}: ${result.responseTime}ms (${result.statusCode})`);
    }

    this.results.endpoints = endpointResults;
  }

  async testEndpoint(endpoint) {
    return new Promise((resolve) => {
      const startTime = performance.now();

      const url = `${TEST_CONFIG.baseUrl}${endpoint.path}`;
      const isHttps = url.startsWith('https://');
      const httpModule = isHttps ? https : http;

      const req = httpModule.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          resolve({
            name: endpoint.name,
            url,
            success: res.statusCode === endpoint.expectedStatus,
            statusCode: res.statusCode,
            responseTime,
            dataSize: data.length
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        resolve({
          name: endpoint.name,
          url,
          success: false,
          statusCode: 0,
          responseTime,
          error: error.message
        });
      });

      req.setTimeout(5000, () => {
        req.abort();
        resolve({
          name: endpoint.name,
          url,
          success: false,
          statusCode: 0,
          responseTime: 5000,
          error: 'Timeout'
        });
      });
    });
  }

  async runLoadTest() {
    const loadTestResults = {};

    for (const concurrent of TEST_CONFIG.concurrentUsers) {
      console.log(`  📊 测试 ${concurrent} 并发用户...`);

      const result = await this.runConcurrentTest(concurrent);
      loadTestResults[concurrent] = result;

      const status = result.errorRate <= TEST_CONFIG.thresholds.errorRate &&
                    result.p95ResponseTime <= TEST_CONFIG.thresholds.responseTime95 ?
                    '✅' : '❌';

      console.log(`    ${status} ${concurrent}并发: ${result.throughput.toFixed(2)} req/s, P95: ${result.p95ResponseTime.toFixed(2)}ms`);
    }

    this.results.loadTest = loadTestResults;
  }

  async runConcurrentTest(concurrent) {
    const startTime = performance.now();
    const promises = [];
    const responseTimes = [];
    let errors = 0;

    // 创建并发请求
    for (let i = 0; i < concurrent; i++) {
      promises.push(this.simulateUserRequests(responseTimes, () => errors++));
    }

    // 等待所有请求完成
    await Promise.allSettled(promises);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 计算统计数据
    responseTimes.sort((a, b) => a - b);

    return {
      concurrent,
      totalRequests: concurrent * 10, // 每个用户10个请求
      duration: Math.round(duration),
      avgResponseTime: this.average(responseTimes),
      minResponseTime: responseTimes[0] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
      p50ResponseTime: this.percentile(responseTimes, 50),
      p95ResponseTime: this.percentile(responseTimes, 95),
      p99ResponseTime: this.percentile(responseTimes, 99),
      throughput: (concurrent * 10) / (duration / 1000),
      errors,
      errorRate: errors / (concurrent * 10)
    };
  }

  async simulateUserRequests(responseTimes, onError) {
    const requests = 10; // 每个用户发送10个请求

    for (let i = 0; i < requests; i++) {
      try {
        const endpoint = TEST_CONFIG.testEndpoints[Math.floor(Math.random() * TEST_CONFIG.testEndpoints.length)];
        const result = await this.testEndpoint(endpoint);

        if (result.success) {
          responseTimes.push(result.responseTime);
        } else {
          onError();
        }
      } catch (error) {
        onError();
      }

      // 随机等待时间
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }
  }

  async checkSystemHealth() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.results.systemHealth = {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      uptime: Math.round(process.uptime()), // seconds
    };

    console.log(`  💾 内存使用: ${this.results.systemHealth.memory.heapUsed}MB`);
    console.log(`  ⏱️  运行时间: ${this.results.systemHealth.uptime}秒`);
  }

  generateReport() {
    // 计算总结
    const successfulEndpoints = this.results.endpoints.filter(e => e.success).length;
    const endpointSuccessRate = (successfulEndpoints / this.results.endpoints.length) * 100;

    // 找出最佳负载测试结果
    const loadTestEntries = Object.entries(this.results.loadTest);
    const maxConcurrent = Math.max(...loadTestEntries.map(([k]) => parseInt(k)));
    const maxConcurrentResult = this.results.loadTest[maxConcurrent];

    // 计算总体稳定性评分
    let stabilityScore = 0;

    // 端点测试权重 30%
    stabilityScore += endpointSuccessRate * 0.3;

    // 负载测试权重 40%
    if (maxConcurrentResult) {
      const loadScore = maxConcurrentResult.errorRate <= TEST_CONFIG.thresholds.errorRate &&
                       maxConcurrentResult.p95ResponseTime <= TEST_CONFIG.thresholds.responseTime95 ? 100 : 50;
      stabilityScore += loadScore * 0.4;
    }

    // 系统健康权重 30%
    const memoryScore = this.results.systemHealth.memory.heapUsed <= TEST_CONFIG.thresholds.memoryUsage ? 100 : 70;
    stabilityScore += memoryScore * 0.3;

    this.results.summary = {
      endpointSuccessRate,
      maxConcurrentUsers: maxConcurrent,
      maxThroughput: maxConcurrentResult?.throughput || 0,
      stabilityScore: Math.round(stabilityScore),
      status: stabilityScore >= 80 ? 'PASS' : stabilityScore >= 60 ? 'WARNING' : 'FAIL'
    };

    // 保存报告
    const reportPath = path.join(__dirname, 'quick-stability-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // 打印总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 快速稳定性测试总结');
    console.log('='.repeat(60));
    console.log(`\n✅ 端点成功率: ${endpointSuccessRate.toFixed(1)}%`);
    console.log(`📈 最大并发用户: ${maxConcurrent}`);
    console.log(`🚀 最大吞吐量: ${maxConcurrentResult?.throughput?.toFixed(2) || 0} req/s`);
    console.log(`🏆 稳定性评分: ${this.results.summary.stabilityScore}/100`);
    console.log(`📊 测试状态: ${this.results.summary.status}`);
    console.log('\n📄 详细报告已保存到: quick-stability-report.json');
    console.log('='.repeat(60));

    // 生成HTML报告
    this.generateHtmlReport();
  }

  generateHtmlReport() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>中道商城API快速稳定性测试报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .score { font-size: 72px; font-weight: bold; text-align: center; margin: 30px 0; }
        .score.PASS { color: #27ae60; }
        .score.WARNING { color: #f39c12; }
        .score.FAIL { color: #e74c3c; }
        .metric { display: flex; justify-content: space-between; padding: 15px; background: #f8f9fa; margin: 10px 0; border-radius: 5px; border-left: 4px solid #3498db; }
        .metric-value { font-weight: bold; color: #2c3e50; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #f8f9fa; font-weight: bold; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; color: white; }
        .status.PASS { background: #27ae60; }
        .status.WARNING { background: #f39c12; }
        .status.FAIL { background: #e74c3c; }
        .endpoint-success { color: #27ae60; }
        .endpoint-fail { color: #e74c3c; }
        .timestamp { color: #7f8c8d; font-size: 14px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>中道商城API快速稳定性测试报告</h1>
        <p class="timestamp">生成时间: ${new Date(this.results.timestamp).toLocaleString('zh-CN')}</p>

        <div class="score ${this.results.summary.status}">
            ${this.results.summary.stabilityScore}/100
        </div>

        <h2>📊 测试总结</h2>
        <div class="metric">
            <span>测试状态</span>
            <span class="status ${this.results.summary.status}">${this.results.summary.status}</span>
        </div>
        <div class="metric">
            <span>端点成功率</span>
            <span class="metric-value">${this.results.summary.endpointSuccessRate.toFixed(1)}%</span>
        </div>
        <div class="metric">
            <span>最大并发用户</span>
            <span class="metric-value">${this.results.summary.maxConcurrentUsers}</span>
        </div>
        <div class="metric">
            <span>最大吞吐量</span>
            <span class="metric-value">${this.results.summary.maxThroughput.toFixed(2)} req/s</span>
        </div>

        <h2>📡 端点测试结果</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>端点名称</th>
                    <th>状态</th>
                    <th>响应时间</th>
                    <th>状态码</th>
                </tr>
            </thead>
            <tbody>
                ${this.results.endpoints.map(endpoint => `
                    <tr>
                        <td>${endpoint.name}</td>
                        <td class="${endpoint.success ? 'endpoint-success' : 'endpoint-fail'}">
                            ${endpoint.success ? '✅ 成功' : '❌ 失败'}
                        </td>
                        <td>${endpoint.responseTime.toFixed(2)}ms</td>
                        <td>${endpoint.statusCode}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>⚡ 负载测试结果</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>并发用户</th>
                    <th>平均响应时间</th>
                    <th>P95响应时间</th>
                    <th>吞吐量</th>
                    <th>错误率</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(this.results.loadTest).map(([concurrent, result]) => `
                    <tr>
                        <td>${concurrent}</td>
                        <td>${result.avgResponseTime.toFixed(2)}ms</td>
                        <td>${result.p95ResponseTime.toFixed(2)}ms</td>
                        <td>${result.throughput.toFixed(2)} req/s</td>
                        <td>${(result.errorRate * 100).toFixed(2)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>💻 系统健康状态</h2>
        <div class="metric">
            <span>Node.js版本</span>
            <span class="metric-value">${this.results.systemHealth.nodeVersion}</span>
        </div>
        <div class="metric">
            <span>平台</span>
            <span class="metric-value">${this.results.systemHealth.platform}</span>
        </div>
        <div class="metric">
            <span>内存使用 (堆)</span>
            <span class="metric-value">${this.results.systemHealth.memory.heapUsed} MB</span>
        </div>
        <div class="metric">
            <span>进程运行时间</span>
            <span class="metric-value">${this.results.systemHealth.uptime} 秒</span>
        </div>
    </div>
</body>
</html>
    `;

    const htmlPath = path.join(__dirname, 'quick-stability-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log('📄 HTML报告已生成: quick-stability-report.html');
  }

  // 辅助函数
  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  percentile(sortedArr, percentile) {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, index)];
  }
}

// 主执行函数
async function main() {
  const test = new QuickStabilityTest();

  try {
    await test.runTest();

    // 根据测试结果设置退出码
    const exitCode = test.results.summary.status === 'PASS' ? 0 : 1;
    process.exit(exitCode);

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = QuickStabilityTest;