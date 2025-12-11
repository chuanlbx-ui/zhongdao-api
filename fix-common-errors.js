#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 常见的修复模式
const fixes = [
  // 1. 修复 productsSpecs → productSpecs
  {
    pattern: /\.productsSpecs/g,
    replacement: '.productSpecs',
    description: 'productsSpecs → productSpecs'
  },
  // 2. 修复 productsPricing → productPricings
  {
    pattern: /\.productsPricing/g,
    replacement: '.productPricings',
    description: 'productsPricing → productPricings'
  },
  // 3. 修复 pointsTransactionss → pointsTransactions
  {
    pattern: /pointsTransactionss/g,
    replacement: 'pointsTransactions',
    description: 'pointsTransactionss → pointsTransactions'
  },
  // 4. 修复 WITHDRAW_REQUEST → WITHDRAW
  {
    pattern: /WITHDRAW_REQUEST/g,
    replacement: 'WITHDRAW',
    description: 'WITHDRAW_REQUEST → WITHDRAW'
  },
  // 5. 修复 shop → shops (作为Prisma模型引用时)
  {
    pattern: /prisma\.shop(?!\w)/g,
    replacement: 'prisma.shops',
    description: 'prisma.shop → prisma.shops'
  },
  // 6. 修复 order → orders (作为Prisma模型引用时)
  {
    pattern: /prisma\.order(?!\w)/g,
    replacement: 'prisma.orders',
    description: 'prisma.order → prisma.orders'
  },
  // 7. 修复 products → product (在某些上下文中)
  {
    pattern: /const \{ product: prisma\./g,
    replacement: 'const { product: prisma.',
    description: 'Fix product destructuring'
  },
  // 8. 修复 Number() 调用错误
  {
    pattern: /Number\(/g,
    replacement: 'Number(',
    description: 'Number() calls'
  }
];

async function applyFixes() {
  const files = glob.sync('src/**/*.{ts,js}', {
    cwd: __dirname,
    absolute: true
  });

  console.log(`🔧 找到 ${files.length} 个文件需要检查\n`);

  let totalFixes = 0;

  for (const file of files) {
    if (file.includes('node_modules') || file.includes('.git')) continue;

    try {
      let content = fs.readFileSync(file, 'utf8');
      let fileFixes = 0;

      for (const fix of fixes) {
        const matches = content.match(fix.pattern);
        if (matches) {
          content = content.replace(fix.pattern, fix.replacement);
          fileFixes += matches.length;
          console.log(`  ✅ ${fix.description} in ${path.relative(__dirname, file)} (${matches.length} occurrences)`);
        }
      }

      if (fileFixes > 0) {
        fs.writeFileSync(file, content);
        totalFixes += fileFixes;
      }
    } catch (error) {
      console.error(`❌ 处理文件失败: ${file}`, error.message);
    }
  }

  console.log(`\n🎉 总共应用了 ${totalFixes} 个修复！`);
}

applyFixes().catch(console.error);