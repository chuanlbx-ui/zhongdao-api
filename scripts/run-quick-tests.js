/**
 * 快速测试脚本
 * 在开发过程中快速验证核心功能
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 测试配置
const testConfig = {
  healthCheck: {
    name: '健康检查',
    command: 'curl',
    args: ['-s', 'http://localhost:3000/health'],
    expected: 'OK'
  },
  authTest: {
    name: '认证测试',
    command: 'curl',
    args: ['-s', '-H', 'Authorization: Bearer $ADMIN_TOKEN', 'http://localhost:3000/api/v1/auth/me'],
    expected: '"role":"ADMIN"'
  },
  pointsBalance: {
    name: '积分余额',
    command: 'curl',
    args: ['-s', '-H', 'Authorization: Bearer $NORMAL_TOKEN', 'http://localhost:3000/api/v1/points/balance'],
    expected: 'balance'
  },
  productsList: {
    name: '商品列表',
    command: 'curl',
    args: ['-s', 'http://localhost:3000/api/v1/products?page=1&perPage=5'],
    expected: 'products'
  }
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// 执行单个测试
function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n🔍 ${colorize(test.name, 'cyan')}...`);

    const child = spawn(test.command, test.args, {
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      const success = code === 0 && output.includes(test.expected);

      if (success) {
        console.log(`   ${colorize('✅ 通过', 'green')} (${code})`);
      } else {
        console.log(`   ${colorize('❌ 失败', 'red')} (${code})`);
        if (error) {
          console.log(`   ${colorize('错误:', 'yellow')} ${error.trim()}`);
        }
      }

      resolve({
        name: test.name,
        success,
        output: output.trim(),
        error: error.trim()
      });
    });

    // 5秒超时
    setTimeout(() => {
      child.kill();
      console.log(`   ${colorize('⏰ 超时', 'yellow')}`);
      resolve({
        name: test.name,
        success: false,
        error: 'Test timeout'
      });
    }, 5000);
  });
}

// 主函数
async function main() {
  console.log(colorize('🚀 快速测试开始', 'blue'));
  console.log(`⏰ ${new Date().toLocaleString()}\n`);

  const results = [];

  // 检查服务器是否运行
  console.log('📡 检查服务器状态...');
  try {
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      console.log(colorize('   ✅ 服务器正在运行', 'green'));
    } else {
      console.log(colorize('   ❌ 服务器响应异常', 'red'));
      process.exit(1);
    }
  } catch (error) {
    console.log(colorize('   ❌ 服务器未运行，请先启动: npm run dev', 'red'));
    process.exit(1);
  }

  // 运行所有测试
  for (const test of Object.values(testConfig)) {
    const result = await runTest(test);
    results.push(result);
  }

  // 生成报告
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  const failed = total - passed;

  console.log('\n' + '='.repeat(50));
  console.log(colorize('📊 快速测试报告', 'blue'));
  console.log('='.repeat(50));
  console.log(`总测试数: ${total}`);
  console.log(`${colorize('✅ 通过', 'green')}: ${passed}`);
  console.log(`${colorize('❌ 失败', 'red')}: ${failed}`);
  console.log(`通过率: ${Math.round((passed / total) * 100)}%`);
  console.log('='.repeat(50));

  // 保存快速测试报告
  const reportPath = path.join(__dirname, '../quick-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed },
    results
  }, null, 2));
  console.log(`\n📄 报告已保存: ${reportPath}`);

  // 如果有失败的测试，显示失败详情
  if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    results.filter(r => !r.success).forEach(test => {
      console.log(`   - ${test.name}: ${test.error || 'Test failed'}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error(colorize('❌ 测试执行失败:', 'red'), error);
    process.exit(1);
  });
}