#!/usr/bin/env ts-node
/**
 * 批量生成用户编号脚本
 * 用于为已有用户按注册时间顺序生成7位数用户编号
 */

import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env.development') });

import { UserNumberService } from '../src/modules/user/user-number.service';
import { logger } from '../src/shared/utils/logger';

async function main() {
  try {
    logger.info('🚀 开始执行批量生成用户编号脚本...');
    
    const userNumberService = new UserNumberService();
    await userNumberService.batchGenerateUserNumbers();
    
    logger.info('✅ 批量生成用户编号完成！');
    process.exit(0);
  } catch (error) {
    logger.error('❌ 批量生成用户编号失败', { error });
    process.exit(1);
  }
}

main();
