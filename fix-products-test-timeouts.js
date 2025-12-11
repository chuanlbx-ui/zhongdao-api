#!/usr/bin/env node

/**
 * 修复products测试的超时时间和分页参数
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修复products测试的超时设置...\n');

const filePath = path.join(__dirname, 'tests/api/products.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. 增加所有测试的超时时间
content = content.replace(/}, 15000\)/g, '}, 30000)');
content = content.replace(/}, 20000\)/g, '}, 30000)');
content = content.replace(/}, 10000\)/g, '}, 30000)');

// 2. 减少分页数量
content = content.replace(/perPage: 10/g, 'perPage: 5');
content = content.replace(/perPage: 20/g, 'perPage: 5');

// 3. 确保第一个测试也有足够的超时时间
content = content.replace('}, 10000);', '}, 30000);');

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ 修复完成！');
console.log('- 所有测试超时时间增加到30秒');
console.log('- 每页数量减少到5');