#!/usr/bin/env node

/**
 * 批量错误分析工具 - 快速识别所有模块的核心问题
 */

const fs = require('fs');
const path = require('path');

// 模块列表
const modules = [
  'auth', 'users', 'shops', 'products', 'orders',
  'inventory', 'points', 'teams', 'commission'
];

console.log('=== 批量错误分析工具 ===\n');

// 1. 检查模块导出问题
console.log('1. 检查模块导出问题:');
modules.forEach(module => {
  const modulePath = `src/modules/${module}`;

  if (fs.existsSync(modulePath)) {
    const files = fs.readdirSync(modulePath);
    const hasService = files.some(f => f.includes('.service.'));
    const hasIndex = files.includes('index.ts');

    console.log(`  ${module}:`);
    console.log(`    - service文件: ${hasService ? '✓' : '✗'}`);
    console.log(`    - index.ts: ${hasIndex ? '✓' : '✗'}`);

    if (hasService) {
      // 检查service文件导出
      const serviceFile = files.find(f => f.includes('.service.'));
      const servicePath = path.join(modulePath, serviceFile);
      try {
        const content = fs.readFileSync(servicePath, 'utf8');
        const hasExport = content.includes('export') && content.includes('class');
        console.log(`    - service导出: ${hasExport ? '✓' : '✗'}`);
      } catch (e) {
        console.log(`    - service导出: ✗ (读取失败)`);
      }
    }
  } else {
    console.log(`  ${module}: ✗ 目录不存在`);
  }
  console.log('');
});

// 2. 检查数据库字段映射问题
console.log('2. 检查常见的数据库字段命名问题:');

const oldFieldPatterns = [
  /user_id/g,
  /shop_id/g,
  /product_id/g,
  /order_id/g,
  /team_id/g,
  /created_at/g,
  /updated_at/g
];

const newFieldPatterns = [
  'userId',
  'shopId',
  'productId',
  'orderId',
  'teamId',
  'createdAt',
  'updatedAt'
];

// 检查几个关键文件
const criticalFiles = [
  'src/modules/user/user.service.ts',
  'src/modules/shop/shop.service.ts',
  'src/modules/inventory/inventory.service.ts'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    console.log(`\n  ${file}:`);

    oldFieldPatterns.forEach((pattern, i) => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`    - 发现旧字段名: ${pattern.source} (${matches.length}次)`);
      }
    });
  }
});

// 3. 检查导入导出问题
console.log('\n3. 检查模块导入导出一致性:');

const routesPath = 'src/routes/v1';
if (fs.existsSync(routesPath)) {
  const routeModules = fs.readdirSync(routesPath);

  modules.forEach(module => {
    const routeFile = path.join(routesPath, module, 'index.ts');
    if (fs.existsSync(routeFile)) {
      try {
        const content = fs.readFileSync(routeFile, 'utf8');
        const hasServiceImport = content.includes(`import.*from.*${module}`);
        const hasRouterExport = content.includes('export.*router');

        console.log(`  ${module}路由:`);
        console.log(`    - 服务导入: ${hasServiceImport ? '✓' : '✗'}`);
        console.log(`    - 路由导出: ${hasRouterExport ? '✓' : '✗'}`);
      } catch (e) {
        console.log(`  ${module}路由: ✗ 读取失败`);
      }
    }
  });
}

// 4. 快速修复建议
console.log('\n=== 快速修复建议 ===\n');

console.log('优先级1 - 立即修复:');
console.log('1. 修复 src/shared/services/points.ts 的导入路径');
console.log('   - 将 "./services/points" 改为 "./points"');
console.log('2. 统一所有数据库字段命名为驼峰式');
console.log('3. 确保每个模块都有正确的导出');

console.log('\n优先级2 - 批量修复:');
console.log('1. 使用脚本批量替换数据库字段名');
console.log('2. 统一模块导入导出格式');
console.log('3. 补充缺失的模块文件');

console.log('\n优先级3 - 系统优化:');
console.log('1. 建立自动化测试流水线');
console.log('2. 创建代码质量检查工具');
console.log('3. 建立错误监控和日志系统');

console.log('\n建议的修复顺序:');
console.log('1. 先修复导入导出问题 (5分钟)');
console.log('2. 批量替换数据库字段名 (10分钟)');
console.log('3. 验证所有模块可以正常加载 (5分钟)');
console.log('4. 运行测试套件验证修复效果 (10分钟)');
console.log('5. 处理剩余的业务逻辑问题 (灵活安排)');