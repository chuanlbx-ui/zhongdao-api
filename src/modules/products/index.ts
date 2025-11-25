/**
 * 商品模块 - 定价服务
 * 提供差异化定价、价格计算、价格管理等功能
 */

export { PricingService, pricingService } from './pricing.service';
export * from './types';

// 便捷方法导出
export { UserLevel } from '../user/level.service';

// 导出常用实例
export { pricingService as default } from './pricing.service';