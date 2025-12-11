const fs = require('fs');
const path = require('path');

// 需要保留console.log的文件/模式
const keepConsolePatterns = [
  /config\//,           // 配置文件
  /index\.ts$/,          // 入口文件
  /test/,               // 测试目录
  /debug/,             // 调试脚本
  /setup\.ts$/         // 测试设置
];

// 需要保留的console语句模式
const keepConsolePatternsInContent = [
  /console\.error\(/,        // 错误日志
  /console\.warn\(/,         // 警告日志
  /console\.log\('✓/,      // 成功标记
  /console\.log\('📚/,      // 文档标记
  /console\.log\('❌/,      // 错误标记
  /console\.log\('⚠/,      // 警告标记
];

function shouldKeepConsole(filePath) {
  // 检查文件路径是否在保留列表中
  for (const pattern of keepConsolePatterns) {
    if (filePath.match(pattern)) {
      return true;
    }
  }
  return false;
}

function shouldKeepConsoleLine(line) {
  // 检查行内容是否应该保留console
  for (const pattern of keepConsolePatternsInContent) {
    if (line.match(pattern)) {
      return true;
    }
  }
  return false;
}

function cleanupFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;

  const cleanedLines = lines.map(line => {
    // 检查是否包含console.log但不需要保留
    if (line.includes('console.log') && !shouldKeepConsoleLine(line)) {
      // 注释掉这行而不是删除，以便后续需要时可以恢复
      if (!line.trim().startsWith('//')) {
        modified = true;
        return `// [DEBUG REMOVED] ${line}`;
      }
    }
    return line;
  });

  if (modified) {
    fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf8');
    return true;
  }
  return false;
}

// 查找并清理所有TS文件
function findAndCleanup() {
  let cleanedFiles = 0;

  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // 跳过node_modules等目录
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
          walkDir(filePath);
        }
      } else if (filePath.endsWith('.ts')) {
        // 处理TypeScript文件
        if (!shouldKeepConsole(filePath)) {
          if (cleanupFile(filePath)) {
            cleanedFiles++;
            console.log(`Cleaned: ${filePath}`);
          }
        }
      }
    }
  }

  walkDir('D:/wwwroot/zhongdao-mall/src');
  console.log(`\nCleanup complete! Cleaned ${cleanedFiles} files.`);
}

// 运行清理
findAndCleanup();