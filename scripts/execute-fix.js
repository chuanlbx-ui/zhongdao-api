#!/usr/bin/env node
/**
 * 综合修复执行工具 - PM-AI制定
 * 整合所有修复步骤，一键执行
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🚀 中道商城API后端系统修复 v2.0');
console.log('=====================================\n');

async function executeFix() {
  const steps = [
    {
      name: '1. 批量修复常见问题',
      command: 'node scripts/batch-fix.js',
      critical: true
    },
    {
      name: '2. 生成Prisma客户端',
      command: 'npm run db:generate',
      critical: true
    },
    {
      name: '3. 数据库模式同步',
      command: 'npm run db:push',
      critical: true
    },
    {
      name: '4. TypeScript类型检查',
      command: 'npm run type-check',
      critical: false
    },
    {
      name: '5. 运行测试检查',
      command: 'npm run test:points',
      critical: false
    },
    {
      name: '6. 系统健康检查',
      command: 'node scripts/quick-check.js',
      critical: true
    }
  ];

  let successCount = 0;
  let criticalErrors = 0;

  for (const step of steps) {
    console.log(`\n${step.name}`);
    console.log('-'.repeat(50));

    try {
      console.log('执行中...');
      const output = execSync(step.command, {
        encoding: 'utf8',
        stdio: step.critical ? 'inherit' : 'pipe',
        timeout: 60000
      });

      if (!step.critical && output) {
        // 只显示最后几行输出
        const lines = output.trim().split('\n');
        if (lines.length > 10) {
          console.log(lines.slice(-10).join('\n'));
        } else {
          console.log(output);
        }
      }

      console.log('✅ 完成');
      successCount++;

    } catch (error) {
      console.log(`❌ 失败: ${error.message}`);
      if (step.critical) {
        criticalErrors++;
        console.error('\n⚠️  关键步骤失败，停止执行');
        break;
      } else {
        console.log('  (非关键步骤，继续执行)');
      }
    }
  }

  // 生成最终报告
  console.log('\n' + '='.repeat(50));
  console.log('📊 修复执行报告');
  console.log('='.repeat(50));
  console.log(`✅ 成功步骤: ${successCount}/${steps.length}`);
  console.log(`❌ 关键错误: ${criticalErrors}`);

  if (criticalErrors === 0) {
    console.log('\n🎉 修复完成！');
    console.log('\n下一步操作：');
    console.log('1. 启动开发服务器: npm run dev');
    console.log('2. 访问API文档: http://localhost:3000/api-docs');
    console.log('3. 运行完整测试: npm test');

    // 检查是否有积分API测试文件
    if (fs.existsSync('tests/api/points.test.ts')) {
      console.log('\n测试积分API：');
      console.log('curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/points/balance');
    }
  } else {
    console.log('\n⚠️  存在关键错误，请：');
    console.log('1. 查看上述错误信息');
    console.log('2. 手动执行失败的步骤');
    console.log('3. 检查日志文件');
  }
}

// 执行修复
executeFix().catch(console.error);