/**
 * 运行覆盖率演示测试的简单脚本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始运行覆盖率演示测试...\n');

// 确保覆盖率目录存在
const coverageDir = path.join(__dirname, '../coverage');
if (!fs.existsSync(coverageDir)) {
  fs.mkdirSync(coverageDir, { recursive: true });
  console.log('✅ 创建coverage目录');
}

try {
  // 运行单个测试文件并生成覆盖率
  console.log('📊 运行coverage-demo.test.ts...\n');

  const vitestCommand = [
    'npx',
    'vitest',
    'run',
    '--coverage',
    '--reporter=verbose',
    'tests/unit/coverage-demo.test.ts'
  ].join(' ');

  console.log(`执行命令: ${vitestCommand}\n`);

  execSync(vitestCommand, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    encoding: 'utf8'
  });

  console.log('\n✅ 测试完成！');

  // 检查覆盖率报告
  const indexHtml = path.join(coverageDir, 'index.html');
  const lcovInfo = path.join(coverageDir, 'lcov.info');

  if (fs.existsSync(indexHtml)) {
    console.log(`\n📋 HTML覆盖率报告: ${indexHtml}`);
    console.log('💡 在浏览器中打开查看详细报告\n');
  }

  if (fs.existsSync(lcovInfo)) {
    console.log(`\n📋 LCOV覆盖率报告: ${lcovInfo}`);
  }

  // 尝试读取覆盖率摘要
  const coverageSummary = path.join(coverageDir, 'coverage-summary.json');
  if (fs.existsSync(coverageSummary)) {
    const summary = JSON.parse(fs.readFileSync(coverageSummary, 'utf8'));
    console.log('\n📊 覆盖率摘要:');
    console.log(JSON.stringify(summary, null, 2));
  }

} catch (error) {
  console.error('\n❌ 运行测试时出错:');
  console.error(error.message);
  process.exit(1);
}

console.log('\n🏁 执行完成');