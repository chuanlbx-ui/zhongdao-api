/**
 * 部署准备状态检查脚本
 * 验证系统是否准备好进行远程部署
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function check(title, condition, details = '') {
  if (condition) {
    log(`✅ ${title}`, 'green');
    if (details) log(`   ${details}`, 'cyan');
    return true;
  } else {
    log(`❌ ${title}`, 'red');
    if (details) log(`   ${details}`, 'yellow');
    return false;
  }
}

function checkWarning(title, condition, details = '') {
  if (condition) {
    log(`⚠️  ${title}`, 'yellow');
    if (details) log(`   ${details}`, 'yellow');
    return false;
  } else {
    log(`✅ ${title}`, 'green');
    if (details) log(`   ${details}`, 'cyan');
    return true;
  }
}

function runCheck() {
  log('\n🚀 中道商城系统部署准备状态检查', 'blue');
  log('='.repeat(50), 'blue');

  let results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // 1. 项目结构检查
  log('\n📁 项目结构检查:', 'blue');

  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'prisma/schema.prisma',
    'src/index.ts',
    '.env.example',
    'README.md'
  ];

  requiredFiles.forEach(file => {
    if (check(`${file} 存在`, fs.existsSync(file))) {
      results.passed++;
    } else {
      results.failed++;
    }
  });

  // 2. 依赖检查
  log('\n📦 依赖检查:', 'blue');

  if (check('package.json 存在', fs.existsSync('package.json'))) {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      check('项目名称已定义', packageJson.name, packageJson.name);
      check('版本号已定义', packageJson.version, packageJson.version);
      check('启动脚本已定义', packageJson.scripts?.start, 'npm run start');
      check('构建脚本已定义', packageJson.scripts?.build, 'npm run build');
      check('数据库脚本已定义', packageJson.scripts?.['db:generate'], 'npm run db:generate');

      results.passed += 5;
    } catch (error) {
      log('❌ package.json 格式错误', 'red');
      results.failed++;
    }
  }

  // 3. 环境配置检查
  log('\n⚙️  环境配置检查:', 'blue');

  if (check('.env.example 文件存在', fs.existsSync('.env.example'))) {
    try {
      const envExample = fs.readFileSync('.env.example', 'utf8');

      const requiredEnvVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'PORT'
      ];

      const wechatVars = [
        'WECHAT_APP_ID',
        'WECHAT_APP_SECRET'
      ];

      requiredEnvVars.forEach(envVar => {
        if (check(`${envVar} 在模板中定义`, envExample.includes(envVar))) {
          results.passed++;
        } else {
          results.failed++;
        }
      });

      wechatVars.forEach(envVar => {
        if (checkWarning(`${envVar} 在模板中定义`, !envExample.includes(envVar), '微信配置需要手动添加')) {
          results.passed++;
        } else {
          results.warnings++;
        }
      });

    } catch (error) {
      log('❌ .env.example 读取失败', 'red');
      results.failed++;
    }
  }

  checkWarning('.env 生产文件不存在', !fs.existsSync('.env'), '需要在生产环境创建');

  // 4. 数据库配置检查
  log('\n🗄️ 数据库配置检查:', 'blue');

  if (check('Prisma schema 存在', fs.existsSync('prisma/schema.prisma'))) {
    try {
      const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

      check('User 模型已定义', schema.includes('model User'));
      check('Product 模型已定义', schema.includes('model Product'));
      check('Order 模型已定义', schema.includes('model Order'));
      check('PointsTransaction 模型已定义', schema.includes('model PointsTransaction'));
      check('referralCode 字段已定义', schema.includes('referralCode'));

      results.passed += 5;
    } catch (error) {
      log('❌ Prisma schema 读取失败', 'red');
      results.failed++;
    }
  }

  // 5. 源代码检查
  log('\n💻 源代码检查:', 'blue');

  const sourceFiles = [
    'src/index.ts',
    'src/app.ts',
    'src/shared/database.ts',
    'src/routes/v1/index.ts'
  ];

  sourceFiles.forEach(file => {
    if (check(`${file} 存在`, fs.existsSync(file))) {
      results.passed++;
    } else {
      results.failed++;
    }
  });

  // 6. TypeScript配置检查
  log('\n🔧 TypeScript配置检查:', 'blue');

  if (check('tsconfig.json 存在', fs.existsSync('tsconfig.json'))) {
    try {
      const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));

      check('编译目标已设置', tsconfig.compilerOptions?.target);
      check('模块系统已设置', tsconfig.compilerOptions?.module);
      check('严格模式已启用', tsconfig.compilerOptions?.strict === true);
      check('输出目录已设置', tsconfig.compilerOptions?.outDir);

      results.passed += 4;
    } catch (error) {
      log('❌ tsconfig.json 格式错误', 'red');
      results.failed++;
    }
  }

  // 7. 错误处理机制检查
  log('\n🛡️ 错误处理机制检查:', 'blue');

  const errorHandlingFiles = [
    'src/shared/utils/errorHandler.ts',
    'src/middleware/errorHandler.ts'
  ];

  errorHandlingFiles.forEach(file => {
    if (check(`${file} 存在`, fs.existsSync(file))) {
      results.passed++;
    } else {
      results.failed++;
    }
  });

  // 8. API文档检查
  log('\n📚 API文档检查:', 'blue');

  const docFiles = [
    'docs/deployment-guide.md',
    'docs/error-handling-guide.md',
    'docs/data-validation-summary.md'
  ];

  docFiles.forEach(file => {
    if (check(`${file} 存在`, fs.existsSync(file))) {
      results.passed++;
    } else {
      results.warnings++;
    }
  });

  // 9. 测试文件检查
  log('\n🧪 测试文件检查:', 'blue');

  const testFiles = [
    'test-data-validation.js',
    'test-data-validation-readonly.js',
    'test-error-handling.js'
  ];

  testFiles.forEach(file => {
    if (check(`${file} 存在`, fs.existsSync(file))) {
      results.passed++;
    } else {
      results.warnings++;
    }
  });

  // 10. 前端项目检查
  log('\n🎨 前端项目检查:', 'blue');

  const h5ApiFiles = [
    '../zhongdao-H5/src/api/enhanced-api.ts',
    '../zhongdao-H5/src/api/enhanced-client.ts',
    '../zhongdao-H5/src/hooks/useApiError.ts'
  ];

  const adminApiFiles = [
    '../zhongdao-admin/src/api/enhanced-api.ts',
    '../zhongdao-admin/src/api/enhanced-client.ts'
  ];

  h5ApiFiles.forEach(file => {
    if (check(`H5 ${path.basename(file)} 存在`, fs.existsSync(file))) {
      results.passed++;
    } else {
      results.warnings++;
    }
  });

  adminApiFiles.forEach(file => {
    if (check(`Admin ${path.basename(file)} 存在`, fs.existsSync(file))) {
      results.passed++;
    } else {
      results.warnings++;
    }
  });

  // 11. 脚本文件检查
  log('\n📜 脚本文件检查:', 'blue');

  const scriptFiles = [
    'scripts/deployment-readiness-check.js',
    'scripts'
  ];

  if (check('脚本目录存在', fs.existsSync('scripts'))) {
    results.passed++;
  } else {
    results.failed++;
  }

  // 12. Git仓库检查
  log('\n📦 Git仓库检查:', 'blue');

  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim() === '') {
      check('Git工作区干净', true, '所有更改已提交');
      results.passed++;
    } else {
      checkWarning('Git工作区有未提交更改', true, gitStatus.split('\n').filter(line => line.trim()).length + ' 个文件未提交');
      results.warnings++;
    }
  } catch (error) {
    checkWarning('Git仓库未初始化', true, '建议初始化Git仓库');
    results.warnings++;
  }

  // 13. Node.js版本检查
  log('\n🔢 Node.js版本检查:', 'blue');

  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (check(`Node.js版本: ${nodeVersion}`, majorVersion >= 16, '推荐使用Node.js 16+')) {
      results.passed++;
    } else {
      results.failed++;
    }
  } catch (error) {
    log('❌ Node.js未安装', 'red');
    results.failed++;
  }

  // 14. npm版本检查
  log('\n📦 npm版本检查:', 'blue');

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    check(`npm版本: ${npmVersion}`, true);
    results.passed++;
  } catch (error) {
    log('❌ npm未安装', 'red');
    results.failed++;
  }

  // 结果汇总
  log('\n' + '='.repeat(50), 'blue');
  log('📊 检查结果汇总:', 'blue');
  log(`✅ 通过: ${results.passed} 项`, 'green');
  log(`❌ 失败: ${results.failed} 项`, 'red');
  log(`⚠️  警告: ${results.warnings} 项`, 'yellow');

  const totalChecks = results.passed + results.failed + results.warnings;
  const successRate = totalChecks > 0 ? ((results.passed / totalChecks) * 100).toFixed(1) : 0;

  log(`📈 成功率: ${successRate}%`, 'blue');

  // 部署建议
  log('\n🎯 部署准备状态评估:', 'blue');

  if (results.failed === 0 && results.warnings <= 3) {
    log('🟢 系统已准备好进行生产环境部署', 'green');
    log('\n📋 下一步操作:', 'blue');
    log('1. 准备生产服务器环境', 'cyan');
    log('2. 配置数据库和Redis', 'cyan');
    log('3. 创建生产环境.env文件', 'cyan');
    log('4. 按照部署指南进行部署', 'cyan');
    log('5. 配置SSL证书和域名', 'cyan');
  } else if (results.failed <= 2 && results.warnings <= 5) {
    log('🟡 系统基本准备就绪，建议解决警告后部署', 'yellow');
    log('\n⚠️  建议先解决以下问题:', 'yellow');
    if (results.failed > 0) {
      log('- 修复失败的检查项', 'yellow');
    }
    if (results.warnings > 0) {
      log('- 查看警告信息并完善配置', 'yellow');
    }
  } else {
    log('🔴 系统需要完善后才能部署', 'red');
    log('\n❌ 必须解决以下问题:', 'red');
    log('- 修复所有失败的检查项', 'red');
    log('- 完善缺失的文件和配置', 'red');
    log('- 确保所有核心功能正常', 'red');
  }

  // 重要提醒
  log('\n⚠️  重要提醒:', 'yellow');
  log('1. 生产环境必须配置真实的微信支付参数', 'yellow');
  log('2. 确保数据库密码足够安全', 'yellow');
  log('3. 配置SSL证书和HTTPS', 'yellow');
  log('4. 设置防火墙和安全策略', 'yellow');
  log('5. 配置日志监控和备份策略', 'yellow');

  log('\n📚 相关文档:', 'blue');
  log('- 部署指南: docs/deployment-guide.md', 'cyan');
  log('- 错误处理指南: docs/error-handling-guide.md', 'cyan');
  log('- 数据验证报告: docs/data-validation-summary.md', 'cyan');

  return results.failed === 0;
}

// 运行检查
if (require.main === module) {
  const isReady = runCheck();
  process.exit(isReady ? 0 : 1);
}

module.exports = { runCheck };