#!/usr/bin/env node

/**
 * 检查所有API测试的当前状态
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 检查所有API测试的状态...\n');

// 测试文件列表
const testFiles = [
  'tests/api/inventory.test.ts',
  'tests/api/points.test.ts',
  'tests/api/users.test.ts',
  'tests/api/shops.test.ts',
  'tests/api/orders.test.ts',
  'tests/api/teams.test.ts',
  'tests/api/commission.test.ts',
  'tests/api/payments.test.ts',
  'tests/api/products.test.ts'
];

// 检查文件是否存在
console.log('检查测试文件...');
testFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
});

console.log('\n开始运行测试（每个测试限时30秒）...\n');

// 运行每个测试
const results = [];

testFiles.forEach(file => {
  console.log(`\n====================`);
  console.log(`测试: ${file}`);
  console.log(`====================`);

  try {
    const startTime = Date.now();
    const output = execSync(`cd ${__dirname} && timeout 30 npm test ${file} -- --run`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    const duration = Date.now() - startTime;

    // 统计通过的测试
    const passMatch = output.match(/✓.*\n/g);
    const failMatch = output.match(/×.*\n/g);
    const passed = passMatch ? passMatch.length : 0;
    const failed = failMatch ? failMatch.length : 0;
    const total = passed + failed;

    results.push({
      file,
      status: 'completed',
      passed,
      failed,
      total,
      duration
    });

    console.log(`\n✅ 完成 - 通过: ${passed}/${total} (${duration}ms)`);

  } catch (error) {
    const duration = Date.now() - startTime;
    let passed = 0, failed = 0, total = 0;

    if (error.stdout) {
      const passMatch = error.stdout.match(/✓.*\n/g);
      const failMatch = error.stdout.match(/×.*\n/g);
      passed = passMatch ? passMatch.length : 0;
      failed = failMatch ? failMatch.length : 0;
      total = passed + failed;
    }

    if (error.signal === 'SIGTERM') {
      console.log(`\n⏰ 超时 - 通过: ${passed}/${total} (${duration}ms)`);
      results.push({
        file,
        status: 'timeout',
        passed,
        failed,
        total,
        duration
      });
    } else {
      console.log(`\n❌ 失败 - 通过: ${passed}/${total} (${duration}ms)`);
      console.log(`错误: ${error.message}`);
      results.push({
        file,
        status: 'failed',
        passed,
        failed,
        total,
        duration,
        error: error.message
      });
    }
  }
});

// 汇总结果
console.log('\n\n====================');
console.log('测试结果汇总');
console.log('====================');

const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
const totalTests = totalPassed + totalFailed;
const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

console.log(`总体通过率: ${totalPassed}/${totalTests} (${passRate}%)\n`);

results.forEach(result => {
  const status = result.status === 'completed' ? '✅' :
                result.status === 'timeout' ? '⏰' : '❌';
  const rate = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0.0';
  console.log(`${status} ${result.file}`);
  console.log(`   通过: ${result.passed}/${result.total} (${rate}%) - ${result.duration}ms`);
});

console.log('\n分析:');
if (totalTests === 0) {
  console.log('- 所有测试都遇到了问题');
} else if (parseFloat(passRate) < 50) {
  console.log('- 测试通过率较低，需要进一步修复');
} else if (parseFloat(passRate) < 80) {
  console.log('- 测试通过率尚可，继续优化');
} else {
  console.log('- 测试通过率良好！');
}