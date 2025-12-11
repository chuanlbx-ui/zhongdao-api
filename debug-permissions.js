/**
 * 调试权限验证问题
 */

const jwt = require('jsonwebtoken');
const { TestAuthHelper } = require('./tests/helpers/auth.helper.ts');

async function debugPermissions() {
  console.log('=== 调试权限验证问题 ===');

  try {
    // 创建测试用户
    console.log('\n1. 创建星级用户...');
    const starUser = await TestAuthHelper.createTestUserByType('star1');
    console.log('星级用户信息:', {
      id: starUser.id,
      level: starUser.level,
      role: starUser.role
    });

    // 解析JWT token
    console.log('\n2. 解析JWT Token...');
    const decoded = jwt.decode(starUser.tokens.accessToken);
    console.log('JWT解码内容:', decoded);

    // 验证权限检查逻辑
    console.log('\n3. 验证权限检查逻辑...');
    const userLevel = decoded.level;
    console.log('用户级别:', userLevel);

    const allowedLevels = [
      'VIP', 'vip',
      'STAR_1', 'star_1', 'STAR1', 'star1',
      'STAR_2', 'star_2', 'STAR2', 'star2',
      'STAR_3', 'star_3', 'STAR3', 'star3',
      'STAR_4', 'star_4', 'STAR4', 'star4',
      'STAR_5', 'star_5', 'STAR5', 'star5',
      'DIRECTOR', 'director', 'ADMIN', 'admin'
    ];

    const hasPermission = allowedLevels.includes(userLevel);
    console.log('是否有权限查看团队:', hasPermission);

    const isAdmin = ['DIRECTOR', 'director', 'ADMIN', 'admin'].includes(userLevel);
    console.log('是否为管理员:', isAdmin);

  } catch (error) {
    console.error('调试过程中出错:', error);
  }
}

debugPermissions().then(() => {
  console.log('\n调试完成');
  process.exit(0);
}).catch(error => {
  console.error('调试失败:', error);
  process.exit(1);
});