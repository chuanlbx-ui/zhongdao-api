const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 API测试系统综合修复工具\n');

async function runCommand(command, description) {
  console.log(`\n🔄 ${description}`);
  console.log('   命令:', command);

  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60000
    });
    console.log('   ✅ 成功');
    return { success: true, output };
  } catch (error) {
    console.log('   ❌ 失败');
    console.log('   错误:', error.message);
    if (error.stdout) {
      console.log('   输出:', error.stdout.substring(0, 500));
    }
    return { success: false, error: error.message };
  }
}

async function main() {
  const fixes = [
    {
      command: 'npm run build',
      description: '1. 编译TypeScript代码',
      critical: true
    },
    {
      command: 'npm run db:generate',
      description: '2. 生成Prisma客户端',
      critical: true
    },
    {
      command: 'node test-auth-direct.js',
      description: '3. 测试认证系统',
      critical: false
    },
    {
      command: 'npm test tests/api/payments.test.ts',
      description: '4. 测试支付模块（已知通过的模块）',
      critical: false
    },
    {
      command: 'npm test tests/api/teams.test.ts',
      description: '5. 测试团队模块（已修复的认证问题）',
      critical: false
    }
  ];

  console.log('修复计划:');
  console.log('-'.repeat(60));
  fixes.forEach((fix, index) => {
    console.log(`${index + 1}. ${fix.description}`);
    if (fix.critical) {
      console.log('   ⚠️  这是关键修复步骤');
    }
  });

  console.log('\n开始执行修复...\n');

  let successCount = 0;
  for (const fix of fixes) {
    const result = await runCommand(fix.command, fix.description);
    if (result.success) {
      successCount++;
    }

    if (fix.critical && !result.success) {
      console.log('\n❌ 关键修复失败，停止后续修复');
      break;
    }

    // 短暂延迟，避免资源冲突
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`修复完成: ${successCount}/${fixes.length} 成功`);

  if (successCount === fixes.length) {
    console.log('\n✅ 所有修复成功！');
    console.log('\n建议下一步:');
    console.log('1. 运行 npm run dev 启动开发服务器');
    console.log('2. 使用 Postman 或 curl 测试API');
    console.log('3. 运行 npm test 进行完整测试');
  } else {
    console.log('\n⚠️ 部分修复失败');
    console.log('请查看上述错误信息并手动修复');
  }

  // 生成修复报告
  const report = {
    timestamp: new Date().toISOString(),
    fixes: fixes.map((fix, index) => ({
      ...fix,
      success: index < successCount
    })),
    summary: {
      total: fixes.length,
      success: successCount,
      failed: fixes.length - successCount
    }
  };

  fs.writeFileSync(
    path.join(__dirname, 'fix-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('\n📝 修复报告已保存到 fix-report.json');
}

// 运行修复
main().catch(error => {
  console.error('\n❌ 修复过程出错:', error);
  process.exit(1);
});