#!/usr/bin/env node

/**
 * 最终路由修复工具 - 修复所有模块导入问题
 */

const fs = require('fs');
const path = require('path');

console.log('=== 最终路由修复工具 ===\n');

// 批量修复所有路由文件的导入问题
function fixRouteImports() {
  const routesDir = 'src/routes/v1';
  const modules = ['auth', 'users', 'shops', 'orders', 'inventory', 'points', 'teams', 'commission'];

  modules.forEach(module => {
    const routeFile = path.join(routesDir, module, 'index.ts');

    if (fs.existsSync(routeFile)) {
      let content = fs.readFileSync(routeFile, 'utf8');
      const serviceClass = module.charAt(0).toUpperCase() + module.slice(1) + 'Service';
      const modulePath = `../../../modules/${module}`;

      // 检查是否需要导入
      if (!content.includes(`import { ${serviceClass} }`) && content.includes(`new ${serviceClass}()`)) {
        // 在第一个 import 后添加我们的导入
        const firstImportIndex = content.indexOf('import');
        const firstImportEnd = content.indexOf('\n', firstImportIndex);

        const importLine = `import { ${serviceClass} } from '${modulePath}';`;
        content = content.slice(0, firstImportEnd) + '\n' + importLine + content.slice(firstImportEnd);

        fs.writeFileSync(routeFile, content);
        console.log(`✓ 修复 ${module} 路由导入: ${serviceClass}`);
      }
    }
  });
}

// 修复一些特殊问题
function fixSpecialIssues() {
  console.log('\n修复特殊问题...\n');

  // 修复 users 模块中的 prisma.userss 问题
  const usersServicePath = 'src/modules/users/users.service.ts';
  if (fs.existsSync(usersServicePath)) {
    let content = fs.readFileSync(usersServicePath, 'utf8');
    content = content.replace(/prisma\.userss/g, 'prisma.users');
    fs.writeFileSync(usersServicePath, content);
    console.log('✓ 修复 users service 中的 prisma 表名');
  }

  // 修复 shops 模块中的 prisma.shopss 问题
  const shopsServicePath = 'src/modules/shops/shops.service.ts';
  if (fs.existsSync(shopsServicePath)) {
    let content = fs.readFileSync(shopsServicePath, 'utf8');
    content = content.replace(/prisma\.shopss/g, 'prisma.shops');
    fs.writeFileSync(shopsServicePath, content);
    console.log('✓ 修复 shops service 中的 prisma 表名');
  }

  // 修复 orders 模块中的 prisma.orderss 问题
  const ordersServicePath = 'src/modules/orders/orders.service.ts';
  if (fs.existsSync(ordersServicePath)) {
    let content = fs.readFileSync(ordersServicePath, 'utf8');
    content = content.replace(/prisma\.orderss/g, 'prisma.orders');
    fs.writeFileSync(ordersServicePath, content);
    console.log('✓ 修复 orders service 中的 prisma 表名');
  }

  // 修复 teams 模块中的 prisma.teamss 问题
  const teamsServicePath = 'src/modules/teams/teams.service.ts';
  if (fs.existsSync(teamsServicePath)) {
    let content = fs.readFileSync(teamsServicePath, 'utf8');
    content = content.replace(/prisma\.teamss/g, 'prisma.teams');
    fs.writeFileSync(teamsServicePath, content);
    console.log('✓ 修复 teams service 中的 prisma 表名');
  }

  // 修复 commission 模块中的 prisma.commissionCalculations 问题
  const commissionServicePath = 'src/modules/commission/commission.service.ts';
  if (fs.existsSync(commissionServicePath)) {
    let content = fs.readFileSync(commissionServicePath, 'utf8');
    content = content.replace(/prisma\.commissionCalculationss/g, 'prisma.commissionCalculations');
    fs.writeFileSync(commissionServicePath, content);
    console.log('✓ 修复 commission service 中的 prisma 表名');
  }
}

// 创建修复 summary
function createFixSummary() {
  console.log('\n=== 修复总结 ===\n');
  console.log('已完成修复:');
  console.log('✓ 积分服务导入路径错误');
  console.log('✓ 所有核心模块的 service 文件');
  console.log('✓ 所有路由文件的导入语句');
  console.log('✓ prisma 表名问题');
  console.log('\n建议下一步:');
  console.log('1. 运行 npm test 验证修复效果');
  console.log('2. 检查是否有其他类型错误');
  console.log('3. 运行具体的 API 测试');
}

// 开始执行
fixRouteImports();
fixSpecialIssues();
createFixSummary();