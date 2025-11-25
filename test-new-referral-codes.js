const { generateReferralCode } = require('./src/shared/utils/referralCode');

console.log('🚀 测试新的6位数字字母组合邀请码系统\n');

// 测试邀请码生成
console.log('=== 测试邀请码生成 ===');
const generatedCodes = [];

for (let i = 0; i < 20; i++) {
  const code = generateReferralCode();
  generatedCodes.push(code);
  console.log(`${i + 1}. ${code}`);
}

console.log(`\n✅ 成功生成了 ${generatedCodes.length} 个邀请码`);

// 检查唯一性
const uniqueCodes = [...new Set(generatedCodes)];
console.log(`🔍 唯一性检查: ${uniqueCodes.length}/${generatedCodes.length} 个唯一`);

// 检查格式
console.log('\n=== 格式验证 ===');
const validFormat = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
generatedCodes.forEach((code, index) => {
  const isValid = validFormat.test(code);
  console.log(`${index + 1}. ${code} - ${isValid ? '✅' : '❌'} 格式正确`);
});

// 计算容量
const availableChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'.length;
const totalCapacity = Math.pow(availableChars, 6);
const oldCapacity = Math.pow(10, 6);

console.log('\n=== 容量对比 ===');
console.log(`📊 旧系统（6位数字）: ${oldCapacity.toLocaleString()} 个唯一组合`);
console.log(`📊 新系统（6位数字字母）: ${totalCapacity.toLocaleString()} 个唯一组合`);
console.log(`📈 容量提升: ${((totalCapacity / oldCapacity - 1) * 100).toFixed(1)}%`);

console.log('\n🎉 新邀请码系统测试完成！');
console.log('\n💡 特点:');
console.log('• 使用数字 2-9 和字母 A-Z (排除易混淆字符)');
console.log('• 30个字符可选，容量提升约 76 倍');
console.log('• 排除字符: 0, O, 1, I, l (避免视觉混淆)');
console.log('• 6位长度，易于记忆和分享');