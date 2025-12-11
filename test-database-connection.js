#!/usr/bin/env node

// 测试数据库连接

const { PrismaClient } = require('@prisma/client');

console.log('🔍 测试数据库连接...\n');

async function testConnection() {
    let prisma;

    try {
        // 创建Prisma客户端
        prisma = new PrismaClient({
            log: ['warn', 'error'],
            errorFormat: 'pretty'
        });

        console.log('📡 正在连接数据库...');

        // 测试简单查询
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ 数据库连接成功！');

        // 检查表是否存在
        console.log('\n📋 检查数据表...');

        try {
            const tables = await prisma.$queryRaw`SHOW TABLES`;
            console.log(`✅ 找到 ${tables.length} 个数据表`);

            // 显示前10个表
            tables.slice(0, 10).forEach(table => {
                const tableName = table.Tables_in_zhongdao_mall_dev || Object.values(table)[0];
                console.log(`   - ${tableName}`);
            });

            if (tables.length > 10) {
                console.log(`   ... 还有 ${tables.length - 10} 个表`);
            }
        } catch (e) {
            console.log('⚠️ 数据表可能尚未创建');
            console.log('   请运行: npm run db:push');
        }

        // 检查用户表
        console.log('\n👥 检查用户数据...');
        try {
            const userCount = await prisma.users.count();
            console.log(`✅ 用户表存在，共 ${userCount} 条记录`);
        } catch (e) {
            console.log('⚠️ 用户表不存在或无法访问');
        }

        console.log('\n✨ 数据库测试完成！');
        console.log('\n💡 下一步：');
        console.log('   1. 如果表不存在，运行: npm run db:push');
        console.log('   2. 如果需要初始数据，运行: npm run db:seed:minimal');
        console.log('   3. 启动服务器: npm run dev');

    } catch (error) {
        console.error('❌ 数据库连接失败：');
        console.error(`   ${error.message}`);

        if (error.code === 'P1001') {
            console.log('\n🔧 可能的解决方案：');
            console.log('   1. 确保MySQL服务已启动');
            console.log('   2. 检查.env文件中的数据库配置');
            console.log('   3. 确认数据库 "zhongdao_mall_dev" 已创建');
            console.log('   4. 验证用户名和密码是否正确');
        } else if (error.code === 'P1002') {
            console.log('\n🔧 数据库不存在：');
            console.log('   1. 登录MySQL: mysql -u root -p');
            console.log('   2. 创建数据库: CREATE DATABASE zhongdao_mall_dev;');
            console.log('   3. 创建用户: CREATE USER "dev_user"@"localhost" IDENTIFIED BY "dev_password_123";');
            console.log('   4. 授权: GRANT ALL ON zhongdao_mall_dev.* TO "dev_user"@"localhost";');
        }

        process.exit(1);
    } finally {
        if (prisma) {
            await prisma.$disconnect();
        }
    }
}

// 运行测试
testConnection().catch(console.error);