const jwt = require('jsonwebtoken');

console.log('🔍 JWT认证问题诊断工具\n');

// 1. 检查环境变量
console.log('1. 检查JWT配置:');
const JWT_SECRET = process.env.JWT_SECRET || '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';
console.log(`   JWT_SECRET: ${JWT_SECRET ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`   JWT_SECRET长度: ${JWT_SECRET ? JWT_SECRET.length : 0}`);

// 2. 生成测试token
console.log('\n2. 生成测试token:');
try {
  const testPayload = {
    sub: 'test-user-id',
    phone: '18800000002',
    role: 'USER',
    level: 'NORMAL',
    scope: ['active', 'user'],
    type: 'access'
  };

  const token = jwt.sign(testPayload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'zhongdao-mall-test',
    audience: 'zhongdao-mall-users'
  });

  console.log(`   ✅ Token生成成功`);
  console.log(`   Token长度: ${token.length}`);
  console.log(`   Token前缀: ${token.substring(0, 50)}...`);

  // 3. 验证token
  console.log('\n3. 验证Token:');
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: 'zhongdao-mall-test',
    audience: 'zhongdao-mall-users'
  });

  console.log(`   ✅ Token验证成功`);
  console.log(`   用户ID: ${decoded.sub}`);
  console.log(`   角色: ${decoded.role}`);
  console.log(`   等级: ${decoded.level}`);

  // 4. 测试错误的token
  console.log('\n4. 测试错误Token:');
  try {
    jwt.verify('invalid.token.here', JWT_SECRET);
    console.log('   ❌ 错误Token验证通过（不应该发生）');
  } catch (error) {
    console.log(`   ✅ 错误Token被正确拒绝`);
    console.log(`   错误类型: ${error.name}`);
  }

  // 5. 测试token格式
  console.log('\n5. 测试认证头格式:');
  const authHeader = `Bearer ${token}`;
  console.log(`   认证头格式: ${authHeader.substring(0, 70)}...`);

  // 从Authorization头提取token
  const extractedToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (extractedToken === token) {
    console.log('   ✅ Token提取成功');
  } else {
    console.log('   ❌ Token提取失败');
  }

} catch (error) {
  console.error('   ❌ JWT操作失败:', error.message);
}

// 6. 检查常见的认证中间件问题
console.log('\n6. 常见问题检查:');

console.log('   中间件问题清单:');
console.log('   - [ ] 检查auth中间件是否正确挂载');
console.log('   - [ ] 检查token验证逻辑是否正确');
console.log('   - [ ] 检查环境变量JWT_SECRET是否正确加载');
console.log('   - [ ] 检查token过期时间设置');
console.log('   - [ ] 检查issuer和audience验证');

// 7. 生成测试用的认证头
console.log('\n7. 测试用认证头:');
const testTokens = {
  normalUser: null,
  vipUser: null,
  starUser: null,
  adminUser: null
};

try {
  // 生成不同类型的测试token
  const users = [
    { sub: 'normal-user-id', role: 'USER', level: 'NORMAL', type: 'normalUser' },
    { sub: 'vip-user-id', role: 'USER', level: 'VIP', type: 'vipUser' },
    { sub: 'star-user-id', role: 'USER', level: 'STAR_3', type: 'starUser' },
    { sub: 'admin-user-id', role: 'ADMIN', level: 'DIRECTOR', type: 'adminUser' }
  ];

  users.forEach(user => {
    const token = jwt.sign({
      sub: user.sub,
      phone: '18800000002',
      role: user.role,
      level: user.level,
      scope: ['active', 'user'],
      type: 'access'
    }, JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'zhongdao-mall-test',
      audience: 'zhongdao-mall-users'
    });

    testTokens[user.type] = token;
    console.log(`   ${user.type}: Bearer ${token.substring(0, 50)}...`);
  });

  // 保存测试tokens到文件
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, 'test-tokens.json'),
    JSON.stringify(testTokens, null, 2)
  );
  console.log('\n   ✅ 测试tokens已保存到 test-tokens.json');

} catch (error) {
  console.error('   ❌ 生成测试tokens失败:', error.message);
}

console.log('\n✅ JWT诊断完成');