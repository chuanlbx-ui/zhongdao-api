const { exec } = require('child_process');
const path = require('path');

// 设置环境变量
process.env.NODE_ENV = 'development';

// 使用 ts-node 运行，启用路径映射
const tsNode = require('ts-node');
const { register } = tsNode;

// 注册 ts-node 并配置路径
register({
  project: path.join(__dirname, '../tsconfig.json'),
  transpileOnly: true,
  files: true,
  pretty: true,
});

// 启动文件监视
const nodemon = require('nodemon');
const nodemonConfig = {
  script: path.join(__dirname, '../src/index.ts'),
  watch: ['src'],
  ext: 'ts,js,json',
  ignore: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
  exec: 'ts-node -r tsconfig-paths/register',
  env: {
    NODE_ENV: 'development'
  }
};

nodemon(nodemonConfig);

nodemon.on('start', () => {
  console.log('\n🚀 开发服务器启动中...');
  console.log('📍 API地址: http://localhost:3000');
  console.log('📖 API文档: http://localhost:3000/api-docs\n');
});

nodemon.on('restart', () => {
  console.log('\n🔄 重启开发服务器...\n');
});

nodemon.on('quit', () => {
  console.log('\n👋 开发服务器已退出\n');
  process.exit();
});