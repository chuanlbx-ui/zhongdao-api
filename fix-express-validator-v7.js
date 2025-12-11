#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 递归获取所有文件
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', '.vscode', 'dist', 'coverage'].includes(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// 修复express-validator导入
function fixExpressValidator(content) {
  let fixed = content;
  let changes = 0;

  // 1. 查找express-validator导入的各种模式
  const patterns = [
    // 模式1: import * as expressValidator from 'express-validator'
    {
      regex: /import \* as expressValidator from ['"]express-validator['"];?\s*\n(?:const \{([^}]+)\} = expressValidator;?\s*\n?)?/g,
      replacement: (match, destructured) => {
        if (destructured) {
          changes++;
          return `import { ${destructured} } from 'express-validator';\n`;
        }
        return match;
      }
    },
    // 模式2: import { body, validationResult } from 'express-validator'; (正确模式，不需要修改)
    // 模式3: 错误的导入形式
    {
      regex: /import\s+body.*from\s+['"]express-validator['"];?/g,
      replacement: () => {
        changes++;
        return match; // 保持原样，这通常是正确的
      }
    }
  ];

  patterns.forEach(pattern => {
    fixed = fixed.replace(pattern.regex, pattern.replacement);
  });

  return { content: fixed, changes };
}

async function applyFixes() {
  const srcDir = path.join(__dirname, 'src');
  const files = getAllFiles(srcDir);

  console.log(`🔧 找到 ${files.length} 个文件需要检查\n`);

  let totalChanges = 0;
  let fixedFiles = 0;

  // 特别关注routes目录
  const routeFiles = files.filter(file => file.includes('/routes/'));

  for (const file of routeFiles) {
    try {
      let content = fs.readFileSync(file, 'utf8');

      if (content.includes('express-validator')) {
        const { content: fixedContent, changes } = fixExpressValidator(content);

        if (changes > 0) {
          fs.writeFileSync(file, fixedContent);
          console.log(`  ✅ 修复 ${path.relative(__dirname, file)}`);
          totalChanges += changes;
          fixedFiles++;
        }
      }
    } catch (error) {
      console.error(`❌ 处理文件失败: ${file}`, error.message);
    }
  }

  console.log(`\n🎉 Express-validator v7修复完成！`);
  console.log(`📁 修复了 ${fixedFiles} 个文件`);
  console.log(`🔧 总共应用了 ${totalChanges} 个修改`);
}

applyFixes().catch(console.error);