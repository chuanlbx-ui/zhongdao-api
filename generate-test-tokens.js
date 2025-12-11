#!/usr/bin/env node

const jwt = require('jsonwebtoken');

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-development-only';
const JWT_EXPIRES_IN = '24h';

// 测试用户数据
const testUsers = {
    admin: {
        userId: 'aiwlm3azfr6ryc2mx64mqo6b',
        phone: '13800000001',
        role: 'ADMIN',
        level: 'DIRECTOR',
        nickname: '系统管理员',
        email: 'admin@zhongdao.com'
    },
    director: {
        userId: 'dir_1234567890',
        phone: '13800000002',
        role: 'USER',
        level: 'DIRECTOR',
        nickname: '总监',
        email: 'director@zhongdao.com'
    },
    star5: {
        userId: 'star5_1234567890',
        phone: '13800000003',
        role: 'USER',
        level: 'STAR_5',
        nickname: '五星店主',
        email: 'star5@zhongdao.com'
    },
    star3: {
        userId: 'star3_1234567890',
        phone: '13800000004',
        role: 'USER',
        level: 'STAR_3',
        nickname: '三星店主',
        email: 'star3@zhongdao.com'
    },
    vip: {
        userId: 'vip_1234567890',
        phone: '13800000005',
        role: 'USER',
        level: 'VIP',
        nickname: 'VIP用户',
        email: 'vip@zhongdao.com'
    },
    normal: {
        userId: 'user_1234567890',
        phone: '13800000006',
        role: 'USER',
        level: 'NORMAL',
        nickname: '普通用户',
        email: 'user@zhongdao.com'
    }
};

// 生成JWT Token
function generateToken(user) {
    const payload = {
        sub: user.userId,
        phone: user.phone,
        role: user.role,
        level: user.level,
        nickname: user.nickname,
        scope: ['active', 'user']
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'zhongdao-mall',
        audience: 'zhongdao-mall-users',
        jwtid: generateId()
    });
}

// 生成随机ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
}

// 验证Token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error('Token验证失败:', error.message);
        return null;
    }
}

// 主函数
async function generateTestTokens() {
    console.log('🔑 生成测试Token...\n');

    const tokens = {};

    // 为每个角色生成Token
    for (const [role, user] of Object.entries(testUsers)) {
        const token = generateToken(user);
        const decoded = verifyToken(token);

        tokens[role] = {
            token,
            user: {
                id: user.userId,
                phone: user.phone,
                role: user.role,
                level: user.level,
                nickname: user.nickname
            },
            expiresAt: new Date(decoded.exp * 1000).toISOString()
        };

        console.log(`✅ ${role}级用户 Token已生成`);
        console.log(`   用户: ${user.nickname} (${user.phone})`);
        console.log(`   级别: ${user.level}`);
        console.log(`   到期: ${tokens[role].expiresAt}\n`);
    }

    // 保存Token到文件
    const tokenData = {
        generatedAt: new Date().toISOString(),
        secret: JWT_SECRET,
        tokens
    };

    require('fs').writeFileSync(
        'test-tokens.json',
        JSON.stringify(tokenData, null, 2)
    );

    console.log('💾 Token已保存到: test-tokens.json');

    // 生成cURL命令示例
    console.log('\n📝 cURL命令示例:\n');
    console.log(`# 管理员获取仪表板数据`);
    console.log(`curl -X GET http://localhost:3000/api/v1/admin/dashboard \\`);
    console.log(`  -H "Authorization: Bearer ${tokens.admin.token}" \\`);
    console.log(`  -H "Content-Type: application/json"\n`);

    console.log(`# 普通用户获取积分余额`);
    console.log(`curl -X GET http://localhost:3000/api/v1/points/balance \\`);
    console.log(`  -H "Authorization: Bearer ${tokens.normal.token}" \\`);
    console.log(`  -H "Content-Type: application/json"\n`);

    // 生成环境变量文件
    console.log('\n📄 环境变量文件内容:\n');
    console.log('# 测试Token - 添加到 .env.test 文件');
    for (const [role, data] of Object.entries(tokens)) {
        console.log(`TEST_TOKEN_${role.toUpperCase()}=${data.token}`);
    }

    return tokenData;
}

// 验证现有Token
function validateExistingToken(token) {
    const decoded = verifyToken(token);
    if (!decoded) return false;

    console.log('✅ Token有效');
    console.log(`   用户ID: ${decoded.sub}`);
    console.log(`   角色: ${decoded.role}`);
    console.log(`   级别: ${decoded.level}`);
    console.log(`   到期时间: ${new Date(decoded.exp * 1000).toISOString()}`);
    console.log(`   剩余时间: ${Math.floor((decoded.exp - Date.now() / 1000) / 60)} 分钟`);

    return true;
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

if (command === 'validate' && args[1]) {
    console.log('🔍 验证Token...\n');
    validateExistingToken(args[1]);
} else {
    generateTestTokens()
        .then(() => {
            console.log('\n✨ Token生成完成！');
        })
        .catch(console.error);
}

module.exports = {
    generateTestTokens,
    validateExistingToken,
    generateToken,
    testUsers
};