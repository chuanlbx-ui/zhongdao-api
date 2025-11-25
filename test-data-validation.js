/**
 * 数据验证测试脚本
 * 检查前后端数据格式一致性、边界值测试和数据完整性
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API基础配置
const API_BASE_URL = 'http://localhost:3000/api/v1';

// 测试用的认证token
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bjMzN28wMDAxZWRiY2ZjdzNyeGRuIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoiZGlyZWN0b3IiLCJpYXQiOjE3NjM0NzQzNDgsImV4cCI6MTc2NDA3OTE0OCwianRpIjoiMHd3amQ3cXZjZTVlbWk0bjNmcnoifQ.83SSYBxiNp-Xm7tshMXbRMaz0ERu9HS11SoVsoRBC_k';

// 创建API客户端
const createApiClient = (baseURL, token = null) => {
  return axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  });
};

// 数据库模型字段类型定义
const DATABASE_SCHEMA = {
  User: {
    id: 'String',
    openid: 'String',
    nickname: 'String?',
    avatarUrl: 'String?',
    phone: 'String?',
    level: 'UserLevel',
    status: 'UserStatus',
    referralCode: 'String?',
    pointsBalance: 'Decimal',
    totalSales: 'Decimal',
    directCount: 'Int',
    teamCount: 'Int',
    parentId: 'String?',
    teamPath: 'String?',
    createdAt: 'DateTime',
    updatedAt: 'DateTime'
  },
  Product: {
    id: 'String',
    name: 'String',
    description: 'String?',
    images: 'Json',
    price: 'Decimal',
    originalPrice: 'Decimal',
    stock: 'Int',
    status: 'ProductStatus',
    categoryId: 'String?',
    createdAt: 'DateTime',
    updatedAt: 'DateTime'
  },
  Order: {
    id: 'String',
    orderNo: 'String',
    type: 'OrderType',
    status: 'OrderStatus',
    totalAmount: 'Decimal',
    finalAmount: 'Decimal',
    buyerId: 'String',
    items: 'Json',
    createdAt: 'DateTime',
    updatedAt: 'DateTime'
  }
};

// 前端接口字段类型定义
const H5_INTERFACE_SCHEMA = {
  UserProfile: {
    id: 'string',
    nickname: 'string',
    phone: 'string',
    avatarUrl: 'string',
    level: 'string',
    pointsBalance: 'number',
    referralCode: 'string',
    directCount: 'number',
    teamCount: 'number'
  },
  Product: {
    id: 'string',
    name: 'string',
    description: 'string',
    images: 'string[]',
    price: 'number',
    originalPrice: 'number',
    stock: 'number',
    specs: 'any',
    category: 'any',
    status: 'string'
  },
  Order: {
    id: 'string',
    orderNo: 'string',
    type: 'string',
    status: 'string',
    totalAmount: 'number',
    finalAmount: 'number',
    items: 'any[]',
    createdAt: 'string',
    deliveryAddress: 'any'
  }
};

// 管理后台接口字段类型定义
const ADMIN_INTERFACE_SCHEMA = {
  User: {
    id: 'string',
    openid: 'string',
    nickname: 'string',
    phone: 'string',
    avatarUrl: 'string',
    level: 'string',
    status: 'string',
    totalSales: 'number',
    directCount: 'number',
    teamCount: 'number',
    pointsBalance: 'number',
    createdAt: 'string',
    updatedAt: 'string'
  },
  Product: {
    id: 'string',
    name: 'string',
    description: 'string',
    images: 'string[]',
    price: 'number',
    originalPrice: 'number',
    stock: 'number',
    status: 'string',
    category: 'any',
    specs: 'any',
    createdAt: 'string'
  },
  Order: {
    id: 'string',
    orderNo: 'string',
    type: 'string',
    status: 'string',
    totalAmount: 'number',
    finalAmount: 'number',
    customer: 'any',
    items: 'any[]',
    createdAt: 'string',
    updatedAt: 'string'
  }
};

// 边界值测试数据
const BOUNDARY_TEST_DATA = {
  User: {
    nickname: [
      '',                    // 空字符串
      'a',                   // 单字符
      'a'.repeat(50),        // 正常长度
      'a'.repeat(255),       // 最大长度
      'a'.repeat(256),       // 超出最大长度
      '@#$%^&*()',           // 特殊字符
      '中文测试',             // 中文字符
      '🚀🎉💯',             // emoji字符
      '   spaced   ',       // 带空格
      '\n\t\r',             // 控制字符
      null,                 // null值
      undefined              // undefined值
    ],
    phone: [
      '',                    // 空字符串
      '1',                   // 太短
      '123',                 // 仍然太短
      '12345678901',        // 11位数字
      '123456789012',       // 12位数字
      '1234567890a',        // 包含字母
      '123-456-78901',      // 包含连字符
      '+8612345678901',     // 带国际区号
      null,
      undefined
    ],
    level: [
      'NORMAL',
      'VIP',
      'STAR_1',
      'STAR_2',
      'STAR_3',
      'STAR_4',
      'STAR_5',
      'DIRECTOR',
      'INVALID_LEVEL',      // 无效等级
      '',                    // 空字符串
      null,
      undefined
    ]
  },
  Product: {
    name: [
      '',
      'a',
      'a'.repeat(100),
      'a'.repeat(255),
      'a'.repeat(256),
      '产品名称测试',
      '🛍️商品🛒',
      null,
      undefined
    ],
    price: [
      -1,                    // 负数
      0,                     // 零
      0.01,                  // 最小正数
      999999999.99,          // 大数值
      Number.MAX_SAFE_INTEGER, // 最大安全整数
      Number.POSITIVE_INFINITY, // 无穷大
      NaN,                   // 非数字
      'string',              // 字符串
      null,
      undefined
    ],
    stock: [
      -1,                    // 负库存
      0,                     // 零库存
      1,                     // 最小正库存
      999999,                // 大库存
      Number.MAX_SAFE_INTEGER,
      1.5,                   // 小数
      'string',
      null,
      undefined
    ]
  }
};

// 类型映射函数
const mapDatabaseTypeToJSType = (dbType) => {
  if (dbType.endsWith('?')) return 'object'; // nullable field
  switch (dbType) {
    case 'String': return 'string';
    case 'Int': return 'number';
    case 'Decimal': return 'number';
    case 'DateTime': return 'string';
    case 'Boolean': return 'boolean';
    case 'Json': return 'object';
    case 'UserLevel':
    case 'UserStatus':
    case 'ProductStatus':
    case 'OrderType':
      return 'string';
    default: return 'unknown';
  }
};

// 验证数据类型
const validateDataType = (value, expectedType) => {
  const actualType = value === null ? 'object' : typeof value;
  return actualType === expectedType;
};

// 数据格式一致性检查
const checkDataFormatConsistency = () => {
  console.log('🔍 开始前后端数据格式一致性检查...\n');

  let issues = [];
  let warnings = [];

  // 检查User模型
  console.log('📋 检查User模型数据格式一致性:');

  const userFields = Object.keys(DATABASE_SCHEMA.User);

  // H5前端User接口检查
  console.log('  🎯 H5前端UserProfile接口:');
  const h5UserFields = Object.keys(H5_INTERFACE_SCHEMA.UserProfile);

  userFields.forEach(dbField => {
    const dbType = mapDatabaseTypeToJSType(DATABASE_SCHEMA.User[dbField]);
    const h5Field = h5UserFields.find(field =>
      field.toLowerCase() === dbField.toLowerCase().replace(/id$/, '')
    );

    if (h5Field) {
      const h5Type = H5_INTERFACE_SCHEMA.UserProfile[h5Field];
      if (dbType !== h5Type) {
        issues.push(`User.${dbField}: DB类型(${dbType}) ≠ H5类型(${h5Type})`);
      } else {
        console.log(`    ✅ ${dbField}: ${dbType}`);
      }
    } else {
      if (['updatedAt', 'openid', 'parentId', 'teamPath'].includes(dbField)) {
        console.log(`    ℹ️  ${dbField}: H5端未使用此字段`);
      } else {
        warnings.push(`User.${dbField}: H5端缺少此字段`);
      }
    }
  });

  // 检查H5端独有字段
  h5UserFields.forEach(h5Field => {
    const dbField = userFields.find(field =>
      field.toLowerCase().replace(/id$/, '') === h5Field.toLowerCase()
    );
    if (!dbField && !['teamCount', 'directCount'].includes(h5Field)) {
      warnings.push(`UserProfile.${h5Field}: 后端缺少此字段`);
    }
  });

  // 管理后台User接口检查
  console.log('\n  🎯 管理后台User接口:');
  const adminUserFields = Object.keys(ADMIN_INTERFACE_SCHEMA.User);

  userFields.forEach(dbField => {
    const dbType = mapDatabaseTypeToJSType(DATABASE_SCHEMA.User[dbField]);
    const adminField = adminUserFields.find(field =>
      field.toLowerCase() === dbField.toLowerCase()
    );

    if (adminField) {
      const adminType = ADMIN_INTERFACE_SCHEMA.User[adminField];
      if (dbType !== adminType) {
        issues.push(`User.${dbField}: DB类型(${dbType}) ≠ Admin类型(${adminType})`);
      } else {
        console.log(`    ✅ ${dbField}: ${dbType}`);
      }
    } else {
      if (['teamPath', 'parentId'].includes(dbField)) {
        console.log(`    ℹ️  ${dbField}: 管理后台未使用此字段`);
      } else {
        warnings.push(`User.${dbField}: 管理后台缺少此字段`);
      }
    }
  });

  return { issues, warnings };
};

// 边界值测试
const performBoundaryTests = async () => {
  console.log('\n🧪 开始边界值测试...\n');

  const userClient = createApiClient(API_BASE_URL, USER_TOKEN);
  const adminClient = createApiClient(API_BASE_URL, ADMIN_TOKEN);

  let testResults = [];

  // 测试用户数据边界值
  console.log('📋 测试用户数据边界值:');

  for (const [field, values] of Object.entries(BOUNDARY_TEST_DATA.User)) {
    console.log(`\n  🔍 测试字段: ${field}`);

    for (const testValue of values) {
      const testResult = {
        field,
        value: testValue,
        type: typeof testValue,
        status: 'unknown',
        error: null
      };

      try {
        console.log(`    测试值: ${JSON.stringify(testValue)}`);

        // 构造测试数据
        const testData = { [field]: testValue };

        // 尝试更新用户信息
        const response = await userClient.put('/users/me', testData);

        if (response.data.success) {
          testResult.status = 'success';
          console.log(`      ✅ 接受 - ${field}: ${JSON.stringify(testValue)}`);
        } else {
          testResult.status = 'rejected';
          testResult.error = response.data.message;
          console.log(`      ❌ 拒绝 - ${response.data.message}`);
        }
      } catch (error) {
        if (error.response) {
          testResult.status = 'error';
          testResult.error = error.response.data?.message || error.response.statusText;
          console.log(`      🚫 错误 - ${testResult.error}`);
        } else {
          testResult.status = 'network_error';
          testResult.error = error.message;
          console.log(`      🌐 网络错误 - ${error.message}`);
        }
      }

      testResults.push(testResult);

      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return testResults;
};

// 数据完整性验证
const verifyDataIntegrity = async () => {
  console.log('\n🔒 开始数据完整性验证...\n');

  const userClient = createApiClient(API_BASE_URL, USER_TOKEN);
  const adminClient = createApiClient(API_BASE_URL, ADMIN_TOKEN);

  let integrityResults = [];

  try {
    // 1. 验证用户数据完整性
    console.log('📋 验证用户数据完整性:');

    const userResponse = await userClient.get('/users/me');
    if (userResponse.data.success) {
      const userData = userResponse.data.data;

      console.log('  🔍 检查必需字段:');
      const requiredFields = ['id', 'openid', 'level', 'status'];

      for (const field of requiredFields) {
        if (userData[field]) {
          console.log(`    ✅ ${field}: ${userData[field]}`);
          integrityResults.push({
            type: 'field_check',
            entity: 'user',
            field,
            status: 'success',
            value: userData[field]
          });
        } else {
          console.log(`    ❌ ${field}: 缺失或为空`);
          integrityResults.push({
            type: 'field_check',
            entity: 'user',
            field,
            status: 'failed',
            value: null
          });
        }
      }

      // 2. 验证数据类型一致性
      console.log('\n  🔍 检查数据类型:');
      const expectedTypes = {
        id: 'string',
        level: 'string',
        status: 'string',
        pointsBalance: 'number',
        directCount: 'number',
        teamCount: 'number'
      };

      for (const [field, expectedType] of Object.entries(expectedTypes)) {
        const actualType = typeof userData[field];
        if (actualType === expectedType || (userData[field] === null && expectedType === 'object')) {
          console.log(`    ✅ ${field}: ${actualType}`);
          integrityResults.push({
            type: 'type_check',
            entity: 'user',
            field,
            status: 'success',
            expected: expectedType,
            actual: actualType
          });
        } else {
          console.log(`    ❌ ${field}: 期望 ${expectedType}, 实际 ${actualType}`);
          integrityResults.push({
            type: 'type_check',
            entity: 'user',
            field,
            status: 'failed',
            expected: expectedType,
            actual: actualType
          });
        }
      }

      // 3. 验证业务逻辑
      console.log('\n  🔍 检查业务逻辑:');

      // 检查积分余额是否为非负数
      if (userData.pointsBalance >= 0) {
        console.log(`    ✅ pointsBalance: ${userData.pointsBalance} (非负数)`);
        integrityResults.push({
          type: 'business_logic',
          entity: 'user',
          rule: 'points_balance_non_negative',
          status: 'success',
          value: userData.pointsBalance
        });
      } else {
        console.log(`    ❌ pointsBalance: ${userData.pointsBalance} (负数)`);
        integrityResults.push({
          type: 'business_logic',
          entity: 'user',
          rule: 'points_balance_non_negative',
          status: 'failed',
          value: userData.pointsBalance
        });
      }

      // 检查团队数量是否为非负整数
      if (Number.isInteger(userData.directCount) && userData.directCount >= 0) {
        console.log(`    ✅ directCount: ${userData.directCount} (非负整数)`);
        integrityResults.push({
          type: 'business_logic',
          entity: 'user',
          rule: 'direct_count_non_negative_integer',
          status: 'success',
          value: userData.directCount
        });
      } else {
        console.log(`    ❌ directCount: ${userData.directCount} (非负整数)`);
        integrityResults.push({
          type: 'business_logic',
          entity: 'user',
          rule: 'direct_count_non_negative_integer',
          status: 'failed',
          value: userData.directCount
        });
      }

    } else {
      console.log('  ❌ 获取用户数据失败');
    }

    // 4. 验证通券交易数据完整性
    console.log('\n📋 验证通券交易数据完整性:');

    try {
      const pointsResponse = await userClient.get('/points/balance');
      if (pointsResponse.data.success) {
        const pointsData = pointsResponse.data.data;

        const requiredPointsFields = ['balance', 'frozen'];
        for (const field of requiredPointsFields) {
          if (typeof pointsData[field] === 'number' && pointsData[field] >= 0) {
            console.log(`    ✅ ${field}: ${pointsData[field]}`);
            integrityResults.push({
              type: 'field_check',
              entity: 'points',
              field,
              status: 'success',
              value: pointsData[field]
            });
          } else {
            console.log(`    ❌ ${field}: ${pointsData[field]} (应为非负数)`);
            integrityResults.push({
              type: 'field_check',
              entity: 'points',
              field,
              status: 'failed',
              value: pointsData[field]
            });
          }
        }
      }
    } catch (error) {
      console.log(`  ⚠️ 通券数据检查失败: ${error.message}`);
    }

  } catch (error) {
    console.log(`  ❌ 数据完整性验证失败: ${error.message}`);
  }

  return integrityResults;
};

// 生成测试报告
const generateTestReport = (consistencyResults, boundaryResults, integrityResults) => {
  console.log('\n📊 生成数据验证测试报告...\n');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: consistencyResults.issues.length + consistencyResults.warnings.length,
      consistencyIssues: consistencyResults.issues.length,
      consistencyWarnings: consistencyResults.warnings.length,
      boundaryTests: boundaryResults.length,
      integrityChecks: integrityResults.length
    },
    consistency: consistencyResults,
    boundary: boundaryResults,
    integrity: integrityResults
  };

  // 统计边界测试结果
  const boundaryStats = {
    success: boundaryResults.filter(r => r.status === 'success').length,
    rejected: boundaryResults.filter(r => r.status === 'rejected').length,
    error: boundaryResults.filter(r => r.status === 'error').length,
    network_error: boundaryResults.filter(r => r.status === 'network_error').length
  };

  // 统计完整性检查结果
  const integrityStats = {
    success: integrityResults.filter(r => r.status === 'success').length,
    failed: integrityResults.filter(r => r.status === 'failed').length
  };

  // 打印报告摘要
  console.log('=' * 60);
  console.log('📋 数据验证测试报告');
  console.log('=' * 60);
  console.log(`🕐 测试时间: ${report.timestamp}`);
  console.log('');

  console.log('📊 测试摘要:');
  console.log(`  🔍 数据格式一致性:`);
  console.log(`    ❌ 严重问题: ${report.summary.consistencyIssues}`);
  console.log(`    ⚠️  警告: ${report.summary.consistencyWarnings}`);
  console.log(`  🧪 边界值测试: ${report.summary.boundaryTests} 项`);
  console.log(`    ✅ 成功: ${boundaryStats.success}`);
  console.log(`    ❌ 拒绝: ${boundaryStats.rejected}`);
  console.log(`    🚫 错误: ${boundaryStats.error}`);
  console.log(`    🌐 网络错误: ${boundaryStats.network_error}`);
  console.log(`  🔒 完整性检查: ${report.summary.integrityChecks} 项`);
  console.log(`    ✅ 通过: ${integrityStats.success}`);
  console.log(`    ❌ 失败: ${integrityStats.failed}`);

  // 详细结果
  if (consistencyResults.issues.length > 0) {
    console.log('\n❌ 严重问题:');
    consistencyResults.issues.forEach(issue => console.log(`  - ${issue}`));
  }

  if (consistencyResults.warnings.length > 0) {
    console.log('\n⚠️  警告:');
    consistencyResults.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  // 计算总体评分
  const totalChecks = report.summary.consistencyIssues +
                      report.summary.boundaryTests +
                      report.summary.integrityChecks;
  const totalFailures = report.summary.consistencyIssues +
                        boundaryStats.error +
                        integrityStats.failed;

  const successRate = totalChecks > 0 ? ((totalChecks - totalFailures) / totalChecks * 100).toFixed(1) : 0;

  console.log('\n🎯 总体评分:');
  console.log(`  成功率: ${successRate}%`);

  if (successRate >= 90) {
    console.log('  🟢 数据质量: 优秀');
  } else if (successRate >= 75) {
    console.log('  🟡 数据质量: 良好');
  } else if (successRate >= 60) {
    console.log('  🟠 数据质量: 一般');
  } else {
    console.log('  🔴 数据质量: 需要改进');
  }

  // 保存报告到文件
  const reportPath = path.join(__dirname, `data-validation-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);

  return { report, successRate };
};

// 主测试函数
const runDataValidationTests = async () => {
  console.log('🚀 开始数据验证测试...\n');

  try {
    // 1. 数据格式一致性检查
    const consistencyResults = checkDataFormatConsistency();

    // 2. 边界值测试
    const boundaryResults = await performBoundaryTests();

    // 3. 数据完整性验证
    const integrityResults = await verifyDataIntegrity();

    // 4. 生成测试报告
    const { report, successRate } = generateTestReport(
      consistencyResults,
      boundaryResults,
      integrityResults
    );

    return { report, successRate };

  } catch (error) {
    console.error('❌ 数据验证测试失败:', error);
    throw error;
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  runDataValidationTests()
    .then(({ successRate }) => {
      console.log(`\n✅ 数据验证测试完成 (成功率: ${successRate}%)`);
      process.exit(successRate >= 75 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  runDataValidationTests,
  checkDataFormatConsistency,
  performBoundaryTests,
  verifyDataIntegrity,
  generateTestReport
};