#!/usr/bin/env node

// 批量修复路由文件导入问题

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 批量修复路由文件导入问题...\n');

// 获取所有需要修复的文件
const files = execSync('find src/routes -name "*.ts" -type f', { encoding: 'utf8' })
    .split('\n')
    .filter(f => f.trim() && !f.includes('node_modules'));

// 需要修复的导入映射
const fixes = [
    {
        from: /from ['"]\.\.\/\.\.\/shared\/errors\/error\.middleware['"]/g,
        to: "from '../../../shared/middleware/error'",
        description: '修复 error.middleware 导入'
    },
    {
        from: /from ['"]\.\.\/\.\.\/shared\/middleware\/error['"]/g,
        to: "from '../../../shared/middleware/error'",
        description: '统一 error 导入路径'
    },
    {
        from: /from ['"]\.\.\/\.\.\/shared\/middleware\/validation['"]/g,
        to: "from '../../../shared/middleware/validator'",
        description: '修复 validation 导入'
    }
];

let totalFixed = 0;

console.log(`📁 找到 ${files.length} 个路由文件\n`);

// 修复每个文件
files.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileFixed = 0;

    fixes.forEach(({ from, to, description }) => {
        if (from.test(content)) {
            content = content.replace(from, to);
            console.log(`✅ ${filePath}`);
            console.log(`   ${description}`);
            fileFixed++;
        }
    });

    // 特殊处理：检查是否使用了未定义的中间件
    if (content.includes('validate') && !content.includes('import') && filePath.includes('admin')) {
        console.log(`⚠️ ${filePath} 使用了validate但缺少导入`);
    }

    // 保存修复后的文件
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        totalFixed += fileFixed;
    }
});

// 特殊检查：检查admin路由的导出问题
console.log('\n🔍 检查admin路由导出...');
const adminFiles = [
    'src/routes/v1/admin/config.ts',
    'src/routes/v1/admin/index.ts',
    'src/routes/v1/admin/dashboard.ts',
    'src/routes/v1/admin/orders.ts',
    'src/routes/v1/admin/products.ts',
    'src/routes/v1/admin/users.ts'
];

adminFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');

        // 检查是否有router.use但没有正确的导出
        if (content.includes('router.use(')) {
            // 检查是否有export default router
            if (!content.includes('export default router')) {
                console.log(`❌ ${file} 缺少 'export default router'`);
            }
        }
    }
});

// 检查配置路由
console.log('\n🔍 检查配置路由...');
const configFiles = [
    'src/routes/v1/config/demo.ts',
    'src/routes/v1/config/demo-simple.ts'
];

configFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');

        if (content.includes('router.use(')) {
            if (!content.includes('export default router')) {
                console.log(`❌ ${file} 缺少 'export default router'`);

                // 尝试修复
                const fixedContent = content + '\n\nexport default router;';
                fs.writeFileSync(file, fixedContent);
                console.log(`✅ 已修复 ${file}`);
                totalFixed++;
            }
        }
    }
});

console.log(`\n📊 修复完成！`);
console.log(`   - 修复文件: ${totalFixed > 0 ? '多个' : '0'}`);
console.log(`   - 修复总数: ${totalFixed}`);

// 验证关键文件
console.log('\n✅ 关键文件验证:');
const keyFiles = [
    { path: 'src/routes/v1/admin/config.ts', name: 'Admin Config' },
    { path: 'src/routes/v1/admin/index.ts', name: 'Admin Index' },
    { path: 'src/routes/v1/config/demo.ts', name: 'Config Demo' }
];

keyFiles.forEach(({ path, name }) => {
    if (fs.existsSync(path)) {
        console.log(`   ✓ ${name} - 存在`);

        const content = fs.readFileSync(path, 'utf8');
        if (content.includes('export default router')) {
            console.log(`   ✓ ${name} - 导出正确`);
        } else {
            console.log(`   ❌ ${name} - 导出有问题`);
        }
    } else {
        console.log(`   ❌ ${name} - 不存在`);
    }
});

console.log('\n🚀 下一步:');
console.log('   1. 运行 npm run dev 测试服务器');
console.log('   2. 如果仍有错误，查看具体的错误信息');
console.log('   3. 运行 node test-all-api-endpoints.js 测试API');