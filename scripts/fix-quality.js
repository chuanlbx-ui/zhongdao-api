#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  try {
    log(`\n${colors.blue}🔧 ${description}...${colors.reset}`);
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} 完成`, 'green');
    return true;
  } catch (error) {
    log(`⚠️ ${description} 失败: ${error.message}`, 'yellow');
    return false;
  }
}

function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('🔧 中道商城代码质量自动修复', 'bold');
  log('='.repeat(60) + '\n', 'blue');

  const startTime = Date.now();
  const results = {
    lintFix: false,
    formatFix: false,
    importFix: false
  };

  // ESLint 自动修复
  results.lintFix = runCommand(
    'npm run lint:fix',
    'ESLint 自动修复'
  );

  // Prettier 格式化
  results.formatFix = runCommand(
    'npm run format',
    'Prettier 格式化'
  );

  // 修复导入顺序
  results.importFix = runCommand(
    'npx eslint src --ext .ts --fix --rule "import/order: [2, {alphabetize: {order: asc, caseInsensitive: true}}]"',
    '导入排序修复'
  );

  // 检查 TypeScript 编译错误
  log('\n🔍 检查 TypeScript 编译...', 'blue');
  try {
    execSync('npm run type-check', { stdio: 'pipe' });
    log('✅ TypeScript 编译无错误', 'green');
  } catch (error) {
    log('⚠️ TypeScript 仍有编译错误，需要手动修复', 'yellow');

    // 尝试提取具体的错误信息
    const errors = error.stdout?.toString().split('\n').filter(line =>
      line.includes('error TS') && !line.includes('node_modules')
    ).slice(0, 5);

    if (errors.length > 0) {
      log('\n📝 主要错误:', 'yellow');
      errors.forEach(err => log(`  - ${err}`, 'yellow'));
    }
  }

  // 计算耗时
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  log('\n' + '='.repeat(60), 'blue');
  log('📊 修复结果', 'bold');
  log('='.repeat(60) + '\n', 'blue');

  const fixItems = [
    { name: 'ESLint 自动修复', status: results.lintFix },
    { name: 'Prettier 格式化', status: results.formatFix },
    { name: '导入排序修复', status: results.importFix }
  ];

  let fixed = 0;
  fixItems.forEach(item => {
    const icon = item.status ? '✅' : '❌';
    const color = item.status ? 'green' : 'red';
    log(`  ${icon} ${item.name}`, color);
    if (item.status) fixed++;
  });

  log(`\n⏱️  总耗时: ${duration} 秒`, 'blue');

  // 后续建议
  log('\n💡 后续建议:', 'blue');
  log('  1. 运行 npm run quality-check 查看修复结果', 'yellow');
  log('  2. 手动修复 TypeScript 编译错误', 'yellow');
  log('  3. 运行测试确保功能正常', 'yellow');

  if (fixed > 0) {
    log('\n✨ 已修复部分问题，请运行 git add . 提交修复！', 'green');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };