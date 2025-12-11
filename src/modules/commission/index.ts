/**
 * 佣金管理模块
 * 提供佣金计算、结算、提现等功能
 */

// 导出服务实现
export { CommissionService, commissionService } from './commission.service';

// 导出类型定义
export type {
  CommissionRecord,
  CommissionCalculationParams,
  CommissionCalculationResult,
  CommissionSummary,
  WithdrawalParams
} from './commission.service';

export { CommissionType } from './commission.service';