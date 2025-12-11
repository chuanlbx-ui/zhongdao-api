import { logger } from '../utils/logger';
import { UserLevel } from '../../modules/user/level.service';

/**
 * 佣金计算策略接口
 */
export interface CommissionCalculationStrategy {
  calculate(params: CommissionCalculationParams): Promise<CommissionCalculationResult>;
}

/**
 * 佣金计算参数
 */
export interface CommissionCalculationParams {
  orderId: string;
  sellerId: string;
  orderAmount: number;
  buyerId?: string;
  orderType?: string;
  userLevel?: UserLevel;
  context?: Record<string, any>;
}

/**
 * 佣金计算结果
 */
export interface CommissionCalculationResult {
  commissions: CommissionItem[];
  totalAmount: number;
  breakdown: CommissionBreakdown;
}

/**
 * 佣金项
 */
export interface CommissionItem {
  userId: string;
  type: CommissionType;
  amount: number;
  rate?: number;
  level?: number;
  description: string;
}

/**
 * 佣金类型
 */
export enum CommissionType {
  PERSONAL_SALES = 'PERSONAL_SALES',
  DIRECT_REFERRAL = 'DIRECT_REFERRAL',
  INDIRECT_REFERRAL = 'INDIRECT_REFERRAL',
  TEAM_BONUS = 'TEAM_BONUS',
  LEVEL_BONUS = 'LEVEL_BONUS',
  PERFORMANCE_BONUS = 'PERFORMANCE_BONUS'
}

/**
 * 佣金明细
 */
export interface CommissionBreakdown {
  personalCommission: number;
  referralCommission: number;
  teamCommission: number;
  bonusCommission: number;
}

/**
 * 简单佣金计算策略
 * 适用于简单的佣金计算场景
 */
export class SimpleCommissionStrategy implements CommissionCalculationStrategy {
  private rates: Record<UserLevel, number>;

  constructor(rates?: Partial<Record<UserLevel, number>>) {
    this.rates = {
      [UserLevel.NORMAL]: 0,
      [UserLevel.VIP]: 0.05,
      [UserLevel.STAR_1]: 0.08,
      [UserLevel.STAR_2]: 0.10,
      [UserLevel.STAR_3]: 0.12,
      [UserLevel.STAR_4]: 0.14,
      [UserLevel.STAR_5]: 0.16,
      [UserLevel.DIRECTOR]: 0.20,
      ...rates
    };
  }

  async calculate(params: CommissionCalculationParams): Promise<CommissionCalculationResult> {
    const rate = this.rates[params.userLevel || UserLevel.NORMAL];
    const commissionAmount = params.orderAmount * rate;

    const commissions: CommissionItem[] = [];

    // 个人销售佣金
    if (commissionAmount > 0) {
      commissions.push({
        userId: params.sellerId,
        type: CommissionType.PERSONAL_SALES,
        amount: commissionAmount,
        rate,
        description: '个人销售佣金'
      });
    }

    return {
      commissions,
      totalAmount: commissionAmount,
      breakdown: {
        personalCommission: commissionAmount,
        referralCommission: 0,
        teamCommission: 0,
        bonusCommission: 0
      }
    };
  }
}

/**
 * 多级佣金计算策略
 * 支持直推和间接推荐佣金
 */
export class MultiLevelCommissionStrategy implements CommissionCalculationStrategy {
  private personalRates: Record<UserLevel, number>;
  private directReferralRate: number;
  private indirectReferralRates: number[];
  private maxLevels: number;

  constructor(config?: {
    personalRates?: Partial<Record<UserLevel, number>>;
    directReferralRate?: number;
    indirectReferralRates?: number[];
    maxLevels?: number;
  }) {
    this.personalRates = {
      [UserLevel.NORMAL]: 0,
      [UserLevel.VIP]: 0.05,
      [UserLevel.STAR_1]: 0.08,
      [UserLevel.STAR_2]: 0.10,
      [UserLevel.STAR_3]: 0.12,
      [UserLevel.STAR_4]: 0.14,
      [UserLevel.STAR_5]: 0.16,
      [UserLevel.DIRECTOR]: 0.20,
      ...config?.personalRates
    };
    this.directReferralRate = config?.directReferralRate || 0.05;
    this.indirectReferralRates = config?.indirectReferralRates || [0.04, 0.03, 0.02, 0.015, 0.01];
    this.maxLevels = config?.maxLevels || 10;
  }

  async calculate(params: CommissionCalculationParams): Promise<CommissionCalculationResult> {
    const commissions: CommissionItem[] = [];
    let totalAmount = 0;
    const breakdown: CommissionBreakdown = {
      personalCommission: 0,
      referralCommission: 0,
      teamCommission: 0,
      bonusCommission: 0
    };

    // 1. 计算个人销售佣金
    const personalRate = this.personalRates[params.userLevel || UserLevel.NORMAL];
    const personalCommission = params.orderAmount * personalRate;

    if (personalCommission > 0) {
      commissions.push({
        userId: params.sellerId,
        type: CommissionType.PERSONAL_SALES,
        amount: personalCommission,
        rate: personalRate,
        description: '个人销售佣金'
      });
      breakdown.personalCommission = personalCommission;
      totalAmount += personalCommission;
    }

    // 2. 计算推荐佣金
    const referralChain = await this.getReferralChain(params.sellerId, this.maxLevels);

    for (let i = 0; i < referralChain.length; i++) {
      const referrer = referralChain[i];
      const level = i + 1;

      let commissionRate = 0;
      let commissionType: CommissionType;

      if (level === 1) {
        // 直推佣金
        commissionRate = this.directReferralRate;
        commissionType = CommissionType.DIRECT_REFERRAL;
      } else if (level - 1 < this.indirectReferralRates.length) {
        // 间接推荐佣金
        commissionRate = this.indirectReferralRates[level - 2];
        commissionType = CommissionType.INDIRECT_REFERRAL;
      } else {
        break; // 超出最大层级
      }

      const commissionAmount = params.orderAmount * commissionRate;

      if (commissionAmount > 0.01) { // 最小佣金门槛
        commissions.push({
          userId: referrer.id,
          type: commissionType,
          amount: commissionAmount,
          rate: commissionRate,
          level,
          description: `${level === 1 ? '直推' : `${level}级间接推荐`}佣金`
        });

        breakdown.referralCommission += commissionAmount;
        totalAmount += commissionAmount;
      }
    }

    // 3. 计算团队奖金（如果有配置）
    if (this.shouldCalculateTeamBonus(params.userLevel)) {
      const teamBonus = await this.calculateTeamBonus(params);
      if (teamBonus > 0) {
        const eligibleLeaders = await this.getEligibleTeamLeaders(params.sellerId);
        for (const leader of eligibleLeaders) {
          commissions.push({
            userId: leader.id,
            type: CommissionType.TEAM_BONUS,
            amount: teamBonus,
            description: '团队管理奖金'
          });
        }
        breakdown.teamCommission = teamBonus * eligibleLeaders.length;
        totalAmount += breakdown.teamCommission;
      }
    }

    return {
      commissions,
      totalAmount,
      breakdown
    };
  }

  private async getReferralChain(userId: string, maxLevels: number): Promise<Array<{ id: string }>> {
    // 这里应该从数据库查询推荐链
    // 简化实现
    return [];
  }

  private shouldCalculateTeamBonus(userLevel?: UserLevel): boolean {
    if (!userLevel) return false;
    const levelsWithTeamBonus = [UserLevel.STAR_2, UserLevel.STAR_3, UserLevel.STAR_4, UserLevel.STAR_5, UserLevel.DIRECTOR];
    return levelsWithTeamBonus.includes(userLevel);
  }

  private async calculateTeamBonus(params: CommissionCalculationParams): Promise<number> {
    // 简化实现，实际应该根据团队业绩计算
    return params.orderAmount * 0.01;
  }

  private async getEligibleTeamLeaders(userId: string): Promise<Array<{ id: string }>> {
    // 获取有资格获得团队奖金的领导
    return [];
  }
}

/**
 * 动态佣金计算策略
 * 根据规则引擎动态计算佣金
 */
export class DynamicCommissionStrategy implements CommissionCalculationStrategy {
  private rules: CommissionRule[];

  constructor(rules: CommissionRule[] = []) {
    this.rules = rules;
  }

  addRule(rule: CommissionRule): void {
    this.rules.push(rule);
  }

  async calculate(params: CommissionCalculationParams): Promise<CommissionCalculationResult> {
    const commissions: CommissionItem[] = [];
    let totalAmount = 0;
    const breakdown: CommissionBreakdown = {
      personalCommission: 0,
      referralCommission: 0,
      teamCommission: 0,
      bonusCommission: 0
    };

    // 应用规则计算佣金
    for (const rule of this.rules) {
      if (await this.matchesRule(rule, params)) {
        const ruleResult = await rule.calculate(params);
        commissions.push(...ruleResult.commissions);
        totalAmount += ruleResult.totalAmount;

        // 累加到明细
        breakdown.personalCommission += ruleResult.breakdown.personalCommission;
        breakdown.referralCommission += ruleResult.breakdown.referralCommission;
        breakdown.teamCommission += ruleResult.breakdown.teamCommission;
        breakdown.bonusCommission += ruleResult.breakdown.bonusCommission;
      }
    }

    return {
      commissions,
      totalAmount,
      breakdown
    };
  }

  private async matchesRule(rule: CommissionRule, params: CommissionCalculationParams): Promise<boolean> {
    // 检查规则条件
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, params)) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(condition: CommissionRuleCondition, params: CommissionCalculationParams): Promise<boolean> {
    switch (condition.field) {
      case 'userLevel':
        return condition.operator === 'in'
          ? condition.values.includes(params.userLevel || UserLevel.NORMAL)
          : params.userLevel === condition.value;
      case 'orderAmount':
        return this.compareValues(params.orderAmount, condition.operator, condition.value);
      case 'orderType':
        return params.orderType === condition.value;
      default:
        return true;
    }
  }

  private compareValues(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'gte': return actual >= expected;
      case 'lt': return actual < expected;
      case 'lte': return actual <= expected;
      case 'eq': return actual === expected;
      default: return false;
    }
  }
}

/**
 * 佣金规则接口
 */
export interface CommissionRule {
  name: string;
  conditions: CommissionRuleCondition[];
  calculate: (params: CommissionCalculationParams) => Promise<CommissionCalculationResult>;
}

/**
 * 佣金规则条件
 */
export interface CommissionRuleCondition {
  field: string;
  operator: string;
  value?: any;
  values?: any[];
}

/**
 * 佣金策略上下文
 */
export class CommissionContext {
  private strategy: CommissionCalculationStrategy;

  constructor(strategy: CommissionCalculationStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: CommissionCalculationStrategy): void {
    this.strategy = strategy;
  }

  async calculate(params: CommissionCalculationParams): Promise<CommissionCalculationResult> {
    return this.strategy.calculate(params);
  }
}

/**
 * 佣金策略工厂
 */
export class CommissionStrategyFactory {
  private static strategies: Map<string, (config?: any) => CommissionCalculationStrategy> = new Map();

  static registerStrategy(name: string, factory: (config?: any) => CommissionCalculationStrategy): void {
    this.strategies.set(name, factory);
  }

  static createStrategy(name: string, config?: any): CommissionCalculationStrategy {
    const factory = this.strategies.get(name);
    if (!factory) {
      throw new Error(`未知的佣金策略: ${name}`);
    }
    return factory(config);
  }

  static getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}

// 注册默认佣金策略
CommissionStrategyFactory.registerStrategy('SIMPLE', (config) => {
  return new SimpleCommissionStrategy(config?.rates);
});

CommissionStrategyFactory.registerStrategy('MULTI_LEVEL', (config) => {
  return new MultiLevelCommissionStrategy(config);
});

CommissionStrategyFactory.registerStrategy('DYNAMIC', (config) => {
  return new DynamicCommissionStrategy(config?.rules);
});

// 创建预定义的动态策略
export const createDefaultDynamicStrategy = (): DynamicCommissionStrategy => {
  const strategy = new DynamicCommissionStrategy();

  // 个人销售佣金规则
  strategy.addRule({
    name: 'Personal Sales Commission',
    conditions: [
      { field: 'orderType', operator: 'eq', value: 'PURCHASE' },
      { field: 'userLevel', operator: 'in', values: [UserLevel.VIP, UserLevel.STAR_1, UserLevel.STAR_2, UserLevel.STAR_3, UserLevel.STAR_4, UserLevel.STAR_5, UserLevel.DIRECTOR] }
    ],
    calculate: async (params) => {
      const rates: Record<UserLevel, number> = {
        [UserLevel.VIP]: 0.05,
        [UserLevel.STAR_1]: 0.08,
        [UserLevel.STAR_2]: 0.10,
        [UserLevel.STAR_3]: 0.12,
        [UserLevel.STAR_4]: 0.14,
        [UserLevel.STAR_5]: 0.16,
        [UserLevel.DIRECTOR]: 0.20,
        [UserLevel.NORMAL]: 0
      };

      const rate = rates[params.userLevel || UserLevel.NORMAL];
      const amount = params.orderAmount * rate;

      return {
        commissions: [{
          userId: params.sellerId,
          type: CommissionType.PERSONAL_SALES,
          amount,
          rate,
          description: '个人销售佣金'
        }],
        totalAmount: amount,
        breakdown: {
          personalCommission: amount,
          referralCommission: 0,
          teamCommission: 0,
          bonusCommission: 0
        }
      };
    }
  });

  return strategy;
};