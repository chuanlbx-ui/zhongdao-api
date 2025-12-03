// 测试数据库连接和获取实际数据
const axios = require('axios');

async function testDatabaseConnection(apiUrl) {
    try {
        console.log(`\n测试 ${apiUrl}`);
        console.log('='.repeat(50));

        // 1. 检查健康状态
        const health = await axios.get(`${apiUrl}/health/database`, { timeout: 5000 });
        console.log('✓ API服务正常运行');
        console.log(`数据库连接: ${health.data.data.database}`);
        console.log(`数据库状态: ${health.data.data.status}`);

        // 2. 尝试获取实际数据（非模拟数据）
        const usersResponse = await axios.get(`${apiUrl}/api/v1/users?page=1&perPage=1`, { timeout: 5000 });
        if (usersResponse.data.success && usersResponse.data.data.total > 0) {
            console.log('✓ 数据库中有真实用户数据');
            console.log(`用户总数: ${usersResponse.data.data.total}`);
        } else {
            console.log('⚠ 数据库中无用户数据或数据为空');
        }

        // 3. 检查系统配置（如果有真实数据库连接）
        try {
            const configResponse = await axios.get(`${apiUrl}/api/v1/system/config-list`, { timeout: 5000 });
            if (configResponse.data.success) {
                console.log('✓ 成功获取系统配置');
                console.log(`配置数量: ${configResponse.data.data.length || 0}`);
            }
        } catch (e) {
            console.log('⚠ 无法获取系统配置（可能是权限问题或路由不存在）');
        }

        // 4. 检查端口和服务类型
        const healthFull = await axios.get(`${apiUrl}/health`, { timeout: 5000 });
        console.log(`环境类型: ${healthFull.data.data.environment}`);
        console.log(`服务端口: ${healthFull.data.data.port}`);

        return true;
    } catch (error) {
        console.log(`✗ 连接失败: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('数据库连接验证工具');
    console.log('='.repeat(60));

    // 测试列表
    const testUrls = [
        { name: '本地开发环境', url: 'http://localhost:3000' },
        { name: '本地生产模式', url: 'http://localhost:3003' },
        { name: '生产服务器', url: 'https://zd-api.aierxin.com' }
    ];

    for (const test of testUrls) {
        await testDatabaseConnection(test.url);
        console.log('\n' + '='.repeat(60) + '\n');
    }

    // 检查当前环境配置
    console.log('当前环境配置');
    console.log('='.repeat(50));

    try {
        const fs = require('fs');
        if (fs.existsSync('.env.local')) {
            const content = fs.readFileSync('.env.local', 'utf8');
            const nodeEnv = content.match(/NODE_ENV=(.+)/)?.[1] || 'undefined';
            const dbHost = content.match(/DB_HOST=(.+)/)?.[1] || 'undefined';
            const dbPort = content.match(/DB_PORT=(.+)/)?.[1] || 'undefined';
            const dbName = content.match(/DB_NAME=(.+)/)?.[1] || 'undefined';

            console.log(`NODE_ENV: ${nodeEnv}`);
            console.log(`数据库地址: ${dbHost}:${dbPort}`);
            console.log(`数据库名: ${dbName}`);
        } else {
            console.log('未找到 .env.local 文件');
        }
    } catch (e) {
        console.log(`读取配置失败: ${e.message}`);
    }
}

main().catch(console.error);