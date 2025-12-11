#!/usr/bin/env node

// 测试不需要认证的公共API端点

const http = require('http');

const publicEndpoints = [
    '/health',
    '/health/database',
    '/health/redis',
    '/health/security',
    '/api/v1/products',
    '/api/v1/products/categories',
    '/api/v1/products/tags',
    '/api/v1/shops',
    '/api/v1/levels',
    '/api/v1/levels/requirements'
];

async function testPublicAPIs() {
    console.log('🔍 测试公共API端点...\n');

    let successCount = 0;
    let failCount = 0;

    for (const path of publicEndpoints) {
        try {
            console.log(`测试: ${path}`);

            const res = await fetch(`http://localhost:3000${path}`);

            if (res.ok) {
                console.log(`  ✅ ${res.status} - OK`);
                successCount++;
            } else {
                console.log(`  ❌ ${res.status} - Failed`);
                failCount++;
            }
        } catch (error) {
            console.log(`  ❌ 错误: ${error.message}`);
            failCount++;
        }
    }

    console.log('\n📊 测试结果:');
    console.log(`  成功: ${successCount}`);
    console.log(`  失败: ${failCount}`);
    console.log(`  成功率: ${((successCount / publicEndpoints.length) * 100).toFixed(1)}%`);

    if (failCount === 0) {
        console.log('\n✨ 所有公共API端点正常工作！');
    } else {
        console.log('\n⚠️ 部分端点可能需要服务器运行');
    }
}

// 检查服务器是否运行
async function checkServer() {
    try {
        const res = await fetch('http://localhost:3000/health');
        return res.ok;
    } catch {
        return false;
    }
}

// 主函数
async function main() {
    const serverRunning = await checkServer();

    if (!serverRunning) {
        console.log('❌ 服务器未运行，请先启动服务器:');
        console.log('  npm run dev');
        console.log('\n或者使用内置的快速测试:');
        console.log('  npm run test:quick');
        return;
    }

    await testPublicAPIs();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testPublicAPIs };