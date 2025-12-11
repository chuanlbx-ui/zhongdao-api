import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/api/products.test.ts'],
    exclude: ['tests/setup.ts'],

    // 优化的超时配置
    testTimeout: 15000,      // 15秒单个测试超时
    hookTimeout: 10000,      // 10秒钩子超时
    isolate: false,          // 减少隔离以提高性能

    // 减少并发以避免资源竞争
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,       // 限制并发线程数
        minThreads: 1
      }
    },

    // 快速失败配置
    bail: 1,                 // 第一个失败就停止
    reporter: ['verbose'],

    // 覆盖率配置（可选）
    coverage: {
      enabled: false,        // 禁用覆盖率以加快速度
      reporter: ['text']
    },

    // 全局设置
    setupFiles: ['tests/setup.ts'],
    logHeapUsage: false,     // 禁用堆日志以提高性能

    // 优化配置
    chaiConfig: {
      truncateThreshold: 200  // 减少错误信息长度
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, './src/shared'),
      '@modules': resolve(__dirname, './src/modules'),
      '@routes': resolve(__dirname, './src/routes'),
      '@tests': resolve(__dirname, './tests')
    }
  }
});