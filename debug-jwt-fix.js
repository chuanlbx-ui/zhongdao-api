const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.development' });

// 从环境变量获取JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

console.log('=== JWT 调试信息 ===');
console.log('JWT_SECRET:', JWT_SECRET ? `${JWT_SECRET.substring(0, 10)}...` : 'undefined');
console.log('JWT_EXPIRES_IN:', JWT_EXPIRES_IN);
console.log('');

// 测试用户数据
const testUser = {
  sub: 'admin-test-id',
  role: 'ADMIN',
  level: 'DIRECTOR',
  scope: ['active', 'admin']
};

console.log('=== 测试用户数据 ===');
console.log(JSON.stringify(testUser, null, 2));
console.log('');

// 生成token
try {
  console.log('=== 生成 Token ===');
  const token = jwt.sign(testUser, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: 'zhongdao-mall',
    audience: 'zhongdao-users'
  });

  console.log('Token生成成功!');
  console.log('Token长度:', token.length);
  console.log('Token前50字符:', token.substring(0, 50) + '...');
  console.log('');

  // 验证token
  console.log('=== 验证 Token ===');
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'zhongdao-mall',
    audience: 'zhongdao-users'
  });

  console.log('Token验证成功!');
  console.log('解码后的用户数据:', JSON.stringify(decoded, null, 2));
  console.log('');

  // 测试不同的secret
  console.log('=== 测试错误的 Secret ===');
  try {
    jwt.verify(token, 'wrong-secret', { algorithms: ['HS256'] });
  } catch (error) {
    console.log('预期的错误（使用错误的secret）:', error.message);
  }
  console.log('');

  // 输出完整的token用于测试
  console.log('=== 完整的测试 Token ===');
  console.log(token);
  console.log('');

  // 生成普通用户token
  console.log('=== 生成普通用户 Token ===');
  const normalUser = {
    sub: 'user-test-id',
    role: 'USER',
    level: 'NORMAL',
    scope: ['active']
  };

  const userToken = jwt.sign(normalUser, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: 'zhongdao-mall',
    audience: 'zhongdao-users'
  });

  console.log('普通用户Token:');
  console.log(userToken);

} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error('详细错误:', error);
}