// 直接测试JWT验证
require('dotenv').config({ path: '.env' });

const jwt = require('jsonwebtoken');

console.log('🔍 直接JWT验证测试');
console.log('===================');

// 读取JWT secrets
console.log('\n📋 环境变量:');
const envSecret = process.env.JWT_SECRET;
console.log('JWT_SECRET (env):', envSecret ? envSecret.substring(0, 20) + '...' : 'undefined');

// 测试token
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTExMzAwMSwiZXhwIjoxNzY1NzE3ODAxLCJqdGkiOiJqbm5lNHc3bW5tbWl2cXBnZDciLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.YQ7Pw2zAj6SezB7n-0YsR4wB53e0j5debSK1P5yoUeU';

console.log('\n🧪 Token验证测试:');
console.log('Token:', testToken.substring(0, 50) + '...');

// 使用环境变量验证
console.log('\n1️⃣ 使用环境变量验证:');
try {
  const verified1 = jwt.verify(testToken, envSecret, { algorithms: ['HS256'] });
  console.log('✅ 环境变量验证成功');
  console.log('用户ID:', verified1.sub);
  console.log('角色:', verified1.role);
  console.log('级别:', verified1.level);
  console.log('scope:', verified1.scope);
  console.log('过期时间:', new Date(verified1.exp * 1000).toISOString());
} catch (error) {
  console.log('❌ 环境变量验证失败:', error.message);
  console.log('错误名称:', error.name);
}