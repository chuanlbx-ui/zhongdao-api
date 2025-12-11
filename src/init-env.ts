/**
 * 环境变量初始化模块
 * 必须在应用启动时最先执行，在任何其他import之前
 * 用于加载.env文件
 */

import dotenv from 'dotenv';
import path from 'path';

// 在应用启动最早阶段加载环境变量
// 优先加载 .env.local（如果存在），否则根据 NODE_ENV 加载对应文件
const localEnvFile = path.resolve(__dirname, '../.env.local');
let envFile: string;
let result: dotenv.DotenvConfigOutput;

// 首先检查是否存在 .env.local
if (require('fs').existsSync(localEnvFile)) {
  envFile = localEnvFile;
  result = dotenv.config({ path: envFile });
  // 在开发模式下显示简化的加载信息
  if (process.env.NODE_ENV === 'development') {
// [DEBUG REMOVED]     console.log(`✓ 环境配置已加载: ${path.basename(envFile)}`);
  }
} else {
  // 如果没有 .env.local，则根据 NODE_ENV 加载对应文件
  envFile = path.resolve(__dirname, `../.env.${process.env.NODE_ENV || 'development'}`);
  result = dotenv.config({ path: envFile });
  if (result.error) {
    console.warn(`⚠️ 无法加载环境配置文件`);
  } else if (process.env.NODE_ENV === 'development') {
// [DEBUG REMOVED]     console.log(`✓ 环境配置已加载: ${path.basename(envFile)}`);
  }
}

// 错误处理（对于 NODE_ENV=development 的情况）
if (result.error && process.env.NODE_ENV === 'development') {
  console.warn('[WARN] 无法加载.env文件:', envFile);
}

export {};
