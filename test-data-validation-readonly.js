/**
 * 只读数据验证测试脚本
 * 专注于前后端数据格式一致性检查和数据完整性验证
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

// 改进的类型映射函数
const mapDatabaseTypeToJSType = (dbType) => {
  if (dbType.endsWith('?')) return 'string | null'; // nullable string field
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

// 前端接口字段类型定义（修复后）
const H5_INTERFACE_SCHEMA = {
  UserProfile: {
    id: 'string',
    nickname: 'string | null',
    phone: 'string | null',
    avatarUrl: 'string | null',
    level: 'string',
    pointsBalance: 'number',
    referralCode: 'string | null',
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

// 管理后台接口字段类型定义（修复后）
const ADMIN_INTERFACE_SCHEMA = {
  User: {
    id: 'string',
    openid: 'string',
    nickname: 'string | null',
    phone: 'string | null',
    avatarUrl: 'string | null',
    level: 'string',
    status: 'string',
    totalSales: 'number',
    directCount: 'number',
    teamCount: 'number',
    pointsBalance: 'number',
    referralCode: 'string | null',
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

// 字段名映射函数
const mapFieldName = (dbField, targetInterface) => {
  const mappings = {
    'H5': {
      'avatar_url': 'avatarUrl',
      'referral_code': 'referralCode'
    },
    'Admin': {
      'avatar_url': 'avatarUrl',
      'referral_code': 'referralCode'
    }
  };

  const interfaceMappings = mappings[targetInterface] || {};
  return interfaceMappings[dbField] || dbField;
};

// 检查数据格式一致性
const checkDataFormatConsistency = () => {
  console.log('🔍 开始前后端数据格式一致性检查...\n');

  let issues = [];
  let warnings = [];
  let successes = [];

  // 检查User模型
  console.log('📋 检查User模型数据格式一致性:');

  const userFields = Object.keys(DATABASE_SCHEMA.User);

  // H5前端User接口检查
  console.log('  🎯 H5前端UserProfile接口:');
  const h5UserFields = Object.keys(H5_INTERFACE_SCHEMA.UserProfile);

  userFields.forEach(dbField => {
    const dbType = mapDatabaseTypeToJSType(DATABASE_SCHEMA.User[dbField]);
    const mappedFieldName = mapFieldName(dbField, 'H5');
    const h5Field = h5UserFields.find(field =>
      field.toLowerCase() === mappedFieldName.toLowerCase()
    );

    if (h5Field) {
      const h5Type = H5_INTERFACE_SCHEMA.UserProfile[h5Field];
      if (dbType === h5Type) {
        console.log(`    ✅ ${dbField}: ${dbType}`);
        successes.push(`User.${dbField}: DB(${dbType}) = H5(${h5Type})`);
      } else {
        // 检查是否是合理的类型差异
        if ((dbType === 'string | null' && h5Type === 'string') ||
            (dbType === 'string' && h5Type === 'string | null')) {
          console.log(`    ⚠️  ${dbField}: DB(${dbType}) vs H5(${h5Type}) - 可为空的差异`);
          warnings.push(`User.${dbField}: DB类型(${dbType}) vs H5类型(${h5Type}) - 可为空性差异`);
        } else {
          console.log(`    ❌ ${dbField}: DB(${dbType}) ≠ H5(${h5Type})`);
          issues.push(`User.${dbField}: DB类型(${dbType}) ≠ H5类型(${h5Type})`);
        }
      }
    } else {
      if (['updatedAt', 'openid', 'parentId', 'teamPath'].includes(dbField)) {
        console.log(`    ℹ️  ${dbField}: H5端未使用此字段`);
      } else {
        console.log(`    ⚠️  ${dbField}: H5端缺少此字段`);
        warnings.push(`User.${dbField}: H5端缺少此字段`);
      }
    }
  });

  // 检查H5端独有字段
  h5UserFields.forEach(h5Field => {
    const dbField = userFields.find(field => {
      const mappedField = mapFieldName(field, 'H5');
      return mappedField.toLowerCase() === h5Field.toLowerCase();
    });
    if (!dbField && !['teamCount', 'directCount'].includes(h5Field)) {
      console.log(`    ⚠️  ${h5Field}: 后端缺少此字段`);
      warnings.push(`UserProfile.${h5Field}: 后端缺少此字段`);
    }
  });

  // 管理后台User接口检查
  console.log('\n  🎯 管理后台User接口:');
  const adminUserFields = Object.keys(ADMIN_INTERFACE_SCHEMA.User);

  userFields.forEach(dbField => {
    const dbType = mapDatabaseTypeToJSType(DATABASE_SCHEMA.User[dbField]);
    const mappedFieldName = mapFieldName(dbField, 'Admin');
    const adminField = adminUserFields.find(field =>
      field.toLowerCase() === mappedFieldName.toLowerCase()
    );

    if (adminField) {
      const adminType = ADMIN_INTERFACE_SCHEMA.User[adminField];
      if (dbType === adminType) {
        console.log(`    ✅ ${dbField}: ${dbType}`);
        successes.push(`User.${dbField}: DB(${dbType}) = Admin(${adminType})`);
      } else {
        if ((dbType === 'string | null' && adminType === 'string') ||
            (dbType === 'string' && adminType === 'string | null')) {
          console.log(`    ⚠️  ${dbField}: DB(${dbType}) vs Admin(${adminType}) - 可为空的差异`);
          warnings.push(`User.${dbField}: DB类型(${dbType}) vs Admin类型(${adminType}) - 可为空性差异`);
        } else {
          console.log(`    ❌ ${dbField}: DB(${dbType}) ≠ Admin(${adminType})`);
          issues.push(`User.${dbField}: DB类型(${dbType}) ≠ Admin类型(${adminType})`);
        }
      }
    } else {
      if (['teamPath', 'parentId'].includes(dbField)) {
        console.log(`    ℹ️  ${dbField}: 管理后台未使用此字段`);
      } else {
        console.log(`    ⚠️  ${dbField}: 管理后台缺少此字段`);
        warnings.push(`User.${dbField}: 管理后台缺少此字段`);
      }
    }
  });

  return { issues, warnings, successes };
};

// 数据完整性验证（只读）
const verifyDataIntegrity = async () => {
  console.log('\n🔒 开始数据完整性验证（只读模式）...\n');

  const userClient = createApiClient(API_BASE_URL, USER_TOKEN);
  const adminClient = createApiClient(API_BASE_URL, ADMIN_TOKEN);

  let integrityResults = [];
  let testResults = {
    userData: false,
    pointsData: false,
    adminUserList: false,
    adminDashboard: false
  };

  try {
    // 1. 验证用户数据完整性
    console.log('📋 验证用户数据完整性:');

    try {
      const userResponse = await userClient.get('/users/me');
      if (userResponse.data.success) {
        const userData = userResponse.data.data;
        testResults.userData = true;

        console.log('  🔍 检查必需字段:');
        const requiredFields = ['id', 'level', 'status'];

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

        // 检查可选字段
        console.log('  🔍 检查可选字段:');
        const optionalFields = ['nickname', 'phone', 'avatarUrl', 'referralCode'];

        for (const field of optionalFields) {
          const mappedField = mapFieldName(field, 'H5');
          const value = userData[mappedField];
          console.log(`    ℹ️  ${mappedField}: ${value || 'null'}`);
          integrityResults.push({
            type: 'optional_field_check',
            entity: 'user',
            field: mappedField,
            status: 'checked',
            value: value
          });
        }

        // 验证数据类型
        console.log('  🔍 检查数据类型:');
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
            console.log(`    ✅ ${field}: ${actualType} (${userData[field]})`);
            integrityResults.push({
              type: 'type_check',
              entity: 'user',
              field,
              status: 'success',
              expected: expectedType,
              actual: actualType,
              value: userData[field]
            });
          } else {
            console.log(`    ❌ ${field}: 期望 ${expectedType}, 实际 ${actualType}`);
            integrityResults.push({
              type: 'type_check',
              entity: 'user',
              field,
              status: 'failed',
              expected: expectedType,
              actual: actualType,
              value: userData[field]
            });
          }
        }

        // 验证业务逻辑
        console.log('  🔍 检查业务逻辑:');
        const businessChecks = [
          {
            field: 'pointsBalance',
            rule: 'points_balance_non_negative',
            check: (value) => typeof value === 'number' && value >= 0
          },
          {
            field: 'directCount',
            rule: 'direct_count_non_negative_integer',
            check: (value) => Number.isInteger(value) && value >= 0
          },
          {
            field: 'teamCount',
            rule: 'team_count_non_negative_integer',
            check: (value) => Number.isInteger(value) && value >= 0
          }
        ];

        for (const { field, rule, check } of businessChecks) {
          const value = userData[field];
          if (check(value)) {
            console.log(`    ✅ ${field}: ${value} (通过${rule}检查)`);
            integrityResults.push({
              type: 'business_logic',
              entity: 'user',
              rule,
              status: 'success',
              value
            });
          } else {
            console.log(`    ❌ ${field}: ${value} (未通过${rule}检查)`);
            integrityResults.push({
              type: 'business_logic',
              entity: 'user',
              rule,
              status: 'failed',
              value
            });
          }
        }

      } else {
        console.log('  ❌ 用户数据获取失败: ' + userResponse.data.message);
      }
    } catch (error) {
      console.log(`  ❌ 用户数据检查失败: ${error.message}`);
    }

    // 2. 验证通券数据完整性
    console.log('\n📋 验证通券数据完整性:');
    try {
      const pointsResponse = await userClient.get('/points/balance');
      if (pointsResponse.data.success) {
        const pointsData = pointsResponse.data.data;
        testResults.pointsData = true;

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
      } else {
        console.log('  ❌ 通券数据获取失败: ' + pointsResponse.data.message);
      }
    } catch (error) {
      console.log(`  ⚠️ 通券数据检查失败: ${error.message}`);
    }

    // 3. 验证管理后台数据
    console.log('\n📋 验证管理后台数据完整性:');

    try {
      const adminUsersResponse = await adminClient.get('/admin/users', { params: { page: 1, perPage: 5 } });
      if (adminUsersResponse.data.success) {
        testResults.adminUserList = true;
        console.log('    ✅ 管理员用户列表获取成功');

        const users = adminUsersResponse.data.data.items;
        if (users && users.length > 0) {
          console.log(`    ℹ️  获取到 ${users.length} 个用户数据`);

          // 检查第一个用户的数据结构
          const sampleUser = users[0];
          const requiredAdminFields = ['id', 'openid', 'level', 'status'];

          for (const field of requiredAdminFields) {
            if (sampleUser[field]) {
              console.log(`      ✅ ${field}: 存在`);
              integrityResults.push({
                type: 'admin_field_check',
                entity: 'admin_user',
                field,
                status: 'success'
              });
            } else {
              console.log(`      ❌ ${field}: 缺失`);
              integrityResults.push({
                type: 'admin_field_check',
                entity: 'admin_user',
                field,
                status: 'failed'
              });
            }
          }
        }
      } else {
        console.log('  ❌ 管理员用户列表获取失败: ' + adminUsersResponse.data.message);
      }
    } catch (error) {
      console.log(`  ⚠️ 管理后台数据检查失败: ${error.message}`);
    }

    try {
      const adminDashboardResponse = await adminClient.get('/admin/dashboard/overview');
      if (adminDashboardResponse.data.success) {
        testResults.adminDashboard = true;
        console.log('    ✅ 管理员仪表板数据获取成功');

        const dashboardData = adminDashboardResponse.data.data;
        const dashboardFields = ['totalUsers', 'totalOrders', 'totalSales'];

        for (const field of dashboardFields) {
          if (typeof dashboardData[field] === 'number' && dashboardData[field] >= 0) {
            console.log(`      ✅ ${field}: ${dashboardData[field]}`);
            integrityResults.push({
              type: 'dashboard_field_check',
              entity: 'admin_dashboard',
              field,
              status: 'success',
              value: dashboardData[field]
            });
          } else {
            console.log(`      ❌ ${field}: ${dashboardData[field]} (应为非负数)`);
            integrityResults.push({
              type: 'dashboard_field_check',
              entity: 'admin_dashboard',
              field,
              status: 'failed',
              value: dashboardData[field]
            });
          }
        }
      } else {
        console.log('  ❌ 管理员仪表板数据获取失败: ' + adminDashboardResponse.data.message);
      }
    } catch (error) {
      console.log(`  ⚠️ 管理员仪表板检查失败: ${error.message}`);
    }

  } catch (error) {
    console.log(`  ❌ 数据完整性验证失败: ${error.message}`);
  }

  return { integrityResults, testResults };
};

// 生成改进的测试报告
const generateTestReport = (consistencyResults, integrityResults) => {
  console.log('\n📊 生成数据验证测试报告...\n');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: consistencyResults.issues.length + consistencyResults.warnings.length,
      consistencyIssues: consistencyResults.issues.length,
      consistencyWarnings: consistencyResults.warnings.length,
      consistencySuccesses: consistencyResults.successes.length,
      integrityChecks: integrityResults.integrityResults.length,
      testSuccess: integrityResults.testResults
    },
    consistency: consistencyResults,
    integrity: integrityResults
  };

  // 统计完整性检查结果
  const integrityStats = {
    success: integrityResults.integrityResults.filter(r => r.status === 'success').length,
    failed: integrityResults.integrityResults.filter(r => r.status === 'failed').length,
    checked: integrityResults.integrityResults.filter(r => r.status === 'checked').length
  };

  // 打印报告摘要
  console.log('='.repeat(60));
  console.log('📋 数据验证测试报告（只读模式）');
  console.log('='.repeat(60));
  console.log(`🕐 测试时间: ${report.timestamp}`);
  console.log('');

  console.log('📊 测试摘要:');
  console.log(`  🔍 数据格式一致性:`);
  console.log(`    ✅ 成功: ${report.summary.consistencySuccesses}`);
  console.log(`    ❌ 严重问题: ${report.summary.consistencyIssues}`);
  console.log(`    ⚠️  警告: ${report.summary.consistencyWarnings}`);
  console.log(`  🔒 完整性检查: ${report.summary.integrityChecks} 项`);
  console.log(`    ✅ 通过: ${integrityStats.success}`);
  console.log(`    ❌ 失败: ${integrityStats.failed}`);
  console.log(`    ℹ️  已检查: ${integrityStats.checked}`);

  console.log(`  🧪 API测试状态:`);
  console.log(`    👤 用户数据: ${report.summary.testSuccess.userData ? '✅' : '❌'}`);
  console.log(`    💰 通券数据: ${report.summary.testSuccess.pointsData ? '✅' : '❌'}`);
  console.log(`    👥 管理员用户: ${report.summary.testSuccess.adminUserList ? '✅' : '❌'}`);
  console.log(`    📊 管理员仪表板: ${report.summary.testSuccess.adminDashboard ? '✅' : '❌'}`);

  // 详细结果
  if (consistencyResults.issues.length > 0) {
    console.log('\n❌ 严重问题:');
    consistencyResults.issues.forEach(issue => console.log(`  - ${issue}`));
  }

  if (consistencyResults.warnings.length > 0) {
    console.log('\n⚠️  警告:');
    consistencyResults.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (consistencyResults.successes.length > 0) {
    console.log('\n✅ 成功匹配的字段:');
    consistencyResults.successes.slice(0, 10).forEach(success => console.log(`  - ${success}`));
    if (consistencyResults.successes.length > 10) {
      console.log(`  ... 还有 ${consistencyResults.successes.length - 10} 个成功匹配的字段`);
    }
  }

  // 计算总体评分
  const totalChecks = report.summary.consistencySuccesses +
                      report.summary.consistencyIssues +
                      report.summary.consistencyWarnings +
                      integrityStats.success +
                      integrityStats.failed;

  const totalSuccesses = report.summary.consistencySuccesses + integrityStats.success;
  const successRate = totalChecks > 0 ? ((totalSuccesses / totalChecks) * 100).toFixed(1) : 0;

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
  const reportPath = path.join(__dirname, `data-validation-report-readonly-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);

  return { report, successRate: parseFloat(successRate) };
};

// 主测试函数
const runReadOnlyDataValidationTests = async () => {
  console.log('🚀 开始只读数据验证测试...\n');

  try {
    // 1. 数据格式一致性检查
    const consistencyResults = checkDataFormatConsistency();

    // 2. 数据完整性验证（只读）
    const integrityResults = await verifyDataIntegrity();

    // 3. 生成测试报告
    const { report, successRate } = generateTestReport(consistencyResults, integrityResults);

    return { report, successRate };

  } catch (error) {
    console.error('❌ 只读数据验证测试失败:', error);
    throw error;
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  runReadOnlyDataValidationTests()
    .then(({ successRate }) => {
      console.log(`\n✅ 只读数据验证测试完成 (成功率: ${successRate}%)`);
      process.exit(successRate >= 75 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  runReadOnlyDataValidationTests,
  checkDataFormatConsistency,
  verifyDataIntegrity,
  generateTestReport
};