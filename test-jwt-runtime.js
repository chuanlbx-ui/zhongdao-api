// 加载环境变量
require('dotenv').config({ path: '.env' });

const jwt = require('jsonwebtoken');

// 从config模块读取JWT secret（运行时）
const { config } = require('./src/config/index');

console.log('🔍 JWT Secret 诊断测试');
console.log('==========================');

console.log('\n📋 环境变量检查:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT_SECRET 存在:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET 长度:', process.env.JWT_SECRET?.length || 0);
console.log('JWT_SECRET (前20字符):', process.env.JWT_SECRET?.substring(0, 20) + '...');

console.log('\n📋 Config模块检查:');
console.log('config.jwt.secret 存在:', !!config.jwt.secret);
console.log('config.jwt.secret 长度:', config.jwt.secret?.length || 0);
console.log('config.jwt.secret (前20字符):', config.jwt.secret?.substring(0, 20) + '...');

console.log('\n🔐 JWT Secret 对比:');
console.log('环境变量 === config.jwt.secret:', process.env.JWT_SECRET === config.jwt.secret);

// 测试token
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk4OTY0MywiZXhwIjoxNzY0OTkzMjQzLCJqdGkiOiJrMXM3YTB1eTQyOGFoajV6M3UifQ.puo93HiFqO5SHCoCw5TtoSKp2Nm4EBVcnxIjHtUSKks';

console.log('\n🧪 Token验证测试:');
console.log('测试Token:', testToken.substring(0, 50) + '...');

try {
  // 使用环境变量验证
  if (process.env.JWT_SECRET) {
    const verified1 = jwt.verify(testToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    console.log('✅ 环境变量验证成功:', verified1.sub);
  } else {
    console.log('❌ 环境变量JWT_SECRET为空');
  }
} catch (error) {
  console.log('❌ 环境变量验证失败:', error.message);
}

try {
  // 使用config模块验证
  if (config.jwt.secret) {
    const verified2 = jwt.verify(testToken, config.jwt.secret, { algorithms: ['HS256'] });
    console.log('✅ config.jwt.secret验证成功:', verified2.sub);
  } else {
    console.log('❌ config.jwt.secret为空');
  }
} catch (error) {
  console.log('❌ config.jwt.secret验证失败:', error.message);
}

console.log('\n🎯 建议解决方案:');
if (process.env.JWT_SECRET !== config.jwt.secret) {
  console.log('❌ 环境变量和config模块不一致！');
  console.log('建议：检查dotenv加载顺序和环境变量设置');
} else if (!process.env.JWT_SECRET) {
  console.log('❌ JWT_SECRET未设置！');
  console.log('建议：检查.env文件是否正确加载');
} else {
  console.log('✅ JWT secret设置正确，问题可能在别处');
  console.log('建议：检查用户ID是否存在于数据库中');
}