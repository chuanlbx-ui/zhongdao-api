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

// 修复ErrorCode导入
function fixErrorCodeImports(content) {
  let fixed = content;
  let changes = 0;

  // 检查是否使用了ErrorCode但没有导入
  const hasErrorCodeUsage = /ErrorCode\./.test(content);
  const hasErrorCodeImport = /import.*ErrorCode.*from/.test(content);

  if (hasErrorCodeUsage && !hasErrorCodeImport) {
    // 查找最后一个import语句
    const importRegex = /import[^;]+;/g;
    const imports = content.match(importRegex);

    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);

      // 在最后一个import后添加ErrorCode导入
      const errorCodeImport = "\nimport { ErrorCode } from '../../../shared/errors';";
      fixed = content.slice(0, lastImportIndex + lastImport.length) +
              errorCodeImport +
              content.slice(lastImportIndex + lastImport.length);

      changes = 1;
    }
  }

  return { content: fixed, changes };
}

async function applyFixes() {
  const srcDir = path.join(__dirname, 'src');
  const files = getAllFiles(srcDir);

  console.log(`🔧 检查ErrorCode导入问题...\n`);

  let totalChanges = 0;
  let fixedFiles = 0;

  for (const file of files) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      const { content: fixedContent, changes } = fixErrorCodeImports(content);

      if (changes > 0) {
        fs.writeFileSync(file, fixedContent);
        console.log(`  ✅ 修复 ErrorCode 导入: ${path.relative(__dirname, file)}`);
        totalChanges += changes;
        fixedFiles++;
      }
    } catch (error) {
      console.error(`❌ 处理文件失败: ${file}`, error.message);
    }
  }

  console.log(`\n🎉 ErrorCode导入修复完成！`);
  console.log(`📁 修复了 ${fixedFiles} 个文件`);
  console.log(`🔧 总共应用了 ${totalChanges} 个修改`);
}

applyFixes().catch(console.error);