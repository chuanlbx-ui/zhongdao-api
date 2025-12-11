#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 递归获取所有TypeScript文件
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', '.vscode', 'dist', 'coverage'].includes(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (file.endsWith('.ts')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

async function fixAsyncHandler() {
  const srcDir = path.join(__dirname, 'src');
  const files = getAllFiles(srcDir);

  console.log(`🔧 修复asyncHandler类型问题...\n`);

  let totalFixes = 0;
  let fixedFiles = 0;

  // 重点关注routes目录
  const routeFiles = files.filter(file => file.includes('/routes/'));

  for (const file of routeFiles) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      const originalContent = content;

      // 查找使用asyncHandler的两参数函数模式
      // 模式1: asyncHandler(async (req, res) => {
      const pattern1 = /asyncHandler\(async \(req,\s*res\) =>/g;
      const matches1 = content.match(pattern1);
      if (matches1) {
        content = content.replace(pattern1, 'asyncHandler2(async (req, res) =>');
        console.log(`  ✅ 修复 ${path.relative(__dirname, file)} (${matches1.length} 个修改)`);
        totalFixes += matches1.length;
      }

      // 如果内容有改变，写回文件
      if (content !== originalContent) {
        fs.writeFileSync(file, content);
        fixedFiles++;
      }
    } catch (error) {
      console.error(`❌ 处理文件失败: ${file}`, error.message);
    }
  }

  console.log(`\n🎉 asyncHandler修复完成！`);
  console.log(`📁 修复了 ${fixedFiles} 个文件`);
  console.log(`🔧 总共应用了 ${totalFixes} 个修改`);

  // 检查剩余错误数量
  const { execSync } = require('child_process');
  try {
    const errorCount = execSync('npx tsc --noEmit 2>&1 | grep "error TS" | wc -l', {
      encoding: 'utf8',
      cwd: __dirname
    }).trim();

    console.log(`\n📊 当前TypeScript错误数量: ${errorCount}`);

    // 检查asyncHandler相关错误
    const asyncHandlerErrors = execSync('npx tsc --noEmit 2>&1 | grep "asyncHandler\\|NextFunction" | wc -l', {
      encoding: 'utf8',
      cwd: __dirname
    }).trim();

    console.log(`📊 asyncHandler相关错误: ${asyncHandlerErrors}`);
  } catch (error) {
    console.log('\n⚠️ 无法获取错误数量统计');
  }
}

fixAsyncHandler().catch(console.error);