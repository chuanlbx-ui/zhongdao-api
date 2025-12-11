#!/usr/bin/env node

/**
 * 数据库索引优化执行脚本
 * 用于安全地执行索引优化操作
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = {
  // 数据库连接信息（从环境变量读取）
  dbHost: process.env.DB_HOST || '127.0.0.1',
  dbPort: process.env.DB_PORT || '3306',
  dbUser: process.env.DB_USER || 'dev_user',
  dbPassword: process.env.DB_PASSWORD || 'dev_password_123',
  dbName: process.env.DB_NAME || 'zhongdao_mall_dev',

  // 优化选项
  backupBeforeOptimization: true,
  enableSlowQueryLog: true,
  analyzeAfterOptimization: true
};

// 颜色输出函数
function colorLog(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
  };

  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 执行SQL命令
function executeSQL(sql, description = '') {
  try {
    colorLog(`\n${description ? description + ' - ' : ''}执行SQL...`, 'blue');

    const mysqlCommand = `mysql -h${config.dbHost} -P${config.dbPort} -u${config.dbUser} -p${config.dbPassword} ${config.dbName}`;
    execSync(`echo "${sql}" | ${mysqlCommand}`, { stdio: 'inherit' });

    colorLog('✅ 执行成功', 'green');
    return true;
  } catch (error) {
    colorLog(`❌ 执行失败: ${error.message}`, 'red');
    return false;
  }
}

// 创建数据库备份
function createBackup() {
  if (!config.backupBeforeOptimization) {
    colorLog('\n跳过数据库备份', 'yellow');
    return true;
  }

  colorLog('\n创建数据库备份...', 'yellow');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `backup_${config.dbName}_${timestamp}.sql`;

  try {
    const dumpCommand = `mysqldump -h${config.dbHost} -P${config.dbPort} -u${config.dbUser} -p${config.dbPassword} ${config.dbName} > ${backupFile}`;
    execSync(dumpCommand);

    colorLog(`✅ 数据库备份完成: ${backupFile}`, 'green');
    return backupFile;
  } catch (error) {
    colorLog(`❌ 数据库备份失败: ${error.message}`, 'red');
    return null;
  }
}

// 检查数据库连接
function checkConnection() {
  colorLog('\n检查数据库连接...', 'blue');

  const checkSQL = 'SELECT 1 as test;';
  const connected = executeSQL(checkSQL, '连接测试');

  if (connected) {
    colorLog('✅ 数据库连接正常', 'green');
    return true;
  } else {
    colorLog('❌ 数据库连接失败', 'red');
    return false;
  }
}

// 启用慢查询日志
function enableSlowQueryLog() {
  if (!config.enableSlowQueryLog) {
    colorLog('\n跳过慢查询日志配置', 'yellow');
    return;
  }

  colorLog('\n配置慢查询日志...', 'blue');

  const slowQuerySQL = `
    SET GLOBAL slow_query_log = 'ON';
    SET GLOBAL long_query_time = 0.1;
    SET GLOBAL log_queries_not_using_indexes = 'ON';
  `;

  executeSQL(slowQuerySQL, '慢查询日志配置');
}

// 执行索引优化
function executeIndexOptimization() {
  colorLog('\n==================== 开始执行索引优化 ====================', 'bright');

  const optimizeSQL = fs.readFileSync(
    path.join(__dirname, 'optimize-indexes.sql'),
    'utf8'
  );

  // 分批执行SQL，避免长时间锁表
  const batches = optimizeSQL
    .split('-- =====================================================')
    .filter(batch => batch.trim())
    .filter(batch => batch.includes('CREATE INDEX'));

  colorLog(`\n发现 ${batches.length} 个索引创建批次`, 'yellow');

  let successCount = 0;
  let totalBatches = batches.length;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].trim();
    if (!batch) continue;

    colorLog(`\n执行批次 ${i + 1}/${totalBatches}...`, 'magenta');

    // 提取CREATE INDEX语句
    const indexStatements = batch
      .split('\n')
      .filter(line => line.trim().startsWith('CREATE INDEX') || line.trim().startsWith('CREATE UNIQUE INDEX'))
      .join('\n');

    if (indexStatements) {
      const success = executeSQL(indexStatements, `批次 ${i + 1}`);
      if (success) successCount++;

      // 短暂延迟，减少数据库压力
      colorLog('等待2秒...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  colorLog(`\n✅ 索引优化完成！成功: ${successCount}/${totalBatches}`, 'green');
  return successCount === totalBatches;
}

// 分析表以更新统计信息
function analyzeTables() {
  if (!config.analyzeAfterOptimization) {
    colorLog('\n跳过表分析', 'yellow');
    return;
  }

  colorLog('\n分析表以更新统计信息...', 'blue');

  const tables = [
    'users', 'pointsTransactions', 'orders', 'products',
    'productCategories', 'inventoryLogs', 'teamMembers',
    'performanceMetrics', 'paymentRecords'
  ];

  for (const table of tables) {
    executeSQL(`ANALYZE TABLE ${table};`, `分析表: ${table}`);
  }
}

// 生成优化报告
function generateReport(success) {
  colorLog('\n==================== 优化报告 ====================', 'bright');

  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    config,
    success,
    recommendations: [
      '1. 定期监控慢查询日志',
      '2. 使用 node test-index-performance.js after 测试性能改进',
      '3. 监控数据库写入性能，确保索引不会严重影响写入速度',
      '4. 定期检查索引使用情况，移除未使用的索引',
      '5. 考虑在业务低峰期执行大型索引创建操作'
    ],
    nextSteps: [
      '执行性能测试: node scripts/test-index-performance.js after',
      '监控应用性能指标',
      '检查查询响应时间改进情况',
      '观察数据库CPU和内存使用情况'
    ]
  };

  const reportFile = 'index-optimization-report.json';
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  colorLog(`\n✅ 优化报告已生成: ${reportFile}`, 'green');

  // 打印摘要
  console.log('\n优化摘要:');
  console.log('- 数据库:', config.dbName);
  console.log('- 优化时间:', timestamp);
  console.log('- 执行状态:', success ? '成功' : '部分成功');
  console.log('\n建议下一步操作:');
  console.log('1. 运行性能测试验证优化效果');
  console.log('2. 监控应用性能表现');
  console.log('3. 定期检查索引使用情况');
}

// 主函数
async function main() {
  colorLog('\n==================== 数据库索引优化工具 ====================', 'bright');
  colorLog('开始时间:', new Date().toLocaleString(), 'blue');

  try {
    // 1. 检查连接
    if (!checkConnection()) {
      colorLog('\n❌ 数据库连接失败，终止执行', 'red');
      process.exit(1);
    }

    // 2. 创建备份
    const backupFile = createBackup();
    if (!backupFile && config.backupBeforeOptimization) {
      colorLog('\n⚠️  备份失败，但继续执行优化', 'yellow');
    }

    // 3. 配置慢查询日志
    enableSlowQueryLog();

    // 4. 执行索引优化
    const success = executeIndexOptimization();

    // 5. 分析表
    analyzeTables();

    // 6. 生成报告
    generateReport(success);

    colorLog('\n==================== 优化完成 ====================', 'bright');
    colorLog('结束时间:', new Date().toLocaleString(), 'blue');

    if (success) {
      colorLog('\n✅ 所有索引创建成功！', 'green');
      colorLog('\n请执行以下命令测试性能改进:', 'yellow');
      colorLog('node scripts/test-index-performance.js after', 'blue');
    } else {
      colorLog('\n⚠️  部分索引创建失败，请检查错误日志', 'yellow');
    }

  } catch (error) {
    colorLog(`\n❌ 优化过程中发生错误: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 显示使用说明
function showUsage() {
  colorLog('\n数据库索引优化工具', 'bright');
  colorLog('\n用法:', 'blue');
  colorLog('  node scripts/execute-index-optimization.js', 'green');
  colorLog('\n环境变量:', 'blue');
  colorLog('  DB_HOST - 数据库主机 (默认: 127.0.0.1)', 'white');
  colorLog('  DB_PORT - 数据库端口 (默认: 3306)', 'white');
  colorLog('  DB_USER - 数据库用户 (默认: dev_user)', 'white');
  colorLog('  DB_PASSWORD - 数据库密码 (默认: dev_password_123)', 'white');
  colorLog('  DB_NAME - 数据库名称 (默认: zhongdao_mall_dev)', 'white');
  colorLog('\n注意事项:', 'yellow');
  colorLog('1. 请确保有足够的数据库权限', 'white');
  colorLog('2. 建议在业务低峰期执行', 'white');
  colorLog('3. 执行前会自动创建备份', 'white');
  colorLog('4. 大表索引创建可能需要较长时间', 'white');
}

// 解析命令行参数
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  showUsage();
  process.exit(0);
}

// 确认执行
colorLog('\n⚠️  即将执行数据库索引优化', 'yellow');
colorLog('这将创建多个索引并可能影响数据库性能', 'yellow');
colorLog('建议在业务低峰期执行\n', 'yellow');

// 如果是生产环境，需要额外确认
if (config.dbName.includes('prod') || config.dbName.includes('production')) {
  colorLog('❌ 检测到生产环境数据库！', 'red');
  colorLog('请谨慎执行，并确保已获得适当授权\n', 'red');

  // 在生产环境中添加额外的确认步骤
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('请输入 "PRODUCTION" 以确认继续: ', (answer) => {
    if (answer === 'PRODUCTION') {
      rl.close();
      main();
    } else {
      colorLog('执行已取消', 'yellow');
      rl.close();
      process.exit(0);
    }
  });
} else {
  main();
}