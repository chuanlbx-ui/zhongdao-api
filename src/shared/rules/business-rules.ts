import { RuleDefinition, RuleCategory, ConditionType, ComparisonOperator, LogicalOperator, ActionType } from './types';
import { UserLevel } from '../../modules/user/level.service';

/**
 * 业务规则定义
 * 集中管理所有业务规则，便于维护和修改
 */

export const BUSINESS_RULES: RuleDefinition[] = [
  // ==================== 用户等级规则 ====================
  {
    id: 'user_upgrade_normal_to_vip',
    name: '普通用户升级VIP',
    description: '普通用户累计购买10箱产品升级为VIP',
    category: RuleCategory.USER_LEVEL,
    priority: 100,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'totalBottles',
        operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
        value: 10
      },
      {
        type: ConditionType.USER_FIELD,
        field: 'level',
        operator: ComparisonOperator.EQUALS,
        value: UserLevel.NORMAL,
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.UPDATE_USER_LEVEL,
        parameters: {
          newLevel: UserLevel.VIP,
          reason: '累计购买10箱产品，满足VIP升级条件',
          autoApprove: true
        },
        order: 1
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          type: 'LEVEL_UPGRADE',
          template: 'level_upgrade_vip',
          channels: ['system', 'wechat'],
          data: {
            previousLevel: '普通会员',
            newLevel: 'VIP会员',
            benefits: ['5%购物折扣', '一级佣金', '基础培训']
          }
        },
        order: 2
      },
      {
        type: ActionType.EXECUTE_SERVICE,
        parameters: {
          serviceName: 'commissionService',
          method: 'processUpgradeReward',
          parameters: { level: UserLevel.VIP }
        },
        order: 3
      }
    ]
  },

  {
    id: 'user_upgrade_vip_to_star1',
    name: 'VIP升级一星店长',
    description: 'VIP用户累计购买30箱产品升级为一星店长',
    category: RuleCategory.USER_LEVEL,
    priority: 100,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'totalBottles',
        operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
        value: 30
      },
      {
        type: ConditionType.USER_FIELD,
        field: 'level',
        operator: ComparisonOperator.EQUALS,
        value: UserLevel.VIP,
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.UPDATE_USER_LEVEL,
        parameters: {
          newLevel: UserLevel.STAR_1,
          reason: '累计购买30箱产品，满足一星店长升级条件',
          autoApprove: true
        },
        order: 1
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          type: 'LEVEL_UPGRADE',
          template: 'level_upgrade_star',
          channels: ['system', 'wechat', 'sms'],
          data: {
            previousLevel: 'VIP会员',
            newLevel: '一星店长',
            starLevel: 1,
            benefits: ['8%购物折扣', '二级佣金', '进阶培训']
          }
        },
        order: 2
      },
      {
        type: ActionType.EXECUTE_SERVICE,
        parameters: {
          serviceName: 'commissionService',
          method: 'processUpgradeReward',
          parameters: { level: UserLevel.STAR_1 }
        },
        order: 3
      }
    ]
  },

  {
    id: 'user_upgrade_star2_requirements',
    name: '升级二星店长条件',
    description: '一星店长累计购买60箱产品且有2个直推VIP升级为二星店长',
    category: RuleCategory.USER_LEVEL,
    priority: 100,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'totalBottles',
        operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
        value: 60
      },
      {
        type: ConditionType.USER_FIELD,
        field: 'level',
        operator: ComparisonOperator.EQUALS,
        value: UserLevel.STAR_1,
        logicalOperator: LogicalOperator.AND
      },
      {
        type: ConditionType.USER_FIELD,
        field: 'directVIPCount',
        operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
        value: 2,
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.UPDATE_USER_LEVEL,
        parameters: {
          newLevel: UserLevel.STAR_2,
          reason: '累计购买60箱产品且有2个直推VIP，满足二星店长升级条件',
          autoApprove: true
        },
        order: 1
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          type: 'LEVEL_UPGRADE',
          template: 'level_upgrade_star',
          channels: ['system', 'wechat', 'sms'],
          data: {
            previousLevel: '一星店长',
            newLevel: '二星店长',
            starLevel: 2,
            benefits: ['10%购物折扣', '三级佣金', '店长培训', '团队管理工具']
          }
        },
        order: 2
      }
    ]
  },

  // ==================== 佣金计算规则 ====================
  {
    id: 'commission_personal_sales_rate',
    name: '个人销售佣金计算',
    description: '根据用户等级计算个人销售佣金率',
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
      },
      {
        type: ConditionType.ORDER_FIELD,
        field: 'hasCommission',
        operator: ComparisonOperator.EQUALS,
        value: false,
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.CALCULATE_COMMISSION,
        parameters: {
          type: 'PERSONAL_SALES',
          rateMapping: {
            [UserLevel.VIP]: 0.05,
            [UserLevel.STAR_1]: 0.08,
            [UserLevel.STAR_2]: 0.10,
            [UserLevel.STAR_3]: 0.12,
            [UserLevel.STAR_4]: 0.14,
            [UserLevel.STAR_5]: 0.16,
            [UserLevel.DIRECTOR]: 0.20
          },
          bonusLevels: {
            [UserLevel.STAR_1]: 50,
            [UserLevel.STAR_2]: 100,
            [UserLevel.STAR_3]: 200,
            [UserLevel.STAR_4]: 300,
            [UserLevel.STAR_5]: 500,
            [UserLevel.DIRECTOR]: 1000
          }
        },
        order: 1
      }
    ]
  },

  {
    id: 'commission_direct_referral',
    name: '直推佣金计算',
    description: '计算直推用户的佣金',
    category: RuleCategory.COMMISSION,
    priority: 190,
    enabled: true,
    conditions: [
      {
        type: ConditionType.TEAM_FIELD,
        field: 'isDirectReferral',
        operator: ComparisonOperator.EQUALS,
        value: true
      },
      {
        type: ConditionType.USER_FIELD,
        field: 'level',
        operator: ComparisonOperator.IN,
        value: [UserLevel.VIP, UserLevel.STAR_1, UserLevel.STAR_2, UserLevel.STAR_3, UserLevel.STAR_4, UserLevel.STAR_5, UserLevel.DIRECTOR],
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.CALCULATE_COMMISSION,
        parameters: {
          type: 'DIRECT_REFERRAL',
          rateMapping: {
            [UserLevel.VIP]: 0.05,
            [UserLevel.STAR_1]: 0.08,
            [UserLevel.STAR_2]: 0.10,
            [UserLevel.STAR_3]: 0.12,
            [UserLevel.STAR_4]: 0.14,
            [UserLevel.STAR_5]: 0.16,
            [UserLevel.DIRECTOR]: 0.20
          },
          maxLevels: 1
        },
        order: 1
      }
    ]
  },

  {
    id: 'commission_indirect_referral',
    name: '间接推荐佣金计算',
    description: '计算间接推荐用户的佣金（最多10层）',
    category: RuleCategory.COMMISSION,
    priority: 180,
    enabled: true,
    conditions: [
      {
        type: ConditionType.TEAM_FIELD,
        field: 'isIndirectReferral',
        operator: ComparisonOperator.EQUALS,
        value: true
      },
      {
        type: ConditionType.TEAM_FIELD,
        field: 'referralLevel',
        operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
        value: 10,
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.CALCULATE_COMMISSION,
        parameters: {
          type: 'INDIRECT_REFERRAL',
          rateStructure: [
            { level: 2, rate: 0.04 },
            { level: 3, rate: 0.03 },
            { level: 4, rate: 0.02 },
            { level: 5, rate: 0.015 },
            { level: 6, rate: 0.01 },
            { level: 7, rate: 0.008 },
            { level: 8, rate: 0.006 },
            { level: 9, rate: 0.004 },
            { level: 10, rate: 0.002 }
          ]
        },
        order: 1
      }
    ]
  },

  {
    id: 'commission_team_bonus',
    name: '团队管理奖金',
    description: '计算团队管理奖金',
    category: RuleCategory.COMMISSION,
    priority: 170,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'level',
        operator: ComparisonOperator.IN,
        value: [UserLevel.STAR_2, UserLevel.STAR_3, UserLevel.STAR_4, UserLevel.STAR_5, UserLevel.DIRECTOR]
      },
      {
        type: ConditionType.TEAM_FIELD,
        field: 'hasActiveDownline',
        operator: ComparisonOperator.EQUALS,
        value: true,
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.CALCULATE_COMMISSION,
        parameters: {
          type: 'TEAM_BONUS',
          rateMapping: {
            [UserLevel.STAR_2]: 0.01,
            [UserLevel.STAR_3]: 0.015,
            [UserLevel.STAR_4]: 0.02,
            [UserLevel.STAR_5]: 0.025,
            [UserLevel.DIRECTOR]: 0.03
          },
          minTeamSize: {
            [UserLevel.STAR_2]: 5,
            [UserLevel.STAR_3]: 10,
            [UserLevel.STAR_4]: 15,
            [UserLevel.STAR_5]: 20,
            [UserLevel.DIRECTOR]: 30
          }
        },
        order: 1
      }
    ]
  },

  // ==================== 采购权限规则 ====================
  {
    id: 'purchase_team_relationship_validation',
    name: '采购团队关系验证',
    description: '验证采购方和销售方是否在同一个团队',
    category: RuleCategory.PURCHASE,
    priority: 300,
    enabled: true,
    conditions: [
      {
        type: ConditionType.TEAM_FIELD,
        field: 'isValidRelationship',
        operator: ComparisonOperator.EQUALS,
        value: true
      }
    ],
    actions: [
      {
        type: ActionType.SET_VALUE,
        parameters: {
          field: 'validationPassed',
          value: true
        },
        order: 1
      }
    ]
  },

  {
    id: 'purchase_level_hierarchy_validation',
    name: '采购等级层级验证',
    description: '验证采购方等级必须低于销售方等级',
    category: RuleCategory.PURCHASE,
    priority: 310,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'buyerLevelRank',
        operator: ComparisonOperator.LESS_THAN,
        value: { field: 'sellerLevelRank' }
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
      },
      {
        type: ActionType.SET_VALUE,
        parameters: {
          field: 'purchaseRestrictions',
          value: {
            maxQuantity: 50,
            requiresApproval: false
          }
        },
        order: 2
      }
    ]
  },

  {
    id: 'purchase_same_level_upline_search',
    name: '平级上级查找',
    description: '当销售方与采购方同级时，向上查找更高级别的上级',
    category: RuleCategory.PURCHASE,
    priority: 320,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'buyerLevelRank',
        operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
        value: { field: 'sellerLevelRank' }
      },
      {
        type: ConditionType.TEAM_FIELD,
        field: 'hasHigherUpline',
        operator: ComparisonOperator.EQUALS,
        value: true,
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.SET_VALUE,
        parameters: {
          field: 'autoReroute',
          value: true
        },
        order: 1
      },
      {
        type: ActionType.SET_VALUE,
        parameters: {
          field: 'finalSellerId',
          value: { field: 'higherUplineId' }
        },
        order: 2
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          type: 'PURCHASE_REROUTE',
          template: 'purchase_auto_reroute',
          channels: ['system'],
          data: {
            originalSellerId: { field: 'sellerId' },
            finalSellerId: { field: 'higherUplineId' },
            reason: '原销售方等级不高于采购方，自动找到更高级别上级'
          }
        },
        order: 3
      }
    ]
  },

  // ==================== 定价规则 ====================
  {
    id: 'pricing_user_level_discount',
    name: '用户等级折扣',
    description: '根据用户等级应用不同的折扣率',
    category: RuleCategory.PRICING,
    priority: 400,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'level',
        operator: ComparisonOperator.IN,
        value: [UserLevel.VIP, UserLevel.STAR_1, UserLevel.STAR_2, UserLevel.STAR_3, UserLevel.STAR_4, UserLevel.STAR_5, UserLevel.DIRECTOR]
      }
    ],
    actions: [
      {
        type: ActionType.APPLY_DISCOUNT,
        parameters: {
          type: 'PERCENTAGE',
          rateMapping: {
            [UserLevel.VIP]: 0.5,
            [UserLevel.STAR_1]: 0.45,
            [UserLevel.STAR_2]: 0.4,
            [UserLevel.STAR_3]: 0.35,
            [UserLevel.STAR_4]: 0.3,
            [UserLevel.STAR_5]: 0.25,
            [UserLevel.DIRECTOR]: 0.2
          },
          applyTo: ['unitPrice', 'totalPrice']
        },
        order: 1
      }
    ]
  },

  {
    id: 'pricing_quantity_discount',
    name: '批量采购折扣',
    description: '采购数量达到一定阈值时应用额外折扣',
    category: RuleCategory.PRICING,
    priority: 390,
    enabled: true,
    conditions: [
      {
        type: ConditionType.ORDER_FIELD,
        field: 'totalQuantity',
        operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
        value: 20
      }
    ],
    actions: [
      {
        type: ActionType.APPLY_DISCOUNT,
        parameters: {
          type: 'PERCENTAGE',
          rate: 0.05,
          description: '批量采购折扣（满20箱）',
          stackable: true
        },
        order: 1
      }
    ]
  },

  // ==================== 促销规则 ====================
  {
    id: 'promotion_buy_10_get_1',
    name: '买10赠1促销',
    description: '五通店用户购买满10箱赠送1箱',
    category: RuleCategory.PROMOTION,
    priority: 500,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'hasWutongShop',
        operator: ComparisonOperator.EQUALS,
        value: true
      },
      {
        type: ConditionType.ORDER_FIELD,
        field: 'totalQuantity',
        operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
        value: 10,
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.SET_VALUE,
        parameters: {
          field: 'promotionApplied',
          value: {
            type: 'BUY_10_GET_1',
            description: '买10赠1',
            freeItems: 1,
            discountAmount: 599
          }
        },
        order: 1
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          type: 'PROMOTION',
          template: 'buy_10_get_1',
          channels: ['system'],
          data: {
            qualifiedQuantity: 10,
            freeItems: 1,
            savedAmount: 599
          }
        },
        order: 2
      }
    ]
  },

  {
    id: 'promotion_first_order_discount',
    name: '首单优惠',
    description: '用户首次采购享受额外折扣',
    category: RuleCategory.PROMOTION,
    priority: 490,
    enabled: true,
    conditions: [
      {
        type: ConditionType.USER_FIELD,
        field: 'orderCount',
        operator: ComparisonOperator.EQUALS,
        value: 0
      },
      {
        type: ConditionType.ORDER_FIELD,
        field: 'type',
        operator: ComparisonOperator.EQUALS,
        value: 'PURCHASE',
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.APPLY_DISCOUNT,
        parameters: {
          type: 'PERCENTAGE',
          rate: 0.05,
          description: '首单优惠5%',
          oneTime: true
        },
        order: 1
      }
    ]
  },

  // ==================== 团队规则 ====================
  {
    id: 'team_performance_bonus',
    name: '团队业绩奖金',
    description: '团队月业绩达到目标时发放奖金',
    category: RuleCategory.TEAM,
    priority: 250,
    enabled: true,
    conditions: [
      {
        type: ConditionType.TEAM_FIELD,
        field: 'monthlyPerformance',
        operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
        value: 10000
      },
      {
        type: ConditionType.USER_FIELD,
        field: 'level',
        operator: ComparisonOperator.IN,
        value: [UserLevel.STAR_3, UserLevel.STAR_4, UserLevel.STAR_5, UserLevel.DIRECTOR],
        logicalOperator: LogicalOperator.AND
      }
    ],
    actions: [
      {
        type: ActionType.CALCULATE_COMMISSION,
        parameters: {
          type: 'PERFORMANCE_BONUS',
          rate: 0.02,
          bonusLevels: {
            [UserLevel.STAR_3]: { threshold: 10000, rate: 0.02 },
            [UserLevel.STAR_4]: { threshold: 20000, rate: 0.025 },
            [UserLevel.STAR_5]: { threshold: 50000, rate: 0.03 },
            [UserLevel.DIRECTOR]: { threshold: 100000, rate: 0.05 }
          }
        },
        order: 1
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          type: 'TEAM_ACHIEVEMENT',
          template: 'team_performance_bonus',
          channels: ['system', 'wechat'],
          data: {
            performance: { field: 'monthlyPerformance' },
            bonus: { field: 'calculatedBonus' }
          }
        },
        order: 2
      }
    ]
  }
];

// 规则配置映射
export const RULE_CONFIGS = {
  // 佣金配置
  commission: {
    personalRate: {
      [UserLevel.NORMAL]: 0,
      [UserLevel.VIP]: 0.05,
      [UserLevel.STAR_1]: 0.08,
      [UserLevel.STAR_2]: 0.10,
      [UserLevel.STAR_3]: 0.12,
      [UserLevel.STAR_4]: 0.14,
      [UserLevel.STAR_5]: 0.16,
      [UserLevel.DIRECTOR]: 0.20
    },
    directReferralRate: 0.05,
    indirectReferralRates: [0.04, 0.03, 0.02, 0.015, 0.01, 0.008, 0.006, 0.004, 0.002],
    teamBonusRates: {
      [UserLevel.NORMAL]: 0,
      [UserLevel.VIP]: 0,
      [UserLevel.STAR_1]: 0,
      [UserLevel.STAR_2]: 0.01,
      [UserLevel.STAR_3]: 0.015,
      [UserLevel.STAR_4]: 0.02,
      [UserLevel.STAR_5]: 0.025,
      [UserLevel.DIRECTOR]: 0.03
    },
    levelBonusAmounts: {
      [UserLevel.NORMAL]: 0,
      [UserLevel.VIP]: 0,
      [UserLevel.STAR_1]: 50,
      [UserLevel.STAR_2]: 100,
      [UserLevel.STAR_3]: 200,
      [UserLevel.STAR_4]: 300,
      [UserLevel.STAR_5]: 500,
      [UserLevel.DIRECTOR]: 1000
    }
  },

  // 折扣配置
  discount: {
    rates: {
      [UserLevel.NORMAL]: 1.0,
      [UserLevel.VIP]: 0.5,
      [UserLevel.STAR_1]: 0.45,
      [UserLevel.STAR_2]: 0.4,
      [UserLevel.STAR_3]: 0.35,
      [UserLevel.STAR_4]: 0.3,
      [UserLevel.STAR_5]: 0.25,
      [UserLevel.DIRECTOR]: 0.2
    },
    bulkPurchase: {
      threshold: 20,
      rate: 0.05
    },
    firstOrder: {
      rate: 0.05,
      oneTime: true
    }
  },

  // 升级要求配置
  levelRequirements: {
    [UserLevel.NORMAL]: { minBottles: 0, minTeamSize: 0, minDirectVIP: 0 },
    [UserLevel.VIP]: { minBottles: 10, minTeamSize: 0, minDirectVIP: 0 },
    [UserLevel.STAR_1]: { minBottles: 30, minTeamSize: 0, minDirectVIP: 0 },
    [UserLevel.STAR_2]: { minBottles: 60, minTeamSize: 2, minDirectVIP: 2 },
    [UserLevel.STAR_3]: { minBottles: 120, minTeamSize: 5, minDirectVIP: 5 },
    [UserLevel.STAR_4]: { minBottles: 200, minTeamSize: 10, minDirectVIP: 10 },
    [UserLevel.STAR_5]: { minBottles: 350, minTeamSize: 15, minDirectVIP: 15 },
    [UserLevel.DIRECTOR]: { minBottles: 500, minTeamSize: 20, minDirectVIP: 20 }
  }
};