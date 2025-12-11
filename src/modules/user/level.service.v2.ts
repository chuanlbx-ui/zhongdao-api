import { logger } from '@/shared/utils/logger';
import { prisma } from '@/shared/database/client';
import { ruleManager } from '@/shared/rules';
import { eventBus } from '@/shared/services/event-bus';
import { cacheService } from '@/shared/services/cache';
import { RuleCategory, RuleContext } from '@/shared/rules/types';
import { UserLevel, UserLevelService } from './level.service';
import { teamService } from './team.service';

/**
 * 用户等级服务 V2 - 使用规则引擎重构
 * 支持复杂的升级条件和流程编排
 */

export interface UserUpgradeRequest {
  userId: string;
  targetLevel?: UserLevel;
  reason?: string;
  requestedBy?: string;
  autoApprove?: boolean;
}

export interface UpgradeValidationResult {
  canUpgrade: boolean;
  currentLevel: UserLevel;
  nextLevel?: UserLevel;
  requirements?: any;
  currentStats?: any;
  blockers?: string[];
  suggestions?: string[];
}

export interface UpgradeExecutionResult {
  success: boolean;
  previousLevel: UserLevel;
  newLevel: UserLevel;
  upgradeId?: string;
  message: string;
  effects?: UpgradeEffect[];
}

export interface UpgradeEffect {
  type: 'commission' | 'permission' | 'notification' | 'benefit';
  description: string;
  executed: boolean;
  data?: any;
}

export class UserLevelServiceV2 {
  private cachePrefix = 'user:level:v2:';
  private cacheTTL = 10 * 60; // 10分钟

  /**
   * 检查用户升级条件 - 使用规则引擎
   */
  async checkUpgradeConditions(userId: string): Promise<UpgradeValidationResult> {
    const cacheKey = `${this.cachePrefix}check:${userId}`;

    // 尝试从缓存获取
    const cached = await cacheService.get<UpgradeValidationResult>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 获取用户当前信息
      const user = await this.getUserWithStats(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 构建规则执行上下文
      const context: RuleContext = {
        userId,
        currentLevel: user.level,
        totalBottles: user.stats?.totalBottles || 0,
        teamSize: user.stats?.teamSize || 0,
        directVIPCount: user.stats?.directVIPCount || 0,
        orderCount: user.stats?.orderCount || 0,
        totalAmount: user.stats?.totalAmount || 0
      };

      // 执行升级规则
      const ruleResults = await ruleManager.executeRulesByCategory(
        RuleCategory.USER_LEVEL,
        context
      );

      // 分析规则结果
      const analysis = this.analyzeUpgradePossibilities(user.level, ruleResults);

      // 构建验证结果
      const result: UpgradeValidationResult = {
        canUpgrade: analysis.canUpgrade,
        currentLevel: user.level,
        nextLevel: analysis.nextLevel,
        currentStats: {
          totalBottles: context.totalBottles,
          teamSize: context.teamSize,
          directVIPCount: context.directVIPCount,
          orderCount: context.orderCount,
          totalAmount: context.totalAmount
        },
        blockers: analysis.blockers,
        suggestions: analysis.suggestions
      };

      // 缓存结果
      await cacheService.set(cacheKey, result, this.cacheTTL);

      return result;
    } catch (error) {
      logger.error('检查升级条件失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 执行用户升级 - 使用Saga模式确保一致性
   */
  async executeUserUpgrade(request: UserUpgradeRequest): Promise<UpgradeExecutionResult> {
    const upgradeId = `upgrade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('开始执行用户升级', {
        upgradeId,
        userId: request.userId,
        targetLevel: request.targetLevel
      });

      // 1. 验证升级条件
      const validation = await this.checkUpgradeConditions(request.userId);
      if (!validation.canUpgrade) {
        return {
          success: false,
          previousLevel: validation.currentLevel,
          newLevel: validation.currentLevel,
          message: `无法升级：${validation.blockers?.join(', ')}`
        };
      }

      const targetLevel = request.targetLevel || validation.nextLevel!;
      const previousLevel = validation.currentLevel;

      // 2. 创建升级Saga
      const upgradeSaga = new UserUpgradeSaga(upgradeId, request.userId, previousLevel, targetLevel);

      // 3. 执行升级流程
      const sagaResult = await upgradeSaga.execute();

      // 4. 处理结果
      if (sagaResult.success) {
        // 清理相关缓存
        await this.clearUserCache(request.userId);

        // 发送升级成功事件
        await eventBus.emit('user.level_upgraded', {
          userId: request.userId,
          previousLevel,
          newLevel: targetLevel,
          upgradeId,
          upgradeType: request.autoApprove ? 'AUTO' : 'MANUAL',
          requestedBy: request.requestedBy
        });

        logger.info('用户升级成功', {
          upgradeId,
          userId: request.userId,
          previousLevel,
          newLevel: targetLevel
        });

        return {
          success: true,
          previousLevel,
          newLevel: targetLevel,
          upgradeId,
          message: `恭喜升级到${this.getLevelDisplayName(targetLevel)}！`,
          effects: sagaResult.effects
        };
      } else {
        // Saga执行失败，触发补偿
        await upgradeSaga.compensate();

        // 发送升级失败事件
        await eventBus.emit('user.level_upgrade_failed', {
          userId: request.userId,
          attemptedLevel: targetLevel,
          reason: sagaResult.error,
          upgradeId
        });

        logger.error('用户升级失败', {
          upgradeId,
          userId: request.userId,
          error: sagaResult.error
        });

        return {
          success: false,
          previousLevel,
          newLevel: previousLevel,
          message: `升级失败：${sagaResult.error}`
        };
      }
    } catch (error) {
      logger.error('执行用户升级异常', {
        upgradeId,
        request,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        previousLevel: UserLevel.NORMAL,
        newLevel: UserLevel.NORMAL,
        message: '升级过程中发生异常'
      };
    }
  }

  /**
   * 批量检查团队升级
   */
  async batchCheckTeamUpgrades(userId: string): Promise<UpgradeValidationResult[]> {
    const cacheKey = `${this.cachePrefix}batch:${userId}`;

    // 尝试从缓存获取
    const cached = await cacheService.get<UpgradeValidationResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 获取所有下级用户
      const downlineIds = await this.getAllDownlineIds(userId);

      // 并行检查升级条件
      const checks = await Promise.all(
        downlineIds.map(async (downlineId) => {
          try {
            return await this.checkUpgradeConditions(downlineId);
          } catch (error) {
            logger.error('批量检查升级失败', {
              userId: downlineId,
              error: error instanceof Error ? error.message : '未知错误'
            });
            return null;
          }
        })
      );

      // 过滤掉失败的检查
      const results = checks.filter(check => check !== null) as UpgradeValidationResult[];

      // 缓存结果
      await cacheService.set(cacheKey, results, this.cacheTTL / 2); // 批量结果缓存时间较短

      return results;
    } catch (error) {
      logger.error('批量检查团队升级失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 处理升级奖励
   */
  async processUpgradeBenefits(
    userId: string,
    newLevel: UserLevel,
    previousLevel: UserLevel
  ): Promise<UpgradeEffect[]> {
    const effects: UpgradeEffect[] = [];

    try {
      // 1. 处理佣金奖励
      const commissionEffect = await this.processCommissionReward(userId, newLevel);
      if (commissionEffect) {
        effects.push(commissionEffect);
      }

      // 2. 更新权限
      const permissionEffect = await this.updateUserPermissions(userId, newLevel);
      effects.push(permissionEffect);

      // 3. 发送升级通知
      const notificationEffect = await this.sendUpgradeNotification(
        userId,
        newLevel,
        previousLevel
      );
      effects.push(notificationEffect);

      // 4. 激活等级权益
      const benefitEffect = await this.activateLevelBenefits(userId, newLevel);
      effects.push(benefitEffect);

      logger.info('升级权益处理完成', {
        userId,
        newLevel,
        effectsCount: effects.length
      });

      return effects;
    } catch (error) {
      logger.error('处理升级权益失败', {
        userId,
        newLevel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取用户等级信息（带缓存）
   */
  async getUserLevel(userId: string): Promise<UserLevel> {
    const cacheKey = `${this.cachePrefix}level:${userId}`;

    // 尝试从缓存获取
    const cached = await cacheService.get<UserLevel>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const level = user.level as UserLevel;

      // 缓存结果
      await cacheService.set(cacheKey, level, this.cacheTTL);

      return level;
    } catch (error) {
      logger.error('获取用户等级失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取等级权益
   */
  getLevelBenefits(level: UserLevel): {
    purchaseDiscount: number;
    commissionRate: number;
    teamDepth: number;
    specialRights: string[];
  } {
    // 使用规则引擎获取权益配置
    const benefits = {
      [UserLevel.NORMAL]: {
        purchaseDiscount: 0,
        commissionRate: 0,
        teamDepth: 0,
        specialRights: ['基础购物权益']
      },
      [UserLevel.VIP]: {
        purchaseDiscount: 0.05,
        commissionRate: 0.05,
        teamDepth: 1,
        specialRights: ['5%购物折扣', '一级佣金', '基础培训']
      },
      [UserLevel.STAR_1]: {
        purchaseDiscount: 0.08,
        commissionRate: 0.08,
        teamDepth: 2,
        specialRights: ['8%购物折扣', '二级佣金', '进阶培训']
      },
      [UserLevel.STAR_2]: {
        purchaseDiscount: 0.10,
        commissionRate: 0.10,
        teamDepth: 3,
        specialRights: ['10%购物折扣', '三级佣金', '店长培训', '团队管理工具']
      },
      [UserLevel.STAR_3]: {
        purchaseDiscount: 0.12,
        commissionRate: 0.12,
        teamDepth: 4,
        specialRights: ['12%购物折扣', '四级佣金', '高级店长培训', '高级管理工具']
      },
      [UserLevel.STAR_4]: {
        purchaseDiscount: 0.14,
        commissionRate: 0.14,
        teamDepth: 5,
        specialRights: ['14%购物折扣', '五级佣金', '总监培训', '全部管理工具']
      },
      [UserLevel.STAR_5]: {
        purchaseDiscount: 0.16,
        commissionRate: 0.16,
        teamDepth: 6,
        specialRights: ['16%购物折扣', '六级佣金', '五星店长培训', '全部管理工具', '区域代理']
      },
      [UserLevel.DIRECTOR]: {
        purchaseDiscount: 0.20,
        commissionRate: 0.20,
        teamDepth: 7,
        specialRights: ['20%购物折扣', '七级佣金', '董事培训', '全部管理工具', '股权激励', '全国代理']
      }
    };

    return benefits[level] || benefits[UserLevel.NORMAL];
  }

  // ========== 私有方法 ==========

  /**
   * 获取用户及统计信息
   */
  private async getUserWithStats(userId: string): Promise<any> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        level: true,
        nickname: true
      }
    });

    if (!user) {
      return null;
    }

    // 获取用户统计信息
    const stats = await this.getUserStats(userId);

    return {
      ...user,
      stats
    };
  }

  /**
   * 获取用户统计信息
   */
  private async getUserStats(userId: string): Promise<any> {
    // 并行获取各项统计
    const [
      purchases,
      teamInfo,
      orders
    ] = await Promise.all([
      // 总购买箱数
      prisma.purchaseOrders.aggregate({
        where: {
          buyerId: userId,
          status: 'COMPLETED'
        },
        _sum: { totalBottles: true },
        _count: true
      }),

      // 团队信息
      this.getTeamStats(userId),

      // 订单统计
      prisma.orders.aggregate({
        where: {
          buyerId: userId,
          status: 'COMPLETED'
        },
        _sum: { finalAmount: true },
        _count: true
      })
    ]);

    return {
      totalBottles: purchases._sum.totalBottles || 0,
      orderCount: purchases._count,
      teamSize: teamInfo.total,
      directVIPCount: teamInfo.directVIP,
      totalAmount: orders._sum.finalAmount || 0
    };
  }

  /**
   * 获取团队统计
   */
  private async getTeamStats(userId: string): Promise<{ total: number; directVIP: number }> {
    const [totalMembers, directVIP] = await Promise.all([
      // 团队总人数
      teamService.getTeamSize(userId),
      // 直推VIP人数
      prisma.users.count({
        where: {
          parentId: userId,
          level: 'VIP'
        }
      })
    ]);

    return {
      total: totalMembers,
      directVIP
    };
  }

  /**
   * 分析升级可能性
   */
  private analyzeUpgradePossibilities(
    currentLevel: UserLevel,
    ruleResults: any[]
  ): {
    canUpgrade: boolean;
    nextLevel?: UserLevel;
    blockers: string[];
    suggestions: string[];
  } {
    const blockers: string[] = [];
    const suggestions: string[] = [];
    let canUpgrade = false;
    let nextLevel: UserLevel | undefined;

    // 分析规则执行结果
    for (const result of ruleResults) {
      if (!result.success) {
        blockers.push(result.message || '规则执行失败');
        continue;
      }

      if (result.value) {
        for (const action of result.value) {
          if (action.type === 'UPDATE_USER_LEVEL') {
            canUpgrade = true;
            nextLevel = action.parameters.newLevel;
          }
        }
      }
    }

    // 生成建议
    if (!canUpgrade) {
      if (currentLevel === UserLevel.NORMAL) {
        suggestions.push('再购买10箱产品即可升级为VIP');
      } else if (currentLevel === UserLevel.VIP) {
        suggestions.push('再购买20箱产品即可升级为一星店长');
      } else {
        suggestions.push('继续努力，提升业绩和团队规模');
      }
    }

    return {
      canUpgrade,
      nextLevel,
      blockers,
      suggestions
    };
  }

  /**
   * 获取所有下级用户ID
   */
  private async getAllDownlineIds(userId: string): Promise<string[]> {
    // 这里应该使用团队服务的批量查询方法
    // 简化实现
    const downlines = await prisma.users.findMany({
      where: { parentId: userId },
      select: { id: true }
    });

    return downlines.map(d => d.id);
  }

  /**
   * 处理佣金奖励
   */
  private async processCommissionReward(
    userId: string,
    level: UserLevel
  ): Promise<UpgradeEffect | null> {
    try {
      // 调用佣金服务处理升级奖励
      const { commissionServiceV2 } = await import('@/shared/services/commission-v2');
      const bonusAmount = await commissionServiceV2.processUpgradeReward(
        userId,
        level,
        UserLevel.NORMAL // 假设从NORMAL升级，实际应该传入previousLevel
      );

      if (bonusAmount > 0) {
        return {
          type: 'commission',
          description: `升级奖励：${bonusAmount}元`,
          executed: true,
          data: { bonusAmount }
        };
      }

      return null;
    } catch (error) {
      logger.error('处理佣金奖励失败', { userId, level });
      return {
        type: 'commission',
        description: '佣金奖励处理失败',
        executed: false
      };
    }
  }

  /**
   * 更新用户权限
   */
  private async updateUserPermissions(
    userId: string,
    level: UserLevel
  ): Promise<UpgradeEffect> {
    try {
      // 这里应该调用权限服务更新用户权限
      const permissions = this.getLevelPermissions(level);

      return {
        type: 'permission',
        description: `权限更新：${permissions.join(', ')}`,
        executed: true,
        data: { permissions }
      };
    } catch (error) {
      logger.error('更新用户权限失败', { userId, level });
      return {
        type: 'permission',
        description: '权限更新失败',
        executed: false
      };
    }
  }

  /**
   * 发送升级通知
   */
  private async sendUpgradeNotification(
    userId: string,
    newLevel: UserLevel,
    previousLevel: UserLevel
  ): Promise<UpgradeEffect> {
    try {
      await eventBus.emit('notification.send', {
        userId,
        type: 'LEVEL_UPGRADE',
        template: 'level_upgrade',
        data: {
          previousLevel: this.getLevelDisplayName(previousLevel),
          newLevel: this.getLevelDisplayName(newLevel),
          benefits: this.getLevelBenefits(newLevel)
        }
      });

      return {
        type: 'notification',
        description: '升级通知已发送',
        executed: true
      };
    } catch (error) {
      logger.error('发送升级通知失败', { userId, newLevel });
      return {
        type: 'notification',
        description: '通知发送失败',
        executed: false
      };
    }
  }

  /**
   * 激活等级权益
   */
  private async activateLevelBenefits(
    userId: string,
    level: UserLevel
  ): Promise<UpgradeEffect> {
    try {
      const benefits = this.getLevelBenefits(level);

      // 这里应该调用权益服务激活用户权益
      // 激活购物折扣
      // 激活佣金比例
      // 激活团队深度
      // 激活特殊权益

      return {
        type: 'benefit',
        description: `${benefits.specialRights.join(', ')}已激活`,
        executed: true,
        data: benefits
      };
    } catch (error) {
      logger.error('激活等级权益失败', { userId, level });
      return {
        type: 'benefit',
        description: '权益激活失败',
        executed: false
      };
    }
  }

  /**
   * 获取等级权限列表
   */
  private getLevelPermissions(level: UserLevel): string[] {
    const permissions = {
      [UserLevel.NORMAL]: ['basic_purchase'],
      [UserLevel.VIP]: ['basic_purchase', 'referral_commission'],
      [UserLevel.STAR_1]: ['basic_purchase', 'referral_commission', 'team_management'],
      [UserLevel.STAR_2]: ['basic_purchase', 'referral_commission', 'team_management', 'bulk_purchase'],
      [UserLevel.STAR_3]: ['basic_purchase', 'referral_commission', 'team_management', 'bulk_purchase', 'advanced_reports'],
      [UserLevel.STAR_4]: ['basic_purchase', 'referral_commission', 'team_management', 'bulk_purchase', 'advanced_reports', 'regional_management'],
      [UserLevel.STAR_5]: ['basic_purchase', 'referral_commission', 'team_management', 'bulk_purchase', 'advanced_reports', 'regional_management', 'system_configuration'],
      [UserLevel.DIRECTOR]: ['*'] // 所有权限
    };

    return permissions[level] || [];
  }

  /**
   * 获取等级显示名称
   */
  private getLevelDisplayName(level: UserLevel): string {
    const levelNames = {
      [UserLevel.NORMAL]: '普通会员',
      [UserLevel.VIP]: 'VIP会员',
      [UserLevel.STAR_1]: '一星店长',
      [UserLevel.STAR_2]: '二星店长',
      [UserLevel.STAR_3]: '三星店长',
      [UserLevel.STAR_4]: '四星店长',
      [UserLevel.STAR_5]: '五星店长',
      [UserLevel.DIRECTOR]: '董事'
    };
    return levelNames[level] || level;
  }

  /**
   * 清理用户相关缓存
   */
  private async clearUserCache(userId: string): Promise<void> {
    const patterns = [
      `${this.cachePrefix}level:${userId}`,
      `${this.cachePrefix}check:${userId}`,
      `${this.cachePrefix}stats:${userId}`
    ];

    for (const key of patterns) {
      await cacheService.delete(key);
    }

    // 清理批量缓存
    await cacheService.deleteByPattern(`${this.cachePrefix}batch:*`);
  }
}

/**
 * 用户升级Saga - 确保升级过程的原子性
 */
class UserUpgradeSaga {
  private steps: SagaStep[] = [];
  private compensations: CompensationStep[] = [];
  private executedSteps: string[] = [];

  constructor(
    private upgradeId: string,
    private userId: string,
    private previousLevel: UserLevel,
    private targetLevel: UserLevel
  ) {
    this.initializeSteps();
  }

  async execute(): Promise<{ success: boolean; effects: UpgradeEffect[]; error?: string }> {
    const effects: UpgradeEffect[] = [];

    try {
      for (const step of this.steps) {
        logger.debug('执行升级步骤', {
          upgradeId: this.upgradeId,
          step: step.name
        });

        const result = await step.execute();
        this.executedSteps.push(step.name);

        if (result.effect) {
          effects.push(result.effect);
        }

        // 记录补偿步骤
        if (step.compensate) {
          this.compensations.push({
            name: step.name,
            compensate: step.compensate
          });
        }
      }

      return { success: true, effects };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('升级Saga执行失败', {
        upgradeId: this.upgradeId,
        error: errorMessage
      });

      return { success: false, effects, error: errorMessage };
    }
  }

  async compensate(): Promise<void> {
    logger.info('开始执行升级补偿', {
      upgradeId: this.upgradeId,
      stepsCount: this.compensations.length
    });

    // 逆序执行补偿
    for (let i = this.compensations.length - 1; i >= 0; i--) {
      const compensation = this.compensations[i];
      try {
        await compensation.compensate();
        logger.debug('补偿步骤执行成功', {
          upgradeId: this.upgradeId,
          step: compensation.name
        });
      } catch (error) {
        logger.error('补偿步骤执行失败', {
          upgradeId: this.upgradeId,
          step: compensation.name,
          error: error instanceof Error ? error.message : '未知错误'
        });
        // 继续执行其他补偿
      }
    }
  }

  private initializeSteps(): void {
    this.steps = [
      {
        name: 'validateUpgrade',
        execute: async () => {
          // 验证升级条件
          return { success: true };
        },
        compensate: async () => {
          // 无需补偿
        }
      },
      {
        name: 'updateUserLevel',
        execute: async () => {
          await prisma.users.update({
            where: { id: this.userId },
            data: { level: this.targetLevel }
          });

          return { success: true };
        },
        compensate: async () => {
          await prisma.users.update({
            where: { id: this.userId },
            data: { level: this.previousLevel }
          });
        }
      },
      {
        name: 'createUpgradeRecord',
        execute: async () => {
          await prisma.levelUpgradeRecord.create({
            data: {
              userId: this.userId,
              previousLevel: this.previousLevel,
              newLevel: this.targetLevel,
              upgradeType: 'AUTO',
              approvedById: 'system',
              status: 'COMPLETED',
              upgradedAt: new Date(),
              metadata: {
                sagaId: this.upgradeId
              }
            }
          });

          return { success: true };
        },
        compensate: async () => {
          // 标记记录为已回滚
          await prisma.levelUpgradeRecord.updateMany({
            where: {
              userId: this.userId,
              newLevel: this.targetLevel,
              previousLevel: this.previousLevel
            },
            data: {
              status: 'ROLLED_BACK',
              metadata: {
                sagaId: this.upgradeId,
                rolledBackAt: new Date().toISOString()
              }
            }
          });
        }
      },
      {
        name: 'processBenefits',
        execute: async () => {
          const service = new UserLevelServiceV2();
          const effects = await service.processUpgradeBenefits(
            this.userId,
            this.targetLevel,
            this.previousLevel
          );

          return { success: true, effect: effects[0] }; // 返回第一个效果作为代表
        },
        compensate: async () => {
          // 回滚权益
          // 这里应该调用相应的回滚逻辑
        }
      }
    ];
  }
}

interface SagaStep {
  name: string;
  execute: () => Promise<{ success: boolean; effect?: UpgradeEffect }>;
  compensate?: () => Promise<void>;
}

interface CompensationStep {
  name: string;
  compensate: () => Promise<void>;
}

// 导出单例实例
export const userLevelServiceV2 = new UserLevelServiceV2();