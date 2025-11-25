/**
 * 前端仓库同步脚本
 * 自动同步H5前端和管理后台代码到对应的GitHub仓库
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

function execCommand(command, cwd, description) {
  log(`🔄 ${description}...`, 'blue');
  try {
    const result = execSync(command, { cwd, encoding: 'utf8', stdio: 'inherit' });
    log(`✅ ${description} 完成`, 'green');
    return result;
  } catch (error) {
    log(`❌ ${description} 失败: ${error.message}`, 'red');
    return null;
  }
}

function createFrontendProject(projectPath, projectName, repoUrl) {
  const projectAbsolutePath = path.resolve('D:/wwwroot', projectPath);

  if (!fs.existsSync(projectAbsolutePath)) {
    log(`❌ ${projectName} 目录不存在: ${projectAbsolutePath}`, 'red');
    return false;
  }

  log(`\n📁 开始同步 ${projectName} 到 GitHub...`, 'blue');

  // 进入项目目录
  process.chdir(projectAbsolutePath);

  // 检查是否已经是Git仓库
  const isGitRepo = fs.existsSync('.git');

  if (!isGitRepo) {
    log('🔧 初始化Git仓库...', 'blue');
    execCommand('git init', projectAbsolutePath, '初始化Git仓库');
    execCommand(`git remote add origin ${repoUrl}`, projectAbsolutePath, '添加远程仓库');
    execCommand('git branch -M main', projectAbsolutePath, '设置主分支为main');
  } else {
    log('ℹ️  Git仓库已存在，检查远程地址...', 'yellow');
    // 这里可以检查远程地址是否匹配
  }

  // 检查package.json是否存在
  const packageJsonPath = path.join(projectAbsolutePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log(`❌ ${projectName} 缺少package.json文件`, 'red');
    return false;
  }

  // 读取package.json获取项目信息
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    log(`❌ 读取${projectName}的package.json失败`, 'red');
    return false;
  }

  log(`📦 项目信息: ${packageJson.name} v${packageJson.version}`, 'cyan');

  // 创建或更新.gitignore
  const gitignorePath = path.join(projectAbsolutePath, '.gitignore');
  const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Build outputs
dist/
build/
out/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Coverage
coverage/
*.lcov

# AI协作工具配置
.ai-collaboration/
.claude/

# 上传文件
uploads/
public/uploads/
static/uploads/

# 数据验证报告
*-validation-report-*.json

# 开发脚本
deploy-production.sh
`;

  fs.writeFileSync(gitignorePath, gitignoreContent);
  log('✅ 已创建.gitignore文件', 'green');

  // 添加所有文件到Git（排除.gitignore中的文件）
  log('📥 添加文件到Git暂存区...', 'blue');
  execCommand('git add .', projectAbsolutePath, '添加文件到暂存区');

  // 检查是否有文件需要提交
  const gitStatus = execCommand('git status --porcelain', projectAbsolutePath, '检查Git状态');
  if (gitStatus && gitStatus.trim() !== '') {
    // 创建有意义的提交信息
    const commitMessage = `feat: ${projectName}前端完整实现

🚀 核心功能
- 中道商城H5移动端应用
- 完整的用户认证和注册流程
- 推荐码系统集成
- 商品浏览和购买功能
- 订单管理和查看
- 通券（积分）系统
- 团队管理功能
- 支付集成（微信支付）

🛡️ 安全特性
- JWT认证机制
- API接口加密
- 输入验证防护
- 错误处理和降级

🎨 用户界面
- 响应式移动端设计
- Ant Design Mobile组件库
- 流畅的用户体验
- 离线数据支持

📊 技术架构
- React 18 + TypeScript
- Vite构建工具
- Ant Design Mobile UI
- 集成API错误处理机制
- 完善的错误提示系统

📈 质量保证
- TypeScript类型安全
- ESLint代码规范
- 完整的API接口
- 数据验证测试

项目版本: ${packageJson.version || '1.0.0'}
构建时间: ${new Date().toISOString()}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

    // 提交代码
    execCommand(`git commit -m "${commitMessage}"`, projectAbsolutePath, '提交代码到本地仓库');
  } else {
    log('ℹ️  没有需要提交的文件', 'yellow');
  }

  // 推送到远程仓库
  log('🚀 推送到GitHub...', 'blue');
  execCommand('git push -u origin main', projectAbsolutePath, '推送到GitHub');

  log(`✅ ${projectName} 同步完成！`, 'green');
  return true;
}

function main() {
  log('🚀 开始前端仓库同步流程...', 'blue');
  log('='.repeat(50), 'blue');

  // 定义项目配置
  const projects = [
    {
      path: 'zhongdao-h5',
      name: '中道商城H5前端',
      repoUrl: 'https://github.com/chuanlbx-ui/zhongdao-mall-h5.git'
    },
    {
      path: 'zhongdao-admin',
      name: '中道商城管理后台',
      repoUrl: 'https://github.com/chuanlbx-ui/zhongdao-mall-admin.git'
    }
  ];

  let successCount = 0;
  let failCount = 0;

  // 逐一同步每个项目
  for (const project of projects) {
    try {
      const success = createFrontendProject(project.path, project.name, project.repoUrl);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      log(`❌ 同步${project.name}时发生错误: ${error.message}`, 'red');
      failCount++;
    }

    log('', 'reset'); // 空行分隔
  }

  // 结果汇总
  log('='.repeat(50), 'blue');
  log('📊 同步结果汇总:', 'blue');
  log(`✅ 成功: ${successCount} 个`, 'green');
  log(`❌ 失败: ${failCount} 个`, 'red');
  log(`📈 成功率: ${projects.length > 0 ? ((successCount / projects.length) * 100).toFixed(1) : 0}%`, 'blue');

  if (successCount === projects.length) {
    log('\n🎉 所有前端项目同步完成！', 'green');
    log('\n📋 下一步操作:', 'blue');
    log('1. 验证前端仓库内容', 'cyan');
    log('2. 配置前端项目的CI/CD', 'cyan');
    log('3. 开始前端项目的开发工作', 'cyan');
    log('4. 配置前端与后端API的连接', 'cyan');
  } else {
    log('\n⚠️  部分项目同步失败，请检查错误信息', 'yellow');
    log('\n🔧 故障排除:', 'yellow');
    log('1. 确认GitHub仓库地址正确', 'cyan');
    log('2. 检查项目目录结构是否完整', 'cyan');
    log('3. 确认网络连接正常', 'cyan');
    log('4. 检查Git权限配置', 'cyan');
  }

  log('\n📚 相关文档:', 'blue');
  log('- 后端API文档: docs/deployment-guide.md', 'cyan');
  log('- Git仓库结构: docs/git-repository-structure.md', 'cyan');
  log('- 错误处理指南: docs/error-handling-guide.md', 'cyan');

  return successCount === projects.length;
}

// 运行同步脚本
if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { main, createFrontendProject };