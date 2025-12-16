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
    testTimeout: 60000, // 60 seconds - 增加超时时间以避免测试超时
    hookTimeout: 30000, // 30 seconds
    // 使用ts-node来运行TypeScript测试文件
    transformMode: 'ssr',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{ts,js}',
      ],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        'scripts/',
        'docs/',
        '*.config.*',
        '.env*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  // 覆盖默认的测试环境变量
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_EXPIRES_IN: '30d',
    DISABLE_CSRF: 'true',
    DISABLE_RATE_LIMIT: 'true'
  },
  // 设置全局变量，在测试开始前加载
  // 使用实际的环境变量，不在代码中硬编码
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.DISABLE_CSRF': '"true"',
    'process.env.DISABLE_RATE_LIMIT': '"true"'
  },
});