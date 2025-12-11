#!/usr/bin/env node

/**
 * 文档监视脚本
 * 监视源代码和文档变化，自动更新文档
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chokidar = require('chokidar');

const CONFIG = {
  sourceDir: path.resolve(__dirname, '../src'),
  docsDir: path.resolve(__dirname, '../docs'),
  portalDir: path.resolve(__dirname, '../docs-portal'),
  debounceDelay: 1000, // 防抖延迟
};

class DocsWatcher {
  constructor() {
    this.watching = false;
    this.updateTimeout = null;
    this.docsSyncer = require('./docs-sync');
  }

  start() {
    if (this.watching) {
      console.log('👀 文档监视已在运行中...');
      return;
    }

    console.log('🚀 启动文档监视服务...\n');

    // 监视源代码变化
    this.watchSourceCode();

    // 监视文档变化
    this.watchDocs();

    this.watching = true;
    console.log('✅ 文档监视已启动');
    console.log('📁 监视目录:');
    console.log(`  - 源代码: ${CONFIG.sourceDir}`);
    console.log(`  - 文档: ${CONFIG.docsDir}`);
    console.log('\n按 Ctrl+C 停止监视');

    process.on('SIGINT', () => {
      this.stop();
    });
  }

  watchSourceCode() {
    // 监视路由文件变化
    const routeWatcher = chokidar.watch([
      path.join(CONFIG.sourceDir, 'routes/**/*.ts'),
      path.join(CONFIG.sourceDir, 'modules/**/*.ts'),
    ], {
      ignored: /node_modules/,
      persistent: true,
    });

    routeWatcher.on('change', (filepath) => {
      console.log(`\n📝 源代码变化: ${path.relative(CONFIG.sourceDir, filepath)}`);
      this.scheduleUpdate();
    });

    // 监视Swagger配置
    const swaggerWatcher = chokidar.watch(
      path.join(CONFIG.sourceDir, 'config/swagger.ts')
    );

    swaggerWatcher.on('change', () => {
      console.log('\n📝 Swagger配置更新');
      this.scheduleUpdate();
    });
  }

  watchDocs() {
    const docsWatcher = chokidar.watch([
      path.join(CONFIG.docsDir, '**/*.md'),
      path.join(CONFIG.docsDir, '**/*.js'),
      path.join(CONFIG.docsDir, '**/*.ts'),
    ], {
      ignored: /node_modules/,
      persistent: true,
    });

    docsWatcher.on('change', (filepath) => {
      console.log(`\n📚 文档更新: ${path.relative(CONFIG.docsDir, filepath)}`);
      this.scheduleDocsUpdate();
    });

    docsWatcher.on('add', (filepath) => {
      console.log(`\n📚 新增文档: ${path.relative(CONFIG.docsDir, filepath)}`);
      this.scheduleDocsUpdate();
    });
  }

  scheduleUpdate() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(async () => {
      console.log('\n🔄 更新API文档...');
      try {
        await this.updateApiDocs();
        console.log('✅ API文档已更新');
      } catch (error) {
        console.error('❌ 更新失败:', error.message);
      }
    }, CONFIG.debounceDelay);
  }

  scheduleDocsUpdate() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(async () => {
      console.log('\n🔄 同步文档...');
      try {
        await this.syncAllDocs();
        console.log('✅ 文档已同步');
      } catch (error) {
        console.error('❌ 同步失败:', error.message);
      }
    }, CONFIG.debounceDelay);
  }

  async updateApiDocs() {
    // 只更新API文档，不构建完整文档门户
    const syncer = new this.docsSyncer();
    await syncer.extractApiDocs();
  }

  async syncAllDocs() {
    const syncer = new this.docsSyncer();
    await syncer.run();
  }

  stop() {
    console.log('\n\n🛑 停止文档监视...');
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.watching = false;
    process.exit(0);
  }
}

// 命令行接口
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'start':
      const watcher = new DocsWatcher();
      watcher.start();
      break;

    case 'update':
      console.log('🔄 手动更新文档...');
      const syncer = require('./docs-sync');
      const s = new syncer();
      s.run();
      break;

    default:
      console.log(`
用法:
  node docs-watch.js start     # 启动监视服务
  node docs-watch.js update    # 手动更新文档
      `);
  }
}

module.exports = DocsWatcher;