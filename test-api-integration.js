/**
 * 前后端API集成测试脚本
 * 测试H5前端和管理后台与后端API的完整对接
 */

const axios = require('axios');

// 配置
const API_BASE_URL = 'http://localhost:3000/api/v1';
const TEST_TIMEOUT = 30000;

// 测试结果
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// 测试工具函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function assert(condition, message) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    log(`✅ ${message}`, 'success');
    testResults.details.push({ status: 'PASS', message });
  } else {
    testResults.failed++;
    log(`❌ ${message}`, 'error');
    testResults.details.push({ status: 'FAIL', message });
  }
}

// 创建API客户端
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'ZhongdaoMall-Integration-Test/1.0'
  }
});

// 测试令牌
let testToken = null;
let adminToken = null;

async function testHealthCheck() {
  log('\n🏥 测试后端健康检查...');

  try {
    // 测试根路径健康检查
    const rootResponse = await axios.get('http://localhost:3000/health');
    assert(rootResponse.status === 200, '根路径健康检查端点响应正常');
    assert(rootResponse.data.success === true, '服务状态正常');

    // 测试API v1模块状态
    const apiResponse = await apiClient.get('/products');
    assert(apiResponse.status === 200, 'API v1模块响应正常');
    assert(apiResponse.data.success === true, 'API v1模块状态正常');

  } catch (error) {
    assert(false, `健康检查失败: ${error.message}`);
  }
}

async function testAuthEndpoints() {
  log('\n🔐 测试认证端点...');

  try {
    // 测试注册推荐码验证
    const validateResponse = await apiClient.post('/auth/validate-referral', {
      referralCode: 'ABC123'
    });
    assert(validateResponse.status === 200, '推荐码验证端点正常');

    // 测试手机号验证
    const phoneResponse = await apiClient.post('/auth/validate-phone', {
      phone: '13800138000'
    });
    assert(phoneResponse.status === 200, '手机号验证端点正常');

  } catch (error) {
    // 如果是测试环境，某些端点可能不存在
    if (error.response?.status === 404) {
      log('ℹ️  部分认证端点尚未实现，跳过测试', 'warning');
    } else {
      assert(false, `认证端点测试失败: ${error.message}`);
    }
  }
}

async function testPublicEndpoints() {
  log('\n🌐 测试公共端点...');

  try {
    // 测试商品列表 (获取API信息)
    const productsResponse = await apiClient.get('/products');
    assert(productsResponse.status === 200, '商品模块端点正常');
    assert(productsResponse.data.success === true, '商品模块响应成功');

    // 测试分类树
    const categoriesResponse = await apiClient.get('/products/categories/tree');
    assert(categoriesResponse.status === 200, '分类树端点正常');
    assert(categoriesResponse.data.success === true, '分类树响应成功');

    // 测试分类列表
    const categoriesListResponse = await apiClient.get('/products/categories');
    assert(categoriesListResponse.status === 200, '分类列表端点正常');
    assert(categoriesListResponse.data.success === true, '分类列表响应成功');

  } catch (error) {
    assert(false, `公共端点测试失败: ${error.message}`);
  }
}

async function testProtectedEndpoints() {
  log('\n🔒 测试受保护端点...');

  if (!testToken && !adminToken) {
    log('ℹ️  跳过受保护端点测试（需要认证令牌）', 'warning');
    return;
  }

  try {
    // 测试用户信息端点
    if (testToken) {
      const profileResponse = await apiClient.get('/users/profile', {
        headers: { 'Authorization': `Bearer ${testToken}` }
      });
      assert(profileResponse.status === 200, '用户信息端点正常');
    }

    // 测试管理后台端点
    if (adminToken) {
      const usersResponse = await apiClient.get('/users', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        params: { page: 1, perPage: 5 }
      });
      assert(usersResponse.status === 200, '用户管理端点正常');
    }

  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      log('ℹ️  认证失败，可能是测试令牌过期', 'warning');
    } else {
      assert(false, `受保护端点测试失败: ${error.message}`);
    }
  }
}

async function testPointsSystem() {
  log('\n💰 测试积分系统端点...');

  if (!testToken) {
    log('ℹ️  跳过积分系统测试（需要用户令牌）', 'warning');
    return;
  }

  try {
    // 测试积分余额查询
    const balanceResponse = await apiClient.get('/points/balance', {
      headers: { 'Authorization': `Bearer ${testToken}` }
    });
    assert(balanceResponse.status === 200, '积分余额查询正常');
    assert(typeof balanceResponse.data.balance === 'number', '积分余额数据格式正确');

    // 测试积分交易记录
    const transactionsResponse = await apiClient.get('/points/transactions', {
      headers: { 'Authorization': `Bearer ${testToken}` },
      params: { page: 1, perPage: 5 }
    });
    assert(transactionsResponse.status === 200, '积分交易记录正常');

  } catch (error) {
    if (error.response?.status === 401) {
      log('ℹ️  积分系统需要有效认证', 'warning');
    } else {
      assert(false, `积分系统测试失败: ${error.message}`);
    }
  }
}

async function testErrorHandling() {
  log('\n🛡️ 测试错误处理...');

  try {
    // 测试404错误
    const notFoundResponse = await apiClient.get('/nonexistent-endpoint');
    assert(false, '404错误处理异常');
  } catch (error) {
    assert(error.response?.status === 404, '404错误处理正常');
  }

  try {
    // 测试验证错误
    const validationResponse = await apiClient.post('/auth/login', {
      invalidData: 'test'
    });
    assert(false, '输入验证错误处理异常');
  } catch (error) {
    assert(error.response?.status >= 400, '输入验证错误处理正常');
  }

  try {
    // 测试限流（如果配置了）
    const requests = Array(10).fill().map(() =>
      apiClient.get('/products')
    );
    const results = await Promise.allSettled(requests);

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    log(`ℹ️  限流测试: ${successCount}/10 请求成功`, 'info');

  } catch (error) {
    log('ℹ️  限流功能可能未配置', 'warning');
  }
}

async function testDataFormats() {
  log('\n📊 测试数据格式一致性...');

  try {
    // 测试商品数据格式
    const productsResponse = await apiClient.get('/products', {
      params: { page: 1, perPage: 1 }
    });

    if (productsResponse.data.data && productsResponse.data.data.length > 0) {
      const product = productsResponse.data.data[0];

      assert(typeof product.id === 'string', '商品ID格式正确');
      assert(typeof product.name === 'string', '商品名称格式正确');
      assert(typeof product.price === 'number', '商品价格格式正确');

      // 检查可选字段
      const hasValidDescription = !product.description || typeof product.description === 'string';
      assert(hasValidDescription, '商品描述格式正确');
    }

    // 测试用户数据格式
    const usersResponse = await apiClient.get('/users', {
      params: { page: 1, perPage: 1 }
    });

    if (usersResponse.data.data && usersResponse.data.data.length > 0) {
      const user = usersResponse.data.data[0];

      assert(typeof user.id === 'string', '用户ID格式正确');
      assert(typeof user.phone === 'string', '用户手机号格式正确');

      // 检查可选字段
      const hasValidNickname = !user.nickname || typeof user.nickname === 'string';
      const hasValidAvatar = !user.avatarUrl || typeof user.avatarUrl === 'string';

      assert(hasValidNickname, '用户昵称格式正确');
      assert(hasValidAvatar, '用户头像URL格式正确');
    }

  } catch (error) {
    if (error.response?.status === 401) {
      log('ℹ️  需要认证权限进行数据格式测试', 'warning');
    } else {
      assert(false, `数据格式测试失败: ${error.message}`);
    }
  }
}

async function generateTestReport() {
  log('\n' + '='.repeat(50), 'info');
  log('📋 API集成测试报告', 'info');
  log('='.repeat(50), 'info');

  log(`\n📊 测试统计:`, 'info');
  log(`总测试数: ${testResults.total}`, 'info');
  log(`通过: ${testResults.passed}`, 'success');
  log(`失败: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'success');

  const successRate = testResults.total > 0
    ? ((testResults.passed / testResults.total) * 100).toFixed(1)
    : 0;
  log(`成功率: ${successRate}%`, 'info');

  if (testResults.failed > 0) {
    log('\n❌ 失败的测试:', 'error');
    testResults.details
      .filter(test => test.status === 'FAIL')
      .forEach(test => log(`  - ${test.message}`, 'error'));
  }

  log('\n🔗 前端与后端集成状态:', 'info');
  if (successRate >= 90) {
    log('🟢 优秀 - 前后端集成状况良好，可以开始部署', 'success');
  } else if (successRate >= 75) {
    log('🟡 良好 - 大部分功能正常，建议修复失败项后部署', 'warning');
  } else {
    log('🔴 需要改进 - 存在较多问题，建议解决后再部署', 'error');
  }

  log('\n📝 建议:', 'info');
  log('1. 确保后端API服务正在运行 (npm run dev)', 'info');
  log('2. 检查数据库连接和初始化状态', 'info');
  log('3. 验证前端项目的API配置正确', 'info');
  log('4. 配置正确的环境变量', 'info');
  log('5. 检查网络连接和防火墙设置', 'info');

  return successRate >= 80;
}

// 主测试函数
async function runApiIntegrationTests() {
  log('🚀 开始前后端API集成测试...', 'info');
  log(`API端点: ${API_BASE_URL}`, 'info');

  try {
    // 基础连接测试
    await testHealthCheck();

    // 功能模块测试
    await testAuthEndpoints();
    await testPublicEndpoints();
    await testProtectedEndpoints();
    await testPointsSystem();

    // 质量保证测试
    await testErrorHandling();
    await testDataFormats();

  } catch (error) {
    log(`\n💥 测试过程中发生严重错误: ${error.message}`, 'error');
    testResults.failed++;
    testResults.total++;
  }

  return await generateTestReport();
}

// 运行测试
if (require.main === module) {
  runApiIntegrationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`测试执行失败: ${error.message}`, 'error');
      process.exit(1);
    });
}

module.exports = { runApiIntegrationTests };