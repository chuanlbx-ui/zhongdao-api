#!/usr/bin/env node

// 诊断启动错误

const fs = require('fs');
const path = require('path');

console.log('🔍 诊断服务器启动错误...\n');

// 1. 检查主路由文件
console.log('1️⃣ 检查主路由文件...');
const mainRoutePath = 'src/routes/v1/index.ts';
const mainRouteContent = fs.readFileSync(mainRoutePath, 'utf8');

// 提取所有import语句
const imports = mainRouteContent.match(/import.*from.*;/g) || [];
console.log(`   找到 ${imports.length} 个导入语句`);

// 检查每个导入
imports.forEach(imp => {
    if (imp.includes('Routes')) {
        console.log(`   ${imp}`);
        const routeName = imp.match(/import\s+(\w+)Routes/);
        if (routeName) {
            console.log(`     -> 变量名: ${routeName[1]}`);
        }
    }
});

// 2. 检查具体的问题路由
console.log('\n2️⃣ 检查问题路由...');

// 检查commission路由
const commissionIndexPath = 'src/routes/v1/commission/index.ts';
if (fs.existsSync(commissionIndexPath)) {
    const content = fs.readFileSync(commissionIndexPath, 'utf8');

    // 检查是否有router.use调用但没有正确的处理函数
    const routerUses = content.match(/router\.use\(.+\);/g) || [];
    console.log(`\n   commission路由中有 ${routerUses.length} 个router.use调用`);

    // 查找可能的中间件导入问题
    if (content.includes("from '../../../shared/middleware/error'")) {
        console.log('   ❌ 发现错误的中间件导入路径');
        console.log('      应该是: from \'../../../shared/errors/error.middleware\'');
    }

    // 检查controller导入
    if (content.includes('from \'./controller\'')) {
        console.log('   ✅ controller导入正确');
    }
}

// 3. 尝试加载模块
console.log('\n3️⃣ 尝试加载问题模块...');

try {
    // 清除require缓存
    delete require.cache[path.resolve('src/routes/v1/commission/index.ts')];

    // 尝试动态导入
    const commissionRoutes = require('./src/routes/v1/commission/index.ts');
    console.log('   ✅ commission路由加载成功');
    console.log(`   类型: ${typeof commissionRoutes}`);
} catch (error) {
    console.log(`   ❌ commission路由加载失败:`);
    console.log(`      ${error.message}`);
}

// 4. 建议修复方案
console.log('\n4️⃣ 修复建议:');
console.log('   1. 检查所有路由文件的导出是否正确');
console.log('   2. 确保中间件导入路径正确');
console.log('   3. 查看具体的错误堆栈信息');

// 5. 创建简化的测试路由
console.log('\n5️⃣ 创建测试路由文件...');
const testRouteContent = `import { Router } from 'express';

const router = Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Test route works' });
});

export default router;
`;

// 写入测试文件
fs.writeFileSync('src/routes/v1/commission/index-test.ts', testRouteContent);
console.log('   ✅ 创建了测试路由: src/routes/v1/commission/index-test.ts');

console.log('\n✨ 诊断完成！');