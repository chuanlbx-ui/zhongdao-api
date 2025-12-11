const jwt = require('jsonwebtoken');

// 直接从环境变量读取JWT secret
const JWT_SECRET = process.env.JWT_SECRET || '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

console.log('🔍 JWT Token 验证测试');
console.log('JWT Secret:', JWT_SECRET);
console.log('JWT Secret长度:', JWT_SECRET.length);

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
  const verified = jwt.verify(testToken, JWT_SECRET, { algorithms: ['HS256'] });
  console.log('✅ Token验证成功!');
  console.log('验证后用户ID:', verified.sub);
  console.log('验证后用户角色:', verified.role);
  console.log('验证后用户级别:', verified.level);

} catch (error) {
  console.log('❌ Token验证失败:');
  console.log('错误名称:', error.name);
  console.log('错误消息:', error.message);

  if (error.name === 'JsonWebTokenError') {
    console.log('\n🔍 可能的原因:');
    console.log('1. JWT Secret不匹配');
    console.log('2. Token被篡改');
    console.log('3. 算法不匹配');
  } else if (error.name === 'TokenExpiredError') {
    console.log('\n🔍 Token已过期');
  }
}

console.log('\n📊 环境变量检查:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);