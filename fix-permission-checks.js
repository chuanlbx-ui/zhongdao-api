#!/usr/bin/env node

/**
 * 修复权限检查逻辑
 * 统一role和level的使用，确保大小写一致
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复权限检查逻辑...\n');

// 需要修复的文件和规则
const fixRules = [
  {
    file: 'src/api/v1/payments/routes.ts',
    replacements: [
      { from: "req.user.role !== 'admin'", to: "req.user.role !== 'ADMIN'" },
      { from: "req.user.role !== 'admin' &&", to: "req.user.role !== 'ADMIN' &&" }
    ]
  },
  {
    file: 'src/routes/v1/users/index.ts',
    replacements: [
      // 这里使用level是正确的，因为检查的是用户等级（DIRECTOR）
      // 不需要修改
    ]
  },
  {
    file: 'src/routes/v1/points/index.ts',
    replacements: [
      // 已经使用了正确的 'ADMIN' 和 'DIRECTOR'
      // 不需要修改
    ]
  }
];

// 统一权限检查模式
const permissionPatterns = [
  // 管理员权限检查（基于role）
  {
    pattern: /req\.user\.role\s*[!=]==\s*['"]admin['"]/gi,
    replacement: "req.user.role === 'ADMIN'"
  },
  {
    pattern: /req\.user\.role\s*[!=]==\s*['"]user['"]/gi,
    replacement: "req.user.role === 'USER'"
  },
  // 功能权限检查（基于level）
  {
    pattern: /req\.user\.level\s*[!=]==\s*['"]director['"]/gi,
    replacement: "req.user.level === 'DIRECTOR'"
  },
  {
    pattern: /req\.user\.level\s*[!=]==\s*['"]normal['"]/gi,
    replacement: "req.user.level === 'NORMAL'"
  }
];

let totalFixes = 0;

// 首先查找所有可能需要修复的文件
const searchDirs = [
  'src/routes',
  'src/api',
  'src/modules'
];

const filesToCheck = [];

// 递归查找所有TypeScript文件
function findTsFiles(dir, baseDir = '') {
  const fullPath = path.join(__dirname, dir);

  if (!fs.existsSync(fullPath)) {
    return;
  }

  const items = fs.readdirSync(fullPath);

  items.forEach(item => {
    const itemPath = path.join(fullPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      findTsFiles(path.join(dir, item), baseDir);
    } else if (item.endsWith('.ts')) {
      filesToCheck.push(path.join(dir, item));
    }
  });
}

searchDirs.forEach(dir => findTsFiles(dir));

console.log(`找到 ${filesToCheck.length} 个TypeScript文件需要检查...\n`);

// 检查每个文件
filesToCheck.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  const originalContent = content;

  // 应用权限模式修复
  permissionPatterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      if (content !== originalContent) {
        console.log(`  ✓ 修复 ${filePath}`);
        matches.forEach(match => {
          console.log(`    - ${match} → ${replacement}`);
        });
        modified = true;
      }
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    totalFixes++;
  }
});

console.log(`\n✅ 修复完成！共修复了 ${totalFixes} 个文件`);

// 生成权限检查指南
const guide = `
## 权限检查指南

### 角色与等级的区别：

1. **role（角色）**:
   - USER: 普通用户
   - ADMIN: 管理员

2. **level（等级）**:
   - NORMAL: 普通会员
   - VIP: VIP会员
   - STAR_1 到 STAR_5: 1-5星店长
   - DIRECTOR: 董事

### 权限检查模式：

1. **管理员权限检查**（基于role）:
   \\`\\`\\`typescript
   if (!req.user || req.user.role !== 'ADMIN') {
     return res.status(403).json({ error: '需要管理员权限' });
   }
   \\`\\`\\`

2. **功能权限检查**（基于level）:
   \\`\\`\\`typescript
   if (!req.user || !['DIRECTOR', 'STAR_5'].includes(req.user.level)) {
     return res.status(403).json({ error: '权限不足' });
   }
   \\`\\`\\`

3. **组合权限检查**:
   \\`\\`\\`typescript
   // 管理员或董事级别用户
   if (req.user && (req.user.role === 'ADMIN' || req.user.level === 'DIRECTOR')) {
     // 有权限
   }
   \\`\\`\\`
`;

fs.writeFileSync(path.join(__dirname, 'permission-check-guide.md'), guide, 'utf8');

console.log('\n已生成权限检查指南：permission-check-guide.md');

console.log('\n下一步建议：');
console.log('1. 检查修复后的权限检查逻辑');
console.log('2. 运行相关测试验证修复');
console.log('3. 继续执行商品管理测试修复');