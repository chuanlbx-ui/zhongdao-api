/**
 * 积分API自动化测试脚本
 * 测试所有积分相关的API端点，包括不同用户角色的权限验证
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const config = {
  baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  reportFile: path.join(__dirname, '../test-points-api-report.json'),
  htmlReportFile: path.join(__dirname, '../test-points-api-report.html')
};

// 测试用户配置
const testUsers = {
  admin: {
    id: process.env.ADMIN_USER_ID || 'admin_user_id_here',
    token: process.env.ADMIN_TOKEN || 'admin_token_here',
    role: 'ADMIN',
    level: null
  },
  director: {
    id: process.env.DIRECTOR_USER_ID || 'director_user_id_here',
    token: process.env.DIRECTOR_TOKEN || 'director_token_here',
    role: 'USER',
    level: 'DIRECTOR'
  },
  vip: {
    id: process.env.VIP_USER_ID || 'vip_user_id_here',
    token: process.env.VIP_TOKEN || 'vip_token_here',
    role: 'USER',
    level: 'VIP'
  },
  normal: {
    id: process.env.NORMAL_USER_ID || 'normal_user_id_here',
    token: process.env.NORMAL_TOKEN || 'normal_token_here',
    role: 'USER',
    level: 'NORMAL'
  }
};

// API测试用例
const apiTests = [
  // 获取余额测试
  {
    name: '获取积分余额 - 普通用户',
    method: 'GET',
    path: '/api/v1/points/balance',
    userRole: 'normal',
    expectedStatus: 200,
    expectedFields: ['balance', 'frozenBalance', 'availableBalance']
  },
  {
    name: '获取积分余额 - VIP用户',
    method: 'GET',
    path: '/api/v1/points/balance',
    userRole: 'vip',
    expectedStatus: 200,
    expectedFields: ['balance', 'frozenBalance', 'availableBalance']
  },
  {
    name: '获取积分余额 - 董事用户',
    method: 'GET',
    path: '/api/v1/points/balance',
    userRole: 'director',
    expectedStatus: 200,
    expectedFields: ['balance', 'frozenBalance', 'availableBalance']
  },

  // 转账测试
  {
    name: '积分转账 - 普通用户转账给VIP',
    method: 'POST',
    path: '/api/v1/points/transfer',
    userRole: 'normal',
    data: {
      toUserId: 'vip_user_id_here',
      amount: 10,
      description: '测试转账'
    },
    expectedStatus: 200,
    expectedFields: ['transactionNo', 'fromUserId', 'toUserId', 'amount']
  },
  {
    name: '积分转账 - 转账给自己（应该失败）',
    method: 'POST',
    path: '/api/v1/points/transfer',
    userRole: 'normal',
    data: {
      toUserId: 'normal_user_id_here',
      amount: 10,
      description: '给自己转账'
    },
    expectedStatus: 400,
    expectedError: 'INVALID_TRANSFER'
  },
  {
    name: '积分转账 - 超出限额（应该失败）',
    method: 'POST',
    path: '/api/v1/points/transfer',
    userRole: 'normal',
    data: {
      toUserId: 'vip_user_id_here',
      amount: 999999,
      description: '超大额转账'
    },
    expectedStatus: 400,
    expectedError: 'EXCEED_LIMIT'
  },
  {
    name: '积分转账 - 无效金额（应该失败）',
    method: 'POST',
    path: '/api/v1/points/transfer',
    userRole: 'normal',
    data: {
      toUserId: 'vip_user_id_here',
      amount: -10,
      description: '负数转账'
    },
    expectedStatus: 400
  },

  // 充值测试（需要管理员或董事权限）
  {
    name: '积分充值 - 管理员权限',
    method: 'POST',
    path: '/api/v1/points/recharge',
    userRole: 'admin',
    data: {
      userId: 'normal_user_id_here',
      amount: 100,
      description: '管理员测试充值'
    },
    expectedStatus: 200,
    expectedFields: ['transactionNo', 'userId', 'amount']
  },
  {
    name: '积分充值 - 董事权限',
    method: 'POST',
    path: '/api/v1/points/recharge',
    userRole: 'director',
    data: {
      userId: 'normal_user_id_here',
      amount: 100,
      description: '董事测试充值'
    },
    expectedStatus: 200,
    expectedFields: ['transactionNo', 'userId', 'amount']
  },
  {
    name: '积分充值 - 普通用户无权限（应该失败）',
    method: 'POST',
    path: '/api/v1/points/recharge',
    userRole: 'normal',
    data: {
      userId: 'normal_user_id_here',
      amount: 100,
      description: '无权限充值'
    },
    expectedStatus: 403,
    expectedError: 'INSUFFICIENT_PERMISSIONS'
  },
  {
    name: '积分充值 - VIP用户无权限（应该失败）',
    method: 'POST',
    path: '/api/v1/points/recharge',
    userRole: 'vip',
    data: {
      userId: 'normal_user_id_here',
      amount: 100,
      description: 'VIP无权限充值'
    },
    expectedStatus: 403,
    expectedError: 'INSUFFICIENT_PERMISSIONS'
  },

  // 流水记录测试
  {
    name: '获取积分流水 - 普通用户',
    method: 'GET',
    path: '/api/v1/points/transactions',
    userRole: 'normal',
    expectedStatus: 200,
    expectedFields: ['transactions', 'pagination']
  },
  {
    name: '获取积分流水 - 带分页参数',
    method: 'GET',
    path: '/api/v1/points/transactions?page=1&perPage=10',
    userRole: 'normal',
    expectedStatus: 200,
    expectedFields: ['transactions', 'pagination']
  },
  {
    name: '获取积分流水 - 按类型筛选',
    method: 'GET',
    path: '/api/v1/points/transactions?type=TRANSFER',
    userRole: 'normal',
    expectedStatus: 200,
    expectedFields: ['transactions', 'pagination']
  },
  {
    name: '获取积分流水 - 无效分页参数（应该失败）',
    method: 'GET',
    path: '/api/v1/points/transactions?page=0',
    userRole: 'normal',
    expectedStatus: 400
  },

  // 统计信息测试
  {
    name: '获取积分统计 - 普通用户',
    method: 'GET',
    path: '/api/v1/points/statistics',
    userRole: 'normal',
    expectedStatus: 200,
    expectedFields: ['totalIncome', 'totalExpense', 'totalTransferIn', 'totalTransferOut']
  },
  {
    name: '获取积分统计 - VIP用户',
    method: 'GET',
    path: '/api/v1/points/statistics',
    userRole: 'vip',
    expectedStatus: 200,
    expectedFields: ['totalIncome', 'totalExpense', 'totalTransferIn', 'totalTransferOut']
  },

  // 冻结/解冻测试（需要管理员或董事权限）
  {
    name: '冻结积分 - 管理员权限',
    method: 'POST',
    path: '/api/v1/points/freeze',
    userRole: 'admin',
    data: {
      userId: 'normal_user_id_here',
      amount: 10,
      type: 'FREEZE',
      description: '测试冻结'
    },
    expectedStatus: 200
  },
  {
    name: '解冻积分 - 管理员权限',
    method: 'POST',
    path: '/api/v1/points/freeze',
    userRole: 'admin',
    data: {
      userId: 'normal_user_id_here',
      amount: 10,
      type: 'UNFREEZE',
      description: '测试解冻'
    },
    expectedStatus: 200
  },
  {
    name: '冻结积分 - 董事权限',
    method: 'POST',
    path: '/api/v1/points/freeze',
    userRole: 'director',
    data: {
      userId: 'normal_user_id_here',
      amount: 10,
      type: 'FREEZE',
      description: '董事测试冻结'
    },
    expectedStatus: 200
  },
  {
    name: '冻结积分 - 普通用户无权限（应该失败）',
    method: 'POST',
    path: '/api/v1/points/freeze',
    userRole: 'normal',
    data: {
      userId: 'normal_user_id_here',
      amount: 10,
      type: 'FREEZE',
      description: '无权限冻结'
    },
    expectedStatus: 403,
    expectedError: 'INSUFFICIENT_PERMISSIONS'
  },

  // 批量充值测试
  {
    name: '批量充值 - 管理员权限',
    method: 'POST',
    path: '/api/v1/points/batch-recharge',
    userRole: 'admin',
    data: {
      recharges: [
        {
          userId: 'normal_user_id_here',
          amount: 50,
          description: '批量充值1'
        },
        {
          userId: 'vip_user_id_here',
          amount: 50,
          description: '批量充值2'
        }
      ]
    },
    expectedStatus: 200,
    expectedFields: ['summary', 'results', 'errors']
  },
  {
    name: '批量充值 - 超出数量限制（应该失败）',
    method: 'POST',
    path: '/api/v1/points/batch-recharge',
    userRole: 'admin',
    data: {
      recharges: new Array(101).fill().map((_, i) => ({
        userId: 'normal_user_id_here',
        amount: 10,
        description: `充值${i}`
      }))
    },
    expectedStatus: 400
  },
  {
    name: '批量充值 - 普通用户无权限（应该失败）',
    method: 'POST',
    path: '/api/v1/points/batch-recharge',
    userRole: 'normal',
    data: {
      recharges: [
        {
          userId: 'normal_user_id_here',
          amount: 10,
          description: '无权限批量充值'
        }
      ]
    },
    expectedStatus: 403,
    expectedError: 'INSUFFICIENT_PERMISSIONS'
  }
];

// 测试结果存储
let testResults = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// 创建axios实例
function createAxiosInstance(userRole) {
  const user = testUsers[userRole];
  if (!user || !user.token) {
    throw new Error(`用户 ${userRole} 的token未配置`);
  }

  return axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: {
      'Authorization': `Bearer ${user.token}`,
      'Content-Type': 'application/json'
    }
  });
}

// 执行单个API测试
async function runTest(test) {
  totalTests++;
  const startTime = Date.now();
  let result = {
    name: test.name,
    method: test.method,
    path: test.path,
    userRole: test.userRole,
    expectedStatus: test.expectedStatus,
    status: 'PENDING',
    responseTime: 0,
    error: null,
    details: null
  };

  try {
    const instance = createAxiosInstance(test.userRole);
    let response;

    switch (test.method) {
      case 'GET':
        response = await instance.get(test.path);
        break;
      case 'POST':
        response = await instance.post(test.path, test.data);
        break;
      case 'PUT':
        response = await instance.put(test.path, test.data);
        break;
      case 'DELETE':
        response = await instance.delete(test.path);
        break;
      default:
        throw new Error(`不支持的HTTP方法: ${test.method}`);
    }

    result.responseTime = Date.now() - startTime;
    result.actualStatus = response.status;
    result.details = response.data;

    // 检查状态码
    if (response.status !== test.expectedStatus) {
      result.status = 'FAILED';
      result.error = `期望状态码 ${test.expectedStatus}，实际 ${response.status}`;
      failedTests++;
      return result;
    }

    // 检查错误码（如果有）
    if (test.expectedError && response.data.error) {
      if (response.data.error.code !== test.expectedError) {
        result.status = 'FAILED';
        result.error = `期望错误码 ${test.expectedError}，实际 ${response.data.error.code}`;
        failedTests++;
        return result;
      }
    }

    // 检查响应字段
    if (test.expectedFields && response.data.data) {
      const missingFields = test.expectedFields.filter(field =>
        !(field in response.data.data)
      );
      if (missingFields.length > 0) {
        result.status = 'FAILED';
        result.error = `缺少响应字段: ${missingFields.join(', ')}`;
        failedTests++;
        return result;
      }
    }

    result.status = 'PASSED';
    passedTests++;

  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.status = 'FAILED';
    result.error = error.response ?
      `${error.response.status}: ${error.response.data?.error?.message || error.response.statusText}` :
      error.message;
    failedTests++;
  }

  return result;
}

// 生成HTML报告
function generateHtmlReport() {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>积分API测试报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #fafafa;
            border-bottom: 1px solid #eee;
        }
        .summary-item {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .summary-item h3 {
            margin: 0;
            font-size: 2em;
            color: #333;
        }
        .summary-item p {
            margin: 5px 0 0 0;
            color: #666;
        }
        .pass { color: #4caf50; }
        .fail { color: #f44336; }
        .pending { color: #ff9800; }
        .results {
            padding: 30px;
        }
        .test-item {
            margin-bottom: 20px;
            padding: 20px;
            border-radius: 8px;
            background: #f9f9f9;
            border-left: 4px solid #ddd;
        }
        .test-item.passed {
            border-left-color: #4caf50;
            background: #f1f8e9;
        }
        .test-item.failed {
            border-left-color: #f44336;
            background: #ffebee;
        }
        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .test-name {
            font-weight: 600;
            font-size: 1.1em;
            color: #333;
        }
        .test-meta {
            display: flex;
            gap: 15px;
            font-size: 0.9em;
            color: #666;
            margin: 10px 0;
        }
        .test-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 500;
        }
        .badge-method {
            background: #e3f2fd;
            color: #1976d2;
        }
        .badge-role {
            background: #f3e5f5;
            color: #7b1fa2;
        }
        .badge-time {
            background: #e8f5e9;
            color: #388e3c;
        }
        .test-error {
            margin-top: 10px;
            padding: 10px;
            background: #ffebee;
            border-radius: 4px;
            color: #c62828;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
        }
        .test-details {
            margin-top: 10px;
            padding: 10px;
            background: white;
            border-radius: 4px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.85em;
            color: #666;
            max-height: 300px;
            overflow-y: auto;
        }
        .footer {
            padding: 20px;
            text-align: center;
            color: #666;
            border-top: 1px solid #eee;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 积分API测试报告</h1>
            <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>

        <div class="summary">
            <div class="summary-item">
                <h3>${totalTests}</h3>
                <p>总测试数</p>
            </div>
            <div class="summary-item">
                <h3 class="pass">${passedTests}</h3>
                <p>通过</p>
            </div>
            <div class="summary-item">
                <h3 class="fail">${failedTests}</h3>
                <p>失败</p>
            </div>
            <div class="summary-item">
                <h3>${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%</h3>
                <p>通过率</p>
            </div>
        </div>

        <div class="results">
            <h2>测试结果详情</h2>
            ${testResults.map(test => `
                <div class="test-item ${test.status.toLowerCase()}">
                    <div class="test-header">
                        <span class="test-name">${test.name}</span>
                        <span class="test-badge" style="background: ${
                            test.status === 'PASSED' ? '#4caf50' :
                            test.status === 'FAILED' ? '#f44336' : '#ff9800'
                        }; color: white;">
                            ${test.status}
                        </span>
                    </div>
                    <div class="test-meta">
                        <span class="test-badge badge-method">${test.method}</span>
                        <span class="test-badge badge-role">${test.userRole}</span>
                        <span class="test-badge badge-time">${test.responseTime}ms</span>
                        <span>${test.path}</span>
                    </div>
                    ${test.error ? `<div class="test-error">错误: ${test.error}</div>` : ''}
                    ${test.details ? `<div class="test-details">${JSON.stringify(test.details, null, 2)}</div>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>报告由积分API自动化测试工具生成</p>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync(config.htmlReportFile, html);
  console.log(`\n📄 HTML报告已生成: ${config.htmlReportFile}`);
}

// 主函数
async function main() {
  console.log('🚀 开始积分API自动化测试');
  console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`);
  console.log(`📡 测试地址: ${config.baseURL}`);
  console.log(`🧪 总测试用例: ${apiTests.length}\n`);

  // 检查用户token是否配置
  let missingTokens = [];
  for (const [role, user] of Object.entries(testUsers)) {
    if (!user.token || user.token === `${role}_token_here`) {
      missingTokens.push(role);
    }
  }

  if (missingTokens.length > 0) {
    console.warn('⚠️ 警告: 以下用户角色未配置token:');
    missingTokens.forEach(role => console.warn(`   - ${role}`));
    console.warn('\n请设置环境变量或修改脚本中的testUsers配置\n');
  }

  // 运行所有测试
  for (const test of apiTests) {
    console.log(`🔍 测试: ${test.name}`);
    const result = await runTest(test);
    testResults.push(result);

    const icon = result.status === 'PASSED' ? '✅' : result.status === 'FAILED' ? '❌' : '⏳';
    console.log(`   ${icon} ${result.status} (${result.responseTime}ms)`);

    if (result.error) {
      console.log(`   📝 ${result.error}`);
    }
  }

  // 生成测试报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      passRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    },
    results: testResults
  };

  fs.writeFileSync(config.reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📊 JSON报告已保存: ${config.reportFile}`);

  // 生成HTML报告
  generateHtmlReport();

  // 显示测试摘要
  console.log('\n' + '='.repeat(80));
  console.log('📈 测试摘要');
  console.log('='.repeat(80));
  console.log(`总测试数: ${totalTests}`);
  console.log(`✅ 通过: ${passedTests}`);
  console.log(`❌ 失败: ${failedTests}`);
  console.log(`📊 通过率: ${report.summary.passRate}%`);
  console.log(`⏱️ 总耗时: ${testResults.reduce((sum, r) => sum + r.responseTime, 0)}ms`);
  console.log(`⏰ 完成时间: ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  // 如果有失败的测试，退出码为1
  if (failedTests > 0) {
    console.log('\n❌ 存在测试失败，请查看报告获取详细信息');
    process.exit(1);
  } else {
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runTest,
  apiTests,
  testUsers,
  config
};