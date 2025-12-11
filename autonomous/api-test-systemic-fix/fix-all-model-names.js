const fs = require('fs');
const path = require('path');

console.log('🔧 批量修复所有模型名称错误\n');

// 需要替换的模式
const replacements = [
  // 复数形式错误
  { from: 'pointsTransactionss', to: 'pointsTransactions' },
  { from: 'PointsTransactionss', to: 'pointsTransactions' },
  { from: 'productsss', to: 'products' },
  { from: 'shopsss', to: 'shops' },
  { from: 'userss', to: 'users' },
  { from: 'Userss', to: 'users' },

  // 字段名称错误
  { from: 'productsId', to: 'productId' },
  { from: 'ordersId', to: 'orderId' },
  { from: 'shopsId', to: 'shopId' },
];

// 递归查找所有TypeScript文件
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// 修复单个文件
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  replacements.forEach(({ from, to }) => {
    const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const before = content;
    content = content.replace(regex, to);

    if (before !== content) {
      console.log(`  ✓ 修复 ${from} → ${to}`);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

// 主函数
function main() {
  const srcDir = path.join(__dirname, '../../src');
  const tsFiles = findTsFiles(srcDir);

  console.log(`找到 ${tsFiles.length} 个TypeScript文件\n`);

  let fixedCount = 0;
  tsFiles.forEach(file => {
    if (fixFile(file)) {
      fixedCount++;
    }
  });

  console.log(`\n========================================`);
  console.log(`修复完成: ${fixedCount} 个文件被修改`);

  // 特殊处理：检查关键文件的导入
  console.log('\n🔍 检查关键文件的导入...');

  const keyFiles = [
    'src/modules/commission/interfaces.ts',
    'src/types/index.ts'
  ];

  keyFiles.forEach(file => {
    const filePath = path.join(__dirname, '../../', file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');

      // 添加 UserLevel 类型定义
      if (content.includes('UserLevel') && !content.includes('type UserLevel')) {
        content = content.replace(
          /import.*from.*@prisma\/client/ as any) {
    const parts = str.split('.');
    return parts[parts.length - 1];
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}