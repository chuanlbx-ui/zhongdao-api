// 诊断config对象为什么无法读取JWT_SECRET
import './src/init-env';  // 先加载环境变量
import { config } from './src/config';
import dotenv from 'dotenv';

console.log('=== Config 诊断报告 ===\n');

// 1. 检查init-env是否正确执行
console.log('1. init-env执行后的环境变量:');
console.log('   process.env.JWT_SECRET:', !!process.env.JWT_SECRET);
console.log('   JWT_SECRET值:', process.env.JWT_SECRET?.substring(0, 20) + '...');

// 2. 手动加载dotenv看看
console.log('\n2. 手动加载dotenv:');
const result = dotenv.config({ path: '.env.test' });
console.log('   dotenv加载结果:', result.error ? '失败' : '成功');
if (result.error) {
  console.log('   错误信息:', result.error.message);
}

// 再次检查环境变量
console.log('\n3. 手动加载后环境变量:');
console.log('   process.env.JWT_SECRET:', !!process.env.JWT_SECRET);

// 4. 直接检查config模块
console.log('\n4. config对象详情:');
console.log('   config.jwt:', config.jwt);
console.log('   config.jwt.secret:', config.jwt.secret);

// 5. 测试其他环境变量
console.log('\n5. 其他环境变量对比:');
console.log('   process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('   config.app.nodeEnv:', config.app.nodeEnv);
console.log('   process.env.DATABASE_URL存在:', !!process.env.DATABASE_URL);
console.log('   config.database.url存在:', !!config.database.url);

// 6. 查看process.env中的所有JWT相关变量
console.log('\n6. process.env中的JWT相关变量:');
Object.keys(process.env)
  .filter(key => key.toLowerCase().includes('jwt'))
  .forEach(key => {
    console.log(`   ${key}: ${process.env[key]?.substring(0, 20)}...`);
  });

// 7. 重新创建config对象
console.log('\n7. 重新创建config测试:');
const newConfig = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  }
};
console.log('   newConfig.jwt.secret存在:', !!newConfig.jwt.secret);

// 8. 尝试使用其他方式读取环境变量
console.log('\n8. 使用其他方式读取:');
const fs = require('fs');
const content = fs.readFileSync('.env.test', 'utf8');
const match = content.match(/^JWT_SECRET=(.+)$/m);
console.log('   从文件直接读取:', match ? match[1].substring(0, 20) + '...' : '未找到');

console.log('\n=== 诊断完成 ===');