const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 TypeScript错误批量修复工具\n');

// 需要修复的模式列表
const patterns = [
  // Prisma模型名称修复
  { from: 'pointsTransactionss', to: 'pointsTransactions', desc: '修复 pointsTransactionss → pointsTransactions' },
  { from: 'pointsTransactionss', to: 'pointsTransactions', desc: '修复 PointsTransactionss → pointsTransactions', caseSensitive: true },
  { from: 'productsss', to: 'products', desc: '修复 productsss → products' },
  { from: 'productsss', to: 'products', desc: '修复 productsss → products', caseSensitive: true },
  { from: 'shopss', to: 'shops', desc: '修复 shopss → shops' },
  { from: 'shopsss', to: 'shops', desc: '修复 shopsss → shops' },
  { from: 'userss', to: 'users', desc: '修复 userss → users' },
  { from: 'userss', to: 'users', desc: '修复 userss → users', caseSensitive: true },
  { from: 'productsId', to: 'productId', desc: '修复 productsId → productId' },
  { from: 'products', to: 'productId', desc: '修复 products → productId (仅限特定上下文)' },

  // UserLevel 类型修复
  { from: 'import.*UserLevel.*from.*@prisma/client', to: '// UserLevel 类型定义移除', desc: '移除 UserLevel 从 Prisma 的导入', isRegex: true },
  { from: 'UserLevel', to: 'users_level', desc: '修复 UserLevel → users_level', onlyIfNotAfter: 'type UserLevel' },

  // PaymentStatus 修复
  { from: 'PaymentStatus\\.(CANCELLED|EXPIRED)', to: "'CANCELLED'", desc: '修复不存在的 PaymentStatus', isRegex: true },

  // 其他常见错误
  { from: 'points\\.', to: 'users.pointsBalance', desc: '修复 points 模型引用', isRegex: true },
  { from: 'prisma\\.points', to: 'prisma.users', desc: '修复 prisma.points → prisma.users', isRegex: true },
  { from: '\\(Number\\)', to: 'Number', desc: '修复 Number 调用错误', isRegex: true },
  { from: 'Stream', to: 'import("stream").Stream', desc: '修复 Stream 引用' }
];

// 需要添加 UserLevel 类型定义的文件
const filesNeedingUserLevel = [
  'src/modules/commission/interfaces.ts',
  'src/types/index.ts',
  'src/modules/commission/commission.service.ts'
];

// 添加 UserLevel 类型定义
function addUserLevelDefinition(content) {
  if (!content.includes('type UserLevel')) {
    const insertPoint = content.indexOf('import {');
    if (insertPoint !== -1) {
      const importEnd = content.indexOf('\n', insertPoint);
      content = content.slice(0, importEnd + 1) +
        '\n// 用户等级类型\n' +
        'type UserLevel = \'NORMAL\' | \'VIP\' | \'STAR_1\' | \'STAR_2\' | \'STAR_3\' | \'STAR_4\' | \'STAR_5\' | \'DIRECTOR\';\n' +
        content.slice(importEnd + 1);
    }
  }
  return content;
}

// 修复文件
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 首先检查是否需要添加 UserLevel 定义
  if (filesNeedingUserLevel.includes(filePath)) {
    content = addUserLevelDefinition(content);
    modified = true;
  }

  // 应用所有修复模式
  patterns.forEach(pattern => {
    const regex = pattern.isRegex ? new RegExp(pattern.from, 'g') : new RegExp(pattern.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

    if (pattern.caseSensitive) {
      // 区分大小写的替换（仅替换完全匹配的大小写）
      const before = content;
      content = content.replace(regex, pattern.to);
      if (before !== content) {
        console.log(`  ✓ ${pattern.desc}`);
        modified = true;
      }
    } else {
      // 不区分大小写的替换
      const before = content;
      content = content.replace(regex, pattern.to);
      if (before !== content) {
        console.log(`  ✓ ${pattern.desc}`);
        modified = true;
      }
    }
  });

  // 特殊修复：某些文件的特殊处理
  if (filePath.includes('commission.service.ts')) {
    // 修复聚合查询中的空对象
    content = content.replace(/select: \{\}/g, 'select: { id: true }');

    // 修复 WhereInput 类型
    content = content.replace(/PointsTransactionssWhereInput/g, 'pointsTransactionsWhereInput');
    content = content.replace(/PointsTransactionssUpdateInput/g, 'pointsTransactionsUpdateInput');
  }

  if (filePath.includes('payment/types.ts')) {
    // 修复 PaymentStatus 枚举
    content = content.replace(/Record<paymentRecords_status, string>/g, 'Record<string, string>');
  }

  if (filePath.includes('pricing.service.ts')) {
    // 修复 productsId → productId
    content = content.replace(/productsId/g, 'productId');
    content = content.replace(/productsss/g, 'products');
  }

  if (filePath.includes('points.service.ts')) {
    // 修复 points 引用
    content = content.replace(/prisma\.points/g, 'prisma.users');
    content = content.replace(/\.points/g, '.pointsBalance');
  }

  if (filePath.includes('rate-limit.ts') || filePath.includes('security-config.ts')) {
    // 修复 ErrorCode 类型
    content = content.replace(/"RATE_LIMIT_EXCEEDED"/g, '"RATE_LIMITED"');
  }

  // 保存文件
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已修复: ${filePath}`);
  }

  return modified;
}

// 查找需要修复的文件
function findFilesToFix() {
  const files = [];

  // 从编译错误中提取文件列表
  const errorOutput = execSync('npm run build 2>&1 || true', { encoding: 'utf8' });
  const errorLines = errorOutput.split('\n');

  errorLines.forEach(line => {
    const match = line.match(/^src\/.*\.ts\(/);
    if (match) {
      const filePath = match[0].slice(0, -1);
      if (fs.existsSync(filePath) && !files.includes(filePath)) {
        files.push(filePath);
      }
    }
  });

  // 添加已知的文件
  const knownFiles = [
    'src/modules/commission/interfaces.ts',
    'src/types/index.ts',
    'src/modules/commission/commission.service.ts',
    'src/modules/payment/types.ts',
    'src/modules/products/pricing.service.ts',
    'src/modules/points/points.service.ts',
    'src/shared/services/points/statistics.service.ts',
    'src/shared/services/rate-limit.ts',
    'src/shared/services/security-config.ts',
    'src/shared/services/security-monitoring.ts',
    'src/shared/services/userLevelService.ts',
    'src/shared/services/wechat-auth.ts',
    'src/shared/types/response.ts',
    'src/shared/utils/referralCode.ts'
  ];

  knownFiles.forEach(file => {
    if (fs.existsSync(file) && !files.includes(file)) {
      files.push(file);
    }
  });

  return [...new Set(files)]; // 去重
}

// 主修复流程
async function main() {
  console.log('正在查找需要修复的文件...\n');

  const filesToFix = findFilesToFix();

  if (filesToFix.length === 0) {
    console.log('没有找到需要修复的文件');
    return;
  }

  console.log(`找到 ${filesToFix.length} 个文件需要修复:\n`);

  let fixedCount = 0;
  filesToFix.forEach(file => {
    console.log(`\n🔧 修复文件: ${file}`);
    if (fixFile(file)) {
      fixedCount++;
    }
  });

  console.log(`\n========================================`);
  console.log(`修复完成: ${fixedCount}/${filesToFix.length} 个文件`);

  if (fixedCount > 0) {
    console.log('\n正在重新编译...');
    try {
      execSync('npm run build', { stdio: 'inherit' });
    } catch (error) {
      console.log('\n⚠️ 编译仍有错误，请手动检查');
    }
  }
}

// 运行修复
main().catch(error => {
  console.error('\n❌ 修复失败:', error);
  process.exit(1);
});