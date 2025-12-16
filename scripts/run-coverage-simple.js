/**
 * 简单的覆盖率测试运行器
 * 运行所有单元测试并生成覆盖率报告
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始运行单元测试覆盖率...\n');

// 确保覆盖率目录存在
const coverageDir = path.join(__dirname, '../coverage');
if (!fs.existsSync(coverageDir)) {
  fs.mkdirSync(coverageDir, { recursive: true });
  console.log('✅ 创建coverage目录');
}

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.DISABLE_CSRF = 'true';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/zhongdao_test';

try {
  // 运行vitest生成覆盖率报告
  console.log('📊 运行vitest生成覆盖率报告...\n');

  const vitestCommand = [
    'npx',
    'vitest',
    'run',
    '--coverage',
    '--reporter=verbose',
    'tests/unit',
    '--exclude=tests/api',
    '--exclude=tests/integration',
    '--exclude=tests/e2e'
  ].join(' ');

  console.log(`执行命令: ${vitestCommand}\n`);

  const output = execSync(vitestCommand, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    encoding: 'utf8'
  });

  console.log('\n✅ 测试完成！');

  // 检查覆盖率报告是否生成
  const coverageReportPath = path.join(coverageDir, 'index.html');
  if (fs.existsSync(coverageReportPath)) {
    console.log(`\n📋 覆盖率报告已生成: ${coverageReportPath}`);
    console.log('💡 在浏览器中打开查看详细报告\n');
  } else {
    console.log('\n⚠️ 覆盖率报告未生成，请检查错误信息\n');
  }

} catch (error) {
  console.error('\n❌ 运行测试时出错:');
  console.error(error.message);

  // 尝试运行不带覆盖率的测试
  console.log('\n🔄 尝试运行不带覆盖率的测试...\n');

  try {
    execSync('npx vitest run tests/unit --exclude=tests/api --exclude=tests/integration --exclude=tests/e2e', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
  } catch (e) {
    console.error('\n❌ 测试仍然失败');
    process.exit(1);
  }
}

console.log('\n🏁 测试脚本执行完成');