const fs = require('fs');
const path = require('path');

console.log('🔧 修复 teams.test.ts 中的认证问题...\n');

const filePath = path.join(__dirname, '../../tests/api/teams.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 修复1: 移除实例化，改为直接使用静态方法
content = content.replace(
  /let authHelper: TestAuthHelper;/g,
  '// authHelper 是静态类，不需要实例化'
);

content = content.replace(
  /authHelper = new TestAuthHelper\(\);/g,
  '// TestAuthHelper 是静态类，直接使用静态方法'
);

// 修复2: 更新 createTestUser 调用
content = content.replace(
  /(await authHelper\.createTestUser\('(.+?)'\))\.token/g,
  '(await TestAuthHelper.createTestUserByType(\'$2\')).tokens.accessToken'
);

content = content.replace(
  /(await authHelper\.createTestUser\('(.+?)',\s*([^)]+)\))/g,
  'await TestAuthHelper.createTestUser({ phone: `test_${Date.now()}_$2`, level: `$2`.toUpperCase(), role: \'USER\' })'
);

content = content.replace(
  /await authHelper\.getTestUser\('(.+?)'\)/g,
  'await TestAuthHelper.createTestUserByType(\'$1\')'
);

// 保存修复后的文件
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ teams.test.ts 修复完成！');

// 验证修复
const hasErrors = [];
if (content.includes('new TestAuthHelper()')) {
  hasErrors.push('仍然存在实例化代码');
}
if (content.includes('authHelper.createTestUser')) {
  hasErrors.push('仍然存在实例方法调用');
}

if (hasErrors.length === 0) {
  console.log('✅ 所有问题已修复！');
} else {
  console.log('⚠️ 仍有问题:', hasErrors.join(', '));
}

console.log('\n修复摘要:');
console.log('- 移除了 TestAuthHelper 的实例化');
console.log('- 改为使用静态方法 TestAuthHelper.createTestUserByType');
console.log('- 修复了 token 访问路径');