// 测试JWT功能是否正常
import './src/init-env';  // 必须最先导入！
import { config } from './src/config';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken } from './src/shared/middleware/auth';

console.log('=== JWT 功能测试 ===\n');

// 1. 测试auth.ts中的generateToken和verifyToken
console.log('1. 测试auth.ts中的Token生成和验证:');
try {
  const payload = {
    sub: 'test-user-id-123',
    scope: ['active', 'user'],
    role: 'USER',
    level: 'NORMAL'
  };

  // 生成token
  const token = generateToken(payload);
  console.log('   ✓ Token生成成功');
  console.log('   Token长度:', token.length);

  // 验证token
  const decoded = verifyToken(token);
  console.log('   ✓ Token验证成功');
  console.log('   解码后的用户ID:', decoded.sub);
  console.log('   解码后的角色:', decoded.role);
  console.log('   解码后的等级:', decoded.level);

  // 测试过期token
  console.log('\n2. 测试token过期处理:');
  const expiredPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) - 3600 // 1小时前过期
  };

  const expiredToken = jwt.sign(expiredPayload, config.jwt.secret, {
    algorithm: 'HS256'
  });

  try {
    verifyToken(expiredToken);
    console.log('   ✗ 过期Token验证通过（应该失败）');
  } catch (error) {
    console.log('   ✓ 过期Token验证失败（预期行为）:', error.message);
  }

  // 测试错误签名
  console.log('\n3. 测试错误签名处理:');
  const wrongSecretToken = jwt.sign(payload, 'wrong-secret', {
    algorithm: 'HS256'
  });

  try {
    verifyToken(wrongSecretToken);
    console.log('   ✗ 错误签名Token验证通过（应该失败）');
  } catch (error) {
    console.log('   ✓ 错误签名Token验证失败（预期行为）:', error.message);
  }

  // 测试不同用户级别
  console.log('\n4. 测试不同用户级别的Token:');
  const userLevels = ['NORMAL', 'VIP', 'STAR_1', 'STAR_3', 'STAR_5', 'DIRECTOR'];

  for (const level of userLevels) {
    const levelPayload = {
      sub: `user-${level.toLowerCase()}-id`,
      scope: ['active', 'user'],
      role: level === 'DIRECTOR' ? 'ADMIN' : 'USER',
      level
    };

    const levelToken = generateToken(levelPayload);
    const decodedLevel = verifyToken(levelToken);

    console.log(`   ✓ ${level} 级别用户Token: 角色=${decodedLevel.role}, 等级=${decodedLevel.level}`);
  }

} catch (error) {
  console.error('   ✗ 测试失败:', error.message);
  console.error('   错误堆栈:', error.stack);
}

console.log('\n=== 测试完成 ===');

// 生成一些示例token供使用
console.log('\n=== 示例Token ===');
try {
  const adminToken = generateToken({
    sub: 'admin-123',
    scope: ['active', 'admin'],
    role: 'ADMIN',
    level: 'DIRECTOR'
  });
  console.log('\n管理员Token:');
  console.log(adminToken);

  const userToken = generateToken({
    sub: 'user-456',
    scope: ['active', 'user'],
    role: 'USER',
    level: 'VIP'
  });
  console.log('\nVIP用户Token:');
  console.log(userToken);

  const starManagerToken = generateToken({
    sub: 'star-manager-789',
    scope: ['active', 'user', 'manager'],
    role: 'USER',
    level: 'STAR_3'
  });
  console.log('\n3星级店长Token:');
  console.log(starManagerToken);
} catch (error) {
  console.error('生成示例Token失败:', error.message);
}