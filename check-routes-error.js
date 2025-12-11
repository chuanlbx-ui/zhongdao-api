#!/usr/bin/env node

// 检查路由导入错误

const fs = require('fs');
const path = require('path');

console.log('🔍 检查路由文件错误...\n');

// 需要检查的路由文件
const routeFiles = [
    'src/routes/v1/commission/index.ts',
    'src/routes/v1/admin/config.ts',
    'src/routes/v1/admin/dashboard.ts',
    'src/routes/v1/admin/orders.ts',
    'src/routes/v1/admin/products.ts',
    'src/routes/v1/admin/users.ts'
];

// 错误模式
const errorPatterns = [
    {
        pattern: /from ['"]\.\.\/\.\.\/shared\/middleware\/error['"]/,
        replacement: "from '../../../shared/errors/error.middleware'",
        description: '修复error中间件导入路径'
    },
    {
        pattern: /from ['"]\.\.\/\.\.\/shared\/middleware\/validation['"]/,
        replacement: "from '../../../shared/middleware/validator'",
        description: '修复validation中间件导入路径'
    }
];

let fixedFiles = 0;
let totalErrors = 0;

// 检查每个文件
routeFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ 文件不存在: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileErrors = 0;

    console.log(`\n📁 检查: ${filePath}`);

    // 检查并修复错误
    errorPatterns.forEach(({ pattern, replacement, description }) => {
        const matches = content.match(pattern);
        if (matches) {
            console.log(`  ❌ ${description}`);
            content = content.replace(pattern, replacement);
            fileErrors++;
            totalErrors++;
        }
    });

    // 如果有修改，保存文件
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        fixedFiles++;
        console.log(`  ✅ 已修复 ${fileErrors} 个错误`);
    } else {
        console.log(`  ✅ 没有发现错误`);
    }
});

// 输出总结
console.log(`\n📊 检查总结:`);
console.log(`  - 检查文件数: ${routeFiles.length}`);
console.log(`  - 修复文件数: ${fixedFiles}`);
console.log(`  - 修复错误数: ${totalErrors}`);

if (totalErrors > 0) {
    console.log('\n✨ 路由错误已修复，请重新启动服务器');
} else {
    console.log('\n✨ 所有路由文件正常');
}