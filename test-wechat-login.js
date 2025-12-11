/**
 * 微信登录功能测试脚本
 * 用于快速验证微信登录是否正常工作
 */

const axios = require('axios');
const chalk = require('chalk');

// 配置
const API_BASE = 'http://localhost:3000/api/v1';

// 测试数据
const testCases = [
  {
    name: '获取登录指引',
    method: 'GET',
    url: '/auth/wechat/qr',
    data: null
  },
  {
    name: '检查服务健康状态',
    method: 'GET',
    url: '/auth/wechat/health',
    data: null
  },
  {
    name: '微信登录测试（模拟）',
    method: 'POST',
    url: '/auth/wechat/login',
    data: {
      code: '071XPGGa1l5yRp2KlSGa1mYvD83XPGGk',
      userInfo: {
        nickName: '测试用户',
        avatarUrl: 'https://thirdwx.qlogo.cn/avatar.jpg',
        gender: 1,
        city: '深圳',
        province: '广东',
        country: '中国',
        language: 'zh_CN'
      }
    }
  },
  {
    name: '获取用户信息（未登录）',
    method: 'GET',
    url: '/auth/wechat/user-info',
    data: null,
    expectError: true
  }
];

// 颜色输出函数
function success(message) {
  console.log(chalk.green('✓'), message);
}

function error(message) {
  console.log(chalk.red('✗'), message);
}

function info(message) {
  console.log(chalk.blue('ℹ'), message);
}

function warning(message) {
  console.log(chalk.yellow('⚠'), message);
}

// 执行测试
async function runTests() {
  console.log(chalk.bold('\n微信登录功能测试'));
  console.log(chalk.gray('='.repeat(50)));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      console.log(`\n测试: ${testCase.name}`);

      const config = {
        method: testCase.method,
        url: `${API_BASE}${testCase.url}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      };

      if (testCase.data) {
        config.data = testCase.data;
      }

      const response = await axios(config);

      if (testCase.expectError) {
        warning(`测试失败: 预期错误但成功了`);
        failed++;
      } else {
        success(`状态码: ${response.status}`);

        if (response.data.success) {
          success(`响应成功: ${response.data.message || 'OK'}`);

          // 显示关键信息
          if (response.data.data) {
            if (response.data.data.user) {
              info(`用户ID: ${response.data.data.user.id}`);
              info(`用户级别: ${response.data.data.user.level}`);
              info(`是否新用户: ${response.data.data.user.isNewUser}`);
            }
            if (response.data.data.tokens) {
              info(`Access Token: ${response.data.data.tokens.accessToken.substring(0, 50)}...`);
              info(`Token有效期: ${response.data.data.tokens.expiresIn}`);
            }
          }
        } else {
          warning(`业务逻辑错误: ${response.data.error.message}`);
        }

        passed++;
      }
    } catch (err) {
      if (testCase.expectError) {
        if (err.response) {
          success(`预期错误: ${err.response.status} - ${err.response.data.error?.message || 'Error'}`);
          passed++;
        } else {
          error(`意外错误: ${err.message}`);
          failed++;
        }
      } else {
        if (err.response) {
          error(`HTTP错误 ${err.response.status}`);
          if (err.response.data) {
            error(`错误代码: ${err.response.data.error?.code || 'UNKNOWN'}`);
            error(`错误信息: ${err.response.data.error?.message || err.response.data.message || '未知错误'}`);
          }
        } else if (err.code === 'ECONNREFUSED') {
          error('无法连接到服务器，请确保服务器正在运行');
        } else {
          error(`测试失败: ${err.message}`);
        }
        failed++;
      }
    }
  }

  // 输出测试结果
  console.log('\n' + chalk.gray('='.repeat(50)));
  console.log(chalk.bold('测试结果汇总:'));
  console.log(chalk.green(`通过: ${passed}`));
  console.log(chalk.red(`失败: ${failed}`));
  console.log(chalk.blue(`总计: ${passed + failed}`));

  if (failed === 0) {
    console.log(chalk.bold.green('\n✓ 所有测试通过！'));
  } else {
    console.log(chalk.bold.red('\n✗ 部分测试失败，请检查上述错误信息'));
  }

  // 提示和建议
  console.log(chalk.bold('\n提示:'));
  console.log('1. 确保服务器已启动 (npm run dev)');
  console.log('2. 确保微信配置正确 (检查 .env 文件中的 WECHAT_APP_ID 和 WECHAT_APP_SECRET)');
  console.log('3. 微信登录需要真实的小程序环境，这里只测试接口结构');
  console.log('4. 完整的微信登录流程需要在微信小程序中测试');
}

// 运行测试
runTests().catch(console.error);