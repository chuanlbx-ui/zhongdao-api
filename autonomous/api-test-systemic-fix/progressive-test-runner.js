const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProgressiveTestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      phases: []
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',   // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
      reset: '\x1b[0m'
    };

    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  async runCommand(command, description) {
    this.log(`\n🔄 ${description}`, 'info');
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000
      });
      this.log(`   ✅ 成功`, 'success');
      return { success: true, output };
    } catch (error) {
      this.log(`   ❌ 失败`, 'error');
      this.log(`   错误信息: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async runPhase(name, tests) {
    this.log(`\n\n📊 Phase: ${name}`, 'info');
    this.log('='.repeat(60), 'info');

    const phaseResult = {
      name,
      tests: [],
      passed: 0,
      failed: 0
    };

    for (const test of tests) {
      const result = await this.runCommand(test.command, test.description);
      phaseResult.tests.push({
        ...test,
        ...result
      });

      if (result.success) {
        phaseResult.passed++;
        this.results.passed++;
      } else {
        phaseResult.failed++;
        this.results.failed++;
      }
      this.results.total++;
    }

    this.results.phases.push(phaseResult);
    this.log(`\nPhase ${name} 完成: ${phaseResult.passed}/${phaseResult.tests.length} 通过`,
      phaseResult.failed === 0 ? 'success' : 'warning');

    return phaseResult;
  }

  generateReport() {
    const reportPath = path.join(__dirname, 'test-report.md');
    const timestamp = new Date().toLocaleString('zh-CN');

    let report = `# API测试渐进式测试报告\n\n`;
    report += `生成时间: ${timestamp}\n\n`;
    report += `## 总览\n\n`;
    report += `- 总测试数: ${this.results.total}\n`;
    report += `- 通过: ${this.results.passed} (${(this.results.passed/this.results.total*100).toFixed(1)}%)\n`;
    report += `- 失败: ${this.results.failed} (${(this.results.failed/this.results.total*100).toFixed(1)}%)\n\n`;

    report += `## Phase详情\n\n`;

    for (const phase of this.results.phases) {
      report += `### ${phase.name}\n\n`;
      report += `结果: ${phase.passed}/${phase.tests.length} 通过\n\n`;

      for (const test of phase.tests) {
        const status = test.success ? '✅' : '❌';
        report += `${status} **${test.description}**\n`;
        report += `   命令: \`${test.command}\`\n`;
        if (!test.success) {
          report += `   错误: ${test.error}\n`;
        }
        report += '\n';
      }
    }

    fs.writeFileSync(reportPath, report, 'utf8');
    this.log(`\n📝 测试报告已生成: ${reportPath}`, 'success');

    return reportPath;
  }

  async runAll() {
    this.log('🚀 开始API测试渐进式测试', 'info');
    this.log('='.repeat(60), 'info');

    // Phase 1: 基础设施测试
    await this.runPhase('Phase 1: 基础设施验证', [
      {
        description: '数据库连接测试',
        command: 'npm run db:validate'
      },
      {
        description: 'TypeScript编译检查',
        command: 'npm run type-check'
      }
    ]);

    // Phase 2: 已通过的模块测试（确保仍然通过）
    await this.runPhase('Phase 2: 核心模块测试', [
      {
        description: '支付系统测试',
        command: 'npm test tests/api/payments.test.ts'
      },
      {
        description: '库存管理测试',
        command: 'npm test tests/api/inventory.test.ts'
      }
    ]);

    // Phase 3: 用户管理测试
    await this.runPhase('Phase 3: 用户管理测试', [
      {
        description: '用户API测试',
        command: 'npm test tests/api/users.test.ts -- --reporter=verbose'
      }
    ]);

    // Phase 4: 其他模块测试
    await this.runPhase('Phase 4: 其他模块测试', [
      {
        description: '店铺管理测试',
        command: 'npm test tests/api/shops.test.ts'
      },
      {
        description: '商品管理测试',
        command: 'npm test tests/api/products.test.ts'
      }
    ]);

    // 生成报告
    const reportPath = this.generateReport();

    // 显示总结
    this.log('\n\n📊 测试完成总结', 'info');
    this.log('='.repeat(60), 'info');
    this.log(`总测试数: ${this.results.total}`, 'info');
    this.log(`通过: ${this.results.passed} (${(this.results.passed/this.results.total*100).toFixed(1)}%)`, 'success');
    this.log(`失败: ${this.results.failed} (${(this.results.failed/this.results.total*100).toFixed(1)}%)`,
      this.results.failed > 0 ? 'warning' : 'success');

    if (this.results.failed > 0) {
      this.log('\n⚠️  存在失败的测试，请查看详细报告', 'warning');
    } else {
      this.log('\n✅ 所有测试通过！', 'success');
    }

    return {
      success: this.results.failed === 0,
      reportPath,
      ...this.results
    };
  }
}

// 运行测试
if (require.main === module) {
  const runner = new ProgressiveTestRunner();
  runner.runAll()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('测试运行失败:', error);
      process.exit(1);
    });
}

module.exports = ProgressiveTestRunner;