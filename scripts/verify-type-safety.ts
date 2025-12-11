#!/usr/bin/env tsx

/**
 * TypeScript类型安全验证脚本
 *
 * 验证核心模块的类型安全性，确保没有明显的类型错误
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// 需要验证的核心文件
const CORE_FILES = [
  'src/modules/payment/payment.service.ts',
  'src/modules/purchase/purchase.service.ts',
  'src/shared/payments/callbacks/handler.ts',
  'src/modules/payment/types.ts'
];

// 检查文件是否存在
function checkFilesExist(): boolean {
  console.log('📁 检查核心文件是否存在...');

  let allExist = true;
  for (const file of CORE_FILES) {
    const filePath = join(process.cwd(), file);
    if (!existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${file}`);
      allExist = false;
    } else {
      console.log(`✓ 文件存在: ${file}`);
    }
  }

  return allExist;
}

// 检查是否还有@ts-nocheck
function checkForTsNoCheck(): boolean {
  console.log('\n🔍 检查是否还有@ts-nocheck...');

  let hasNoCheck = false;
  for (const file of CORE_FILES) {
    const filePath = join(process.cwd(), file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      if (content.includes('@ts-nocheck')) {
        console.error(`❌ 文件仍包含@ts-nocheck: ${file}`);
        hasNoCheck = true;
      } else {
        console.log(`✓ 文件已移除@ts-nocheck: ${file}`);
      }
    }
  }

  return !hasNoCheck;
}

// 运行TypeScript编译检查
function runTypeCheck(): boolean {
  console.log('\n🛠️  运行TypeScript类型检查...');

  try {
    // 使用npx tsc进行类型检查
    const output = execSync('npx tsc --noEmit --pretty false', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    console.log('✓ TypeScript编译检查通过');
    return true;
  } catch (error: any) {
    console.error('❌ TypeScript编译检查失败:');

    // 过滤出核心文件的错误
    const lines = error.stdout.split('\n');
    const coreErrors = lines.filter(line => {
      return CORE_FILES.some(file => line.includes(file));
    });

    if (coreErrors.length > 0) {
      console.error('\n核心模块类型错误:');
      coreErrors.forEach(line => console.error(line));
    } else {
      console.error('\n其他模块错误（可暂时忽略）:');
      lines.slice(0, 20).forEach(line => console.error(line));
    }

    return false;
  }
}

// 运行类型检查（只针对核心文件）
function runCoreFileTypeCheck(): boolean {
  console.log('\n🎯 运行核心文件类型检查...');

  let allPassed = true;

  for (const file of CORE_FILES) {
    try {
      execSync(`npx tsc --noEmit --skipLibCheck ${file}`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(`✓ ${file} 类型检查通过`);
    } catch (error: any) {
      console.error(`❌ ${file} 类型检查失败:`);
      const lines = error.stdout.split('\n');
      lines.filter((line: string) => line.trim()).forEach((line: string) => {
        if (line.includes(file)) {
          console.error(`  ${line}`);
        }
      });
      allPassed = false;
    }
  }

  return allPassed;
}

// 主函数
function main() {
  console.log('🚀 开始TypeScript类型安全验证\n');

  // 1. 检查文件存在
  if (!checkFilesExist()) {
    console.log('\n❌ 文件检查失败，请确保所有核心文件存在');
    process.exit(1);
  }

  // 2. 检查@ts-nocheck
  if (!checkForTsNoCheck()) {
    console.log('\n❌ 仍有文件包含@ts-nocheck');
    process.exit(1);
  }

  // 3. 运行核心文件类型检查
  if (!runCoreFileTypeCheck()) {
    console.log('\n❌ 核心文件类型检查失败');
    process.exit(1);
  }

  // 4. 运行完整类型检查（可选，可能会有其他模块的错误）
  console.log('\n--------------------------------------------------');
  console.log('运行完整项目类型检查（可能包含其他模块的错误）...');
  runTypeCheck();

  console.log('\n✅ 核心模块TypeScript类型安全验证完成！');
  console.log('\n📝 总结:');
  console.log('  - 所有核心文件存在');
  console.log('  - 已移除@ts-nocheck');
  console.log('  - 核心模块类型检查通过');
  console.log('\n🎉 核心模块已恢复类型安全！');
}

// 运行脚本
if (require.main === module) {
  main();
}

export {
  checkFilesExist,
  checkForTsNoCheck,
  runTypeCheck,
  runCoreFileTypeCheck
};