/**
 * 调试团队API 500错误
 */

const request = require('supertest');
const { TestAuthHelper } = require('./tests/helpers/auth.helper.ts');
const { app } = require('./tests/setup.ts');

async function debugTeamError() {
  console.log('=== 调试团队API 500错误 ===');

  try {
    // 创建星级用户
    console.log('\n1. 创建星级用户...');
    const starUser = await TestAuthHelper.createTestUserByType('star1');
    console.log('星级用户信息:', {
      id: starUser.id,
      level: starUser.level,
      role: starUser.role
    });

    // 测试团队API调用
    console.log('\n2. 测试团队API调用...');
    const response = await request(app)
      .get('/api/v1/users/team')
      .set('Authorization', `Bearer ${starUser.tokens.accessToken}`)
      .timeout(10000);

    console.log('响应状态:', response.status);
    console.log('响应头:', response.headers);
    console.log('响应体:', response.body);

    if (response.status === 500) {
      console.log('\n3. 检查错误详情...');

      // 尝试直接调用teamService方法
      const { teamService } = require('./src/modules/user/team.service.ts');

      try {
        console.log('测试getDirectTeam...');
        const directTeam = await teamService.getDirectTeam(starUser.id, {
          page: 1,
          perPage: 50
        });
        console.log('getDirectTeam成功:', directTeam);
      } catch (error) {
        console.error('getDirectTeam失败:', error.message);
        console.error('错误堆栈:', error.stack);
      }

      try {
        console.log('测试calculateTeamStats...');
        const teamStats = await teamService.calculateTeamStats(starUser.id);
        console.log('calculateTeamStats成功:', teamStats);
      } catch (error) {
        console.error('calculateTeamStats失败:', error.message);
        console.error('错误堆栈:', error.stack);
      }
    }

  } catch (error) {
    console.error('调试过程中出错:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

debugTeamError().then(() => {
  console.log('\n调试完成');
  process.exit(0);
}).catch(error => {
  console.error('调试失败:', error);
  process.exit(1);
});