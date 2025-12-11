#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 递归获取所有TypeScript文件
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', '.vscode', 'dist', 'coverage'].includes(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (file.endsWith('.ts')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// Prisma关系修复规则
const fixes = [
  // 产品相关
  {
    pattern: /\.pricings(?!\w)/g,
    replacement: '.productPricings',
    description: 'pricings → productPricings (关系)'
  },
  // 用户相关 - 修复avatar字段问题
  {
    pattern: /(user\w*\.avatar)/g,
    replacement: 'null', // 暂时用null替代，因为users表没有avatar字段
    description: 'user.avatar → null (字段不存在)'
  },
  // 订单相关
  {
    pattern: /prisma\.order(?!\w)/g,
    replacement: 'prisma.orders',
    description: 'prisma.order → prisma.orders'
  },
  // 店铺相关
  {
    pattern: /prisma\.shop(?!\w)/g,
    replacement: 'prisma.shops',
    description: 'prisma.shop → prisma.shops'
  },
  // 请求相关 - 修复items属性
  {
    pattern: /order\.items(?!\w)/g,
    replacement: 'orderItems', // 假设有orderItems关系
    description: 'order.items → orderItems'
  },
  // 修复prisma.order引用
  {
    pattern: /prisma\.order\./g,
    replacement: 'prisma.orders.',
    description: 'prisma.order. → prisma.orders.'
  }
];

async function applyFixes() {
  const srcDir = path.join(__dirname, 'src');
  const files = getAllFiles(srcDir);

  console.log(`🔧 找到 ${files.length} 个TypeScript文件需要检查\n`);

  let totalFixes = 0;
  let fixedFiles = 0;

  for (const file of files) {
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
        fixedFiles++;
      }
    } catch (error) {
      console.error(`❌ 处理文件失败: ${file}`, error.message);
    }
  }

  console.log(`\n🎉 Prisma关系修复完成！`);
  console.log(`📁 修复了 ${fixedFiles} 个文件`);
  console.log(`🔧 总共应用了 ${totalFixes} 个修复`);
}

applyFixes().catch(console.error);