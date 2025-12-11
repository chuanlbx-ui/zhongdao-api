import './src/init-env';  // 必须最先导入！
import { config } from './src/config';
import jwt from 'jsonwebtoken';

console.log('=== JWT 认证诊断报告 ===\n');

// 1. 检查环境变量
console.log('1. 环境变量检查:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   JWT_SECRET存在:', !!process.env.JWT_SECRET);
console.log('   JWT_SECRET长度:', process.env.JWT_SECRET?.length || 0);
console.log('   JWT_SECRET前10位:', process.env.JWT_SECRET?.substring(0, 10) + '...');

// 2. 检查config对象
console.log('\n2. Config对象检查:');
console.log('   config.jwt.secret存在:', !!config.jwt.secret);
console.log('   config.jwt.secret长度:', config.jwt.secret?.length || 0);
console.log('   config.jwt.secret前10位:', config.jwt.secret?.substring(0, 10) + '...');

// 3. 测试token生成
console.log('\n3. Token生成测试:');
const testPayload = {
  sub: 'test-user-id',
  scope: ['active', 'user'],
  role: 'USER',
  level: 'NORMAL'
};

try {
  // 使用config.jwt.secret生成token
  const token1 = jwt.sign(testPayload, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: '1h'
  });
  console.log('   ✓ 使用config.jwt.secret生成token成功');
  console.log('   Token长度:', token1.length);

  // 验证token
  const decoded1 = jwt.verify(token1, config.jwt.secret, { algorithms: ['HS256'] });
  console.log('   ✓ 使用config.jwt.secret验证token成功');

  // 测试使用process.env.JWT_SECRET验证
  const decoded2 = jwt.verify(token1, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  console.log('   ✓ 使用process.env.JWT_SECRET验证token成功');

  // 检查两个密钥是否相同
  console.log('   两个密钥是否相同:', config.jwt.secret === process.env.JWT_SECRET);

} catch (error) {
  console.log('   ✗ Token生成/验证失败:', error.message);
}

// 4. 测试不同的密钥场景
console.log('\n4. 密钥一致性测试:');

// 使用不同的密钥生成token
const wrongSecret = 'wrong-secret-key';
try {
  const token2 = jwt.sign(testPayload, wrongSecret, {
    algorithm: 'HS256',
    expiresIn: '1h'
  });

  // 尝试用正确的密钥验证
  jwt.verify(token2, config.jwt.secret, { algorithms: ['HS256'] });
  console.log('   ✗ 错误：使用错误密钥生成的token被验证通过了！');
} catch (error) {
  console.log('   ✓ 使用错误密钥生成的token验证失败（预期行为）:', error.message);
}

// 5. 检查常见的token问题
console.log('\n5. 常见问题检查:');

// 检查secret是否为空
if (!config.jwt.secret) {
  console.log('   ✗ JWT_SECRET未设置');
} else if (config.jwt.secret.length < 32) {
  console.log('   ⚠️ JWT_SECRET长度过短（建议至少32字符）');
} else {
  console.log('   ✓ JWT_SECRET长度合适');
}

// 检查是否有.env文件
const fs = require('fs');
const path = require('path');
const envFiles = ['.env', '.env.development', '.env.production', '.env.local'];

console.log('\n6. 环境文件检查:');
envFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✓ ${file} 存在`);

    // 检查是否包含JWT_SECRET
    const content = fs.readFileSync(filePath, 'utf8');
    const hasJwtSecret = content.includes('JWT_SECRET=');
    console.log(`   ${file} 包含JWT_SECRET: ${hasJwtSecret ? '是' : '否'}`);
  } else {
    console.log(`   - ${file} 不存在`);
  }
});

console.log('\n=== 诊断完成 ===');