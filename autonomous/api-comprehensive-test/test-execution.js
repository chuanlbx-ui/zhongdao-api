/**
 * API综合测试执行器
 * 负责协调和执行所有AI智能体的测试任务
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class APITestExecutor {
  constructor() {
    this.testResults = {
      startTime: new Date(),
      modules: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };
    this.testDir = path.join(__dirname, 'results');
    this.ensureTestDir();
  }

  ensureTestDir() {
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }
  }

  async executeTestSuite(testName, command) {
    console.log(`\n🧪 执行测试: ${testName}`);
    console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`);

    const result = {
      name: testName,
      command,
      startTime: new Date(),
      status: 'running',
      output: '',
      error: ''
    };

    try {
      // 执行测试命令
      const output = execSync(command, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 600000 // 10分钟超时
      });

      result.output = output;
      result.status = 'passed';
      result.endTime = new Date();
      result.duration = result.endTime - result.startTime;

      console.log(`✅ ${testName} - 测试通过`);
      this.testResults.summary.passed++;

    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
      result.endTime = new Date();
      result.duration = result.endTime - result.startTime;

      console.log(`❌ ${testName} - 测试失败`);
      console.log(`   错误: ${error.message}`);
      this.testResults.summary.failed++;
    }

    this.testResults.summary.total++;
    this.testResults.modules[testName] = result;

    // 保存测试结果
    this.saveTestResult(result);

    return result;
  }

  saveTestResult(result) {
    const filename = `${result.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`;
    const filepath = path.join(this.testDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  }

  async runAllTests() {
    console.log('\n🚀 开始执行API综合测试');
    console.log('=====================================\n');

    // Phase 1: 准备阶段
    await this.executeTestSuite('01-环境检查', 'npm run db:validate');

    // Phase 2: 核心API测试
    const testSuites = [
      // 用户系统API测试
      ['02-用户认证API', 'npm test tests/api/auth.test.ts'],
      ['03-用户管理API', 'npm test tests/api/users.test.ts'],
      ['04-团队关系API', 'npm test tests/api/teams.test.ts'],

      // 商城系统API测试
      ['05-商城管理API', 'npm test tests/api/shops.test.ts'],
      ['06-商品管理API', 'npm test tests/api/products.test.ts'],
      ['07-订单管理API', 'npm test tests/api/orders.test.ts'],

      // 支付系统API测试
      ['08-积分系统API', 'npm test tests/api/points.test.ts'],
      ['09-支付流程API', 'npm test tests/api/payments.test.ts'],
      ['10-佣金系统API', 'npm test tests/api/commission.test.ts'],

      // 管理系统API测试
      ['11-管理员API', 'npm run test:admin'],

      // 集成测试
      ['12-系统集成测试', 'npm run test:integration'],

      // 安全测试
      ['13-API安全测试', 'npm run test:security'],

      // 性能测试
      ['14-API性能测试', 'npm run test:performance']
    ];

    // 执行所有测试套件
    for (const [testName, command] of testSuites) {
      await this.executeTestSuite(testName, command);

      // 每个测试后稍作休息，避免系统过载
      await this.sleep(2000);
    }

    // 生成测试报告
    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 生成测试报告...');

    const report = {
      testRun: {
        startTime: this.testResults.startTime,
        endTime: new Date(),
        duration: new Date() - this.testResults.startTime
      },
      summary: this.testResults.summary,
      modules: Object.keys(this.testResults.modules).map(key => ({
        name: this.testResults.modules[key].name,
        status: this.testResults.modules[key].status,
        duration: this.testResults.modules[key].duration
      })),
      issues: this.collectIssues()
    };

    // 保存JSON报告
    const reportJson = path.join(this.testDir, 'test-report.json');
    fs.writeFileSync(reportJson, JSON.stringify(report, null, 2));

    // 生成HTML报告
    this.generateHtmlReport(report);

    // 显示摘要
    this.displaySummary(report);

    console.log('\n✅ 测试完成！');
    console.log(`📄 报告位置: ${this.testDir}`);
  }

  collectIssues() {
    const issues = [];

    for (const [name, result] of Object.entries(this.testResults.modules)) {
      if (result.status === 'failed') {
        issues.push({
          module: name,
          severity: 'high',
          error: result.error,
          suggestedFix: this.suggestFix(name, result.error)
        });
      }
    }

    return issues;
  }

  suggestFix(module, error) {
    const suggestions = {
      '用户认证API': '检查JWT配置和数据库连接',
      '用户管理API': '验证用户权限和输入验证',
      '商城管理API': '检查库存系统和业务逻辑',
      '积分系统API': '验证积分计算和交易逻辑',
      '管理员API': '检查权限控制和配置文件',
      'default': '查看详细错误日志，联系相关开发人员'
    };

    return suggestions[module] || suggestions['default'];
  }

  generateHtmlReport(report) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>API测试报告 - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #fff; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .metric h3 { margin: 0; font-size: 24px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background: #f8f9fa; }
        .status-passed { background: #d4edda; }
        .status-failed { background: #f8d7da; }
        .issues { background: #fff3cd; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>中道商城系统 - API测试报告</h1>
        <p>测试时间: ${report.testRun.startTime.toLocaleString()} - ${report.testRun.endTime.toLocaleString()}</p>
        <p>总耗时: ${(report.testRun.duration / 1000).toFixed(2)} 秒</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3 class="passed">${report.summary.passed}</h3>
            <p>通过</p>
        </div>
        <div class="metric">
            <h3 class="failed">${report.summary.failed}</h3>
            <p>失败</p>
        </div>
        <div class="metric">
            <h3>${report.summary.total}</h3>
            <p>总计</p>
        </div>
    </div>

    <h2>测试详情</h2>
    <table>
        <thead>
            <tr>
                <th>模块</th>
                <th>状态</th>
                <th>耗时(秒)</th>
            </tr>
        </thead>
        <tbody>
            ${report.modules.map(module => `
                <tr class="status-${module.status}">
                    <td>${module.name}</td>
                    <td>${module.status === 'passed' ? '✅ 通过' : '❌ 失败'}</td>
                    <td>${(module.duration / 1000).toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    ${report.issues.length > 0 ? `
        <div class="issues">
            <h2>⚠️ 发现的问题</h2>
            <ul>
                ${report.issues.map(issue => `
                    <li>
                        <strong>${issue.module}</strong>: ${issue.error}
                        <br><em>建议: ${issue.suggestedFix}</em>
                    </li>
                `).join('')}
            </ul>
        </div>
    ` : ''}
</body>
</html>
    `;

    const reportHtml = path.join(this.testDir, 'test-report.html');
    fs.writeFileSync(reportHtml, html);
  }

  displaySummary(report) {
    console.log('\n📋 测试摘要');
    console.log('=====================================');
    console.log(`总测试数: ${report.summary.total}`);
    console.log(`通过: ${report.summary.passed} ✅`);
    console.log(`失败: ${report.summary.failed} ❌`);
    console.log(`跳过: ${report.summary.skipped} ⏭️`);
    console.log(`通过率: ${((report.summary.passed / report.summary.total) * 100).toFixed(2)}%`);

    if (report.issues.length > 0) {
      console.log('\n⚠️ 发现的问题:');
      report.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.module}: ${issue.error.substring(0, 100)}...`);
      });
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 执行测试
if (require.main === module) {
  const executor = new APITestExecutor();
  executor.runAllTests().catch(console.error);
}

module.exports = APITestExecutor;