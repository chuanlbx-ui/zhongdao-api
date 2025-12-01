/**
 * 环境变量初始化模块
 * 必须在应用启动时最先执行，在任何其他import之前
 * 用于加载.env文件
 */

import dotenv from 'dotenv';
import path from 'path';

// 在应用启动最早阶段加载环境变量
// 使用绝对路径避免相对路径问题
const envFile = path.resolve(__dirname, `../.env.${process.env.NODE_ENV || 'development'}`);
const result = dotenv.config({ path: envFile });

if (process.env.NODE_ENV === 'development') {
  if (result.error) {
    console.warn('[WARN] 无法加载.env文件:', envFile);
  } else {
    console.log('[INFO] 环境变量已加载:', envFile);
    console.log('[DEBUG] JWT_SECRET present:', !!process.env.JWT_SECRET);
  }
}

export {};
