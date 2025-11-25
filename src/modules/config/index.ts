/**
 * 配置管理模块导出
 */

export { ConfigService, configService } from './config.service';
export { initializeConfigs, getDefaultConfigs } from './config.init';
export type { CloudShopLevelConfig, CommissionConfig, PointsConfig, OrderConfig, InventoryConfig, ConfigInitData } from './config.types';
