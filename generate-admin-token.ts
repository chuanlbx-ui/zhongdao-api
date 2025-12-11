import { config } from './src/config';
import jwt from 'jsonwebtoken';

// 确保环境已加载
import 'dotenv/config';

// 手动生成Token
const payload = {
  sub: 'cmi4nwm5j50010e15rbuagpog',  // 示例用户ID
  scope: ['active', 'user'],
  role: 'ADMIN',  // 设置为ADMIN角色
  level: 'DIRECTOR',  // 设置等级
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24小时
  jti: Math.random().toString(36).substring(2) + Date.now().toString(36)
};

const adminToken = jwt.sign(payload, config.jwt.secret, {
  algorithm: 'HS256'
});

console.log('ADMIN Token:');
console.log(adminToken);

// 验证Token内容
const decoded = Buffer.from(adminToken.split('.')[1], 'base64url').toString();
console.log('\nDecoded Token:');
console.log(JSON.parse(decoded));