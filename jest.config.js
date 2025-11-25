module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // TypeScript配置
  preset: 'ts-jest',

  // 根目录
  rootDir: '.',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // 覆盖率配置
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1'
  },

  // 转换配置
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'js', 'json'],

  // 测试设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // 清理Mock
  clearMocks: true,
  restoreMocks: true,

  // 超时设置
  testTimeout: 30000,

  // 详细输出
  verbose: true,

  // 错误阈值
  errorOnDeprecated: true,

  // 全局变量
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
};