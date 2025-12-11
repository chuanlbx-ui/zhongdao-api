const jwt = require('jsonwebtoken');

const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

// 生成管理员token
const adminPayload = {
  sub: 'cmi4admin001',
  scope: ['active', 'user'],
  role: 'ADMIN',
  level: 'DIRECTOR',
  openid: 'admin_openid_12345',
  nickname: '测试管理员',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时
};

const adminToken = jwt.sign(adminPayload, JWT_SECRET, {
  issuer: 'zhongdao-mall-test',
  audience: 'zhongdao-mall-users'
});

console.log('管理员Token:');
console.log(adminToken);

// 验证token
try {
  const decoded = jwt.verify(adminToken, JWT_SECRET);
  console.log('\nToken验证成功:');
  console.log(decoded);
} catch (error) {
  console.error('\nToken验证失败:', error.message);
}