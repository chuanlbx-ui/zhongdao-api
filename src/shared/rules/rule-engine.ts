import { logger } from '../utils/logger';
import {
  RuleContext,
  RuleResult,
  RuleDefinition,
  RuleCategory,
  RuleCondition,
  RuleAction,
  ConditionType,
  ComparisonOperator,
  LogicalOperator,
  ActionType,
  RuleExecutionPlan,
  RuleEngineConfig
} from './types';
import { configService } from '../../modules/config';

/**
 * 规则引擎 - 核心业务规则执行引擎
 * 负责解析和执行业务规则，支持复杂条件判断和动作执行
 */
export class RuleEngine {
  private rules: Map<string, RuleDefinition> = new Map();
  private ruleExecutors: Map<ActionType, RuleExecutor> = new Map();
  private conditionEvaluators: Map<ConditionType, ConditionEvaluator> = new Map();
  private cache: Map<string, RuleResult> = new Map();
  private config: RuleEngineConfig;

  constructor(config: Partial<RuleEngineConfig> = {}) {
    this.config = {
      enableCache: true,
      cacheTTL: 5 * 60 * 1000, // 5分钟
      enableParallel: true,
      maxParallelRules: 10,
      enableMetrics: true,
      dryRun: false,
      ...config
    };

    this.initializeExecutors();
    this.initializeEvaluators();
    this.loadDefaultRules();
  }

  /**
   * 注册规则
   */
  registerRule(rule: RuleDefinition): void {
    if (!rule.id || !rule.name) {
      throw new Error('规则必须包含ID和名称');
    }

    // 验证规则定义
    this.validateRule(rule);

    this.rules.set(rule.id, {
      ...rule,
      enabled: rule.enabled !== false // 默认启用
    });

    logger.info('规则注册成功', { ruleId: rule.id, ruleName: rule.name });
  }

  /**
   * 执行规则
   */
  async executeRule(ruleId: string, context: RuleContext): Promise<RuleResult> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`规则不存在: ${ruleId}`);
    }

    if (!rule.enabled) {
      return { success: false, message: '规则已禁用' };
    }

    // 检查缓存
    const cacheKey = this.getCacheKey(ruleId, context);
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // 评估条件
      const conditionResult = await this.evaluateConditions(rule.conditions, context);

      if (!conditionResult.success) {
        return { success: false, message: conditionResult.message };
      }

      // 如果条件满足，执行动作
      if (conditionResult.value) {
        const actionResults = await this.executeActions(rule.actions, context);

        const result: RuleResult = {
          success: true,
          value: actionResults,
          message: `规则 ${rule.name} 执行成功`,
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            executionTime: Date.now()
          }
        };

        // 缓存结果
        if (this.config.enableCache) {
          this.cache.set(cacheKey, result);
          // 设置缓存过期
          setTimeout(() => {
            this.cache.delete(cacheKey);
          }, this.config.cacheTTL);
        }

        return result;
      }

      return {
        success: true,
        value: null,
        message: `规则 ${rule.name} 条件未满足`
      };
    } catch (error) {
      logger.error('规则执行失败', {
        ruleId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : '规则执行失败'
      };
    }
  }

  /**
   * 执行规则集
   */
  async executeRules(ruleIds: string[], context: RuleContext): Promise<RuleResult[]> {
    if (!this.config.enableParallel || ruleIds.length <= 1) {
      // 串行执行
      const results: RuleResult[] = [];
      for (const ruleId of ruleIds) {
        const result = await this.executeRule(ruleId, context);
        results.push(result);

        // 如果规则失败且是高优先级规则，停止执行
        if (!result.success && this.isHighPriorityRule(ruleId)) {
          break;
        }
      }
      return results;
    }

    // 并行执行
    const batchSize = Math.min(ruleIds.length, this.config.maxParallelRules);
    const batches: string[][] = [];

    for (let i = 0; i < ruleIds.length; i += batchSize) {
      batches.push(ruleIds.slice(i, i + batchSize));
    }

    const allResults: RuleResult[] = [];
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(ruleId => this.executeRule(ruleId, context))
      );
      allResults.push(...batchResults);
    }

    return allResults;
  }

  /**
   * 按类别执行规则
   */
  async executeRulesByCategory(category: RuleCategory, context: RuleContext): Promise<RuleResult[]> {
    const categoryRules = Array.from(this.rules.values())
      .filter(rule => rule.category === category && rule.enabled)
      .sort((a, b) => b.priority - a.priority); // 按优先级降序

    const ruleIds = categoryRules.map(rule => rule.id);
    return this.executeRules(ruleIds, context);
  }

  /**
   * 创建执行计划
   */
  createExecutionPlan(ruleIds: string[]): RuleExecutionPlan {
    const rules = ruleIds.map(id => this.rules.get(id)).filter(Boolean) as RuleDefinition[];
    const dependencies = new Map<string, string[]>();

    // 分析规则依赖关系
    rules.forEach(rule => {
      const deps: string[] = [];
      rule.conditions.forEach(condition => {
        if (condition.type === ConditionType.CUSTOM_FUNCTION) {
          // 从条件中提取依赖的规则ID
          const match = condition.value?.toString().match(/rule:(\w+)/);
          if (match) {
            deps.push(match[1]);
          }
        }
      });
      dependencies.set(rule.id, deps);
    });

    // 拓扑排序确定执行顺序
    const executionOrder = this.topologicalSort(ruleIds, dependencies);

    return {
      rules,
      executionOrder,
      dependencies
    };
  }

  /**
   * 评估条件
   */
  private async evaluateConditions(conditions: RuleCondition[], context: RuleContext): Promise<RuleResult> {
    if (conditions.length === 0) {
      return { success: true, value: true };
    }

    let result = true;
    let currentOperator = LogicalOperator.AND;

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const evaluator = this.conditionEvaluators.get(condition.type);

      if (!evaluator) {
        return { success: false, message: `不支持的条件类型: ${condition.type}` };
      }

      const conditionResult = await evaluator.evaluate(condition, context);

      if (!conditionResult.success) {
        return conditionResult;
      }

      // 应用逻辑运算符
      if (i === 0) {
        result = conditionResult.value;
      } else {
        if (currentOperator === LogicalOperator.AND) {
          result = result && conditionResult.value;
        } else {
          result = result || conditionResult.value;
        }
      }

      // 保存下一个逻辑运算符
      if (condition.logicalOperator) {
        currentOperator = condition.logicalOperator;
      }
    }

    return { success: true, value: result };
  }

  /**
   * 执行动作
   */
  private async executeActions(actions: RuleAction[], context: RuleContext): Promise<any[]> {
    // 按order字段排序
    const sortedActions = [...actions].sort((a, b) => (a.order || 0) - (b.order || 0));

    const results: any[] = [];
    for (const action of sortedActions) {
      const executor = this.ruleExecutors.get(action.type);

      if (!executor) {
        throw new Error(`不支持的动作类型: ${action.type}`);
      }

      if (this.config.dryRun) {
        // 干运行模式，只记录动作不执行
        results.push({
          type: action.type,
          parameters: action.parameters,
          dryRun: true
        });
      } else {
        const result = await executor.execute(action, context);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * 验证规则定义
   */
  private validateRule(rule: RuleDefinition): void {
    if (!rule.conditions || rule.conditions.length === 0) {
      throw new Error('规则必须包含至少一个条件');
    }

    if (!rule.actions || rule.actions.length === 0) {
      throw new Error('规则必须包含至少一个动作');
    }

    // 验证条件
    rule.conditions.forEach((condition, index) => {
      if (!condition.type || !condition.field || !condition.operator) {
        throw new Error(`条件 ${index} 定义不完整`);
      }
    });

    // 验证动作
    rule.actions.forEach((action, index) => {
      if (!action.type || !action.parameters) {
        throw new Error(`动作 ${index} 定义不完整`);
      }
    });
  }

  /**
   * 初始化执行器
   */
  private initializeExecutors(): void {
    // 注册默认执行器
    this.ruleExecutors.set(ActionType.SET_VALUE, new SetValueExecutor());
    this.ruleExecutors.set(ActionType.CALCULATE_COMMISSION, new CalculateCommissionExecutor());
    this.ruleExecutors.set(ActionType.UPDATE_USER_LEVEL, new UpdateUserLevelExecutor());
    this.ruleExecutors.set(ActionType.APPLY_DISCOUNT, new ApplyDiscountExecutor());
    this.ruleExecutors.set(ActionType.SEND_NOTIFICATION, new SendNotificationExecutor());
    this.ruleExecutors.set(ActionType.EXECUTE_SERVICE, new ExecuteServiceExecutor());
  }

  /**
   * 初始化评估器
   */
  private initializeEvaluators(): void {
    // 注册默认评估器
    this.conditionEvaluators.set(ConditionType.USER_FIELD, new UserFieldEvaluator());
    this.conditionEvaluators.set(ConditionType.ORDER_FIELD, new OrderFieldEvaluator());
    this.conditionEvaluators.set(ConditionType.PRODUCT_FIELD, new ProductFieldEvaluator());
    this.conditionEvaluators.set(ConditionType.TEAM_FIELD, new TeamFieldEvaluator());
    this.conditionEvaluators.set(ConditionType.SYSTEM_CONFIG, new SystemConfigEvaluator());
    this.conditionEvaluators.set(ConditionType.CUSTOM_FUNCTION, new CustomFunctionEvaluator());
  }

  /**
   * 加载默认规则
   */
  private async loadDefaultRules(): Promise<void> {
    try {
      // 从配置或数据库加载规则
      const rulesFromConfig = await configService.getConfig<RuleDefinition[]>('business_rules', []);

      rulesFromConfig.forEach(rule => {
        this.registerRule(rule);
      });

      // 如果没有配置规则，加载内置规则
      if (rulesFromConfig.length === 0) {
        this.loadBuiltinRules();
      }

      logger.info(`业务规则加载完成，共加载 ${this.rules.size} 条规则`);
    } catch (error) {
      logger.error('加载业务规则失败', { error });
      // 加载内置规则作为回退
      this.loadBuiltinRules();
    }
  }

  /**
   * 加载内置规则
   */
  private loadBuiltinRules(): void {
    // 用户等级升级规则
    this.registerRule({
      id: 'user_level_upgrade_vip',
      name: 'VIP升级规则',
      description: '用户累计购买10箱产品升级为VIP',
      category: RuleCategory.USER_LEVEL,
      priority: 100,
      enabled: true,
      conditions: [
        {
          type: ConditionType.USER_FIELD,
          field: 'totalPurchases',
          operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
          value: 10
        },
        {
          type: ConditionType.USER_FIELD,
          field: 'level',
          operator: ComparisonOperator.EQUALS,
          value: 'NORMAL',
          logicalOperator: LogicalOperator.AND
        }
      ],
      actions: [
        {
          type: ActionType.UPDATE_USER_LEVEL,
          parameters: { newLevel: 'VIP', reason: '累计购买达到VIP要求' },
          order: 1
        },
        {
          type: ActionType.SEND_NOTIFICATION,
          parameters: {
            type: 'LEVEL_UPGRADE',
            template: 'user_level_upgrade',
            data: { newLevel: 'VIP' }
          },
          order: 2
        }
      ]
    });

    // 佣金计算规则
    this.registerRule({
      id: 'commission_personal_sales',
      name: '个人销售佣金',
      description: '计算个人销售佣金',
      category: RuleCategory.COMMISSION,
      priority: 200,
      enabled: true,
      conditions: [
        {
          type: ConditionType.ORDER_FIELD,
          field: 'type',
          operator: ComparisonOperator.EQUALS,
          value: 'PURCHASE'
        },
        {
          type: ConditionType.ORDER_FIELD,
          field: 'status',
          operator: ComparisonOperator.EQUALS,
          value: 'COMPLETED',
          logicalOperator: LogicalOperator.AND
        }
      ],
      actions: [
        {
          type: ActionType.CALCULATE_COMMISSION,
          parameters: {
            type: 'PERSONAL_SALES',
            rateField: 'userLevel.commissionRate'
          },
          order: 1
        }
      ]
    });

    // 采购权限规则
    this.registerRule({
      id: 'purchase_permission_validation',
      name: '采购权限验证',
      description: '验证用户是否具有采购权限',
      category: RuleCategory.PURCHASE,
      priority: 300,
      enabled: true,
      conditions: [
        {
          type: ConditionType.TEAM_FIELD,
          field: 'hasValidRelationship',
          operator: ComparisonOperator.EQUALS,
          value: true
        },
        {
          type: ConditionType.USER_FIELD,
          field: 'levelComparison',
          operator: ComparisonOperator.EQUALS,
          value: 'buyer_lower_than_seller',
          logicalOperator: LogicalOperator.AND
        }
      ],
      actions: [
        {
          type: ActionType.SET_VALUE,
          parameters: {
            field: 'canPurchase',
            value: true
          },
          order: 1
        }
      ]
    });
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(ruleId: string, context: RuleContext): string {
    const contextHash = Buffer.from(JSON.stringify(context)).toString('base64');
    return `${ruleId}:${contextHash}`;
  }

  /**
   * 判断是否为高优先级规则
   */
  private isHighPriorityRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    return rule ? rule.priority >= 200 : false;
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(nodes: string[], dependencies: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (node: string) => {
      if (visiting.has(node)) {
        throw new Error(`检测到循环依赖: ${node}`);
      }

      if (visited.has(node)) {
        return;
      }

      visiting.add(node);

      const deps = dependencies.get(node) || [];
      deps.forEach(dep => visit(dep));

      visiting.delete(node);
      visited.add(node);
      result.push(node);
    };

    nodes.forEach(node => visit(node));

    return result;
  }

  /**
   * 获取所有规则
   */
  getRules(): RuleDefinition[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取规则
   */
  getRule(id: string): RuleDefinition | undefined {
    return this.rules.get(id);
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(id: string, enabled: boolean): boolean {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = enabled;
      logger.info(`规则 ${rule.name} ${enabled ? '启用' : '禁用'}`);
      return true;
    }
    return false;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('规则引擎缓存已清理');
  }
}

// 执行器接口
export interface RuleExecutor {
  execute(action: RuleAction, context: RuleContext): Promise<any>;
}

// 评估器接口
export interface ConditionEvaluator {
  evaluate(condition: RuleCondition, context: RuleContext): Promise<RuleResult>;
}

// 具体执行器实现
class SetValueExecutor implements RuleExecutor {
  async execute(action: RuleAction, context: RuleContext): Promise<any> {
    const { field, value } = action.parameters;
    context[field] = value;
    return { field, value };
  }
}

class CalculateCommissionExecutor implements RuleExecutor {
  async execute(action: RuleAction, context: RuleContext): Promise<any> {
    // 实现佣金计算逻辑
    const { type, rateField } = action.parameters;
    // 这里会调用具体的佣金计算服务
    return { type, calculated: true };
  }
}

class UpdateUserLevelExecutor implements RuleExecutor {
  async execute(action: RuleAction, context: RuleContext): Promise<any> {
    const { newLevel, reason } = action.parameters;
    // 这里会调用用户等级更新服务
    return { userId: context.userId, newLevel, reason };
  }
}

class ApplyDiscountExecutor implements RuleExecutor {
  async execute(action: RuleAction, context: RuleContext): Promise<any> {
    const { rate, type } = action.parameters;
    // 这里会应用折扣逻辑
    return { discountRate: rate, discountType: type };
  }
}

class SendNotificationExecutor implements RuleExecutor {
  async execute(action: RuleAction, context: RuleContext): Promise<any> {
    const { type, template, data } = action.parameters;
    // 这里会调用通知服务
    return { notificationType: type, template, sent: true };
  }
}

class ExecuteServiceExecutor implements RuleExecutor {
  async execute(action: RuleAction, context: RuleContext): Promise<any> {
    const { serviceName, method, parameters } = action.parameters;
    // 这里会动态调用服务方法
    return { serviceName, method, executed: true };
  }
}

// 具体评估器实现
class UserFieldEvaluator implements ConditionEvaluator {
  async evaluate(condition: RuleCondition, context: RuleContext): Promise<RuleResult> {
    const fieldValue = context[condition.field];
    const result = this.compareValues(fieldValue, condition.operator, condition.value);
    return { success: true, value: result };
  }

  private compareValues(fieldValue: any, operator: ComparisonOperator, compareValue: any): boolean {
    switch (operator) {
      case ComparisonOperator.EQUALS:
        return fieldValue === compareValue;
      case ComparisonOperator.NOT_EQUALS:
        return fieldValue !== compareValue;
      case ComparisonOperator.GREATER_THAN:
        return fieldValue > compareValue;
      case ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return fieldValue >= compareValue;
      case ComparisonOperator.LESS_THAN:
        return fieldValue < compareValue;
      case ComparisonOperator.LESS_THAN_OR_EQUAL:
        return fieldValue <= compareValue;
      case ComparisonOperator.IN:
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      case ComparisonOperator.NOT_IN:
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);
      case ComparisonOperator.CONTAINS:
        return String(fieldValue).includes(String(compareValue));
      case ComparisonOperator.STARTS_WITH:
        return String(fieldValue).startsWith(String(compareValue));
      case ComparisonOperator.ENDS_WITH:
        return String(fieldValue).endsWith(String(compareValue));
      default:
        return false;
    }
  }
}

class OrderFieldEvaluator implements ConditionEvaluator {
  async evaluate(condition: RuleCondition, context: RuleContext): Promise<RuleResult> {
    // 实现订单字段评估逻辑
    return { success: true, value: true };
  }
}

class ProductFieldEvaluator implements ConditionEvaluator {
  async evaluate(condition: RuleCondition, context: RuleContext): Promise<RuleResult> {
    // 实现产品字段评估逻辑
    return { success: true, value: true };
  }
}

class TeamFieldEvaluator implements ConditionEvaluator {
  async evaluate(condition: RuleCondition, context: RuleContext): Promise<RuleResult> {
    // 实现团队字段评估逻辑
    return { success: true, value: true };
  }
}

class SystemConfigEvaluator implements ConditionEvaluator {
  async evaluate(condition: RuleCondition, context: RuleContext): Promise<RuleResult> {
    const configValue = await configService.getConfig(condition.field);
    const result = this.compareValues(configValue, condition.operator, condition.value);
    return { success: true, value: result };
  }

  private compareValues(fieldValue: any, operator: ComparisonOperator, compareValue: any): boolean {
    // 与UserFieldEvaluator中的compareValues方法相同
    switch (operator) {
      case ComparisonOperator.EQUALS:
        return fieldValue === compareValue;
      case ComparisonOperator.NOT_EQUALS:
        return fieldValue !== compareValue;
      case ComparisonOperator.GREATER_THAN:
        return fieldValue > compareValue;
      case ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return fieldValue >= compareValue;
      case ComparisonOperator.LESS_THAN:
        return fieldValue < compareValue;
      case ComparisonOperator.LESS_THAN_OR_EQUAL:
        return fieldValue <= compareValue;
      case ComparisonOperator.IN:
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      case ComparisonOperator.NOT_IN:
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);
      case ComparisonOperator.CONTAINS:
        return String(fieldValue).includes(String(compareValue));
      case ComparisonOperator.STARTS_WITH:
        return String(fieldValue).startsWith(String(compareValue));
      case ComparisonOperator.ENDS_WITH:
        return String(fieldValue).endsWith(String(compareValue));
      default:
        return false;
    }
  }
}

class CustomFunctionEvaluator implements ConditionEvaluator {
  async evaluate(condition: RuleCondition, context: RuleContext): Promise<RuleResult> {
    // 实现自定义函数评估逻辑
    // 这里可以调用动态注册的函数
    return { success: true, value: true };
  }
}

// 导出单例实例
export const ruleEngine = new RuleEngine();