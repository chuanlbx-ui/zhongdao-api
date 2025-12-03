import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './tests',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // 使用ts-node来运行TypeScript测试文件
    transformMode: 'ssr',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  // 覆盖默认的测试环境变量
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev',
  },
});