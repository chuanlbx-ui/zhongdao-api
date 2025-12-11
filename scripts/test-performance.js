/**
 * 系统性能测试脚本
 * 测试API响应时间、监控内存使用、生成性能报告
 */

const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 性能测试配置
const config = {
  baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
  reportFile: path.join(__dirname, '../performance-test-report.json'),
  htmlReportFile: path.join(__dirname, '../performance-test-report.html'),
  memoryProfileFile: path.join(__dirname, '../memory-profile.json'),
  thresholds: {
    responseTime: {
      excellent: 200,   // 优秀: < 200ms
      good: 500,        // 良好: 200-500ms
      acceptable: 1000, // 可接受: 500-1000ms
      slow: 2000        // 缓慢: > 1000ms
    },
    memory: {
      warning: 500,     // MB
      critical: 1000    // MB
    },
    cpu: {
      warning: 70,      // %
      critical: 90      // %
    }
  }
};

// 性能测试用例
const performanceTests = [
  // 核心API性能测试
  {
    name: '用户认证',
    method: 'GET',
    path: '/api/v1/auth/me',
    concurrent: 10,
    iterations: 100,
    expectedTime: 200
  },
  {
    name: '获取用户资料',
    method: 'GET',
    path: '/api/v1/users/profile',
    concurrent: 10,
    iterations: 100,
    expectedTime: 300
  },
  {
    name: '获取积分余额',
    method: 'GET',
    path: '/api/v1/points/balance',
    concurrent: 10,
    iterations: 100,
    expectedTime: 200
  },
  {
    name: '获取商品列表',
    method: 'GET',
    path: '/api/v1/products?page=1&perPage=20',
    concurrent: 10,
    iterations: 100,
    expectedTime: 500
  },
  {
    name: '获取商品分类',
    method: 'GET',
    path: '/api/v1/products/categories',
    concurrent: 10,
    iterations: 100,
    expectedTime: 300
  },
  {
    name: '获取团队信息',
    method: 'GET',
    path: '/api/v1/users/team',
    concurrent: 10,
    iterations: 100,
    expectedTime: 500
  },
  {
    name: '获取库存摘要',
    method: 'GET',
    path: '/api/v1/inventory/summary',
    concurrent: 10,
    iterations: 100,
    expectedTime: 400
  },
  {
    name: '获取佣金摘要',
    method: 'GET',
    path: '/api/v1/commission/summary',
    concurrent: 10,
    iterations: 100,
    expectedTime: 400
  },
  {
    name: '获取积分流水',
    method: 'GET',
    path: '/api/v1/points/transactions?page=1&perPage=20',
    concurrent: 10,
    iterations: 100,
    expectedTime: 500
  },
  {
    name: '获取积分统计',
    method: 'GET',
    path: '/api/v1/points/statistics',
    concurrent: 10,
    iterations: 100,
    expectedTime: 300
  }
];

// 内存监控数据
let memoryProfile = [];
let cpuProfile = [];

// 获取系统信息
function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
    freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
    loadAverage: os.loadavg(),
    uptime: os.uptime()
  };
}

// 获取Node.js进程内存使用
function getProcessMemory() {
  const memUsage = process.memoryUsage();
  return {
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024) // MB
  };
}

// 获取CPU使用率
function getCPUUsage() {
  return new Promise((resolve) => {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime();

    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const endTime = process.hrtime(startTime);

      const totalMicros = endTime[0] * 1000000 + endTime[1] / 1000;
      const cpuPercent = (endUsage.user + endUsage.system) / totalMicros * 100;

      resolve(cpuPercent);
    }, 100);
  });
}

// 执行单个请求
async function makeRequest(test) {
  const startTime = Date.now();

  try {
    const response = await axios({
      method: test.method,
      url: `${config.baseURL}${test.path}`,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'test_token'}`
      }
    });

    return {
      success: true,
      responseTime: Date.now() - startTime,
      statusCode: response.status,
      dataSize: JSON.stringify(response.data).length
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.response ? `${error.response.status}` : error.message
    };
  }
}

// 执行并发测试
async function runConcurrentTest(test) {
  console.log(`\n🔍 执行性能测试: ${test.name}`);
  console.log(`   并发数: ${test.concurrent}, 迭代次数: ${test.iterations}`);

  const results = [];
  const batch = Math.ceil(test.iterations / test.concurrent);

  for (let i = 0; i < batch; i++) {
    const promises = [];
    const currentBatch = Math.min(test.concurrent, test.iterations - i * test.concurrent);

    for (let j = 0; j < currentBatch; j++) {
      promises.push(makeRequest(test));
    }

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // 显示进度
    const progress = Math.round((results.length / test.iterations) * 100);
    process.stdout.write(`\r⏳ 进度: ${progress}% (${results.length}/${test.iterations})`);
  }

  console.log('\r✅ 完成'.padEnd(50));

  // 计算统计数据
  const successResults = results.filter(r => r.success);
  const responseTimes = successResults.map(r => r.responseTime);

  return {
    test: test.name,
    path: test.path,
    totalRequests: test.iterations,
    successRequests: successResults.length,
    failedRequests: results.length - successResults.length,
    responseTime: {
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
      avg: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      p50: percentile(responseTimes, 50),
      p90: percentile(responseTimes, 90),
      p95: percentile(responseTimes, 95),
      p99: percentile(responseTimes, 99)
    },
    requestsPerSecond: Math.round(successResults.length / (responseTimes.reduce((a, b) => a + b, 0) / 1000)),
    errors: results.filter(r => !r.success).map(r => r.error)
  };
}

// 计算百分位数
function percentile(arr, p) {
  const sorted = arr.sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// 监控系统资源
async function monitorResources(duration = 60000) {
  console.log(`\n📊 开始监控系统资源 (${duration}ms)...`);

  const interval = setInterval(async () => {
    const cpu = await getCPUUsage();
    const memory = getProcessMemory();
    const system = getSystemInfo();

    memoryProfile.push({
      timestamp: new Date().toISOString(),
      ...memory,
      systemFree: system.freeMemory
    });

    cpuProfile.push({
      timestamp: new Date().toISOString(),
      percent: cpu
    });

    // 显示警告
    if (memory.heapUsed > config.thresholds.memory.critical) {
      console.warn(`\n⚠️ 内存使用严重: ${memory.heapUsed}MB`);
    } else if (memory.heapUsed > config.thresholds.memory.warning) {
      console.warn(`\n⚠️ 内存使用警告: ${memory.heapUsed}MB`);
    }

    if (cpu > config.thresholds.cpu.critical) {
      console.warn(`\n⚠️ CPU使用严重: ${cpu.toFixed(2)}%`);
    } else if (cpu > config.thresholds.cpu.warning) {
      console.warn(`\n⚠️ CPU使用警告: ${cpu.toFixed(2)}%`);
    }
  }, 1000);

  return new Promise(resolve => {
    setTimeout(() => {
      clearInterval(interval);
      console.log('\n✅ 资源监控完成');
      resolve();
    }, duration);
  });
}

// 评估性能等级
function evaluatePerformance(testResult) {
  const avgTime = testResult.responseTime.avg;

  if (avgTime <= config.thresholds.responseTime.excellent) {
    return 'EXCELLENT';
  } else if (avgTime <= config.thresholds.responseTime.good) {
    return 'GOOD';
  } else if (avgTime <= config.thresholds.responseTime.acceptable) {
    return 'ACCEPTABLE';
  } else if (avgTime <= config.thresholds.responseTime.slow) {
    return 'SLOW';
  } else {
    return 'CRITICAL';
  }
}

// 生成HTML性能报告
function generatePerformanceHtmlReport(report) {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>系统性能测试报告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 30px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .card h3 {
            margin-top: 0;
            color: #333;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-value {
            font-size: 1.2em;
            font-weight: 600;
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin: 20px 0;
        }
        .test-results {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .test-item {
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            background: #f9f9f9;
            border-left: 4px solid #ddd;
        }
        .test-item.excellent { border-left-color: #4caf50; background: #f1f8e9; }
        .test-item.good { border-left-color: #8bc34a; background: #f9fbe7; }
        .test-item.acceptable { border-left-color: #ffc107; background: #fffde7; }
        .test-item.slow { border-left-color: #ff5722; background: #fbe9e7; }
        .test-item.critical { border-left-color: #f44336; background: #ffebee; }

        .performance-grade {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: 600;
            color: white;
            margin-left: 10px;
        }
        .grade-excellent { background: #4caf50; }
        .grade-good { background: #8bc34a; }
        .grade-acceptable { background: #ffc107; color: #333; }
        .grade-slow { background: #ff5722; }
        .grade-critical { background: #f44336; }

        .response-time-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }
        .bar {
            flex: 1;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }
        .bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #4caf50 0%, #8bc34a 50%, #ffc107 75%, #ff5722 100%);
            border-radius: 4px;
        }
        .system-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .info-item {
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ 系统性能测试报告</h1>
            <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📊 测试概览</h3>
                <div class="metric">
                    <span>总测试数</span>
                    <span class="metric-value">${report.summary.totalTests}</span>
                </div>
                <div class="metric">
                    <span>总请求数</span>
                    <span class="metric-value">${report.summary.totalRequests}</span>
                </div>
                <div class="metric">
                    <span>成功率</span>
                    <span class="metric-value">${report.summary.successRate}%</span>
                </div>
                <div class="metric">
                    <span>平均响应时间</span>
                    <span class="metric-value">${report.summary.averageResponseTime}ms</span>
                </div>
            </div>

            <div class="card">
                <h3>💻 系统信息</h3>
                <div class="system-info">
                    <div class="info-item">
                        <strong>平台:</strong> ${report.systemInfo.platform}
                    </div>
                    <div class="info-item">
                        <strong>架构:</strong> ${report.systemInfo.arch}
                    </div>
                    <div class="info-item">
                        <strong>CPU核心:</strong> ${report.systemInfo.cpus}
                    </div>
                    <div class="info-item">
                        <strong>总内存:</strong> ${report.systemInfo.totalMemory}MB
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>⚡ 性能评级分布</h3>
                <canvas id="performanceChart" class="chart-container"></canvas>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>💾 内存使用趋势</h3>
                <canvas id="memoryChart" class="chart-container"></canvas>
            </div>

            <div class="card">
                <h3>🔥 CPU使用趋势</h3>
                <canvas id="cpuChart" class="chart-container"></canvas>
            </div>
        </div>

        <div class="test-results">
            <h2>📈 详细测试结果</h2>
            ${report.testResults.map(test => {
              const grade = evaluatePerformance(test);
              const gradeClass = grade.toLowerCase();
              return `
                <div class="test-item ${gradeClass}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4>${test.test}</h4>
                        <span class="performance-grade grade-${gradeClass}">${grade}</span>
                    </div>
                    <p style="color: #666; margin: 10px 0;">${test.path}</p>

                    <div class="response-time-bar">
                        <span style="width: 100px;">响应时间分布</span>
                        <div class="bar">
                            <div class="bar-fill" style="width: ${Math.min(test.responseTime.avg / 5, 100)}%"></div>
                        </div>
                        <span style="width: 80px; text-align: right;">平均: ${test.responseTime.avg}ms</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                        <div>
                            <strong>请求成功:</strong> ${test.successRequests}/${test.totalRequests}
                        </div>
                        <div>
                            <strong>最小:</strong> ${test.responseTime.min}ms
                        </div>
                        <div>
                            <strong>P95:</strong> ${test.responseTime.p95}ms
                        </div>
                        <div>
                            <strong>RPS:</strong> ${test.requestsPerSecond}
                        </div>
                    </div>
                </div>
              `;
            }).join('')}
        </div>
    </div>

    <script>
        // 性能评级分布图
        new Chart(document.getElementById('performanceChart'), {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(Object.keys(report.summary.performanceDistribution))},
                datasets: [{
                    data: ${JSON.stringify(Object.values(report.summary.performanceDistribution))},
                    backgroundColor: ['#4caf50', '#8bc34a', '#ffc107', '#ff5722', '#f44336']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // 内存使用图
        new Chart(document.getElementById('memoryChart'), {
            type: 'line',
            data: {
                labels: ${JSON.stringify(report.memoryProfile.map((_, i) => i))},
                datasets: [{
                    label: '堆内存 (MB)',
                    data: ${JSON.stringify(report.memoryProfile.map(m => m.heapUsed))},
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // CPU使用图
        new Chart(document.getElementById('cpuChart'), {
            type: 'line',
            data: {
                labels: ${JSON.stringify(report.cpuProfile.map((_, i) => i))},
                datasets: [{
                    label: 'CPU (%)',
                    data: ${JSON.stringify(report.cpuProfile.map(c => c.percent))},
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(config.htmlReportFile, html);
  console.log(`\n📄 HTML性能报告已生成: ${config.htmlReportFile}`);
}

// 主函数
async function main() {
  console.log('🚀 启动系统性能测试');
  console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`);
  console.log(`📡 测试地址: ${config.baseURL}`);

  const systemInfo = getSystemInfo();
  console.log(`💻 系统信息: ${systemInfo.platform} (${systemInfo.arch}), ${systemInfo.cpus}核CPU, ${systemInfo.totalMemory}MB内存\n`);

  // 获取初始内存状态
  const initialMemory = getProcessMemory();
  console.log(`📊 初始内存使用: ${initialMemory.heapUsed}MB (堆), ${initialMemory.rss}MB (RSS)`);

  // 开始资源监控
  const monitorPromise = monitorResources();

  // 执行性能测试
  const testResults = [];
  for (const test of performanceTests) {
    const result = await runConcurrentTest(test);
    testResults.push(result);
  }

  // 等待资源监控完成
  await monitorPromise;

  // 获取最终内存状态
  const finalMemory = getProcessMemory();
  const memoryDiff = {
    heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
    rss: finalMemory.rss - initialMemory.rss
  };

  // 分析测试结果
  const summary = {
    totalTests: testResults.length,
    totalRequests: testResults.reduce((sum, t) => sum + t.totalRequests, 0),
    successRequests: testResults.reduce((sum, t) => sum + t.successRequests, 0),
    failedRequests: testResults.reduce((sum, t) => sum + t.failedRequests, 0),
    successRate: Math.round((testResults.reduce((sum, t) => sum + t.successRequests, 0) / testResults.reduce((sum, t) => sum + t.totalRequests, 0)) * 100),
    averageResponseTime: Math.round(testResults.reduce((sum, t) => sum + t.responseTime.avg, 0) / testResults.length),
    performanceDistribution: testResults.reduce((acc, t) => {
      const grade = evaluatePerformance(t);
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {})
  };

  // 生成性能报告
  const report = {
    timestamp: new Date().toISOString(),
    systemInfo,
    summary,
    memoryProfile,
    cpuProfile,
    testResults,
    memoryImpact: {
      initial: initialMemory,
      final: finalMemory,
      diff: memoryDiff
    },
    recommendations: []
  };

  // 生成建议
  const slowTests = testResults.filter(t => evaluatePerformance(t) === 'SLOW' || evaluatePerformance(t) === 'CRITICAL');
  if (slowTests.length > 0) {
    report.recommendations.push({
      type: 'performance',
      message: `发现 ${slowTests.length} 个缓慢的API端点，建议优化`,
      tests: slowTests.map(t => t.test)
    });
  }

  if (memoryDiff.heapUsed > 100) {
    report.recommendations.push({
      type: 'memory',
      message: `测试期间内存增长了 ${memoryDiff.heapUsed}MB，可能存在内存泄漏`,
      details: `初始: ${initialMemory.heapUsed}MB, 最终: ${finalMemory.heapUsed}MB`
    });
  }

  const maxMemory = Math.max(...memoryProfile.map(m => m.heapUsed));
  if (maxMemory > config.thresholds.memory.warning) {
    report.recommendations.push({
      type: 'memory',
      message: `峰值内存使用达到 ${maxMemory}MB，超过警告阈值`,
      threshold: config.thresholds.memory.warning
    });
  }

  const maxCPU = Math.max(...cpuProfile.map(c => c.percent));
  if (maxCPU > config.thresholds.cpu.warning) {
    report.recommendations.push({
      type: 'cpu',
      message: `峰值CPU使用率达到 ${maxCPU.toFixed(2)}%，超过警告阈值`,
      threshold: config.thresholds.cpu.warning
    });
  }

  // 保存报告
  fs.writeFileSync(config.reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📊 JSON报告已保存: ${config.reportFile}`);

  fs.writeFileSync(config.memoryProfileFile, JSON.stringify({ memoryProfile, cpuProfile }, null, 2));
  console.log(`📈 内存配置文件已保存: ${config.memoryProfileFile}`);

  // 生成HTML报告
  generatePerformanceHtmlReport(report);

  // 显示性能摘要
  console.log('\n' + '='.repeat(80));
  console.log('⚡ 性能测试摘要');
  console.log('='.repeat(80));
  console.log(`总测试数: ${summary.totalTests}`);
  console.log(`总请求数: ${summary.totalRequests}`);
  console.log(`✅ 成功请求: ${summary.successRequests}`);
  console.log(`❌ 失败请求: ${summary.failedRequests}`);
  console.log(`📊 成功率: ${summary.successRate}%`);
  console.log(`⏱️ 平均响应时间: ${summary.averageResponseTime}ms`);
  console.log(`💾 内存变化: ${memoryDiff.heapUsed > 0 ? '+' : ''}${memoryDiff.heapUsed}MB`);
  console.log(`⏰ 完成时间: ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  // 显示性能评级分布
  console.log('\n🎯 性能评级分布:');
  Object.entries(summary.performanceDistribution).forEach(([grade, count]) => {
    const icon = {
      'EXCELLENT': '🟢',
      'GOOD': '🔵',
      'ACCEPTABLE': '🟡',
      'SLOW': '🟠',
      'CRITICAL': '🔴'
    }[grade] || '⚪';
    console.log(`   ${icon} ${grade}: ${count}`);
  });

  // 显示建议
  if (report.recommendations.length > 0) {
    console.log('\n💡 优化建议:');
    report.recommendations.forEach((rec, i) => {
      const icon = rec.type === 'performance' ? '⚡' : rec.type === 'memory' ? '💾' : '🔥';
      console.log(`   ${icon} ${rec.message}`);
    });
  }

  // 判断是否有严重性能问题
  const criticalTests = testResults.filter(t => evaluatePerformance(t) === 'CRITICAL');
  if (criticalTests.length > 0) {
    console.log('\n❌ 发现严重性能问题，请优化后重试');
    process.exit(1);
  } else {
    console.log('\n✅ 性能测试完成！');
    process.exit(0);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 性能测试失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runConcurrentTest,
  getSystemInfo,
  getProcessMemory,
  config
};