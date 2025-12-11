#!/usr/bin/env node

// 诊断具体哪个路由文件有问题

const fs = require('fs');

console.log('🔍 诊断路由加载错误...\n');

// 主路由文件导入的路由
const routeImports = [
    { name: 'auth-simple', path: './auth-simple' },
    { name: 'users', path: './users' },
    { name: 'levels', path: './levels' },
    { name: 'sms', path: './sms' },
    { name: 'points', path: './points' },
    { name: 'products', path: './products' },
    { name: 'shops', path: './shops' },
    { name: 'inventory', path: './inventory' },
    { name: 'teams', path: './teams' },
    { name: 'payments', path: './payments' },
    { name: 'orders', path: './orders' },
    { name: 'commission', path: './commission' },
    { name: 'configDemo', path: './config/demo' },
    { name: 'configSimple', path: './config/demo-simple' },
    { name: 'adminConfig', path: './admin/config' },
    { name: 'admin', path: './admin' },
    { name: 'wutong', path: './wutong' },
    { name: 'performance', path: './performance' },
    { name: 'systemPerformance', path: './system/performance' }
];

// 尝试动态加载每个路由
routeImports.forEach(route => {
    console.log(`\n检查 ${route.name} (${route.path})...`);

    try {
        // 构建完整路径
        const fullPath = `src/routes/v1/${route.path}.ts`;

        if (!fs.existsSync(fullPath)) {
            console.log(`  ❌ 文件不存在: ${fullPath}`);
            return;
        }

        // 读取文件内容
        const content = fs.readFileSync(fullPath, 'utf8');

        // 检查是否有 export default router
        if (!content.includes('export default router')) {
            console.log(`  ❌ 缺少 'export default router'`);
        } else {
            console.log(`  ✅ 导出正确`);
        }

        // 检查导入问题
        const hasAsyncHandler = content.includes('asyncHandler');
        const hasWrongImport = content.includes("from '../../../shared/errors/error.middleware'");

        if (hasAsyncHandler && hasWrongImport) {
            console.log(`  ❌ 错误的asyncHandler导入路径`);
        } else if (hasAsyncHandler) {
            console.log(`  ✅ asyncHandler导入正确`);
        }

        // 检查是否是函数
        if (content.includes('router.use(') && content.includes('=>')) {
            console.log(`  ⚠️ 使用了箭头函数，可能有问题`);
        }

    } catch (error) {
        console.log(`  ❌ 加载失败: ${error.message}`);
    }
});

// 特别检查admin路由
console.log('\n\n🔍 深入检查admin路由...');
const adminFiles = [
    'src/routes/v1/admin/auth.ts',
    'src/routes/v1/admin/config.ts',
    'src/routes/v1/admin/dashboard.ts',
    'src/routes/v1/admin/users.ts',
    'src/routes/v1/admin/products.ts',
    'src/routes/v1/admin/orders.ts'
];

adminFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`\n检查 ${file}...`);
        const content = fs.readFileSync(file, 'utf8');

        // 查找所有router.use调用
        const routerUses = content.match(/router\.use\([^)]+\)/g);
        if (routerUses) {
            console.log(`  找到 ${routerUses.length} 个router.use调用`);

            // 检查每个router.use的第二个参数
            routerUses.forEach((useCall, index) => {
                if (useCall.includes(',')) {
                    const parts = useCall.split(',');
                    if (parts.length > 1) {
                        const handler = parts[1].trim();
                        if (!handler.includes('(') && !handler.includes('=>') && !handler.includes('function')) {
                            console.log(`  ❌ 第${index + 1}个router.use可能有问题: ${handler}`);
                        }
                    }
                }
            });
        }
    }
});

console.log('\n✨ 诊断完成！');
console.log('\n💡 建议：');
console.log('1. 确保所有路由文件都有正确的导出');
console.log('2. 修复asyncHandler的导入路径');
console.log('3. 检查router.use的第二个参数是否为函数');