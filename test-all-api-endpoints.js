#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { URL } = require('url');

// API测试配置
const config = {
    baseURL: 'http://localhost:3000',
    timeout: 5000,
    maxConcurrent: 10
};

// 从文件加载测试Token
let testTokens = {
    admin: '',
    user: ''
};

try {
    const tokenData = require('./test-tokens.json');
    testTokens = {
        admin: tokenData.tokens.admin.token,
        user: tokenData.tokens.normal.token,
        director: tokenData.tokens.director.token,
        star5: tokenData.tokens.star5.token,
        vip: tokenData.tokens.vip.token
    };
    console.log('✅ 已加载测试Token');
} catch (error) {
    console.log('⚠️ 未找到test-tokens.json，请先运行: node generate-test-tokens.js');
}

// API端点列表
const apiEndpoints = [
    // 健康检查
    { method: 'GET', path: '/health', auth: false, description: '基本健康检查' },
    { method: 'GET', path: '/health/detailed', auth: false, description: '详细健康检查' },
    { method: 'GET', path: '/health/database', auth: false, description: '数据库健康检查' },
    { method: 'GET', path: '/health/security', auth: false, description: '安全状态检查' },

    // 认证相关
    { method: 'GET', path: '/api/v1/auth/me', auth: true, role: 'admin', description: '获取当前用户信息' },
    { method: 'POST', path: '/api/v1/auth/login', auth: false, description: '用户登录', body: { phone: '13800138000', password: 'password123' } },

    // 用户管理
    { method: 'GET', path: '/api/v1/users', auth: true, role: 'admin', description: '获取用户列表' },
    { method: 'GET', path: '/api/v1/users/profile', auth: true, description: '获取用户资料' },
    { method: 'PUT', path: '/api/v1/users/profile', auth: true, description: '更新用户资料', body: { nickname: '测试用户' } },

    // 商品管理
    { method: 'GET', path: '/api/v1/products', auth: false, description: '获取商品列表' },
    { method: 'GET', path: '/api/v1/products/categories', auth: false, description: '获取商品分类' },
    { method: 'GET', path: '/api/v1/products/tags', auth: false, description: '获取商品标签' },

    // 订单管理
    { method: 'GET', path: '/api/v1/orders', auth: true, description: '获取订单列表' },
    { method: 'POST', path: '/api/v1/orders', auth: true, description: '创建订单', body: { productId: 'test_product', quantity: 1 } },

    // 积分系统
    { method: 'GET', path: '/api/v1/points/balance', auth: true, description: '获取积分余额' },
    { method: 'GET', path: '/api/v1/points/statistics', auth: true, description: '获取积分统计' },
    { method: 'GET', path: '/api/v1/points/transactions', auth: true, description: '获取积分交易记录' },

    // 店铺管理
    { method: 'GET', path: '/api/v1/shops', auth: false, description: '获取店铺列表' },
    { method: 'GET', path: '/api/v1/shops/my', auth: true, description: '获取我的店铺' },

    // 团队管理
    { method: 'GET', path: '/api/v1/teams', auth: true, description: '获取团队信息' },
    { method: 'GET', path: '/api/v1/teams/performance', auth: true, description: '获取团队业绩' },

    // 库存管理
    { method: 'GET', path: '/api/v1/inventory', auth: true, description: '获取库存列表' },
    { method: 'GET', path: '/api/v1/inventory/alerts', auth: true, description: '获取库存警报' },

    // 支付相关
    { method: 'GET', path: '/api/v1/payments/methods', auth: false, description: '获取支付方式' },
    { method: 'POST', path: '/api/v1/payments/create', auth: true, description: '创建支付', body: { amount: 100, method: 'wechat' } },

    // 管理员接口
    { method: 'GET', path: '/api/v1/admin/dashboard', auth: true, role: 'admin', description: '管理员仪表板' },
    { method: 'GET', path: '/api/v1/admin/users', auth: true, role: 'admin', description: '管理员用户管理' },
    { method: 'GET', path: '/api/v1/admin/orders', auth: true, role: 'admin', description: '管理员订单管理' },
    { method: 'GET', path: '/api/v1/admin/products', auth: true, role: 'admin', description: '管理员商品管理' },

    // 等级系统
    { method: 'GET', path: '/api/v1/levels', auth: false, description: '获取等级列表' },
    { method: 'GET', path: '/api/v1/levels/requirements', auth: true, description: '获取等级要求' },

    // 佣金系统
    { method: 'GET', path: '/api/v1/commission', auth: true, description: '获取佣金信息' },
    { method: 'GET', path: '/api/v1/commission/history', auth: true, description: '获取佣金历史' },
    { method: 'POST', path: '/api/v1/commission/withdraw', auth: true, description: '申请佣金提现', body: { amount: 100 } },

    // 通知系统
    { method: 'GET', path: '/api/v1/notifications', auth: true, description: '获取通知列表' },
    { method: 'GET', path: '/api/v1/notifications/preferences', auth: true, description: '获取通知偏好' },
    { method: 'GET', path: '/api/v1/notifications/statistics', auth: true, description: '获取通知统计' }
];

// HTTP请求函数
function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.path, config.baseURL);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const requestOptions = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'API-Test/1.0',
                ...options.headers
            },
            timeout: config.timeout
        };

        // 添加认证头
        if (options.auth && options.role && testTokens[options.role]) {
            requestOptions.headers.Authorization = `Bearer ${testTokens[options.role]}`;
        }

        const req = httpModule.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: json,
                        responseTime: Date.now() - options.startTime
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data,
                        responseTime: Date.now() - options.startTime
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        // 发送请求体
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

// 测试单个端点
async function testEndpoint(endpoint) {
    try {
        console.log(`  ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);

        const response = await makeRequest({
            path: endpoint.path,
            method: endpoint.method,
            auth: endpoint.auth,
            role: endpoint.role,
            body: endpoint.body,
            startTime: Date.now()
        });

        const success = response.status >= 200 && response.status < 300;
        const icon = success ? '✅' : '❌';

        console.log(`    ${icon} ${response.status} ${response.responseTime}ms`);

        if (!success) {
            console.log(`    错误: ${JSON.stringify(response.data).substring(0, 100)}...`);
        }

        return {
            ...endpoint,
            success,
            status: response.status,
            responseTime: response.responseTime,
            error: success ? null : response.data
        };
    } catch (error) {
        console.log(`    ❌ 错误: ${error.message}`);
        return {
            ...endpoint,
            success: false,
            status: 0,
            responseTime: 0,
            error: error.message
        };
    }
}

// 批量测试API端点
async function testAllEndpoints() {
    console.log('🚀 开始API接口完整测试...\n');
    console.log(`基础URL: ${config.baseURL}`);
    console.log(`总端点数: ${apiEndpoints.length}\n`);

    const results = {
        total: apiEndpoints.length,
        success: 0,
        failed: 0,
        errors: [],
        responseTimes: []
    };

    // 分批测试
    for (let i = 0; i < apiEndpoints.length; i += config.maxConcurrent) {
        const batch = apiEndpoints.slice(i, i + config.maxConcurrent);
        const batchResults = await Promise.all(
            batch.map(endpoint => testEndpoint(endpoint))
        );

        batchResults.forEach(result => {
            if (result.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({
                    endpoint: `${result.method} ${result.path}`,
                    error: result.error || `HTTP ${result.status}`
                });
            }
            results.responseTimes.push(result.responseTime);
        });

        // 批次间延迟
        if (i + config.maxConcurrent < apiEndpoints.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // 统计结果
    const successRate = ((results.success / results.total) * 100).toFixed(1);
    const avgResponseTime = (results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length).toFixed(0);
    const maxResponseTime = Math.max(...results.responseTimes);

    console.log('\n📊 测试结果统计:');
    console.log(`  总端点数: ${results.total}`);
    console.log(`  成功: ${results.success} ✅`);
    console.log(`  失败: ${results.failed} ❌`);
    console.log(`  成功率: ${successRate}%`);
    console.log(`  平均响应时间: ${avgResponseTime}ms`);
    console.log(`  最大响应时间: ${maxResponseTime}ms`);

    // 显示失败的端点
    if (results.errors.length > 0) {
        console.log('\n❌ 失败的端点:');
        results.errors.forEach(error => {
            console.log(`  - ${error.endpoint}: ${error.error}`);
        });
    }

    // 生成测试报告
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: results.total,
            success: results.success,
            failed: results.failed,
            successRate: parseFloat(successRate),
            avgResponseTime: parseInt(avgResponseTime),
            maxResponseTime
        },
        errors: results.errors,
        details: apiEndpoints.map(ep => ({
            path: ep.path,
            method: ep.method,
            description: ep.description,
            auth: ep.auth,
            role: ep.role
        }))
    };

    require('fs').writeFileSync(
        `api-test-report-${new Date().toISOString().split('T')[0]}.json`,
        JSON.stringify(report, null, 2)
    );

    console.log('\n✨ 测试报告已保存到: api-test-report-*.json');

    return report;
}

// 主函数
if (require.main === module) {
    testAllEndpoints()
        .then(report => {
            console.log('\n✅ API测试完成！');
            process.exit(report.summary.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('\n❌ 测试执行失败:', error);
            process.exit(1);
        });
}

module.exports = { testAllEndpoints, testEndpoint, apiEndpoints };