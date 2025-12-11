/**
 * 业务规则类型定义
 */

export interface RuleContext {
  userId?: string;
  userLevel?: string;
  teamId?: string;
  orderId?: string;
  productId?: string;
  [key: string]: any;
}

export interface RuleResult {
  success: boolean;
  value?: any;
  message?: string;
  metadata?: Record<string, any>;
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  metadata?: Record<string, any>;
}

export enum RuleCategory {
  USER_LEVEL = 'USER_LEVEL',
  COMMISSION = 'COMMISSION',
  PURCHASE = 'PURCHASE',
  ORDER = 'ORDER',
  INVENTORY = 'INVENTORY',
  PRICING = 'PRICING',
  TEAM = 'TEAM',
  PROMOTION = 'PROMOTION'
}

export interface RuleCondition {
  type: ConditionType;
  field: string;
  operator: ComparisonOperator;
  value: any;
  logicalOperator?: LogicalOperator;
}

export enum ConditionType {
  USER_FIELD = 'USER_FIELD',
  ORDER_FIELD = 'ORDER_FIELD',
  PRODUCT_FIELD = 'PRODUCT_FIELD',
  TEAM_FIELD = 'TEAM_FIELD',
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  CUSTOM_FUNCTION = 'CUSTOM_FUNCTION'
}

export enum ComparisonOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with'
}

export enum LogicalOperator {
  AND = 'and',
  OR = 'or'
}

export interface RuleAction {
  type: ActionType;
  parameters: Record<string, any>;
  order?: number;
}

export enum ActionType {
  SET_VALUE = 'set_value',
  CALCULATE_COMMISSION = 'calculate_commission',
  UPDATE_USER_LEVEL = 'update_user_level',
  APPLY_DISCOUNT = 'apply_discount',
  SEND_NOTIFICATION = 'send_notification',
  EXECUTE_SERVICE = 'execute_service',
  CUSTOM_FUNCTION = 'custom_function'
}

export interface RuleExecutionPlan {
  rules: RuleDefinition[];
  executionOrder: string[];
  dependencies: Map<string, string[]>;
}

export interface RuleEngineConfig {
  enableCache: boolean;
  cacheTTL: number;
  enableParallel: boolean;
  maxParallelRules: number;
  enableMetrics: boolean;
  dryRun: boolean;
}