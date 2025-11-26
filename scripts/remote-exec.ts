#!/usr/bin/env tsx
/**
 * 远程执行工具 - 通过SSH连接服务器执行命令
 * 用法: npx tsx scripts/remote-exec.ts "命令"
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);

interface RemoteConfig {
  user: string;
  host: string;
  path: string;
  password?: string;
  keyPath?: string;
}

const loadConfig = (): RemoteConfig => {
  const configPath = path.join(process.cwd(), '.remote.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  throw new Error('.remote.json配置文件不存在');
};

const executeRemote = async (config: RemoteConfig, command: string): Promise<void> => {
  const sshKey = config.keyPath ? `-i ${config.keyPath}` : '';
  const fullCmd = `ssh ${sshKey} ${config.user}@${config.host} "export HOME=/root && cd ${config.path} && ${command}"`;
  
  console.log(`🚀 执行命令: ${command}`);
  console.log(`📍 服务器: ${config.user}@${config.host}`);
  console.log('');
  
  try {
    const { stdout, stderr } = await execPromise(fullCmd, { maxBuffer: 10 * 1024 * 1024 });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log('✅ 命令执行成功');
  } catch (error: any) {
    console.error('❌ 命令执行失败:', error.message);
    process.exit(1);
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ 请提供要执行的命令');
    console.log('用法: npx tsx scripts/remote-exec.ts "命令"');
    process.exit(1);
  }
  
  const command = args.join(' ');
  const config = loadConfig();
  
  await executeRemote(config, command);
};

main();
