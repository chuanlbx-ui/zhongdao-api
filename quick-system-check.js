#!/usr/bin/env node

// 快速系统检查脚本

const os = require('os');
const fs = require('fs');
const path = require('path');

console.log('🔍 中道商城系统快速检查\n');

// 1. 检查Node.js版本
const nodeVersion = process.version;
console.log(`✅ Node.js版本: ${nodeVersion}`);

// 2. 检查npm版本
try {
    const npmVersion = require('child_process').execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`✅ npm版本: ${npmVersion}`);
} catch (e) {
    console.log('❌ npm未安装');
}

// 3. 检查依赖是否安装
if (fs.existsSync('node_modules')) {
    console.log('✅ 依赖已安装');
} else {
    console.log('❌ 依赖未安装，请运行: npm install');
}

// 4. 检查环境变量文件
const envFiles = ['.env', '.env.development', '.env.local'];
envFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ 找到环境文件: ${file}`);
    } else {
        console.log(`⚠️ 缺少环境文件: ${file}`);
    }
});

// 5. 检查数据库配置
try {
    if (fs.existsSync('.env')) {
        const envContent = fs.readFileSync('.env', 'utf8');
        if (envContent.includes('DATABASE_URL')) {
            console.log('✅ 数据库配置已找到');

            // 提取数据库信息
            const dbUrlMatch = envContent.match(/DATABASE_URL=([^\\n]+)/);
            if (dbUrlMatch) {
                const dbUrl = new URL(dbUrlMatch[1]);
                console.log(`   - 主机: ${dbUrl.hostname}`);
                console.log(`   - 端口: ${dbUrl.port}`);
                console.log(`   - 数据库: ${dbUrl.pathname.substring(1)}`);
            }
        } else {
            console.log('❌ 未找到DATABASE_URL配置');
        }
    }
} catch (e) {
    console.log('❌ 无法读取环境配置');
}

// 6. 检查Prisma配置
if (fs.existsSync('prisma/schema.prisma')) {
    console.log('✅ Prisma配置文件存在');
} else {
    console.log('❌ 未找到Prisma配置文件');
}

// 7. 检查端口占用
const port = 3000;
console.log(`\n📡 检查端口 ${port}...`);

// 8. 系统资源信息
console.log('\n💻 系统信息:');
console.log(`   - 系统: ${os.type()} ${os.release()}`);
console.log(`   - 架构: ${os.arch()}`);
console.log(`   - CPU: ${os.cpus().length} 核`);
console.log(`   - 内存: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`   - 可用内存: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`);

// 9. 快速启动建议
console.log('\n🚀 快速启动建议:');
console.log('\n1. 如果MySQL未运行，请先启动MySQL服务');
console.log('2. 创建数据库:');
console.log('   CREATE DATABASE zhongdao_mall_dev;');
console.log('\n3. 初始化项目:');
console.log('   npm install');
console.log('   npm run db:generate');
console.log('   npm run db:push');
console.log('   npm run db:seed:minimal');
console.log('\n4. 启动开发服务器:');
console.log('   npm run dev');
console.log('\n5. 访问应用:');
console.log('   - API服务: http://localhost:3000');
console.log('   - 健康检查: http://localhost:3000/health');
console.log('   - API文档: http://localhost:3000/api-docs');

// 10. 测试命令
console.log('\n🧪 测试命令:');
console.log('   node test-public-api.js');
console.log('   node generate-test-tokens.js');
console.log('   node test-all-api-endpoints.js');

console.log('\n✨ 检查完成！');