/**
 * 中道商城API性能基准测试
 * 专门用于验证性能优化效果
 */

import http from 'http';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

// 性能基准配置
interface BenchmarkConfig {
  baseUrl: string;
  endpoints: EndpointTest[];
  warmupRequests: number;
  benchmarkRequests: number;
  concurrentConnections: number;
  thresholds: PerformanceThresholds;
}

interface EndpointTest {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  weight: number; // 权重，用于计算加权平均
}

interface PerformanceThresholds {
  responseTime: {
    excellent: 50;  // ms
    good: 100;      // ms
    acceptable: 200; // ms
  };
  throughput: {
    excellent: 1000; // req/s
    good: 500;       // req/s
    acceptable: 200;  // req/s
  };
  errorRate: {
    excellent: 0.001; // 0.1%
    good: 0.01;       // 1%
    acceptable: 0.05; // 5%
  };
}

// 性能测试结果
interface BenchmarkResult {
  endpoint: string;
  requests: number;
  totalDuration: number;
  minResponseTime: number;
  maxResponseTime: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorCount: number;
  errorRate: number;
  statusCodes: Record<number, number>;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

class PerformanceBenchmark {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];

  constructor(config?: Partial<BenchmarkConfig>) {
    this.config = {
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      warmupRequests: 100,
      benchmarkRequests: 1000,
      concurrentConnections: 50,
      thresholds: {
        responseTime: { excellent: 50, good: 100, acceptable: 200 },
        throughput: { excellent: 1000, good: 500, acceptable: 200 },
        errorRate: { excellent: 0.001, good: 0.01, acceptable: 0.05 }
      },
      endpoints: [
        // 健康检查
        { name: 'Health Check', path: '/health', method: 'GET', weight: 1 },

        // 用户相关
        { name: 'User Profile', path: '/api/v1/user/profile', method: 'GET', weight: 3 },
        { name: 'User Login', path: '/api/v1/auth/login', method: 'POST', body: { phone: '13800138000', code: '123456' }, weight: 2 },

        // 商品相关
        { name: 'Product List', path: '/api/v1/products/list', method: 'GET', weight: 5 },
        { name: 'Product Detail', path: '/api/v1/products/1', method: 'GET', weight: 3 },
        { name: 'Product Categories', path: '/api/v1/products/categories', method: 'GET', weight: 2 },

        // 订单相关
        { name: 'Order History', path: '/api/v1/orders/history', method: 'GET', weight: 3 },
        { name: 'Order Create', path: '/api/v1/orders/create', method: 'POST',
          body: { productId: 1, quantity: 1, addressId: 1 }, weight: 2 },

        // 积分相关
        { name: 'Points Balance', path: '/api/v1/points/balance', method: 'GET', weight: 2 },
        { name: 'Points Transactions', path: '/api/v1/points/transactions', method: 'GET', weight: 2 },

        // 库存相关
        { name: 'Inventory Status', path: '/api/v1/inventory/status', method: 'GET', weight: 1 },

        // 团队相关
        { name: 'Team Stats', path: '/api/v1/team/stats', method: 'GET', weight: 1 },
        { name: 'Team Members', path: '/api/v1/team/members', method: 'GET', weight: 1 },

        // 管理员相关
        { name: 'Admin Dashboard', path: '/api/v1/admin/dashboard', method: 'GET', weight: 1 },
        { name: 'Admin Users', path: '/api/v1/admin/users', method: 'GET', weight: 1 },
      ],
      ...config
    };
  }

  async runFullBenchmark(): Promise<void> {
    console.log('\n🚀 开始性能基准测试');
    console.log('='.repeat(60));

    console.log(`📊 测试配置:`);
    console.log(`  - 服务器: ${this.config.baseUrl}`);
    console.log(`  - 预热请求: ${this.config.warmupRequests}`);
    console.log(`  - 基准请求: ${this.config.benchmarkRequests}`);
    console.log(`  - 并发连接: ${this.config.concurrentConnections}`);
    console.log(`  - 测试端点: ${this.config.endpoints.length} 个`);

    const totalStartTime = performance.now();

    // 预热服务器
    await this.warmupServer();

    // 运行基准测试
    for (const endpoint of this.config.endpoints) {
      console.log(`\n🔍 测试端点: ${endpoint.name}`);
      const result = await this.benchmarkEndpoint(endpoint);
      this.results.push(result);

      // 显示结果
      this.printEndpointResult(result);
    }

    const totalDuration = performance.now() - totalStartTime;

    // 生成综合报告
    this.generateSummaryReport(totalDuration);
  }

  private async warmupServer(): Promise<void> {
    console.log('\n🔥 预热服务器...');

    for (const endpoint of this.config.endpoints.slice(0, 3)) { // 只预热前3个端点
      const promises: Promise<void>[] = [];

      for (let i = 0; i < this.config.warmupRequests / this.config.endpoints.length; i++) {
        promises.push(this.makeRequest(endpoint));
      }

      await Promise.all(promises);
    }

    console.log('✅ 服务器预热完成');
  }

  private async benchmarkEndpoint(endpoint: EndpointTest): Promise<BenchmarkResult> {
    const responseTimes: number[] = [];
    const statusCodes: Record<number, number> = {};
    let errorCount = 0;

    const startTime = performance.now();

    // 执行基准测试
    const promises: Promise<void>[] = [];
    const requestsPerConnection = Math.ceil(this.config.benchmarkRequests / this.config.concurrentConnections);

    for (let i = 0; i < this.config.concurrentConnections; i++) {
      promises.push(this.runConnection(endpoint, requestsPerConnection, responseTimes, statusCodes, () => errorCount++));
    }

    await Promise.all(promises);

    const totalDuration = performance.now() - startTime;

    // 计算统计数据
    responseTimes.sort((a, b) => a - b);

    const result: BenchmarkResult = {
      endpoint: endpoint.name,
      requests: this.config.benchmarkRequests,
      totalDuration,
      minResponseTime: responseTimes[0] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      p50ResponseTime: this.getPercentile(responseTimes, 50),
      p95ResponseTime: this.getPercentile(responseTimes, 95),
      p99ResponseTime: this.getPercentile(responseTimes, 99),
      throughput: (this.config.benchmarkRequests / totalDuration) * 1000,
      errorCount,
      errorRate: errorCount / this.config.benchmarkRequests,
      statusCodes,
      grade: this.calculateGrade(responseTimes, errorCount / this.config.benchmarkRequests, (this.config.benchmarkRequests / totalDuration) * 1000)
    };

    return result;
  }

  private async runConnection(
    endpoint: EndpointTest,
    requests: number,
    responseTimes: number[],
    statusCodes: Record<number, number>,
    onError: () => void
  ): Promise<void> {
    for (let i = 0; i < requests; i++) {
      try {
        const responseTime = await this.makeRequestWithTiming(endpoint, statusCodes);
        responseTimes.push(responseTime);
      } catch (error) {
        onError();
      }
    }
  }

  private async makeRequest(endpoint: EndpointTest): Promise<void> {
    return this.makeRequestWithTiming(endpoint, {});
  }

  private async makeRequestWithTiming(
    endpoint: EndpointTest,
    statusCodes: Record<number, number>
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();

      const url = `${this.config.baseUrl}${endpoint.path}`;
      const postData = endpoint.body ? JSON.stringify(endpoint.body) : null;

      const options: http.RequestOptions = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token', // 使用测试令牌
          ...(endpoint.headers || {})
        }
      };

      if (postData) {
        options.headers!['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = http.request(url, options, (res) => {
        let data = '';

        // 记录状态码
        if (statusCodes[res.statusCode!]) {
          statusCodes[res.statusCode!]++;
        } else {
          statusCodes[res.statusCode!] = 1;
        }

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          if (res.statusCode! >= 200 && res.statusCode! < 300) {
            resolve(responseTime);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.abort();
        reject(new Error('Request timeout'));
      });

      if (postData) {
        req.write(postData);
      }

      req.end();
    });
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private calculateGrade(avgResponseTime: number, errorRate: number, throughput: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    const thresholds = this.config.thresholds;

    // 计算综合分数
    let score = 100;

    // 响应时间评分
    if (avgResponseTime <= thresholds.responseTime.excellent) {
      score -= 0;
    } else if (avgResponseTime <= thresholds.responseTime.good) {
      score -= 15;
    } else if (avgResponseTime <= thresholds.responseTime.acceptable) {
      score -= 30;
    } else {
      score -= 50;
    }

    // 错误率评分
    if (errorRate <= thresholds.errorRate.excellent) {
      score -= 0;
    } else if (errorRate <= thresholds.errorRate.good) {
      score -= 10;
    } else if (errorRate <= thresholds.errorRate.acceptable) {
      score -= 25;
    } else {
      score -= 40;
    }

    // 吞吐量评分
    if (throughput >= thresholds.throughput.excellent) {
      score -= 0;
    } else if (throughput >= thresholds.throughput.good) {
      score -= 10;
    } else if (throughput >= thresholds.throughput.acceptable) {
      score -= 20;
    } else {
      score -= 30;
    }

    // 转换为等级
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private printEndpointResult(result: BenchmarkResult): void {
    const gradeColors = {
      'A': '\x1b[42m', // 绿色
      'B': '\x1b[46m', // 青色
      'C': '\x1b[43m', // 黄色
      'D': '\x1b[41m', // 红色
      'F': '\x1b[41m', // 红色
    };

    const reset = '\x1b[0m';

    console.log(`  ${gradeColors[result.grade]}[${result.grade}]${reset} ${result.endpoint}`);
    console.log(`    响应时间: 平均 ${result.avgResponseTime.toFixed(2)}ms | P95 ${result.p95ResponseTime.toFixed(2)}ms | P99 ${result.p99ResponseTime.toFixed(2)}ms`);
    console.log(`    吞吐量: ${result.throughput.toFixed(2)} req/s`);
    console.log(`    错误率: ${(result.errorRate * 100).toFixed(3)}% (${result.errorCount}/${result.requests})`);
  }

  private generateSummaryReport(totalDuration: number): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 性能基准测试总结');
    console.log('='.repeat(60));

    // 计算加权平均
    const weightedAvgResponseTime = this.calculateWeightedAverage('avgResponseTime');
    const weightedThroughput = this.calculateWeightedAverage('throughput');
    const weightedErrorRate = this.calculateWeightedAverage('errorRate');

    // 统计等级分布
    const gradeDistribution = this.results.reduce((acc, result) => {
      acc[result.grade] = (acc[result.grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`\n⏱️  总执行时间: ${(totalDuration / 1000).toFixed(2)}秒`);
    console.log(`📈 加权平均响应时间: ${weightedAvgResponseTime.toFixed(2)}ms`);
    console.log(`🚀 加权平均吞吐量: ${weightedThroughput.toFixed(2)} req/s`);
    console.log(`❌ 加权平均错误率: ${(weightedErrorRate * 100).toFixed(3)}%`);

    console.log('\n📊 等级分布:');
    Object.entries(gradeDistribution).sort(([a], [b]) => a.localeCompare(b)).forEach(([grade, count]) => {
      const percentage = (count / this.results.length * 100).toFixed(1);
      console.log(`  ${grade}: ${count} 个端点 (${percentage}%)`);
    });

    // 找出最慢和最快的端点
    const sortedByResponseTime = [...this.results].sort((a, b) => b.avgResponseTime - a.avgResponseTime);
    const sortedByThroughput = [...this.results].sort((a, b) => b.throughput - a.throughput);

    console.log('\n🐌 最慢的5个端点:');
    sortedByResponseTime.slice(0, 5).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.endpoint}: ${result.avgResponseTime.toFixed(2)}ms`);
    });

    console.log('\n🚀 吞吐量最高的5个端点:');
    sortedByThroughput.slice(0, 5).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.endpoint}: ${result.throughput.toFixed(2)} req/s`);
    });

    // 生成HTML报告
    this.generateHtmlReport();

    // 生成JSON报告
    const jsonReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDuration,
        weightedAvgResponseTime,
        weightedThroughput,
        weightedErrorRate,
        gradeDistribution
      },
      endpoints: this.results,
      config: this.config
    };

    fs.writeFileSync(
      path.join(__dirname, 'performance-benchmark-report.json'),
      JSON.stringify(jsonReport, null, 2)
    );

    console.log('\n📄 报告已生成:');
    console.log('  - HTML: performance-benchmark-report.html');
    console.log('  - JSON: performance-benchmark-report.json');
  }

  private calculateWeightedAverage(field: keyof BenchmarkResult): number {
    let weightedSum = 0;
    let totalWeight = 0;

    this.results.forEach(result => {
      const endpoint = this.config.endpoints.find(e => e.name === result.endpoint);
      const weight = endpoint?.weight || 1;
      const value = result[field] as number;

      weightedSum += value * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private generateHtmlReport(): void {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>中道商城API性能基准测试报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #7f8c8d; font-size: 14px; }
        .summary-card .value { font-size: 32px; font-weight: bold; color: #2c3e50; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #f8f9fa; font-weight: bold; }
        .grade { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; color: white; }
        .grade.A { background: #27ae60; }
        .grade.B { background: #3498db; }
        .grade.C { background: #f39c12; }
        .grade.D { background: #e67e22; }
        .grade.F { background: #e74c3c; }
        .chart-container { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .bar-chart { display: flex; height: 200px; align-items: flex-end; gap: 10px; }
        .bar { flex: 1; background: #3498db; position: relative; transition: all 0.3s; }
        .bar:hover { background: #2980b9; }
        .bar-label { position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); font-size: 12px; }
        .bar-value { position: absolute; top: -25px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: bold; }
        .timestamp { color: #7f8c8d; font-size: 14px; margin-bottom: 20px; }
        .progress-bar { width: 100%; height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: #3498db; transition: width 0.3s; }
        .slow-endpoint { background: #fdf2f2; }
        .fast-endpoint { background: #f3f8fd; }
    </style>
</head>
<body>
    <div class="container">
        <h1>中道商城API性能基准测试报告</h1>
        <p class="timestamp">生成时间: ${new Date().toISOString()}</p>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>加权平均响应时间</h3>
                <div class="value">${this.calculateWeightedAverage('avgResponseTime').toFixed(2)}ms</div>
            </div>
            <div class="summary-card">
                <h3>加权平均吞吐量</h3>
                <div class="value">${this.calculateWeightedAverage('throughput').toFixed(2)} req/s</div>
            </div>
            <div class="summary-card">
                <h3>加权平均错误率</h3>
                <div class="value">${(this.calculateWeightedAverage('errorRate') * 100).toFixed(3)}%</div>
            </div>
            <div class="summary-card">
                <h3>测试端点总数</h3>
                <div class="value">${this.results.length}</div>
            </div>
        </div>

        <h2>📊 端点性能详情</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>端点名称</th>
                    <th>等级</th>
                    <th>平均响应时间</th>
                    <th>P95响应时间</th>
                    <th>P99响应时间</th>
                    <th>吞吐量</th>
                    <th>错误率</th>
                </tr>
            </thead>
            <tbody>
                ${this.results.map(result => `
                    <tr class="${result.avgResponseTime > 200 ? 'slow-endpoint' : result.avgResponseTime < 100 ? 'fast-endpoint' : ''}">
                        <td>${result.endpoint}</td>
                        <td><span class="grade ${result.grade}">${result.grade}</span></td>
                        <td>${result.avgResponseTime.toFixed(2)}ms</td>
                        <td>${result.p95ResponseTime.toFixed(2)}ms</td>
                        <td>${result.p99ResponseTime.toFixed(2)}ms</td>
                        <td>${result.throughput.toFixed(2)} req/s</td>
                        <td>${(result.errorRate * 100).toFixed(3)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>📈 等级分布</h2>
        <div class="chart-container">
            <div class="bar-chart">
                ${['A', 'B', 'C', 'D', 'F'].map(grade => {
                    const count = this.results.filter(r => r.grade === grade).length;
                    const percentage = (count / this.results.length * 100);
                    const height = percentage;
                    const color = {
                      'A': '#27ae60',
                      'B': '#3498db',
                      'C': '#f39c12',
                      'D': '#e67e22',
                      'F': '#e74c3c'
                    }[grade];

                    return `
                        <div class="bar" style="height: ${height}%; background: ${color};">
                            <div class="bar-label">${grade}</div>
                            <div class="bar-value">${count}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <h2>⚡ 性能最快的端点</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>排名</th>
                    <th>端点名称</th>
                    <th>响应时间</th>
                    <th>吞吐量</th>
                </tr>
            </thead>
            <tbody>
                ${[...this.results].sort((a, b) => a.avgResponseTime - b.avgResponseTime).slice(0, 5).map((result, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${result.endpoint}</td>
                        <td>${result.avgResponseTime.toFixed(2)}ms</td>
                        <td>${result.throughput.toFixed(2)} req/s</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>🐌 需要优化的端点</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>排名</th>
                    <th>端点名称</th>
                    <th>响应时间</th>
                    <th>建议</th>
                </tr>
            </thead>
            <tbody>
                ${[...this.results].sort((a, b) => b.avgResponseTime - a.avgResponseTime).filter(r => r.grade === 'D' || r.grade === 'F').map((result, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${result.endpoint}</td>
                        <td>${result.avgResponseTime.toFixed(2)}ms</td>
                        <td>${result.errorRate > 0.01 ? '检查错误处理逻辑' : '优化查询性能'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `;

    fs.writeFileSync(
      path.join(__dirname, 'performance-benchmark-report.html'),
      html
    );
  }
}

// 主执行函数
async function main() {
  const benchmark = new PerformanceBenchmark();

  try {
    await benchmark.runFullBenchmark();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 性能基准测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

export { PerformanceBenchmark, BenchmarkResult, EndpointTest };