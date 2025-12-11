#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 获取当前时间
function getTime() {
  return new Date().toLocaleTimeString('zh-CN');
}

// 带颜色的日志输出
function log(message, color = 'reset') {
  console.log(`${colors[color]}[${getTime()}] ${message}${colors.reset}`);
}

// 检查必要文件
function checkRequiredFiles() {
  const requiredFiles = [
    '.env.development',
    'prisma/schema.prisma'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      log(`❌ 缺少必要文件: ${file}`, 'red');
      return false;
    }
  }

  log('✅ 所有必要文件检查通过', 'green');
  return true;
}

// 清理构建缓存
function cleanBuildCache() {
  const cacheDir = path.join(process.cwd(), 'dist');
  const tsbuildInfo = path.join(cacheDir, '.tsbuildinfo');

  if (fs.existsSync(tsbuildInfo)) {
    try {
      fs.unlinkSync(tsbuildInfo);
      log('🗑️  已清理增量编译缓存', 'yellow');
    } catch (error) {
      log(`⚠️  清理缓存失败: ${error.message}`, 'yellow');
    }
  }
}

// 启动开发服务器
function startDevServer() {
  log('🚀 启动开发服务器...', 'bright');

  // 设置环境变量
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    FORCE_COLOR: '1' // 启用彩色输出
  };

  // 启动 tsx 监听模式
  const child = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
    env,
    stdio: 'inherit',
    shell: true
  });

  // 处理进程退出
  child.on('exit', (code) => {
    if (code !== 0) {
      log(`❌ 开发服务器异常退出，退出码: ${code}`, 'red');
      process.exit(code);
    }
  });

  // 处理中断信号
  process.on('SIGINT', () => {
    log('\n🛑 收到中断信号，正在关闭开发服务器...', 'yellow');
    child.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    log('\n🛑 收到终止信号，正在关闭开发服务器...', 'yellow');
    child.kill('SIGTERM');
  });

  return child;
}

// 主函数
async function main() {
  log('📦 中道商城开发环境启动器', 'bright');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  // 检查必要文件
  if (!checkRequiredFiles()) {
    process.exit(1);
  }

  // 清理构建缓存（可选）
  if (process.argv.includes('--clean')) {
    cleanBuildCache();
  }

  // 启动开发服务器
  const server = startDevServer();

  // 启动时的提示
  setTimeout(() => {
    log('\n✨ 开发服务器已启动！', 'green');
    log('📍 API 服务: http://localhost:3000', 'blue');
    log('📚 API 文档: http://localhost:3000/api-docs', 'blue');
    log('💾 数据库管理: npm run db:studio', 'blue');
    log('\n⚡ 热重载已启用，修改代码将自动重启服务', 'yellow');
    log('🛑 按 Ctrl+C 停止服务器', 'cyan');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  }, 2000);
}

// 错误处理
process.on('uncaughtException', (error) => {
  log(`❌ 未捕获的异常: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ 未处理的 Promise 拒绝: ${reason}`, 'red');
  process.exit(1);
});

// 启动
main();