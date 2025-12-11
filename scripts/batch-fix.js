#!/usr/bin/env node
/**
 * 批量修复工具 - PM-AI制定
 * 用于快速修复常见问题
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logger = {
  info: (msg) => console.log(`\n[INFO] ${msg}`),
  success: (msg) => console.log(`\n✅ ${msg}`),
  error: (msg) => console.log(`\n❌ ${msg}`),
  warning: (msg) => console.log(`\n⚠️  ${msg}`),
  step: (step, total, msg) => console.log(`\n[STEP ${step}/${total}] ${msg}`)
};

class BatchFixer {
  constructor() {
    this.fixesApplied = 0;
    this.errors = 0;
    this.startTime = Date.now();
  }

  async run() {
    logger.info('🚀 启动批量修复工具...');
    logger.info('目标：快速修复系统常见问题');

    try {
      // 步骤1：修复JWT认证问题
      await this.fixJWTAuth();

      // 步骤2：修复数据库字段命名
      await this.fixDatabaseFields();

      // 步骤3：修复导入路径
      await this.fixImportPaths();

      // 步骤4：修复基础依赖
      await this.fixDependencies();

      // 生成修复报告
      this.generateReport();

    } catch (error) {
      logger.error(`批量修复失败: ${error.message}`);
      process.exit(1);
    }
  }

  async fixJWTAuth() {
    logger.step(1, 4, '修复JWT认证问题');

    // 查找所有测试文件
    const testFiles = this.findFiles('tests', '.test.ts');

    for (const file of testFiles) {
      try {
        let content = fs.readFileSync(file, 'utf8');
        const original = content;

        // 修复token生成
        content = content.replace(
          /getAuthHeaders\('admin'\)/g,
          `getAuthHeadersForUser('admin')`
        );
        content = content.replace(
          /getAuthHeaders\('user'\)/g,
          `getAuthHeadersForUser('normal')`
        );

        // 如果有修改，写回文件
        if (content !== original) {
          fs.writeFileSync(file, content);
          this.fixesApplied++;
          logger.success(`修复 ${path.relative(process.cwd(), file)}`);
        }
      } catch (error) {
        logger.error(`处理 ${file} 失败: ${error.message}`);
        this.errors++;
      }
    }
  }

  async fixDatabaseFields() {
    logger.step(2, 4, '修复数据库字段命名');

    // 字段映射表：下划线 -> 驼峰
    const fieldMapping = {
      'created_at': 'createdAt',
      'updated_at': 'updatedAt',
      'deleted_at': 'deletedAt',
      'user_id': 'userId',
      'shop_id': 'shopId',
      'product_id': 'productId',
      'order_id': 'orderId',
      'points_id': 'pointsId',
      'team_id': 'teamId',
      'parent_id': 'parentId',
      'is_active': 'isActive',
      'is_deleted': 'isDeleted'
    };

    // 查找需要修复的文件
    const files = [
      ...this.findFiles('src/shared/services', '.ts'),
      ...this.findFiles('src/modules', '.ts'),
      'src/shared/database/client.ts',
      'src/shared/services/systemConfigService.ts'
    ];

    for (const file of files) {
      try {
        let content = fs.readFileSync(file, 'utf8');
        const original = content;

        // 应用字段映射
        for (const [oldName, newName] of Object.entries(fieldMapping)) {
          // 使用正则确保只匹配完整的字段名
          const regex = new RegExp(`\\b${oldName}\\b`, 'g');
          content = content.replace(regex, newName);
        }

        // 如果有修改，写回文件
        if (content !== original) {
          fs.writeFileSync(file, content);
          this.fixesApplied++;
          logger.success(`修复字段 ${path.relative(process.cwd(), file)}`);
        }
      } catch (error) {
        logger.error(`处理 ${file} 失败: ${error.message}`);
        this.errors++;
      }
    }
  }

  async fixImportPaths() {
    logger.step(3, 4, '修复导入路径');

    const files = this.findFiles('src', '.ts');

    for (const file of files) {
      try {
        let content = fs.readFileSync(file, 'utf8');
        const original = content;

        // 修复相对路径
        content = content.replace(
          /from '\.\.\/\.\.\/shared/g,
          "from '@/shared"
        );
        content = content.replace(
          /from '\.\.\/shared/g,
          "from '@/shared"
        );

        // 如果有修改，写回文件
        if (content !== original) {
          fs.writeFileSync(file, content);
          this.fixesApplied++;
          logger.success(`修复路径 ${path.relative(process.cwd(), file)}`);
        }
      } catch (error) {
        logger.error(`处理 ${file} 失败: ${error.message}`);
        this.errors++;
      }
    }
  }

  async fixDependencies() {
    logger.step(4, 4, '修复基础依赖');

    const packageJsonPath = 'package.json';
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // 确保必要的依赖存在
    const requiredDeps = {
      'express': '^4.21.2',
      '@prisma/client': '^6.1.0',
      'prisma': '^6.1.0',
      'jsonwebtoken': '^9.0.2',
      'bcryptjs': '^2.4.3',
      'cors': '^2.8.5',
      'helmet': '^8.0.0',
      'dotenv': '^16.4.7'
    };

    let updated = false;
    for (const [dep, version] of Object.entries(requiredDeps)) {
      if (!packageJson.dependencies[dep]) {
        packageJson.dependencies[dep] = version;
        updated = true;
        logger.info(`添加依赖: ${dep}@${version}`);
      }
    }

    if (updated) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      this.fixesApplied++;
      logger.success('更新 package.json');

      // 安装依赖
      logger.info('安装依赖...');
      execSync('npm install', { stdio: 'inherit' });
    }
  }

  findFiles(dir, extension) {
    const results = [];

    if (!fs.existsSync(dir)) {
      return results;
    }

    const scan = (currentDir) => {
      const files = fs.readdirSync(currentDir);

      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          scan(filePath);
        } else if (file.endsWith(extension)) {
          results.push(filePath);
        }
      }
    };

    scan(dir);
    return results;
  }

  generateReport() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log('📊 批量修复报告');
    console.log('='.repeat(50));
    console.log(`⏱️  执行时间: ${duration}秒`);
    console.log(`✅ 修复成功: ${this.fixesApplied}项`);
    console.log(`❌ 错误数量: ${this.errors}项`);

    if (this.errors === 0) {
      console.log('\n🎉 批量修复完成！');
      console.log('\n下一步：');
      console.log('1. 运行 npm run dev 启动开发服务器');
      console.log('2. 运行 npm run check:quick 进行快速检查');
    } else {
      console.log('\n⚠️  存在错误，请检查日志');
    }
  }
}

// 运行批量修复
if (require.main === module) {
  const fixer = new BatchFixer();
  fixer.run();
}

module.exports = BatchFixer;