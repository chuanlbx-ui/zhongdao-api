// 加载环境变量
require('dotenv').config({ path: '.env' });

const jwt = require('jsonwebtoken');

console.log('🔍 JWT Secret 诊断测试');
console.log('==========================');

console.log('\n📋 环境变量检查:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT_SECRET 存在:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET 长度:', process.env.JWT_SECRET?.length || 0);
console.log('JWT_SECRET (前20字符):', process.env.JWT_SECRET?.substring(0, 20) + '...');

// 测试token
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk4OTY0MywiZXhwIjoxNzY0OTkzMjQzLCJqdGkiOiJrMXM3YTB1eTQyOGFoajV6M3UifQ.puo93HiFqO5SHCoCw5TtoSKp2Nm4EBVcnxIjHtUSKks';

console.log('\n🧪 Token验证测试:');
console.log('测试Token:', testToken.substring(0, 50) + '...');

try {
  // 使用环境变量验证
  if (process.env.JWT_SECRET) {
    const verified = jwt.verify(testToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    console.log('✅ JWT验证成功!');
    console.log('验证后用户ID:', verified.sub);
    console.log('验证后用户角色:', verified.role);
    console.log('验证后用户级别:', verified.level);
    console.log('Token过期时间:', new Date(verified.exp * 1000).toISOString());
  } else {
    console.log('❌ JWT_SECRET为空');
  }
} catch (error) {
  console.log('❌ JWT验证失败:');
  console.log('错误名称:', error.name);
  console.log('错误消息:', error.message);
}

console.log('\n🎯 当前环境变量:');
console.log('JWT_SECRET =', process.env.JWT_SECRET || 'undefined');