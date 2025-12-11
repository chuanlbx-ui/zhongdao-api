const fs = require('fs');
const path = require('path');

console.log('🔧 修复 test-data-manager.ts 中的模型名称错误...\n');

const filePath = path.join(__dirname, '../../src/scripts/test-data-manager.ts');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  // productss → products
  { from: 'config.productss.productss', to: 'config.products.products', count: 0 },
  { from: 'stats.productss', to: 'stats.products', count: 0 },
  { from: 'config.productss', to: 'config.products', count: 0 },

  // productsss → products
  { from: 'prisma.productsssCategories', to: 'prisma.productCategories', count: 0 },
  { from: 'prisma.productssss', to: 'prisma.products', count: 0 },

  // 确保config对象结构正确
];

// 执行替换
replacements.forEach(replacement => {
  const regex = new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const before = content;
  content = content.replace(regex, replacement.to);
  replacement.count = (before.match(regex) || []).length;

  if (replacement.count > 0) {
    console.log(`  ✓ 替换 "${replacement.from}" → "${replacement.to}" (${replacement.count} 处)`);
  }
});

// 保存修复后的文件
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ test-data-manager.ts 修复完成！');

// 验证修复结果
console.log('\n🔍 验证修复结果...');
const remainingIssues = [];
if (content.includes('productss')) remainingIssues.push('productss');
if (content.includes('shopss')) remainingIssues.push('shopss');
if (content.includes('usersss')) remainingIssues.push('usersss');
if (content.includes('productsss')) remainingIssues.push('productsss');

if (remainingIssues.length === 0) {
  console.log('✅ 所有模型名称错误已修复！');
} else {
  console.log(`⚠️ 仍有未修复的问题: ${remainingIssues.join(', ')}`);
}

// 检查config对象定义
console.log('\n🔍 检查DEFAULT_CONFIGS对象...');
if (!content.includes('products:')) {
  console.log('⚠️ 需要检查DEFAULT_CONFIGS中是否有products配置');
}