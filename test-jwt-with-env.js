// 加载环境变量
require('dotenv').config({ path: '.env.test' });

const jwt = require('jsonwebtoken');

// 从环境变量读取JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

console.log('🔍 JWT Token 验证测试（带环境变量）');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT Secret:', JWT_SECRET);
console.log('JWT Secret长度:', JWT_SECRET?.length || 'undefined');

// 测试token
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjcmhvOWUyaHJwNTB4cWtoMnh1bTlyYnAiLCJwaG9uZSI6IjEzODAwMTM4MDAxIiwicm9sZSI6Ik5PUk1BTCIsImxldmVsIjoiTk9STUFMIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzY1MTEwNzc1LCJleHAiOjE3NjUxOTcxNzUsImF1ZCI6Inpob25nZGFvLW1hbGwtdXNlcnMiLCJpc3MiOiJ6aG9uZ2Rhby1tYWxsLXRlc3QifQ.lRWkGLBaF2ASOVs5h6_HwHgdoC7-I-1D4pQC6PjiJsg';

console.log('\n📋 测试Token信息:');
console.log('Token:', testToken.substring(0, 50) + '...');

try {
  // 解码token（不验证）
  const decoded = jwt.decode(testToken, { complete: true });
  console.log('\n✅ Token解码成功:');
  console.log('Header:', decoded.header);
  console.log('Payload用户ID:', decoded.payload.sub);
  console.log('Payload过期时间:', new Date(decoded.payload.exp * 1000).toISOString());
  console.log('当前时间:', new Date().toISOString());
  console.log('是否过期:', Date.now() > decoded.payload.exp * 1000);

  // 验证token
  console.log('\n🔐 开始验证Token...');
  console.log('使用的Secret:', JWT_SECRET ? JWT_SECRET.substring(0, 20) + '...' : 'undefined');

  const verified = jwt.verify(testToken, JWT_SECRET, { algorithms: ['HS256'] });
  console.log('✅ Token验证成功!');
  console.log('验证后用户ID:', verified.sub);
  console.log('验证后用户角色:', verified.role);
  console.log('验证后用户级别:', verified.level);

  // 验证管理员token
  console.log('\n🔐 验证管理员Token...');
  const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTExMDc3NSwiZXhwIjoxNzY1MTk3MTc1LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.i5LhJY0jFzTO6fu_vu_3-3h38Cmf19nN1vjOqC08JHI';

  const verifiedAdmin = jwt.verify(adminToken, JWT_SECRET, { algorithms: ['HS256'] });
  console.log('✅ 管理员Token验证成功!');
  console.log('验证后管理员ID:', verifiedAdmin.sub);
  console.log('验证后管理员角色:', verifiedAdmin.role);
  console.log('验证后管理员级别:', verifiedAdmin.level);

} catch (error) {
  console.log('❌ Token验证失败:');
  console.log('错误名称:', error.name);
  console.log('错误消息:', error.message);

  if (error.name === 'JsonWebTokenError') {
    console.log('\n🔍 可能的原因:');
    console.log('1. JWT Secret不匹配');
    console.log('2. Token被篡改');
    console.log('3. 算法不匹配');
    console.log('4. 环境变量未正确加载');
  } else if (error.name === 'TokenExpiredError') {
    console.log('\n🔍 Token已过期');
  }
}