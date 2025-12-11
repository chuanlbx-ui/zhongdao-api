#!/usr/bin/env node

import { prisma } from '../src/shared/database/client';
import { logger } from '../src/shared/utils/logger';

async function checkDatabaseStatus() {
  console.log('🔍 检查数据库连接状态...\n');

  try {
    // 1. 检查数据库连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 2. 获取数据库基本信息
    const result = await prisma.$queryRaw`SELECT DATABASE() as db_name, VERSION() as version`;
    console.log(`📊 数据库信息:`, result[0]);

    // 3. 检查主要表的数据量
    const tables = [
      'users',
      'shops',
      'products',
      'orders',
      'points_transactions',
      'inventory_items'
    ];

    console.log('\n📋 主要表数据统计:');
    for (const table of tables) {
      try {
        const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  - ${table}: ${count[0].count} 条记录`);
      } catch (error) {
        console.log(`  - ${table}: 表不存在或无法访问`);
      }
    }

    // 4. 检查系统配置表
    try {
      const configCount = await prisma.systemConfig.count();
      console.log(`\n⚙️ 系统配置: ${configCount} 项`);
    } catch (error) {
      console.log('\n⚙️ 系统配置表未初始化');
    }

  } catch (error) {
    console.error('❌ 数据库检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStatus();