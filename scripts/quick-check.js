#!/usr/bin/env node
/**
 * 快速系统检查工具 - PM-AI制定
 * 5分钟内完成系统状态评估
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const logger = {
  info: (msg) => console.log(`\n[INFO] ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  step: (step, total, msg) => console.log(`\n[STEP ${step}/${total}] ${msg}`)
};

class QuickChecker {
  constructor() {
    this.checks = {
      passed: 0,
      failed: 0,
      warnings: 0
    };
    this.startTime = Date.now();
  }

  async run() {
    logger.info('🚀 启动快速系统检查...');
    logger.info('目标：5分钟内评估系统状态');

    try {
      // 检查1：基础文件和目录
      await this.checkBasicStructure();

      // 检查2：配置文件
      await this.checkConfigurations();

      // 检查3：依赖项
      await this.checkDependencies();

      // 检查4：数据库连接
      await this.checkDatabase();

      // 检查5：模块加载
      await this.checkModuleLoading();

      // 检查6：API健康状态
      await this.checkAPIHealth();

      // 生成检查报告
      this.generateReport();

    } catch (error) {
      logger.error(`系统检查失败: ${error.message}`);
      process.exit(1);
    }
  }

  async checkBasicStructure() {
    logger.step(1, 6, '检查基础文件和目录');

    const requiredPaths = [
      'package.json',
      'tsconfig.json',
      'prisma/schema.prisma',
      'src/index.ts',
      'src/shared/database/client.ts',
      'tests/setup.ts'
    ];

    for (const filePath of requiredPaths) {
      if (fs.existsSync(filePath)) {
        this.checks.passed++;
        logger.success(`✓ ${filePath}`);
      } else {
        this.checks.failed++;
        logger.error(`✗ 缺少: ${filePath}`);
      }
    }
  }

  async checkConfigurations() {
    logger.step(2, 6, '检查配置文件');

    // 检查环境变量
    const envFiles = ['.env.development', '.env.production'];
    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        this.checks.passed++;
        logger.success(`✓ ${envFile}`);
      } else {
        this.checks.warnings++;
        logger.warning(`⚠ 缺少: ${envFile}`);
      }
    }

    // 检查Prisma配置
    try {
      const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
      if (schema.includes('provider = "mysql"')) {
        this.checks.passed++;
        logger.success('✓ Prisma数据库配置正确');
      }
    } catch (error) {
      this.checks.failed++;
      logger.error('✗ Prisma配置错误');
    }
  }

  async checkDependencies() {
    logger.step(3, 6, '检查依赖项');

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const criticalDeps = ['express', '@prisma/client', 'jsonwebtoken'];

      for (const dep of criticalDeps) {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          this.checks.passed++;
          logger.success(`✓ ${dep}@${packageJson.dependencies[dep]}`);
        } else {
          this.checks.failed++;
          logger.error(`✗ 缺少依赖: ${dep}`);
        }
      }

      // 检查node_modules
      if (fs.existsSync('node_modules')) {
        this.checks.passed++;
        logger.success('✓ node_modules已安装');
      } else {
        this.checks.failed++;
        logger.error('✗ node_modules未安装');
      }

    } catch (error) {
      this.checks.failed++;
      logger.error('✗ package.json格式错误');
    }
  }

  async checkDatabase() {
    logger.step(4, 6, '检查数据库连接');

    try {
      // 尝试导入Prisma客户端
      const { prisma } = require('../src/shared/database/client');

      // 简单的连接测试
      await prisma.$connect();
      this.checks.passed++;
      logger.success('✓ 数据库连接成功');

      await prisma.$disconnect();
    } catch (error) {
      this.checks.failed++;
      logger.error(`✗ 数据库连接失败: ${error.message}`);
    }
  }

  async checkModuleLoading() {
    logger.step(5, 6, '检查模块加载');

    const criticalModules = [
      'src/shared/middleware/auth.ts',
      'src/shared/utils/logger.ts',
      'src/modules/user/user.service.ts',
      'src/routes/v1/index.ts'
    ];

    for (const modulePath of criticalModules) {
      try {
        // 简单的语法检查
        const content = fs.readFileSync(modulePath, 'utf8');

        // 检查是否有基本的导入/导出
        if (content.includes('import') || content.includes('export')) {
          this.checks.passed++;
          logger.success(`✓ ${path.relative(process.cwd(), modulePath)}`);
        } else {
          this.checks.warnings++;
          logger.warning(`⚠ 模块可能有问题: ${modulePath}`);
        }
      } catch (error) {
        this.checks.failed++;
        logger.error(`✗ 无法读取模块: ${modulePath}`);
      }
    }
  }

  async checkAPIHealth() {
    logger.step(6, 6, '检查API健康状态');

    // 检查服务器是否在运行
    const checkServer = () => {
      return new Promise((resolve) => {
        const req = http.request({
          hostname: 'localhost',
          port: 3000,
          path: '/health',
          method: 'GET',
          timeout: 2000
        }, (res) => {
          resolve(res.statusCode === 200);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.end();
      });
    };

    const serverRunning = await checkServer();
    if (serverRunning) {
      this.checks.passed++;
      logger.success('✓ API服务器正在运行');
    } else {
      this.checks.warnings++;
      logger.warning('⚠ API服务器未运行');
    }
  }

  generateReport() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log('📊 系统检查报告');
    console.log('='.repeat(50));
    console.log(`⏱️  检查时间: ${duration}秒`);
    console.log(`✅ 通过检查: ${this.checks.passed}项`);
    console.log(`❌ 失败项目: ${this.checks.failed}项`);
    console.log(`⚠️  警告项目: ${this.checks.warnings}项`);

    const total = this.checks.passed + this.checks.failed + this.checks.warnings;
    const score = ((this.checks.passed / total) * 100).toFixed(1);

    console.log(`\n📈 系统健康度: ${score}%`);

    if (this.checks.failed === 0) {
      console.log('\n🎉 系统状态良好！');
      console.log('\n建议下一步：');
      console.log('1. 运行 npm test 执行完整测试');
      console.log('2. 运行 npm run dev 启动开发服务器');
    } else {
      console.log('\n⚠️  发现问题，建议：');
      console.log('1. 运行 npm run fix:batch 进行批量修复');
      console.log('2. 检查上述失败项');
    }
  }
}

// 运行检查
if (require.main === module) {
  const checker = new QuickChecker();
  checker.run();
}

module.exports = QuickChecker;