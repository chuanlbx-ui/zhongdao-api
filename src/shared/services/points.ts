// 为了保持向后兼容，这里重新导出模块化的积分服务
export * from './points/index';

// 导出原始的单例实例，确保现有代码正常工作
export { pointsService } from './points/index';