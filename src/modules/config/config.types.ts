/**
 * 配置管理相关类型定义
 */

/**
 * 云店等级配置
 */
export interface CloudShopLevelConfig {
  level: number;
  name: string;
  minBottles: number;              // 最低瓶数要求
  minTeamSize: number;             // 最低团队人数
  minDirectMembers: number;        // 最低直推人数
  purchaseDiscount: number;        // 采购折扣
  monthlyTarget: number;           // 月销售目标
  monthlyCommission: number;       // 月佣金
  description: string;
}

/**
 * 佣金配置
 */
export interface CommissionConfig {
  personalCommissionRate: number;  // 个人销售佣金比例
  directReferralRate: number;      // 直推佣金比例
  indirectReferralRate: number;    // 间接推荐佣金比例
  teamBonusRate: number;           // 团队奖金比例
  levelBonusRate: number;          // 等级奖金比例
  performanceBonusThreshold: number; // 业绩奖金阈值
}

/**
 * 通券配置
 */
export interface PointsConfig {
  minTransferAmount: number;       // 最低转账金额
  maxTransferAmount: number;       // 最高转账金额
  dailyTransferLimit: number;      // 每日转账限额
  transferFeeRate: number;         // 转账手续费率
  freezeThreshold: number;         // 冻结阈值
}

/**
 * 订单配置
 */
export interface OrderConfig {
  autoCancelMinutes: number;       // 自动取消订单时间（分钟）
  refundDays: number;              // 退款时限（天）
  defaultShippingFee: number;      // 默认运费
  freeShippingThreshold: number;   // 包邮阈值
}

/**
 * 库存配置
 */
export interface InventoryConfig {
  warningThreshold: number;        // 预警阈值
  autoReorderEnabled: boolean;     // 是否启用自动补货
  autoReorderQuantity: number;     // 自动补货数量
}

/**
 * 配置初始化数据
 */
export interface ConfigInitData {
  cloudShopLevels: Record<number, CloudShopLevelConfig>;
  commissionConfig: CommissionConfig;
  pointsConfig: PointsConfig;
  orderConfig: OrderConfig;
  inventoryConfig: InventoryConfig;
  [key: string]: any;
}
