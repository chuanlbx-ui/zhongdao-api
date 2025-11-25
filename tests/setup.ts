import 'dotenv/config';

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'mysql://test:test@localhost:3306/zhongdao_mall_test';

// 设置全局超时
jest.setTimeout(30000);

// 全局测试钩子
beforeAll(() => {
  // 在所有测试开始前执行
  console.log('🚀 Starting test suite...');
});

afterAll(() => {
  // 在所有测试结束后执行
  console.log('✅ Test suite completed');
});

// 每个测试前的钩子
beforeEach(() => {
  // 清除控制台输出
  jest.clearAllMocks();
});

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Mock console 方法以减少测试输出噪音
global.console = {
  ...console,
  // 保留 error 和 warn 用于调试
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};