#!/usr/bin/env node

// 测试 admin 路由导入

console.log('🔍 测试 admin 路由导入...\n');

try {
  // 尝试导入 adminRoutes
  console.log('1. 尝试导入 admin/index.ts...');
  const adminRoutes = require('./src/routes/v1/admin/index.ts');
  console.log('✅ adminRoutes 导入成功');
  console.log('   类型:', typeof adminRoutes);
  console.log('   是否为函数:', typeof adminRoutes === 'function');
  console.log('   是否有 default:', adminRoutes.default ? 'yes' : 'no');

  // 检查导出
  if (adminRoutes.default) {
    console.log('   default 类型:', typeof adminRoutes.default);
  }
} catch (error) {
  console.log('❌ 导入失败:');
  console.log('   错误:', error.message);
  console.log('   堆栈:', error.stack);
}

console.log('\n✨ 测试完成！');