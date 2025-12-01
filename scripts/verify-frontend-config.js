#!/usr/bin/env node

/**
 * 验证环境变量配置的测试脚本
 * 用于测试 H5 和 Admin 项目的运行时配置功能
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 开始验证前端项目环境变量配置...\n');

// 项目配置
const projects = [
  {
    name: 'H5前端',
    path: path.join(__dirname, '../../zhongdao-h5'),
    configFile: 'src/config/index.ts',
    mainFile: 'src/main.tsx',
    indexHTML: 'index.html',
    injectScript: 'scripts/inject-config.js',
  },
  {
    name: 'Admin管理后台',
    path: path.join(__dirname, '../../zhongdao-admin'),
    configFile: 'src/config/index.ts',
    mainFile: 'src/main.tsx',
    indexHTML: 'index.html',
    injectScript: 'scripts/inject-config.js',
  }
];

let allPassed = true;

// 验证单个项目
function validateProject(project) {
  console.log(`\n📦 验证项目: ${project.name}`);
  console.log(`   路径: ${project.path}`);
  
  const checks = [];
  
  // 1. 检查项目目录是否存在
  const projectExists = fs.existsSync(project.path);
  checks.push({
    name: '项目目录存在',
    passed: projectExists,
    message: projectExists ? '✅ 通过' : '❌ 失败: 项目目录不存在'
  });
  
  if (!projectExists) {
    return checks;
  }
  
  // 2. 检查配置模块
  const configPath = path.join(project.path, project.configFile);
  const configExists = fs.existsSync(configPath);
  checks.push({
    name: '配置模块存在',
    passed: configExists,
    message: configExists ? '✅ 通过' : '❌ 失败: src/config/index.ts 不存在'
  });
  
  // 3. 检查配置模块内容
  if (configExists) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const hasGetConfigFromDOM = configContent.includes('getConfigFromDOM');
    const hasGetConfigFromEnv = configContent.includes('getConfigFromEnv');
    const hasValidateConfig = configContent.includes('validateConfig');
    
    checks.push({
      name: '配置模块包含DOM读取',
      passed: hasGetConfigFromDOM,
      message: hasGetConfigFromDOM ? '✅ 通过' : '❌ 失败: 缺少 getConfigFromDOM 函数'
    });
    
    checks.push({
      name: '配置模块包含环境变量读取',
      passed: hasGetConfigFromEnv,
      message: hasGetConfigFromEnv ? '✅ 通过' : '❌ 失败: 缺少 getConfigFromEnv 函数'
    });
    
    checks.push({
      name: '配置模块包含验证函数',
      passed: hasValidateConfig,
      message: hasValidateConfig ? '✅ 通过' : '❌ 失败: 缺少 validateConfig 函数'
    });
  }
  
  // 4. 检查 main.tsx
  const mainPath = path.join(project.path, project.mainFile);
  const mainExists = fs.existsSync(mainPath);
  checks.push({
    name: 'main.tsx 存在',
    passed: mainExists,
    message: mainExists ? '✅ 通过' : '❌ 失败: src/main.tsx 不存在'
  });
  
  if (mainExists) {
    const mainContent = fs.readFileSync(mainPath, 'utf-8');
    const importsConfig = mainContent.includes('from \'./config\'');
    const callsValidate = mainContent.includes('validateConfig()');
    
    checks.push({
      name: 'main.tsx 导入配置',
      passed: importsConfig,
      message: importsConfig ? '✅ 通过' : '❌ 失败: main.tsx 未导入配置模块'
    });
    
    checks.push({
      name: 'main.tsx 调用验证',
      passed: callsValidate,
      message: callsValidate ? '✅ 通过' : '❌ 失败: main.tsx 未调用 validateConfig()'
    });
  }
  
  // 5. 检查 index.html
  const htmlPath = path.join(project.path, project.indexHTML);
  const htmlExists = fs.existsSync(htmlPath);
  checks.push({
    name: 'index.html 存在',
    passed: htmlExists,
    message: htmlExists ? '✅ 通过' : '❌ 失败: index.html 不存在'
  });
  
  if (htmlExists) {
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const hasDataApiBase = htmlContent.includes('data-api-base=');
    const hasPlaceholder = htmlContent.includes('${API_BASE}');
    
    checks.push({
      name: 'index.html 包含 data 属性',
      passed: hasDataApiBase,
      message: hasDataApiBase ? '✅ 通过' : '❌ 失败: index.html 缺少 data-api-base 属性'
    });
    
    checks.push({
      name: 'index.html 包含占位符',
      passed: hasPlaceholder,
      message: hasPlaceholder ? '✅ 通过' : '❌ 失败: index.html 缺少 ${API_BASE} 占位符'
    });
  }
  
  // 6. 检查注入脚本
  const scriptPath = path.join(project.path, project.injectScript);
  const scriptExists = fs.existsSync(scriptPath);
  checks.push({
    name: '配置注入脚本存在',
    passed: scriptExists,
    message: scriptExists ? '✅ 通过' : '❌ 失败: scripts/inject-config.js 不存在'
  });
  
  // 7. 检查 package.json
  const pkgPath = path.join(project.path, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const hasBuildProd = !!pkg.scripts['build:prod'];
    const hasDeploy = !!pkg.scripts['deploy'];
    
    checks.push({
      name: 'package.json 有 build:prod',
      passed: hasBuildProd,
      message: hasBuildProd ? '✅ 通过' : '❌ 失败: package.json 缺少 build:prod 脚本'
    });
    
    checks.push({
      name: 'package.json 有 deploy',
      passed: hasDeploy,
      message: hasDeploy ? '✅ 通过' : '❌ 失败: package.json 缺少 deploy 脚本'
    });
  }
  
  // 输出检查结果
  checks.forEach((check, index) => {
    console.log(`   ${index + 1}. ${check.message}`);
    if (!check.passed) {
      allPassed = false;
    }
  });
  
  return checks;
}

// 验证所有项目
projects.forEach(project => {
  validateProject(project);
});

// 总结
console.log('\n' + '='.repeat(60));
console.log('📊 验证总结');
console.log('='.repeat(60));

if (allPassed) {
  console.log('✅ 所有检查通过！前端环境变量配置已正确实施。');
  console.log('\n💡 下一步:');
  console.log('   1. 在开发环境测试: npm run dev');
  console.log('   2. 构建生产版本: npm run deploy:prod');
  console.log('   3. 检查浏览器控制台: window.__APP_CONFIG__');
} else {
  console.log('❌ 部分检查未通过，请检查上述失败项。');
  process.exit(1);
}

console.log('\n');
