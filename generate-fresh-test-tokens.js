#!/usr/bin/env node

/**
 * 生成新的测试token
 */

const jwt = require('jsonwebtoken');

// JWT密钥 - 与环境变量中的保持一致
const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

console.log('生成测试Token...\n');

// 生成token函数
function generateToken(userId, phone, role, level) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (7 * 24 * 60 * 60); // 7天有效期

  return jwt.sign({
    sub: userId,
    phone: phone,
    role: role,
    level: level,
    scope: ['active', 'user'],
    type: 'access',
    iat: now,
    exp: exp,
    aud: 'zhongdao-mall-users',
    iss: 'zhongdao-mall-test'
  }, JWT_SECRET);
}

// 检查token是否有效
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token 验证成功:');
    console.log('- 用户ID:', decoded.sub);
    console.log('- 手机号:', decoded.phone);
    console.log('- 角色:', decoded.role);
    console.log('- 等级:', decoded.level);
    console.log('- 过期时间:', new Date(decoded.exp * 1000).toISOString());
    console.log('- 有效期剩余:', Math.floor((decoded.exp - Math.floor(Date.now() / 1000)) / 3600), '小时');
    return decoded;
  } catch (error) {
    console.error('Token 验证失败:', error.message);
    return null;
  }
}

// 生成测试token
const tokens = {
  // 普通用户
  normal: generateToken(
    'crho9e2hrp50xqkx2um9rbp',
    '13800138001',
    'USER',
    'NORMAL'
  ),

  // VIP用户
  vip: generateToken(
    'crho9e2hrp50xqkx2um9rcp',
    '13800138002',
    'USER',
    'VIP'
  ),

  // 一星店长
  star1: generateToken(
    'crho9e2hrp50xqkx2um9rdp',
    '13800138003',
    'USER',
    'STAR_1'
  ),

  // 三星店长
  star3: generateToken(
    'crho9e2hrp50xqkx2um9rfp',
    '13800138005',
    'USER',
    'STAR_3'
  ),

  // 五星店长
  star5: generateToken(
    'crho9e2hrp50xqkx2um9rhp',
    '13800138007',
    'USER',
    'STAR_5'
  ),

  // 董事/管理员
  director: generateToken(
    'ja4x4705a4emvkga2e73e5ne',
    '13800138888',
    'ADMIN',
    'DIRECTOR'
  )
};

// 输出tokens
console.log('=== 生成的测试Token ===\n');

Object.entries(tokens).forEach(([type, token]) => {
  console.log(`${type.toUpperCase()} Token:`);
  console.log(`Authorization: Bearer ${token}\n`);

  // 验证token
  const decoded = verifyToken(token);
  if (decoded) {
    console.log('---');
  }
});

// 生成更新测试文件的建议
console.log('\n=== 更新测试文件的建议 ===');
console.log('请将以下token替换到测试文件中：\n');

console.log('products.test.ts 需要的token:');
console.log(`normalUserToken: '${tokens.normal}'`);
console.log(`adminToken: '${tokens.director}'\n`);

console.log('或者使用测试辅助工具中的动态生成方式：');
console.log('const { getAuthHeadersForUser } = require("../helpers/auth.helper");');
console.log('const headers = getAuthHeadersForUser("normal");\n');