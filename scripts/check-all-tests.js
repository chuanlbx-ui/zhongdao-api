/**
 * 检查所有API测试的状态
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testFiles = [
  'tests/api/auth.test.ts',
  'tests/api/users.test.ts',
  'tests/api/products.test.ts',
  'tests/api/orders.test.ts',
  'tests/api/inventory.test.ts',
  'tests/api/points.test.ts',
  'tests/api/teams.test.ts',
  'tests/api/shops.test.ts',
  'tests/api/commission.test.ts'
];

console.log('=== 中道商城API测试状态检查 ===\n');

const results = [];

for (const testFile of testFiles) {
  if (!fs.existsSync(path.join(__dirname, '..', testFile))) {
    results.push({ file: testFile, status: 'NOT_FOUND', passed: 0, failed: 0, total: 0 });
    continue;
  }

  try {
    console.log(`检查 ${testFile}...`);
    const output = execSync(`npx vitest run ${testFile} --reporter=json`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });

    // 解析JSON输出
    const lines = output.split('\n');
    const jsonLine = lines.find(line => line.startsWith('{') && line.endsWith('}'));

    if (jsonLine) {
      const result = JSON.parse(jsonLine);
      results.push({
        file: testFile,
        status: 'COMPLETED',
        passed: result.numPassedTests || 0,
        failed: result.numFailedTests || 0,
        total: result.numTotalTests || 0,
        successRate: result.numTotalTests > 0 ? ((result.numPassedTests / result.numTotalTests) * 100).toFixed(1) : '0'
      });
    } else {
      results.push({ file: testFile, status: 'ERROR', passed: 0, failed: 0, total: 0 });
    }
  } catch (error) {
    // 尝试从错误输出中提取信息
    const errorOutput = error.stdout || error.stderr || '';
    const passedMatch = errorOutput.match(/(\d+) passed/);
    const failedMatch = errorOutput.match(/(\d+) failed/);
    const totalMatch = errorOutput.match(/Tests\s+(\d+)/);

    results.push({
      file: testFile,
      status: 'ERROR',
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      total: totalMatch ? parseInt(totalMatch[1]) : 0
    });
  }
}

// 输出结果表格
console.log('\n=== 测试结果汇总 ===');
console.log('文件名'.padEnd(30) + '状态'.padEnd(12) + '通过'.padEnd(8) + '失败'.padEnd(8) + '总计'.padEnd(8) + '成功率');
console.log('-'.repeat(80));

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

for (const result of results) {
  const status = result.status === 'COMPLETED' ? '✅ 完成' :
                 result.status === 'ERROR' ? '❌ 错误' :
                 result.status === 'NOT_FOUND' ? '⚠️ 未找到' : '❓ 未知';

  console.log(
    result.file.padEnd(30) +
    status.padEnd(12) +
    String(result.passed).padEnd(8) +
    String(result.failed).padEnd(8) +
    String(result.total).padEnd(8) +
    (result.successRate ? `${result.successRate}%` : '-')
  );

  totalPassed += result.passed;
  totalFailed += result.failed;
  totalTests += result.total;
}

console.log('-'.repeat(80));
const overallSuccessRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';
console.log(
  '总计'.padEnd(30) +
  ''.padEnd(12) +
  String(totalPassed).padEnd(8) +
  String(totalFailed).padEnd(8) +
  String(totalTests).padEnd(8) +
  `${overallSuccessRate}%`
);

console.log('\n=== 成功的修复模式 ===');
console.log('1. JWT Token一致性保证 - 确保token和用户ID匹配');
console.log('2. 权限参数检查 - 处理查询参数中的权限要求');
console.log('3. 数据库字段完整性 - 防止字段缺失错误');
console.log('4. 简化复杂服务调用 - 避免复杂的团队服务调用');

console.log('\n=== 建议优先修复的模块 ===');
const failedModules = results
  .filter(r => r.failed > 0 && r.status !== 'NOT_FOUND')
  .sort((a, b) => b.failed - a.failed);

failedModules.slice(0, 3).forEach((module, index) => {
  console.log(`${index + 1}. ${module.file} - ${module.failed} 个测试失败`);
});