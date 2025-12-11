// 测试认证Token生成器
const jwt = require('jsonwebtoken');

const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

function createToken(role, level) {
  return jwt.sign({
    sub: 'test-user-' + Date.now(),
    phone: '18800000002',
    role: role,
    level: level,
    scope: ['active', 'user'],
    type: 'access'
  }, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'zhongdao-mall-test',
    audience: 'zhongdao-mall-users'
  });
}

// 生成各种测试token
const tokens = {
  normal: createToken('USER', 'NORMAL'),
  vip: createToken('USER', 'VIP'),
  star1: createToken('USER', 'STAR_1'),
  star3: createToken('USER', 'STAR_3'),
  star5: createToken('USER', 'STAR_5'),
  director: createToken('ADMIN', 'DIRECTOR')
};

console.log('测试Token:');
Object.entries(tokens).forEach(([type, token]) => {
  console.log(`\n${type}:`);
  console.log(`Authorization: Bearer ${token}`);
});
