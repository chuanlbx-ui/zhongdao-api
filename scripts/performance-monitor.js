/**
 * API性能监控脚本
 * 用于建立性能基线并监控API响应时间，防止性能回归
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 性能基线文件路径
const BASELINE_FILE = path.join(__dirname, '../.performance-baseline.json');
const REPORT_FILE = path.join(__dirname, '../performance-report.json');

// 需要监控的API端点
const API_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/auth/me', description: '用户信息查询' },
  { method: 'GET', path: '/api/v1/users/profile', description: '用户资料获取' },
  { method: 'PUT', path: '/api/v1/users/profile', description: '用户资料更新' },
  { method: 'GET', path: '/api/v1/users/team', description: '团队信息查询' },
  { method: 'GET', path: '/api/v1/users/statistics', description: '用户统计信息' },
  { method: 'GET', path: '/api/v1/products', description: '商品列表查询' },
  { method: 'GET', path: '/api/v1/products/categories', description: '商品分类查询' },
  { method: 'GET', path: '/api/v1/points/balance', description: '积分余额查询' },
  { method: 'GET', path: '/api/v1/inventory/summary', description: '库存摘要查询' },
  { method: 'GET', path: '/api/v1/commission/summary', description: '佣金摘要查询' }
];

// 性能阈值（毫秒）
const PERFORMANCE_THRESHOLDS = {
  FAST: 500,      // 优秀：< 500ms
  NORMAL: 1000,   // 正常：500-1000ms
  SLOW: 2000,     // 缓慢：1000-2000ms
  CRITICAL: 5000  // 严重：> 2000ms
};

/**
 * 测量API响应时间
 */
async function measureApiResponseTime(endpoint, port = 3000) {
  console.log(`\n📊 测试 ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);

  try {
    const startTime = Date.now();

    // 使用curl测试API响应时间
    const curlCommand = `curl -X ${endpoint.method} http://localhost:${port}${endpoint.path} -H "Authorization: Bearer $ADMIN_TOKEN" -w "%{http_code}|%{time_total}|%{size_download}" -o /dev/null -s`;

    const result = execSync(curlCommand, {
      encoding: 'utf8',
      timeout: 10000 // 10秒超时
    });

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // 解析curl输出
    const [httpCode, curlTime, size] = result.split('|');

    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      httpCode: parseInt(httpCode),
      totalTime: Math.round(parseFloat(curlTime) * 1000), // 转换为毫秒
      measuredTime: totalTime,
      size: parseInt(size),
      status: 'success'
    };

  } catch (error) {
    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      error: error.message,
      totalTime: 10000, // 超时时间
      status: 'error'
    };
  }
}

/**
 * 评估性能等级
 */
function evaluatePerformance(responseTime) {
  if (responseTime <= PERFORMANCE_THRESHOLDS.FAST) return 'FAST';
  if (responseTime <= PERFORMANCE_THRESHOLDS.NORMAL) return 'NORMAL';
  if (responseTime <= PERFORMANCE_THRESHOLDS.SLOW) return 'SLOW';
  return 'CRITICAL';
}

/**
 * 加载性能基线
 */
function loadBaseline() {
  if (fs.existsSync(BASELINE_FILE)) {
    const content = fs.readFileSync(BASELINE_FILE, 'utf8');
    return JSON.parse(content);
  }
  return null;
}

/**
 * 保存性能基线
 */
function saveBaseline(results) {
  const baseline = {
    timestamp: new Date().toISOString(),
    results: results.map(r => ({
      endpoint: r.endpoint,
      method: r.method,
      totalTime: r.totalTime,
      performance: evaluatePerformance(r.totalTime)
    }))
  };

  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
  console.log(`\n✅ 性能基线已保存到: ${BASELINE_FILE}`);
}

/**
 * 生成性能报告
 */
function generateReport(currentResults, baseline = null) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalEndpoints: currentResults.length,
      successCount: currentResults.filter(r => r.status === 'success').length,
      errorCount: currentResults.filter(r => r.status === 'error').length,
      averageTime: Math.round(currentResults.reduce((sum, r) => sum + r.totalTime, 0) / currentResults.length),
      performanceDistribution: {
        fast: currentResults.filter(r => evaluatePerformance(r.totalTime) === 'FAST').length,
        normal: currentResults.filter(r => evaluatePerformance(r.totalTime) === 'NORMAL').length,
        slow: currentResults.filter(r => evaluatePerformance(r.totalTime) === 'SLOW').length,
        critical: currentResults.filter(r => evaluatePerformance(r.totalTime) === 'CRITICAL').length
      }
    },
    results: currentResults,
    baseline: baseline,
    recommendations: []
  };

  // 生成建议
  const criticalEndpoints = currentResults.filter(r => evaluatePerformance(r.totalTime) === 'CRITICAL');
  if (criticalEndpoints.length > 0) {
    report.recommendations.push({
      type: 'critical',
      message: `发现 ${criticalEndpoints.length} 个严重缓慢的端点，需要立即优化`,
      endpoints: criticalEndpoints.map(e => `${e.method} ${e.endpoint}`)
    });
  }

  const slowEndpoints = currentResults.filter(r => evaluatePerformance(r.totalTime) === 'SLOW');
  if (slowEndpoints.length > 0) {
    report.recommendations.push({
      type: 'optimization',
      message: `发现 ${slowEndpoints.length} 个缓慢的端点，建议优化`,
      endpoints: slowEndpoints.map(e => `${e.method} ${e.endpoint}`)
    });
  }

  // 与基线比较
  if (baseline) {
    const regressions = [];
    currentResults.forEach(current => {
      const baselineResult = baseline.results.find(b => b.endpoint === current.endpoint && b.method === current.method);
      if (baselineResult && current.totalTime > baselineResult.totalTime * 1.2) {
        regressions.push({
          endpoint: `${current.method} ${current.endpoint}`,
          baselineTime: baselineResult.totalTime,
          currentTime: current.totalTime,
          degradation: Math.round(((current.totalTime - baselineResult.totalTime) / baselineResult.totalTime) * 100)
        });
      }
    });

    if (regressions.length > 0) {
      report.regressions = regressions;
      report.recommendations.push({
        type: 'regression',
        message: `检测到 ${regressions.length} 个性能回归，需要调查`,
        details: regressions
      });
    }
  }

  return report;
}

/**
 * 显示性能报告
 */
function displayReport(report) {
  console.log('\n' + '='.repeat(80));
  console.log('📈 API性能监控报告');
  console.log('='.repeat(80));

  console.log(`\n📊 测试概要:`);
  console.log(`   总端点数: ${report.summary.totalEndpoints}`);
  console.log(`   成功数量: ${report.summary.successCount}`);
  console.log(`   错误数量: ${report.summary.errorCount}`);
  console.log(`   平均响应时间: ${report.summary.averageTime}ms`);

  console.log(`\n🎯 性能分布:`);
  console.log(`   🟢 优秀 (<500ms): ${report.summary.performanceDistribution.fast}`);
  console.log(`   🔵 正常 (500-1000ms): ${report.summary.performanceDistribution.normal}`);
  console.log(`   🟡 缓慢 (1000-2000ms): ${report.summary.performanceDistribution.slow}`);
  console.log(`   🔴 严重 (>2000ms): ${report.summary.performanceDistribution.critical}`);

  // 显示详细结果
  console.log(`\n📋 详细结果:`);
  console.log('方法'.padEnd(8) + '端点'.padEnd(35) + '响应时间'.padEnd(12) + '状态'.padEnd(8) + '性能等级');
  console.log('-'.repeat(80));

  report.results.forEach(result => {
    const performance = evaluatePerformance(result.totalTime);
    const performanceIcon = {
      'FAST': '🟢',
      'NORMAL': '🔵',
      'SLOW': '🟡',
      'CRITICAL': '🔴'
    }[performance] || '⚪';

    const endpoint = result.endpoint.length > 35 ? result.endpoint.substring(0, 32) + '...' : result.endpoint;
    const time = result.status === 'success' ? `${result.totalTime}ms` : 'ERROR';

    console.log(
      result.method.padEnd(8) +
      endpoint.padEnd(35) +
      time.padEnd(12) +
      result.status.padEnd(8) +
      `${performanceIcon} ${performance}`
    );
  });

  // 显示建议
  if (report.recommendations.length > 0) {
    console.log(`\n💡 优化建议:`);
    report.recommendations.forEach((rec, index) => {
      const icon = rec.type === 'critical' ? '🚨' : rec.type === 'regression' ? '⚠️' : '💡';
      console.log(`   ${icon} ${rec.message}`);
    });
  }

  // 显示回归信息
  if (report.regressions) {
    console.log(`\n⚠️ 性能回归:`);
    report.regressions.forEach(reg => {
      console.log(`   ${reg.endpoint}: ${reg.baselineTime}ms → ${reg.currentTime}ms (${reg.degradation}% 退化)`);
    });
  }
}

/**
 * 检查服务器是否运行
 */
async function checkServer() {
  const possiblePorts = [3000, 3001, 8000, 8080];

  for (const port of possiblePorts) {
    try {
      execSync(`curl -s http://localhost:${port}/health > /dev/null`, { timeout: 3000 });
      console.log(`✅ 服务器运行在端口 ${port}`);
      return port;
    } catch (error) {
      try {
        execSync(`curl -s http://localhost:${port} > /dev/null`, { timeout: 3000 });
        console.log(`✅ 服务器运行在端口 ${port} (无health端点)`);
        return port;
      } catch (error2) {
        // 继续尝试下一个端口
      }
    }
  }

  return null;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 启动API性能监控');
  console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`);

  // 检查服务器是否运行
  const serverPort = await checkServer();
  if (!serverPort) {
    console.error('❌ 服务器未运行，请先启动服务器: npm run dev');
    console.error('   尝试的端口: 3000, 3001, 8000, 8080');
    process.exit(1);
  }

  // 加载基线
  const baseline = loadBaseline();
  if (baseline) {
    console.log(`📊 已加载性能基线 (${new Date(baseline.timestamp).toLocaleString()})`);
  } else {
    console.log('📊 未找到性能基线，将创建新的基线');
  }

  // 测试所有端点
  console.log(`\n🧪 开始测试 ${API_ENDPOINTS.length} 个API端点...`);
  const results = [];

  for (const endpoint of API_ENDPOINTS) {
    const result = await measureApiResponseTime(endpoint, serverPort);
    results.push(result);

    // 显示进度
    const progress = Math.round((results.length / API_ENDPOINTS.length) * 100);
    process.stdout.write(`\r⏳ 进度: ${progress}% (${results.length}/${API_ENDPOINTS.length})`);
  }

  // 生成报告
  const report = generateReport(results, baseline);

  // 显示报告
  displayReport(report);

  // 保存报告
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n\n📄 详细报告已保存到: ${REPORT_FILE}`);

  // 保存基线（如果是第一次运行或者性能有所改善）
  if (!baseline || report.summary.averageTime < baseline.results.reduce((sum, r) => sum + r.totalTime, 0) / baseline.results.length) {
    saveBaseline(results);
  }

  console.log(`\n✅ 性能监控完成 (${new Date().toLocaleString()})`);
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 性能监控失败:', error);
    process.exit(1);
  });
}

module.exports = {
  measureApiResponseTime,
  evaluatePerformance,
  loadBaseline,
  saveBaseline,
  generateReport
};