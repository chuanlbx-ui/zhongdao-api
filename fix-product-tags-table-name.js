#!/usr/bin/env node

/**
 * 修复商品标签表名错误
 * 将 productsTags 改为 productTags
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修复商品标签表名...\n');

// 需要修复的文件列表
const filesToFix = [
  'src/routes/v1/products/tags.ts',
  'src/shared/services/points.ts',  // 可能也引用了这个表
  'tests/database/test-database.helper.ts'
];

let totalFixes = 0;

// 修复每个文件
filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`  - 跳过不存在的文件: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  // 修复表名
  content = content.replace(/productsTags/g, 'productTags');

  // 特别修复 _count.productss -> _count.products
  content = content.replace(/_count\.productss/g, '_count.products');

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    totalFixes++;
    console.log(`  ✓ 修复: ${filePath}`);
  } else {
    console.log(`  - 无需修复: ${filePath}`);
  }
});

console.log(`\n✅ 修复完成！共修复了 ${totalFixes} 个文件`);
console.log('\n修复内容：');
console.log('- productsTags → productTags');
console.log('- _count.productss → _count.products');