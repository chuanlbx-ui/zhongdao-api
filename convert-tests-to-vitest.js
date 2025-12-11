#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 递归获取所有测试文件
function getTestFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', '.vscode', 'dist', 'coverage'].includes(file)) {
        getTestFiles(fullPath, arrayOfFiles);
      }
    } else {
      if ((file.endsWith('.test.ts') || file.endsWith('.test.js')) &&
          !file.includes('.vitest.') &&
          !file.includes('setup.')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// 检查是否是Jest测试文件
function isJestTest(content) {
  return content.includes('describe(') ||
         content.includes('it(') ||
         content.includes('test(') ||
         content.includes('expect(');
}

// 转换Jest到Vitest
function convertToVitest(content) {
  let converted = content;
  let changes = 0;

  // 1. 添加Vitest导入
  if (!converted.includes('import ') && isJestTest(converted)) {
    // 如果没有import语句，在文件开头添加
    converted = `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';\n\n${converted}`;
    changes++;
  } else if (converted.includes('import ') && isJestTest(converted)) {
    // 如果已有import，检查是否包含vitest
    if (!converted.includes('from \'vitest\'') && !converted.includes('vitest')) {
      // 在第一个import后添加vitest import
      const lines = converted.split('\n');
      let importIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          importIndex = i;
        }
      }

      if (importIndex >= 0) {
        lines.splice(importIndex + 1, 0, "import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';");
        converted = lines.join('\n');
        changes++;
      }
    }
  }

  // 2. 替换 jest.mock → vi.mock
  const jestMocks = (converted.match(/jest\.mock/g) || []).length;
  converted = converted.replace(/jest\.mock/g, 'vi.mock');
  changes += jestMocks;

  // 3. 替换 jest.fn → vi.fn
  const jestFns = (converted.match(/jest\.fn/g) || []).length;
  converted = converted.replace(/jest\.fn/g, 'vi.fn');
  changes += jestFns;

  // 4. 替换 jest.spyOn → vi.spyOn
  const jestSpies = (converted.match(/jest\.spyOn/g) || []).length;
  converted = converted.replace(/jest\.spyOn/g, 'vi.spyOn');
  changes += jestSpies;

  return { content: converted, changes };
}

async function convertTests() {
  const srcDir = path.join(__dirname, 'src');
  const testFiles = getTestFiles(srcDir);

  console.log(`🔍 找到 ${testFiles.length} 个测试文件需要检查\n`);

  let totalChanges = 0;
  let convertedFiles = 0;

  for (const file of testFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');

      if (isJestTest(content)) {
        const { content: convertedContent, changes } = convertToVitest(content);

        if (changes > 0) {
          fs.writeFileSync(file, convertedContent);
          console.log(`  ✅ 转换 ${path.relative(__dirname, file)} (${changes} 个修改)`);
          totalChanges += changes;
          convertedFiles++;
        }
      }
    } catch (error) {
      console.error(`❌ 处理文件失败: ${file}`, error.message);
    }
  }

  console.log(`\n🎉 转换完成！`);
  console.log(`📁 转换了 ${convertedFiles} 个文件`);
  console.log(`🔧 总共应用了 ${totalChanges} 个修改`);
}

convertTests().catch(console.error);