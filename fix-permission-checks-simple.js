#!/usr/bin/env node

/**
 * 修复权限检查逻辑 - 简化版
 * 统一role和level的使用，确保大小写一致
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复权限检查逻辑...\n');

// 权限检查修复规则
const permissionFixes = [
  // 修复大小写不一致的问题
  { from: "role !== 'admin'", to: "role !== 'ADMIN'" },
  { from: 'role !== "admin"', to: 'role !== "ADMIN"' },
  { from: "role === 'admin'", to: "role === 'ADMIN'" },
  { from: 'role === "admin"', to: 'role === "ADMIN"' },
  { from: "role !== 'user'", to: "role !== 'USER'" },
  { from: 'role !== "user"', to: 'role !== "USER"' },
  { from: "role === 'user'", to: "role === 'USER'" },
  { from: 'role === "user"', to: 'role === "USER"' },
  // level大小写修复
  { from: "level !== 'director'", to: "level !== 'DIRECTOR'" },
  { from: 'level !== "director"', to: 'level !== "DIRECTOR"' },
  { from: "level === 'director'", to: "level === 'DIRECTOR'" },
  { from: 'level === "director"', to: 'level === "DIRECTOR"' },
  { from: "level !== 'normal'", to: "level !== 'NORMAL'" },
  { from: 'level !== "normal"', to: 'level !== "NORMAL"' },
  { from: "level === 'normal'", to: "level === 'NORMAL'" },
  { from: 'level === "normal"', to: 'level === "NORMAL"' }
];

// 需要修复的特定文件
const specificFiles = [
  'src/api/v1/payments/routes.ts',
  'src/modules/commission/commission.service.ts',
  'src/modules/points/points.service.ts'
];

// 查找所有TypeScript文件
function findAllTsFiles(dir, fileList = []) {
  const fullPath = path.join(__dirname, dir);

  if (!fs.existsSync(fullPath)) {
    return fileList;
  }

  const files = fs.readdirSync(fullPath);

  files.forEach(file => {
    const filePath = path.join(fullPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
      findAllTsFiles(path.join(dir, file), fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(path.join(dir, file));
    }
  });

  return fileList;
}

// 获取所有需要检查的文件
const filesToCheck = [
  ...specificFiles,
  ...findAllTsFiles('src/routes'),
  ...findAllTsFiles('src/modules'),
  ...findAllTsFiles('src/shared')
];

// 去重
const uniqueFiles = [...new Set(filesToCheck)];

console.log(`找到 ${uniqueFiles.length} 个TypeScript文件需要检查...\n`);

let totalFixes = 0;

// 修复每个文件
uniqueFiles.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  permissionFixes.forEach(({ from, to }) => {
    const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const before = content;
    content = content.replace(regex, to);

    if (before !== content) {
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    totalFixes++;
    console.log(`  ✓ 修复: ${filePath}`);
  }
});

console.log(`\n✅ 修复完成！共修复了 ${totalFixes} 个文件`);

// 输出修复总结
console.log('\n修复内容：');
console.log("- 'admin' → 'ADMIN'");
console.log("- 'user' → 'USER'");
console.log("- 'director' → 'DIRECTOR'");
console.log("- 'normal' → 'NORMAL'");

console.log('\n权限检查原则：');
console.log('- role: USER/ADMIN (用户角色)');
console.log('- level: NORMAL/VIP/STAR_1-5/DIRECTOR (用户等级)');
console.log('- 管理员权限使用 role === "ADMIN"');
console.log('- 功能权限使用 level 检查 (如 STAR_5, DIRECTOR)');

console.log('\n下一步建议：');
console.log('1. 运行测试验证修复效果');
console.log('2. 继续修复商品管理测试');