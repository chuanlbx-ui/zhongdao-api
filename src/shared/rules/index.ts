/**
 * 业务规则引擎模块
 * 提供统一的业务规则管理和执行功能
 */

export * from './types';
export * from './rule-engine';
export * from './business-rules';

// 规则管理器 - 提供高级API
import { ruleEngine, RuleEngine } from './rule-engine';
import { RuleDefinition, RuleCategory, RuleContext, RuleResult } from './types';
import { BUSINESS_RULES } from './business-rules';

export class RuleManager {
  private engine: RuleEngine;

  constructor() {
    this.engine = ruleEngine;
    // 注册默认业务规则
    this.registerBuiltinRules();
  }

  /**
   * 执行用户升级规则
   */
  async executeUserUpgradeRules(userId: string): Promise<RuleResult[]> {
    const context: RuleContext = { userId };

    // 获取用户信息
    // 这里应该从数据库获取用户相关信息
    // context.userLevel = await userLevelService.getUserLevel(userId);
    // context.totalBottles = await this.getUserTotalBottles(userId);
    // context.directVIPCount = await this.getDirectVIPCount(userId);

    return this.engine.executeRulesByCategory(RuleCategory.USER_LEVEL, context);
  }

  /**
   * 执行佣金计算规则
   */
  async executeCommissionRules(orderId: string): Promise<RuleResult[]> {
    const context: RuleContext = { orderId };

    // 获取订单信息
    // context.orderAmount = await this.getOrderAmount(orderId);
    // context.sellerId = await this.getOrderSellerId(orderId);
    // context.orderType = await this.getOrderType(orderId);

    return this.engine.executeRulesByCategory(RuleCategory.COMMISSION, context);
  }

  /**
   * 验证采购权限
   */
  async validatePurchasePermission(
    buyerId: string,
    sellerId: string,
    productId: string,
    quantity: number
  ): Promise<RuleResult> {
    const context: RuleContext = {
      buyerId,
      sellerId,
      productId,
      quantity
    };

    const results = await this.engine.executeRulesByCategory(RuleCategory.PURCHASE, context);
    return results.find(r => r.success) || { success: false, message: '采购权限验证失败' };
  }

  /**
   * 计算价格和折扣
   */
  async calculatePricing(
    userId: string,
    items: Array<{ productId: string; quantity: number }>,
    orderType: string
  ): Promise<RuleResult[]> {
    const context: RuleContext = {
      userId,
      items,
      orderType
    };

    return this.engine.executeRulesByCategory(RuleCategory.PRICING, context);
  }

  /**
   * 应用促销规则
   */
  async applyPromotionRules(
    userId: string,
    orderId: string,
    orderAmount: number
  ): Promise<RuleResult[]> {
    const context: RuleContext = {
      userId,
      orderId,
      orderAmount
    };

    return this.engine.executeRulesByCategory(RuleCategory.PROMOTION, context);
  }

  /**
   * 执行团队相关规则
   */
  async executeTeamRules(teamId: string, eventType: string): Promise<RuleResult[]> {
    const context: RuleContext = {
      teamId,
      eventType
    };

    return this.engine.executeRulesByCategory(RuleCategory.TEAM, context);
  }

  /**
   * 动态添加规则
   */
  addRule(rule: RuleDefinition): void {
    this.engine.registerRule(rule);
  }

  /**
   * 批量添加规则
   */
  addRules(rules: RuleDefinition[]): void {
    rules.forEach(rule => this.addRule(rule));
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    return this.engine.toggleRule(ruleId, enabled);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): RuleDefinition[] {
    return this.engine.getRules();
  }

  /**
   * 获取指定类别的规则
   */
  getRulesByCategory(category: RuleCategory): RuleDefinition[] {
    return this.engine.getRules().filter(rule => rule.category === category);
  }

  /**
   * 注册内置规则
   */
  private registerBuiltinRules(): void {
    BUSINESS_RULES.forEach(rule => {
      this.engine.registerRule(rule);
    });
  }

  /**
   * 重新加载规则
   */
  async reloadRules(): Promise<void> {
    // 清理现有规则
    this.engine.clearCache();

    // 重新注册内置规则
    this.registerBuiltinRules();
  }
}

// 导出单例实例
export const ruleManager = new RuleManager();