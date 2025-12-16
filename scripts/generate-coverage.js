/**
 * 生成覆盖率报告的独立脚本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始生成测试覆盖率报告...\n');

// 清理旧的覆盖率数据
const coverageDir = path.join(__dirname, '../coverage');
if (fs.existsSync(coverageDir)) {
  fs.rmSync(coverageDir, { recursive: true, force: true });
  console.log('✅ 清理旧的覆盖率数据');
}

// 确保覆盖率目录存在
fs.mkdirSync(coverageDir, { recursive: true });

try {
  // 设置环境变量
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    VITEST: 'true',
    DISABLE_CSRF: 'true',
    DISABLE_RATE_LIMIT: 'true',
    JWT_SECRET: 'test-jwt-secret-key',
    DATABASE_URL: 'mysql://test:test@localhost:3306/zhongdao_test'
  };

  console.log('📊 运行覆盖率测试...\n');

  // 运行vitest并生成覆盖率
  const testCommand = 'npx vitest run --coverage --reporter=verbose tests/unit/coverage-demo-source.test.ts';

  console.log(`执行命令: ${testCommand}\n`);

  const result = execSync(testCommand, {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: 'pipe',
    encoding: 'utf8'
  });

  console.log(result);

  // 检查覆盖率文件是否生成
  const coverageFiles = fs.readdirSync(coverageDir);
  console.log('\n📋 覆盖率文件:', coverageFiles);

  if (coverageFiles.length > 0) {
    console.log('\n✅ 覆盖率报告生成成功！');

    // 尝试读取并显示覆盖率摘要
    const summaryFile = path.join(coverageDir, 'coverage-summary.json');
    if (fs.existsSync(summaryFile)) {
      const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
      console.log('\n📊 覆盖率摘要:');

      if (summary.total) {
        console.log(`总覆盖率: ${summary.total.lines.pct}% (${summary.total.lines.covered}/${summary.total.lines.total})`);
        console.log(`函数覆盖率: ${summary.total.functions.pct}%`);
        console.log(`分支覆盖率: ${summary.total.branches.pct}%`);
        console.log(`语句覆盖率: ${summary.total.statements.pct}%`);
      }
    }

    // 显示HTML报告路径
    const htmlFile = path.join(coverageDir, 'index.html');
    if (fs.existsSync(htmlFile)) {
      console.log(`\n💡 HTML报告路径: ${htmlFile}`);
      console.log('在浏览器中打开查看详细报告');
    }
  } else {
    console.log('\n⚠️ 覆盖率报告未生成');
  }

} catch (error) {
  console.error('\n❌ 生成覆盖率报告时出错:');
  console.error(error.stdout || error.message);

  // 尝试运行不带覆盖率的测试
  console.log('\n🔄 尝试运行不带覆盖率的测试...\n');

  try {
    const result = execSync('npx vitest run tests/unit/coverage-demo-source.test.ts', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    console.log('\n✅ 测试通过（无覆盖率）');
  } catch (e) {
    console.error('\n❌ 测试失败');
    process.exit(1);
  }
}

console.log('\n🏁 执行完成');