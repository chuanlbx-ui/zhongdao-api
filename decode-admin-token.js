const jwt = require('jsonwebtoken');

// 从测试输出复制的管理员token
const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYTd6eTczdTF2M3R5OHE0azVyeDR5NjkiLCJwaG9uZSI6IjE4ODAwMDAwMDEiLCJyb2xlIjoiQURNSUyIsImxldmVsIjoiRElSRUNUT1IiLCJzY29wZSI6WyJhY3RpdmUiLCJ1c2VyIl0sInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NjM0NzQzNDgsImV4cCI6MTc2NDA3OTE0OCwianRpIjoiMHd3amQ3cXZjZTVlbWk0bjNmcnoifQ.83U1WXxuJP-Xm7tshMXbRMaz0ERu9HS11SoVsoRBC_k';

// 测试环境JWT secret
const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

try {
  const decoded = jwt.verify(adminToken, JWT_SECRET, {
    issuer: 'zhongdao-mall-test',
    audience: 'zhongdao-mall-users'
  });

  console.log('=== 管理员Token解码信息 ===');
  console.log(decoded);
  console.log('用户ID:', decoded.sub);
  console.log('用户等级:', decoded.level);
  console.log('用户角色:', decoded.role);
  console.log('权限范围:', decoded.scope);
} catch (error) {
  console.error('Token解码失败:', error);
}