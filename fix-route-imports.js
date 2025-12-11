#!/usr/bin/env node

// 批量修复路由导入错误

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 批量修复路由导入错误...\n');

// 需要修复的导入映射
const importFixes = [
    {
        from: /from ['"]\.\.\/\.\.\/shared\/errors\/error\.middleware['"]/g,
        to: 'from \'../../../shared/middleware/error\'',
        description: 'error.middleware → middleware/error'
    },
    {
        from: /from ['"]\.\.\/\.\.\/shared\/middleware\/error['"]/g,
        to: 'from \'../../../shared/middleware/error\'',
        description: 'middleware/error (already correct)'
    }
];

// 查找所有需要检查的文件
const files = execSync('dir /s /b src\\routes\\*.ts', { encoding: 'utf8' })
    .split('\n')
    .filter(f => f.trim());

let totalFixed = 0;

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileFixed = 0;

    // 应用修复
    importFixes.forEach(({ from, to, description }) => {
        const matches = content.match(from);
        if (matches) {
            content = content.replace(from, to);
            console.log(`✅ ${filePath}`);
            console.log(`   ${description}`);
            fileFixed += matches.length;
        }
    });

    // 保存修复后的文件
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        totalFixed += fileFixed;
    }
});

console.log(`\n📊 修复完成！`);
console.log(`   - 检查文件: ${files.length} 个`);
console.log(`   - 修复导入: ${totalFixed} 处`);

// 特别检查controller文件
console.log('\n🔍 检查controller文件中的导入...');
const controllerFiles = execSync('dir /s /b src\\routes\\**\\controller.ts', { encoding: 'utf8' })
    .split('\n')
    .filter(f => f.trim());

controllerFiles.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes("from '../../../shared/errors/error.middleware'")) {
        console.log(`❌ ${filePath} 需要修复`);
        content = content.replace(
            "from '../../../shared/errors/error.middleware'",
            "from '../../../shared/middleware/error'"
        );
        fs.writeFileSync(filePath, content);
        totalFixed++;
    }
});

console.log(`\n✨ 总共修复了 ${totalFixed} 处导入错误！`);