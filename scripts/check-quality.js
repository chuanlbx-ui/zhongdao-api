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

function runCommand(command, description, options = {}) {
  try {
    log(`\n${colors.blue}▶ ${description}...${colors.reset}`);
    execSync(command, { stdio: 'inherit', ...options });
    log(`✅ ${description} completed successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} failed`, 'red');
    if (!options.continueOnError) {
      process.exit(1);
    }
    return false;
  }
}

function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getESLintStats() {
  try {
    const output = execSync('npx eslint src --ext .ts --format=json', { encoding: 'utf8' });
    const results = JSON.parse(output);
    let warnings = 0;
    let errors = 0;
    results.forEach(file => {
      warnings += file.warningCount;
      errors += file.errorCount;
    });
    return { warnings, errors };
  } catch {
    return { warnings: 0, errors: 0 };
  }
}

function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('🔍 中道商城代码质量检查', 'bold');
  log('='.repeat(60) + '\n', 'blue');

  // 检查必要文件
  const requiredFiles = [
    '.eslintrc.js',
    'tsconfig.json',
    'package.json'
  ];

  log('📋 检查必要配置文件...', 'blue');
  let allFilesExist = true;
  requiredFiles.forEach(file => {
    if (checkFileExists(file)) {
      log(`  ✓ ${file}`, 'green');
    } else {
      log(`  ❌ ${file} 缺失`, 'red');
      allFilesExist = false;
    }
  });

  if (!allFilesExist) {
    log('\n❌ 缺少必要配置文件，请检查！', 'red');
    process.exit(1);
  }

  const startTime = Date.now();
  const results = {
    typeCheck: false,
    lintCheck: false,
    formatCheck: false,
    buildCheck: false,
    testCheck: false
  };

  // TypeScript 类型检查
  results.typeCheck = runCommand(
    'npm run type-check',
    'TypeScript 类型检查',
    { continueOnError: true }
  );

  // ESLint 检查
  const { warnings, errors } = getESLintStats();
  log(`\n📊 ESLint 统计:`, 'blue');
  log(`  错误: ${errors}`, errors > 0 ? 'red' : 'green');
  log(`  警告: ${warnings}`, warnings > 10 ? 'yellow' : 'green');

  results.lintCheck = errors === 0 && warnings <= 10;

  // Prettier 检查
  results.formatCheck = runCommand(
    'npx prettier --check "src/**/*.ts"',
    'Prettier 格式检查',
    { continueOnError: true }
  );

  // 构建检查
  results.buildCheck = runCommand(
    'npm run build',
    '项目构建检查',
    { continueOnError: true }
  );

  // 测试检查
  results.testCheck = runCommand(
    'npm run test:coverage',
    '测试覆盖率检查',
    { continueOnError: true }
  );

  // 计算耗时
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // 生成报告
  log('\n' + '='.repeat(60), 'blue');
  log('📊 质量检查报告', 'bold');
  log('='.repeat(60) + '\n', 'blue');

  const checkItems = [
    { name: 'TypeScript 类型检查', status: results.typeCheck },
    { name: 'ESLint 代码规范', status: results.lintCheck },
    { name: 'Prettier 格式化', status: results.formatCheck },
    { name: '项目构建', status: results.buildCheck },
    { name: '测试覆盖率', status: results.testCheck }
  ];

  let passed = 0;
  checkItems.forEach(item => {
    const icon = item.status ? '✅' : '❌';
    const color = item.status ? 'green' : 'red';
    log(`  ${icon} ${item.name}`, color);
    if (item.status) passed++;
  });

  log(`\n⏱️  总耗时: ${duration} 秒`, 'blue');
  log(`📈 通过率: ${passed}/${checkItems.length} (${Math.round(passed / checkItems.length * 100)}%)`,
    passed === checkItems.length ? 'green' : 'yellow');

  // 生成质量报告文件
  const report = {
    timestamp: new Date().toISOString(),
    duration: parseFloat(duration),
    results: {
      ...results,
      eslintWarnings: warnings,
      eslintErrors: errors
    },
    summary: {
      total: checkItems.length,
      passed,
      percentage: Math.round(passed / checkItems.length * 100)
    }
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'quality-report.json'),
    JSON.stringify(report, null, 2)
  );

  log('\n📄 详细报告已保存到 quality-report.json', 'blue');

  if (passed === checkItems.length) {
    log('\n🎉 所有质量检查通过！', 'green', 'bold');
    process.exit(0);
  } else {
    log('\n⚠️  存在质量问题，请修复后重试！', 'yellow', 'bold');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };