// 加载环境变量
require('dotenv').config({ path: '.env' });

const jwt = require('jsonwebtoken');

// 从环境变量读取JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

console.log('🔐 生成并测试新Token');
console.log('JWT Secret:', JWT_SECRET?.substring(0, 20) + '...');
console.log('JWT Secret长度:', JWT_SECRET?.length || 0);

// 用户数据（从数据库中查询到的正确用户ID）
const adminUser = {
  id: 'ja4x4705a4emvkga2e73e5ne', // 管理员
  phone: '13800138888',
  level: 'DIRECTOR',
  scope: ['active', 'user']
};

const now = Math.floor(Date.now() / 1000);
const tokenPayload = {
  sub: adminUser.id,
  phone: adminUser.phone,
  role: adminUser.level,
  level: adminUser.level,
  scope: adminUser.scope,
  type: 'access',
  iat: now,
  exp: now + (7 * 24 * 60 * 60), // 7天
  jti: Math.random().toString(36).substring(2) + Date.now().toString(36),
  aud: 'zhongdao-mall-users',
  iss: 'zhongdao-mall-test'
};

// 生成token
console.log('\n🚀 生成新token...');
const newToken = jwt.sign(tokenPayload, JWT_SECRET, { algorithm: 'HS256' });
console.log('新Token:', newToken);
console.log('Token用户ID:', tokenPayload.sub);

// 立即验证
console.log('\n🔍 立即验证...');
try {
  const verified = jwt.verify(newToken, JWT_SECRET, { algorithms: ['HS256'] });
  console.log('✅ 验证成功:', verified.sub);
  console.log('用户级别:', verified.level);
} catch (error) {
  console.log('❌ 验证失败:', error.message);
}

// 测试curl请求
console.log('\n🌐 测试curl请求...');
const curlCmd = `curl -s -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n" -H "Authorization: Bearer ${newToken}" "http://localhost:3000/api/v1/products/categories?page=1&perPage=10"`;
console.log('执行:', curlCmd);