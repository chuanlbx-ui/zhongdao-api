#!/usr/bin/env node

/**
 * 批量修复表名错误脚本
 * 基于真实数据库结构修复代码中的表名引用错误
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复表名错误...\n');

// 定义需要修复的文件和对应的替换规则
const fixRules = [
  {
    files: [
      'src/routes/v1/products/categories.ts',
      'src/routes/v1/products/products.ts',
      'src/routes/v1/products/tags.ts',
      'tests/api/products.test.ts'
    ],
    replacements: [
      { from: 'productsssCategories', to: 'productCategories' },
      { from: 'productssss', to: 'products' },
      { from: 'productsss', to: 'products' }
    ]
  },
  {
    files: [
      'src/routes/v1/inventory/index.ts',
      'src/routes/v1/inventory/logs.ts',
      'src/routes/v1/inventory/alerts.ts',
      'tests/api/inventory.test.ts'
    ],
    replacements: [
      { from: 'inventoryLogsssss', to: 'inventoryLogs' },
      { from: 'productssss', to: 'products' }
    ]
  },
  {
    files: [
      'tests/database/test-database.helper.ts'
    ],
    replacements: [
      { from: 'productReviews', to: '' }, // 移除不存在的表
      { from: 'userPoints', to: '' }, // 移除不存在的表
      // 修复清理列表中的表名
      { from: 'inventoryLogs', to: 'inventoryLogs' }, // 确保名称正确
      { from: 'pointsTransactions', to: 'pointsTransactions' }
    ]
  }
];

// 需要特殊处理的情况
const specialHandling = {
  'tests/database/test-database.helper.ts': [
    {
      pattern: /\{ table: 'productReviews', field: 'userId' \},\n/g,
      replacement: '' // 删除整行
    },
    {
      pattern: /\{ table: 'userPoints', field: 'userId' \},\n/g,
      replacement: '' // 删除整行
    }
  ]
};

let totalFixes = 0;

// 处理每个文件
fixRules.forEach(rule => {
  rule.files.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  文件不存在: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // 应用通用替换规则
    rule.replacements.forEach(({ from, to }) => {
      const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const before = content;
      content = content.replace(regex, to);
      if (before !== content) {
        modified = true;
        console.log(`  ✓ 修复 ${filePath}: ${from} → ${to}`);
      }
    });

    // 应用特殊处理
    if (specialHandling[filePath]) {
      specialHandling[filePath].forEach(({ pattern, replacement }) => {
        const before = content;
        content = content.replace(pattern, replacement);
        if (before !== content) {
          modified = true;
        }
      });
    }

    // 清理多余的空行和逗号
    content = content.replace(/,\s*\n\s*\}/g, '\n  }');
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      totalFixes++;
    }
  });
});

console.log(`\n✅ 修复完成！共修复了 ${totalFixes} 个文件`);

// 输出修复总结
console.log('\n修复内容总结：');
console.log('- productsssCategories → productCategories');
console.log('- inventoryLogsssss → inventoryLogs');
console.log('- productssss → products');
console.log('- 移除了不存在的表：productReviews, userPoints');

console.log('\n下一步建议：');
console.log('1. 运行 npm test tests/api/products.test.ts 验证修复');
console.log('2. 运行 npm test tests/api/inventory.test.ts 验证修复');
console.log('3. 继续执行其他修复任务');