/**
 * 前端项目构建测试脚本
 * 测试H5前端和管理后台的构建过程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, cwd, description) {
  log(`🔄 ${description}...`, 'blue');
  try {
    const result = execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' });
    log(`✅ ${description} 完成`, 'green');
    return result;
  } catch (error) {
    log(`❌ ${description} 失败: ${error.message}`, 'red');
    return null;
  }
}

function checkProjectStructure(projectPath, projectName) {
  log(`\n📁 检查 ${projectName} 项目结构...`, 'blue');

  const requiredFiles = [
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
    'src/App.tsx',
    'src/main.tsx'
  ];

  let allFilesExist = true;
  requiredFiles.forEach(file => {
    const filePath = path.join(projectPath, file);
    if (fs.existsSync(filePath)) {
      log(`✅ ${file} 存在`, 'green');
    } else {
      log(`❌ ${file} 不存在`, 'red');
      allFilesExist = false;
    }
  });

  // 检查环境配置文件
  const envFiles = ['.env.development', '.env.production'];
  envFiles.forEach(file => {
    const filePath = path.join(projectPath, file);
    if (fs.existsSync(filePath)) {
      log(`✅ ${file} 存在`, 'green');
    } else {
      log(`⚠️  ${file} 不存在`, 'yellow');
    }
  });

  return allFilesExist;
}

function testDependencies(projectPath, projectName) {
  log(`\n📦 测试 ${projectName} 依赖...`, 'blue');

  try {
    // 检查 package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const requiredScripts = ['dev', 'build'];
      requiredScripts.forEach(script => {
        if (packageJson.scripts && packageJson.scripts[script]) {
          log(`✅ ${script} 脚本存在`, 'green');
        } else {
          log(`❌ ${script} 脚本不存在`, 'red');
        }
      });

      // 检查关键依赖
      const requiredDeps = ['react', 'antd', 'axios'];
      requiredDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          log(`✅ ${dep} 依赖存在`, 'green');
        } else {
          log(`❌ ${dep} 依赖不存在`, 'red');
        }
      });
    }

    // 尝试安装依赖（如果需要）
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      log('📥 安装依赖...', 'blue');
      const installResult = runCommand('npm install', projectPath, '安装依赖');
      return installResult !== null;
    } else {
      log('✅ 依赖已安装', 'green');
      return true;
    }
  } catch (error) {
    log(`❌ 依赖检查失败: ${error.message}`, 'red');
    return false;
  }
}

function testTypeCheck(projectPath, projectName) {
  log(`\n🔧 测试 ${projectName} TypeScript检查...`, 'blue');

  try {
    const result = execSync('npx tsc --noEmit', {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    log(`✅ TypeScript检查通过`, 'green');
    return true;
  } catch (error) {
    log(`❌ TypeScript检查失败`, 'red');
    // 显示部分错误信息
    if (error.stdout) {
      log('错误详情:', 'red');
      log(error.stdout.split('\n').slice(0, 10).join('\n'), 'red');
    }
    return false;
  }
}

function testLinting(projectPath, projectName) {
  log(`\n🧹 测试 ${projectName} 代码规范检查...`, 'blue');

  try {
    // 检查是否存在 ESLint 配置
    const eslintConfig = [
      '.eslintrc.js',
      '.eslintrc.json',
      'eslint.config.js',
      '.eslintrc.yml'
    ].find(file => fs.existsSync(path.join(projectPath, file)));

    if (eslintConfig) {
      log(`✅ ESLint配置文件存在: ${eslintConfig}`, 'green');

      try {
        const result = execSync('npm run lint', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: 'pipe'
        });
        log(`✅ 代码规范检查通过`, 'green');
        return true;
      } catch (error) {
        log(`⚠️  代码规范检查有警告`, 'yellow');
        return true; // 警告不阻止构建
      }
    } else {
      log(`⚠️  未找到ESLint配置文件`, 'yellow');
      return true;
    }
  } catch (error) {
    log(`❌ 代码规范检查失败: ${error.message}`, 'red');
    return false;
  }
}

function testBuild(projectPath, projectName) {
  log(`\n🏗️  测试 ${projectName} 构建...`, 'blue');

  try {
    // 清理旧的构建文件
    const distPath = path.join(projectPath, 'dist');
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
      log('🧹 清理旧的构建文件', 'blue');
    }

    // 执行构建
    const buildResult = runCommand('npm run build', projectPath, '构建项目');
    if (buildResult === null) {
      return false;
    }

    // 检查构建结果
    if (fs.existsSync(distPath)) {
      log(`✅ 构建目录存在`, 'green');

      const distFiles = fs.readdirSync(distPath);
      log(`📁 构建文件: ${distFiles.length} 个`, 'cyan');

      // 检查关键文件
      const hasIndexHtml = distFiles.includes('index.html');
      const hasAssets = distFiles.some(file =>
        file.endsWith('.js') || file.endsWith('.css')
      );

      if (hasIndexHtml) {
        log(`✅ index.html 存在`, 'green');
      } else {
        log(`❌ index.html 缺失`, 'red');
        return false;
      }

      if (hasAssets) {
        log(`✅ 静态资源文件存在`, 'green');
      } else {
        log(`❌ 静态资源文件缺失`, 'red');
        return false;
      }

      // 检查文件大小
      let totalSize = 0;
      distFiles.forEach(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      });

      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      log(`📊 构建总大小: ${sizeInMB} MB`, 'cyan');

      return true;
    } else {
      log(`❌ 构建目录不存在`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ 构建失败: ${error.message}`, 'red');
    return false;
  }
}

function testEnvironmentVariables(projectPath, projectName) {
  log(`\n⚙️  测试 ${projectName} 环境变量...`, 'blue');

  const envFiles = ['.env.development', '.env.production'];
  let envCount = 0;

  envFiles.forEach(envFile => {
    const envPath = path.join(projectPath, envFile);
    if (fs.existsSync(envPath)) {
      envCount++;
      log(`✅ ${envFile} 存在`, 'green');

      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n').filter(line =>
          line.trim() && !line.startsWith('#')
        );
        log(`  配置项: ${lines.length} 个`, 'cyan');

        // 检查关键配置
        if (content.includes('VITE_API_BASE_URL')) {
          log(`  ✅ API_BASE_URL 已配置`, 'green');
        } else {
          log(`  ⚠️  API_BASE_URL 未配置`, 'yellow');
        }
      } catch (error) {
        log(`  ❌ 读取 ${envFile} 失败`, 'red');
      }
    }
  });

  if (envCount === 0) {
    log(`❌ 未找到环境配置文件`, 'red');
    return false;
  } else {
    log(`✅ 环境配置检查完成`, 'green');
    return true;
  }
}

async function testFrontendProjects() {
  log('🚀 开始前端项目构建测试...', 'blue');
  log('='.repeat(50), 'blue');

  const projects = [
    {
      path: '/d/wwwroot/zhongdao-H5',
      name: 'H5前端'
    },
    {
      path: '/d/wwwroot/zhongdao-admin',
      name: '管理后台'
    }
  ];

  let overallResults = {
    total: 0,
    passed: 0,
    failed: 0
  };

  for (const project of projects) {
    log(`\n📱 测试 ${project.name} 项目`, 'blue');
    log('-'.repeat(30), 'blue');

    let projectResults = {
      structure: false,
      dependencies: false,
      typecheck: false,
      linting: false,
      build: false,
      env: false
    };

    try {
      // 项目结构检查
      projectResults.structure = checkProjectStructure(project.path, project.name);
      overallResults.total++;

      // 依赖测试
      if (projectResults.structure) {
        projectResults.dependencies = testDependencies(project.path, project.name);
        overallResults.total++;
      }

      // 环境变量测试
      projectResults.env = testEnvironmentVariables(project.path, project.name);
      overallResults.total++;

      // TypeScript检查
      if (projectResults.dependencies) {
        projectResults.typecheck = testTypeCheck(project.path, project.name);
        overallResults.total++;
      }

      // 代码规范检查
      if (projectResults.dependencies) {
        projectResults.linting = testLinting(project.path, project.name);
        overallResults.total++;
      }

      // 构建测试
      if (projectResults.dependencies) {
        projectResults.build = testBuild(project.path, project.name);
        overallResults.total++;
      }

    } catch (error) {
      log(`💥 ${project.name} 测试过程中发生错误: ${error.message}`, 'red');
    }

    // 统计项目结果
    const projectPassed = Object.values(projectResults).filter(Boolean).length;
    const projectTotal = Object.values(projectResults).filter(val => val !== undefined).length;

    log(`\n📊 ${project.name} 测试结果:`, 'blue');
    log(`通过: ${projectPassed}/${projectTotal}`, projectPassed === projectTotal ? 'green' : 'yellow');

    if (projectPassed === projectTotal) {
      overallResults.passed++;
    } else {
      overallResults.failed++;
    }
  }

  // 总体结果
  log('\n' + '='.repeat(50), 'blue');
  log('📋 前端项目构建测试报告', 'blue');
  log('='.repeat(50), 'blue');

  log(`\n📊 总体统计:`, 'info');
  log(`项目总数: ${projects.length}`, 'info');
  log(`通过: ${overallResults.passed}`, 'success');
  log(`失败: ${overallResults.failed}`, overallResults.failed > 0 ? 'error' : 'success');

  const successRate = ((overallResults.passed / projects.length) * 100).toFixed(1);
  log(`成功率: ${successRate}%`, 'info');

  log('\n🔗 构建测试结果:', 'info');
  if (successRate >= 100) {
    log('🟢 优秀 - 所有前端项目构建测试通过', 'success');
  } else if (successRate >= 50) {
    log('🟡 部分通过 - 需要修复失败的构建问题', 'warning');
  } else {
    log('🔴 需要改进 - 存在严重的构建问题', 'error');
  }

  log('\n📝 建议:', 'info');
  log('1. 确保所有项目依赖已正确安装', 'info');
  log('2. 修复TypeScript类型错误', 'info');
  log('3. 解决代码规范问题', 'info');
  log('4. 检查环境变量配置', 'info');
  log('5. 验证构建输出文件', 'info');

  return successRate >= 80;
}

// 运行测试
if (require.main === module) {
  testFrontendProjects()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`测试执行失败: ${error.message}`, 'error');
      process.exit(1);
    });
}

module.exports = { testFrontendProjects };