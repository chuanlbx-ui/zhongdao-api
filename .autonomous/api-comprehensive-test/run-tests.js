#!/usr/bin/env node

/**
 * API综合测试快速启动脚本
 * 使用方法: node run-tests.js [选项]
 */

const { program } = require('commander');
const APITestExecutor = require('./test-execution');
const fs = require('fs');
const path = require('path');

program
  .name('run-tests')
  .description('中道商城系统API综合测试执行器')
  .version('1.0.0');

program
  .option('-m, --module <module>', '运行指定模块的测试', 'all')
  .option('-r, --reporter <type>', '报告格式 (json|html|console)', 'all')
  .option('-t, --timeout <seconds>', '测试超时时间（秒）', '600')
  .option('-v, --verbose', '详细输出模式', false)
  .option('-s, --skip-slow', '跳过耗时较长的测试', false)
  .option('--dry-run', '仅显示要运行的测试，不实际执行', false)
  .parse();

const options = program.opts();

const testModules = {
  'auth': {
    name: '用户认证系统',
    files: ['tests/api/auth.test.ts'],
    agent: 'User-API-AI'
  },
  'users': {
    name: '用户管理系统',
    files: ['tests/api/users.test.ts'],
    agent: 'User-API-AI'
  },
  'shops': {
    name: '商城管理系统',
    files: ['tests/api/shops.test.ts'],
    agent: 'Shop-API-AI'
  },
  'products': {
    name: '商品管理系统',
    files: ['tests/api/products.test.ts'],
    agent: 'Shop-API-AI'
  },
  'orders': {
    name: '订单管理系统',
    files: ['tests/api/orders.test.ts'],
    agent: 'Shop-API-AI'
  },
  'points': {
    name: '积分系统',
    files: ['tests/api/points.test.ts'],
    agent: 'Payment-API-AI'
  },
  'payments': {
    name: '支付系统',
    files: ['tests/api/payments.test.ts'],
    agent: 'Payment-API-AI'
  },
  'commission': {
    name: '佣金系统',
    files: ['tests/api/commission.test.ts'],
    agent: 'Payment-API-AI'
  },
  'admin': {
    name: '管理系统',
    files: ['tests/api/admin.test.ts'],
    command: 'npm run test:admin',
    agent: 'Admin-API-AI'
  },
  'security': {
    name: '安全测试',
    command: 'npm run test:security',
    agent: 'Security-AI',
    slow: true
  },
  'performance': {
    name: '性能测试',
    command: 'npm run test:performance',
    agent: 'Performance-AI',
    slow: true
  },
  'integration': {
    name: '集成测试',
    command: 'npm run test:integration',
    agent: 'Test-AI',
    slow: true
  }
};

async function showTestPlan() {
  console.log('\n📋 测试计划');
  console.log('=====================================\n');

  const modulesToRun = options.module === 'all'
    ? Object.keys(testModules)
    : [options.module];

  console.log(`将要运行的测试模块 (${modulesToRun.length}个):\n`);

  for (const moduleKey of modulesToRun) {
    const module = testModules[moduleKey];
    if (!module) {
      console.log(`⚠️  未知模块: ${moduleKey}`);
      continue;
    }

    console.log(`📦 ${module.name}`);
    console.log(`   负责AI: ${module.agent}`);

    if (module.slow && options.skipSlow) {
      console.log(`   状态: ⏭️  已跳过 (使用 --skip-slow 选项)`);
    } else {
      console.log(`   状态: ⏳ 将要执行`);
      if (module.files) {
        console.log(`   文件: ${module.files.join(', ')}`);
      }
      if (module.command) {
        console.log(`   命令: ${module.command}`);
      }
    }
    console.log('');
  }

  console.log('\n配置:');
  console.log(`- 超时时间: ${options.timeout} 秒`);
  console.log(`- 详细模式: ${options.verbose ? '开启' : '关闭'}`);
  console.log(`- 跳过慢测试: ${options.skipSlow ? '是' : '否'}`);
  console.log(`- 报告格式: ${options.reporter}`);
}

async function runTests() {
  if (options.dryRun) {
    await showTestPlan();
    return;
  }

  console.log('\n🚀 开始执行API测试');
  console.log('=====================================\n');

  const executor = new APITestExecutor();
  const modulesToRun = options.module === 'all'
    ? Object.keys(testModules)
    : [options.module];

  // 准备阶段
  console.log('\n📝 准备阶段');
  console.log('-------------------------------------');
  await executor.executeTestSuite('00-环境检查', 'npm run db:validate');

  // 执行测试
  for (const moduleKey of modulesToRun) {
    const module = testModules[moduleKey];
    if (!module) {
      console.log(`⚠️  跳过未知模块: ${moduleKey}`);
      continue;
    }

    if (module.slow && options.skipSlow) {
      console.log(`⏭️  跳过慢测试模块: ${module.name}`);
      continue;
    }

    if (module.command) {
      await executor.executeTestSuite(module.name, module.command);
    } else if (module.files) {
      for (const file of module.files) {
        await executor.executeTestSuite(
          `${module.name} - ${path.basename(file)}`,
          `npm test ${file}`
        );
      }
    }
  }

  // 生成报告
  executor.generateReport();
}

// 创建测试执行记录
function createTestRecord(results) {
  const record = {
    timestamp: new Date().toISOString(),
    configuration: options,
    results: results,
    summary: {
      totalModules: Object.keys(results.modules).length,
      successfulModules: Object.values(results.modules).filter(m => m.status === 'passed').length,
      failedModules: Object.values(results.modules).filter(m => m.status === 'failed').length,
      totalDuration: Object.values(results.modules).reduce((sum, m) => sum + m.duration, 0)
    }
  };

  const recordsDir = path.join(__dirname, 'records');
  if (!fs.existsSync(recordsDir)) {
    fs.mkdirSync(recordsDir);
  }

  const recordFile = path.join(recordsDir, `test-record-${Date.now()}.json`);
  fs.writeFileSync(recordFile, JSON.stringify(record, null, 2));

  console.log(`\n📝 测试记录已保存: ${recordFile}`);
  return recordFile;
}

// 主程序
async function main() {
  try {
    // 显示欢迎信息
    console.log('\n🎯 中道商城系统 - API综合测试平台');
    console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`);
    console.log('=====================================\n');

    // 如果是dry-run，显示计划并退出
    if (options.dryRun) {
      await showTestPlan();
      process.exit(0);
    }

    // 执行测试
    await runTests();

    // 显示完成信息
    console.log('\n🎉 测试执行完成！');
    console.log(`⏰ 结束时间: ${new Date().toLocaleString()}`);

  } catch (error) {
    console.error('\n❌ 测试执行出错:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  runTests,
  testModules,
  showTestPlan
};