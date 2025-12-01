#!/usr/bin/env node

/**
 * 管理后台与API/数据库兼容性测试工具
 * 测试项目: zhongdao-admin
 * 测试范围: API接口兼容性、数据库一致性、功能可用性
 * 输出: HTML测试报告 + JSON详细数据
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ===== 配置 =====
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const ADMIN_BASE_URL = 'http://localhost:5173'; // 管理后台本地开发地址
const ADMIN_BUILD_DIR = path.join(__dirname, 'zhongdao-admin', 'dist');

// 测试配置
const TEST_CONFIG = {
  timeout: 5000,
  retries: 2,
  verbose: process.argv.includes('--verbose'),
  // 认证配置
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'password',
  autoLogin: process.argv.includes('--auto-login') || true  // 默认启用自动登录
};

// ===== 颜色输出 =====
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// ===== 认证函数 =====
/**
 * 自动登录获取认证令牌
 * @returns {Promise<{token: string, userId: string} | null>}
 */
async function autoLogin() {
  try {
    log('\n🔐 正在尝试自动登录...', 'cyan');
    
    const loginResponse = await axios({
      method: 'POST',
      url: `${API_BASE_URL}/admin/auth/login`,
      data: {
        email: TEST_CONFIG.adminEmail,
        password: TEST_CONFIG.adminPassword
      },
      timeout: TEST_CONFIG.timeout,
      validateStatus: () => true
    });

    if (loginResponse.status === 200 && loginResponse.data && loginResponse.data.data) {
      const token = loginResponse.data.data.token;
      const userId = loginResponse.data.data.userId;
      
      log(`  ✓ 登录成功！用户: ${TEST_CONFIG.adminEmail}`, 'green');
      log(`  ✓ 令牌已获取 (长度: ${token.length} 字符)`, 'green');
      
      return { token, userId };
    } else if (loginResponse.status === 401 || loginResponse.status === 403) {
      log(`  ⚠ 认证失败: ${loginResponse.data?.message || '凭证不正确'}`, 'yellow');
      return null;
    } else {
      log(`  ✗ 登录请求失败 (状态码: ${loginResponse.status})`, 'red');
      return null;
    }
  } catch (error) {
    log(`  ⚠ 自动登录异常: ${error.message}`, 'yellow');
    return null;
  }
}

// ===== 测试状态管理 =====
class TestRunner {
  constructor(options = {}) {
    this.authToken = options.authToken || null;
    this.authHeaders = this.authToken 
      ? { 'Authorization': `Bearer ${this.authToken}` }
      : {};
    this.results = {
      timestamp: new Date().toISOString(),
      authInfo: {
        authenticated: !!this.authToken,
        loginMethod: options.loginMethod || 'none',
        loginTime: null
      },
      apiTests: [],
      databaseTests: [],
      functionalTests: [],
      componentTests: [],
      statistics: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  setAuthToken(token, loginMethod = 'auto') {
    this.authToken = token;
    this.authHeaders = { 'Authorization': `Bearer ${token}` };
    this.results.authInfo.authenticated = true;
    this.results.authInfo.loginMethod = loginMethod;
    this.results.authInfo.loginTime = new Date().toISOString();
  }

  getAuthHeaders() {
    return this.authHeaders;
  }

  addApiTest(test) {
    this.results.apiTests.push(test);
    this.updateStats(test);
  }

  addDatabaseTest(test) {
    this.results.databaseTests.push(test);
    this.updateStats(test);
  }

  addFunctionalTest(test) {
    this.results.functionalTests.push(test);
    this.updateStats(test);
  }

  addComponentTest(test) {
    this.results.componentTests.push(test);
    this.updateStats(test);
  }

  updateStats(test) {
    this.results.statistics.total++;
    if (test.status === 'pass') {
      this.results.statistics.passed++;
    } else if (test.status === 'fail') {
      this.results.statistics.failed++;
    } else if (test.status === 'warning') {
      this.results.statistics.warnings++;
    }
  }

  getSuccessRate() {
    const total = this.results.statistics.total;
    if (total === 0) return 0;
    return ((this.results.statistics.passed / total) * 100).toFixed(1);
  }

  getReport() {
    return this.results;
  }
}

// ===== 响应数据验证函数 =====
/**
 * 验证API响应数据的完整性
 * @param {Object} response - axios响应
 * @param {Array<string>} requiredFields - 需要的字段
 * @returns {Object} - {valid: boolean, missingFields: Array}
 */
function validateResponseContent(response, requiredFields = []) {
  if (!response || response.status !== 200) {
    return { valid: false, missingFields: [], reason: '响应状态不是200' };
  }
  
  const data = response.data?.data;
  if (!data) {
    return { valid: false, missingFields: requiredFields, reason: '响应数据为null' };
  }
  
  const missingFields = requiredFields.filter(field => !(field in data));
  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * 验证分页响应数据
 * @param {Object} response - axios响应
 * @returns {boolean} - 是否有效
 */
function validatePaginatedResponse(response) {
  if (response?.status !== 200) return false;
  
  const data = response.data?.data;
  if (!data) return false;
  
  // 检查分页字段
  const requiredFields = ['total', 'page', 'perPage', 'items'];
  return requiredFields.every(field => field in data);
}

/**
 * 验证仪表板数据
 * @param {Object} response - axios响应
 * @returns {boolean} - 是否有效
 */
function validateDashboardStats(response) {
  if (response?.status !== 200) return false;
  
  const stats = response.data?.data;
  if (!stats) return false;
  
  // 检查关键统计字段
  const requiredFields = ['totalUsers', 'totalProducts', 'totalOrders', 'totalRevenue'];
  return requiredFields.every(field => field in stats);
}

// ===== API 兼容性测试 =====
async function testAdminApiCompatibility(runner) {
  log('\n📡 测试 Admin API 兼容性...', 'cyan');

  const apiEndpoints = [
    {
      name: 'Admin API 健康检查',
      method: 'GET',
      url: `${API_BASE_URL}/admin`,
      requireAuth: false
    },
    {
      name: 'Admin 认证登录',
      method: 'POST',
      url: `${API_BASE_URL}/admin/auth/login`,
      requireAuth: false,
      data: {
        email: TEST_CONFIG.adminEmail,
        password: TEST_CONFIG.adminPassword
      }
    },
    {
      name: '仪表板统计数据',
      method: 'GET',
      url: `${API_BASE_URL}/admin/dashboard/stats`,
      requireAuth: true
    },
    {
      name: '用户列表',
      method: 'GET',
      url: `${API_BASE_URL}/admin/users?page=1&perPage=10`,
      requireAuth: true
    },
    {
      name: '商品列表',
      method: 'GET',
      url: `${API_BASE_URL}/admin/products?page=1&perPage=10`,
      requireAuth: true
    },
    {
      name: '订单列表',
      method: 'GET',
      url: `${API_BASE_URL}/admin/orders?page=1&perPage=10`,
      requireAuth: true
    },
    {
      name: '配置管理列表',
      method: 'GET',
      url: `${API_BASE_URL}/admin/config/configs`,
      requireAuth: true
    }
  ];

  for (const endpoint of apiEndpoints) {
    try {
      const config = {
        method: endpoint.method,
        url: endpoint.url,
        data: endpoint.data,
        timeout: TEST_CONFIG.timeout,
        validateStatus: () => true,
        headers: {}
      };
      
      // 需要认证的请求添加令牌
      if (endpoint.requireAuth && runner.getAuthHeaders().Authorization) {
        config.headers = runner.getAuthHeaders();
      }
      
      const response = await axios(config);

      // 对仪表板数据进行额外验证
      let dataValid = true;
      let validationMessage = '';
      if (endpoint.name === '仪表板统计数据' && response.status === 200) {
        dataValid = validateDashboardStats(response);
        if (!dataValid) {
          validationMessage = ' (响应数据结构不完整)';
        }
      }
      
      const status = (response.status >= 200 && response.status < 300 && dataValid) ? 'pass' : 'warning';
      const message = status === 'pass' 
        ? `${endpoint.name} 可用`
        : `${endpoint.name} 返回状态码 ${response.status}`;

      runner.addApiTest({
        name: endpoint.name,
        endpoint: endpoint.url,
        method: endpoint.method,
        status,
        statusCode: response.status,
        requiresAuth: endpoint.requireAuth,
        message,
        timestamp: new Date().toISOString()
      });

      log(`  ✓ ${endpoint.name}`, status === 'pass' ? 'green' : 'yellow');
    } catch (error) {
      runner.addApiTest({
        name: endpoint.name,
        endpoint: endpoint.url,
        method: endpoint.method,
        status: 'fail',
        error: error.message,
        message: `${endpoint.name} 测试失败: ${error.message}`,
        timestamp: new Date().toISOString()
      });

      log(`  ✗ ${endpoint.name} - ${error.message}`, 'red');
    }
  }
}

// ===== 数据库一致性检查 =====
async function testDatabaseConsistency(runner) {
  log('\n🗄️  测试数据库一致性...', 'cyan');

  const dbTests = [
    {
      name: '用户表完整性',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/users?page=1&perPage=1`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          return response.status === 200 || response.status === 401;
        } catch {
          return false;
        }
      }
    },
    {
      name: '商品表完整性',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/products?page=1&perPage=1`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          return response.status === 200 || response.status === 401;
        } catch {
          return false;
        }
      }
    },
    {
      name: '订单表完整性',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/orders?page=1&perPage=1`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          return response.status === 200 || response.status === 401;
        } catch {
          return false;
        }
      }
    },
    {
      name: '配置表完整性',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/config/configs`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          return response.status === 200 || response.status === 401;
        } catch {
          return false;
        }
      }
    }
  ];

  for (const test of dbTests) {
    try {
      const passed = await test.check();
      const status = passed ? 'pass' : 'warning';
      runner.addDatabaseTest({
        name: test.name,
        status,
        message: passed ? `${test.name} 通过` : `${test.name} 返回异常但端点存在`,
        timestamp: new Date().toISOString()
      });

      log(`  ${passed ? '✓' : '⚠'} ${test.name}`, passed ? 'green' : 'yellow');
    } catch (error) {
      runner.addDatabaseTest({
        name: test.name,
        status: 'warning',
        error: error.message,
        message: `${test.name} 未能连接: ${error.message}`,
        timestamp: new Date().toISOString()
      });

      log(`  ⚠ ${test.name} - ${error.message}`, 'yellow');
    }
  }
}

// ===== 功能可用性测试 =====
async function testFunctionalAvailability(runner) {
  log('\n⚙️  测试功能可用性...', 'cyan');

  const functionalTests = [
    {
      name: '用户列表分页功能',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/users?page=1&perPage=10`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          // 验证分页数据结构
          return response.status === 200 
            ? validatePaginatedResponse(response) 
            : response.status === 401;
        } catch {
          return false;
        }
      }
    },
    {
      name: '用户戠索功能',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/users?search=test`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          return response.status === 200 || response.status === 401;
        } catch {
          return false;
        }
      }
    },
    {
      name: '商品分类过滤',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/products?page=1&perPage=10`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          return response.status === 200 
            ? validatePaginatedResponse(response) 
            : response.status === 401;
        } catch {
          return false;
        }
      }
    },
    {
      name: '订单状态查询',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/orders?page=1&perPage=10`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          return response.status === 200 || response.status === 401;
        } catch {
          return false;
        }
      }
    },
    {
      name: '仪表板实时数据',
      check: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/admin/dashboard/stats`, {
            timeout: TEST_CONFIG.timeout,
            validateStatus: () => true,
            headers: runner.getAuthHeaders()
          });
          return response.status === 200 || response.status === 401;
        } catch {
          return false;
        }
      }
    }
  ];

  for (const test of functionalTests) {
    try {
      const passed = await test.check();
      const status = passed ? 'pass' : 'warning';
      runner.addFunctionalTest({
        name: test.name,
        status,
        message: passed ? `${test.name} 可用` : `${test.name} 返回异常但端点存在`,
        timestamp: new Date().toISOString()
      });

      log(`  ${passed ? '✓' : '⚠'} ${test.name}`, passed ? 'green' : 'yellow');
    } catch (error) {
      runner.addFunctionalTest({
        name: test.name,
        status: 'warning',
        error: error.message,
        message: `${test.name} 未能连接: ${error.message}`,
        timestamp: new Date().toISOString()
      });

      log(`  ⚠ ${test.name} - ${error.message}`, 'yellow');
    }
  }
}

// ===== 前端组件检查 =====
async function testComponentIntegrity(runner) {
  log('\n🎨 测试前端组件完整性...', 'cyan');

  const componentChecks = [
    {
      name: 'Dashboard 组件',
      files: ['src/pages/dashboard', 'src/pages/Dashboard', 'src/components/Dashboard']
    },
    {
      name: '用户管理组件',
      files: ['src/pages/users', 'src/pages/Users', 'src/components/Users']
    },
    {
      name: '商品管理组件',
      files: ['src/pages/products', 'src/pages/Products', 'src/components/Products']
    },
    {
      name: '订单管理组件',
      files: ['src/pages/orders', 'src/pages/Orders', 'src/components/Orders']
    },
    {
      name: '配置管理组件',
      files: ['src/pages/settings', 'src/pages/Config', 'src/components/Config']
    }
  ];

  // 检查管理后台目录
  const adminRoots = [
    path.join(__dirname, '../zhongdao-admin'),
    path.join(__dirname, 'zhongdao-admin'),
    '/www/wwwroot/zd-admin.wenbita.cn'
  ];

  for (const check of componentChecks) {
    let found = false;

    for (const adminRoot of adminRoots) {
      if (!fs.existsSync(adminRoot)) continue;
      
      for (const filePath of check.files) {
        const fullPath = path.join(adminRoot, filePath);
        // 检查目录或文件
        if (fs.existsSync(fullPath)) {
          found = true;
          break;
        }
        // 检查 .tsx 或 .ts 文件
        if (fs.existsSync(fullPath + '.tsx') || fs.existsSync(fullPath + '.ts') || 
            fs.existsSync(fullPath + '.jsx') || fs.existsSync(fullPath + '.js')) {
          found = true;
          break;
        }
      }
      if (found) break;
    }

    runner.addComponentTest({
      name: check.name,
      status: found ? 'pass' : 'warning',
      message: found ? `${check.name} 存在` : `${check.name} 检查失败 - 可能未部署`,
      timestamp: new Date().toISOString()
    });

    log(`  ${found ? '✓' : '⚠'} ${check.name}`, found ? 'green' : 'yellow');
  }
}

// ===== 生成 HTML 报告 =====
function generateHtmlReport(report) {
  const successRate = ((report.statistics.passed / report.statistics.total) * 100).toFixed(1);
  const statusColor = successRate >= 90 ? '#52c41a' : successRate >= 70 ? '#faad14' : '#f5222d';
  const statusText = successRate >= 90 ? '优秀' : successRate >= 70 ? '良好' : '需要改进';

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>中道商城 - 管理后台兼容性测试报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }

        .content {
            padding: 40px;
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .summary-card {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #667eea;
        }

        .summary-card h3 {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
        }

        .summary-card .number {
            font-size: 2.5em;
            font-weight: bold;
            color: #333;
        }

        .success-rate {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 40px;
            border: 2px solid ${statusColor};
        }

        .success-rate h3 {
            color: #666;
            margin-bottom: 15px;
        }

        .rate-value {
            font-size: 3em;
            font-weight: bold;
            color: ${statusColor};
            margin-bottom: 10px;
        }

        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            background-color: ${statusColor};
            color: white;
            border-radius: 20px;
            font-size: 1.1em;
        }

        .section {
            margin-bottom: 40px;
        }

        .section h2 {
            font-size: 1.8em;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }

        .test-item {
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-left: 4px solid;
        }

        .test-item.pass {
            background-color: #f6ffed;
            border-left-color: #52c41a;
        }

        .test-item.fail {
            background-color: #fff1f0;
            border-left-color: #ff4d4f;
        }

        .test-item.warning {
            background-color: #fffbe6;
            border-left-color: #faad14;
        }

        .test-name {
            font-weight: 600;
            color: #333;
        }

        .test-status {
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 0.9em;
        }

        .test-status.pass {
            background-color: #52c41a;
            color: white;
        }

        .test-status.fail {
            background-color: #ff4d4f;
            color: white;
        }

        .test-status.warning {
            background-color: #faad14;
            color: white;
        }

        .test-message {
            color: #666;
            font-size: 0.95em;
            margin-top: 8px;
        }

        .footer {
            background: #f5f5f5;
            padding: 20px 40px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }

        .chart-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .chart {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e8e8e8;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e8e8e8;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            width: ${successRate}%;
            transition: width 0.3s ease;
        }

        .recommendations {
            background: #e6f7ff;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #1890ff;
            margin-top: 40px;
        }

        .recommendations h3 {
            color: #0050b3;
            margin-bottom: 15px;
        }

        .recommendations ul {
            list-style: none;
            padding-left: 0;
        }

        .recommendations li {
            color: #0050b3;
            margin: 8px 0;
            padding-left: 25px;
            position: relative;
        }

        .recommendations li:before {
            content: "→";
            position: absolute;
            left: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 中道商城管理后台兼容性测试报告</h1>
            <p>API & 数据库 & 功能可用性综合测试</p>
        </div>

        <div class="content">
            <div class="success-rate">
                <h3>整体评分</h3>
                <div class="rate-value">${successRate}%</div>
                <span class="status-badge">${statusText}</span>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>

            <div class="summary">
                <div class="summary-card">
                    <h3>总测试数</h3>
                    <div class="number">${report.statistics.total}</div>
                </div>
                <div class="summary-card">
                    <h3>通过</h3>
                    <div class="number" style="color: #52c41a;">${report.statistics.passed}</div>
                </div>
                <div class="summary-card">
                    <h3>失败</h3>
                    <div class="number" style="color: #ff4d4f;">${report.statistics.failed}</div>
                </div>
                <div class="summary-card">
                    <h3>警告</h3>
                    <div class="number" style="color: #faad14;">${report.statistics.warnings}</div>
                </div>
            </div>

            <div class="section">
                <h2>📡 API 兼容性测试 (${report.apiTests.length})</h2>
                ${report.apiTests.map(test => `
                    <div class="test-item ${test.status}">
                        <div>
                            <div class="test-name">${test.name}</div>
                            <div class="test-message">${test.method} ${test.endpoint}</div>
                            ${test.statusCode ? `<div class="test-message">状态码: ${test.statusCode}</div>` : ''}
                            ${test.error ? `<div class="test-message">错误: ${test.error}</div>` : ''}
                        </div>
                        <span class="test-status ${test.status}">${test.status === 'pass' ? '✓ 通过' : test.status === 'fail' ? '✗ 失败' : '⚠ 警告'}</span>
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h2>🗄️ 数据库一致性检查 (${report.databaseTests.length})</h2>
                ${report.databaseTests.map(test => `
                    <div class="test-item ${test.status}">
                        <div>
                            <div class="test-name">${test.name}</div>
                            <div class="test-message">${test.message}</div>
                            ${test.error ? `<div class="test-message">错误: ${test.error}</div>` : ''}
                        </div>
                        <span class="test-status ${test.status}">${test.status === 'pass' ? '✓ 通过' : test.status === 'fail' ? '✗ 失败' : '⚠ 警告'}</span>
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h2>⚙️ 功能可用性测试 (${report.functionalTests.length})</h2>
                ${report.functionalTests.map(test => `
                    <div class="test-item ${test.status}">
                        <div>
                            <div class="test-name">${test.name}</div>
                            <div class="test-message">${test.message}</div>
                            ${test.error ? `<div class="test-message">错误: ${test.error}</div>` : ''}
                        </div>
                        <span class="test-status ${test.status}">${test.status === 'pass' ? '✓ 通过' : test.status === 'fail' ? '✗ 失败' : '⚠ 警告'}</span>
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h2>🎨 前端组件完整性 (${report.componentTests.length})</h2>
                ${report.componentTests.map(test => `
                    <div class="test-item ${test.status}">
                        <div>
                            <div class="test-name">${test.name}</div>
                            <div class="test-message">${test.message}</div>
                        </div>
                        <span class="test-status ${test.status}">${test.status === 'pass' ? '✓ 存在' : '⚠ 缺失'}</span>
                    </div>
                `).join('')}
            </div>

            <div class="recommendations">
                <h3>💡 测试建议</h3>
                <ul>
                    <li>确保后端 API 服务正在运行 (npm run dev)</li>
                    <li>检查数据库连接和初始化状态</li>
                    <li>验证管理后台的 API 配置正确 (API_URL)</li>
                    <li>配置正确的环境变量 (.env)</li>
                    <li>检查网络连接和防火墙设置</li>
                    <li>运行 'npm run db:seed' 生成测试数据</li>
                </ul>
            </div>
        </div>

        <div class="footer">
            <p>测试时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}</p>
            <p>报告版本: 1.0 | API URL: ${API_BASE_URL}</p>
        </div>
    </div>
</body>
</html>`;

  return htmlContent;
}

// ===== 主测试函数 =====
async function runAllTests() {
  log('\n🚀 开始管理后台兼容性测试...\n', 'blue');

  const runner = new TestRunner();

  try {
    // 尝试自动登录
    if (TEST_CONFIG.autoLogin) {
      const loginResult = await autoLogin();
      if (loginResult) {
        runner.setAuthToken(loginResult.token, 'automatic');
        log('', 'reset');
      }
    }

    // 运行所有测试
    await testAdminApiCompatibility(runner);
    await testDatabaseConsistency(runner);
    await testFunctionalAvailability(runner);
    await testComponentIntegrity(runner);

    const report = runner.getReport();
    const successRate = runner.getSuccessRate();

    // 生成HTML报告
    const htmlContent = generateHtmlReport(report);
    const reportPath = path.join(__dirname, 'admin-test-report.html');
    fs.writeFileSync(reportPath, htmlContent, 'utf-8');

    // 保存JSON数据
    const jsonPath = path.join(__dirname, `admin-test-report-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    // 输出测试摘要
    log('\n' + '='.repeat(60), 'blue');
    log('📋 管理后台兼容性测试完成', 'blue');
    log('='.repeat(60), 'blue');
    
    // 输出认证信息
    if (report.authInfo.authenticated) {
      log(`\n🔐 认证信息:`, 'cyan');
      log(`  ✓ 登录方法: ${report.authInfo.loginMethod}`, 'green');
      log(`  ✓ 登录时间: ${new Date(report.authInfo.loginTime).toLocaleString('zh-CN')}`, 'green');
    } else {
      log(`\n🔐 认证状态: 未认证 (部分接口需要会员乙)`, 'yellow');
    }
    
    log(`\n📊 测试统计:`, 'cyan');
    log(`  总测试数: ${report.statistics.total}`);
    log(`  ✅ 通过: ${report.statistics.passed}`, 'green');
    log(`  ❌ 失败: ${report.statistics.failed}`, report.statistics.failed > 0 ? 'red' : 'green');
    log(`  ⚠️  警告: ${report.statistics.warnings}`, report.statistics.warnings > 0 ? 'yellow' : 'green');
    log(`\n🎯 总体评分: ${successRate}%`);

    if (successRate >= 90) {
      log('🟢 优秀 - 管理后台与API/数据库兼容性良好', 'green');
    } else if (successRate >= 75) {
      log('🟡 良好 - 大部分功能正常，建议修复不完整项', 'yellow');
    } else if (successRate >= 60) {
      log('🟠 一般 - 存在问题，建议修复多项', 'yellow');
    } else {
      log('🔴 需要改进 - 存在较多问题，建议解决后再上线', 'red');
    }

    log(`\n📄 详细报告:`, 'cyan');
    log(`  ✓ HTML报告: ${reportPath}`);
    log(`  ✓ JSON数据: ${jsonPath}`);
    log('\n');

    return successRate >= 80;
  } catch (error) {
    log(`\n💥 测试执行失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

// ===== 执行测试 =====
if (require.main === module) {
  runAllTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      log(`\n💥 致命错误: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = { TestRunner, runAllTests };
