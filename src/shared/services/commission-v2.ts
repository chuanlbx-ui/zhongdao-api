import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import { ruleManager } from '../rules';
import { RuleCategory, RuleContext } from '../rules/types';
import { cacheService } from './cache';
import { eventBus } from './event-bus';
import {
  CommissionCalculationParams,
  CommissionResult,
  CommissionBreakdown,
  CommissionStats,
  CommissionQueryParams,
  UserTeamStructure,
  CommissionType,
  CommissionStatus,
  CommissionEvent
} from '../types/commission';
import { UserLevel } from '../../modules/user/level.service';

/**
 * 佣金计算服务 V2 - 使用规则引擎重构
 * 解耦业务逻辑，提高可维护性和可扩展性
 */
export class CommissionServiceV2 {
  private cachePrefix = 'commission:v2:';
  private cacheTTL = 5 * 60; // 5分钟

  /**
   * 计算订单佣金 - 使用规则引擎
   */
  async calculateOrderCommission(params: CommissionCalculationParams): Promise<CommissionResult[]> {
    const startTime = Date.now();

    try {
      logger.info('开始计算订单佣金', {
        orderId: params.orderId,
        sellerId: params.sellerId,
        orderAmount: params.orderAmount
      });

      // 1. 构建规则执行上下文
      const context: RuleContext = {
        orderId: params.orderId,
        sellerId: params.sellerId,
        orderAmount: params.orderAmount,
        buyerId: params.buyerId,
        orderType: params.orderType || 'PURCHASE',
        timestamp: Date.now()
      };

      // 2. 获取销售者信息
      const seller = await this.getUserInfo(params.sellerId);
      if (!seller) {
        throw new Error('销售者不存在');
      }
      context.sellerLevel = seller.level;

      // 3. 执行佣金计算规则
      const ruleResults = await ruleManager.executeCommissionRules(params.orderId);

      // 4. 聚合规则执行结果
      const commissionResults = await this.aggregateCommissionResults(
        ruleResults,
        params,
        seller
      );

      // 5. 缓存计算结果
      const cacheKey = `${this.cachePrefix}order:${params.orderId}`;
      await cacheService.set(cacheKey, commissionResults, this.cacheTTL);

      // 6. 发送佣金计算事件
      await eventBus.emit('commission.calculated', {
        orderId: params.orderId,
        sellerId: params.sellerId,
        totalCommission: commissionResults.reduce((sum, r) => sum + r.totalCommission, 0),
        calculationTime: Date.now() - startTime
      } as CommissionEvent);

      logger.info('订单佣金计算完成', {
        orderId: params.orderId,
        totalResults: commissionResults.length,
        totalCommission: commissionResults.reduce((sum, r) => sum + r.totalCommission, 0),
        duration: Date.now() - startTime
      });

      return commissionResults;
    } catch (error) {
      logger.error('计算订单佣金失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * 批量计算佣金
   */
  async batchCalculateCommissions(
    orders: CommissionCalculationParams[]
  ): Promise<Map<string, CommissionResult[]>> {
    const results = new Map<string, CommissionResult[]>();

    // 并行处理多个订单的佣金计算
    const promises = orders.map(async (params) => {
      try {
        const commissionResults = await this.calculateOrderCommission(params);
        results.set(params.orderId, commissionResults);
      } catch (error) {
        logger.error('批量计算佣金失败', {
          orderId: params.orderId,
          error: error instanceof Error ? error.message : '未知错误'
        });
        results.set(params.orderId, []);
      }
    });

    await Promise.all(promises);

    logger.info('批量佣金计算完成', {
      totalOrders: orders.length,
      successCount: Array.from(results.values()).filter(r => r.length > 0).length
    });

    return results;
  }

  /**
   * 计算用户升级奖励
   */
  async processUpgradeReward(userId: string, newLevel: UserLevel, previousLevel: UserLevel): Promise<number> {
    const cacheKey = `${this.cachePrefix}upgrade:${userId}:${newLevel}`;

    // 检查是否已经处理过
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached.amount;
    }

    try {
      // 只有升级时才有奖励
      if (this.getLevelRank(newLevel) <= this.getLevelRank(previousLevel)) {
        return 0;
      }

      // 使用规则引擎计算升级奖励
      const context: RuleContext = {
        userId,
        newLevel,
        previousLevel,
        eventType: 'LEVEL_UPGRADE'
      };

      const ruleResults = await ruleManager.executeRulesByCategory(
        RuleCategory.USER_LEVEL,
        context
      );

      // 从规则结果中提取奖励金额
      let bonusAmount = 0;
      for (const result of ruleResults) {
        if (result.success && result.value) {
          const upgradeReward = result.value.find((v: any) =>
            v.type === 'UPDATE_USER_LEVEL' && v.parameters.newLevel === newLevel
          );
          if (upgradeReward) {
            // 从配置中获取升级奖励金额
            bonusAmount = await this.getLevelUpgradeBonus(newLevel);
            break;
          }
        }
      }

      // 记录升级奖励
      if (bonusAmount > 0) {
        await prisma.commissionCalculation.create({
          data: {
            userId,
            period: new Date().toISOString().substring(0, 7),
            totalCommission: bonusAmount,
            bonusCommission: bonusAmount,
            status: 'PENDING',
            calculatedAt: new Date(),
            metadata: {
              type: 'LEVEL_UPGRADE',
              previousLevel,
              newLevel,
              calculatedBy: 'RuleEngine'
            }
          }
        });

        // 缓存结果
        await cacheService.set(cacheKey, { amount: bonusAmount }, this.cacheTTL * 24); // 缓存24小时

        // 发送升级奖励事件
        await eventBus.emit('commission.upgrade_reward', {
          userId,
          previousLevel,
          newLevel,
          bonusAmount
        } as CommissionEvent);
      }

      logger.info('用户升级奖励处理完成', {
        userId,
        previousLevel,
        newLevel,
        bonusAmount
      });

      return bonusAmount;
    } catch (error) {
      logger.error('处理升级奖励失败', {
        userId,
        newLevel,
        previousLevel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return 0;
    }
  }

  /**
   * 结算佣金
   */
  async settleCommission(calculationIds: string[]): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // 更新佣金状态
        await tx.commissionCalculation.updateMany({
          where: { id: { in: calculationIds } },
          data: {
            status: 'CALCULATED',
            calculatedAt: new Date()
          }
        });

        // 获取结算详情用于日志
        const calculations = await tx.commissionCalculation.findMany({
          where: { id: { in: calculationIds } },
          select: { userId: true, totalCommission: true }
        });

        // 发送结算事件
        for (const calc of calculations) {
          await eventBus.emit('commission.settled', {
            userId: calc.userId,
            amount: calc.totalCommission,
            calculationIds
          } as CommissionEvent);
        }
      });

      // 清理相关缓存
      for (const id of calculationIds) {
        await cacheService.deleteByPattern(`${this.cachePrefix}*`);
      }

      logger.info('佣金结算完成', { calculationIds, count: calculationIds.length });
    } catch (error) {
      logger.error('结算佣金失败', {
        calculationIds,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 支付佣金
   */
  async payCommission(calculationIds: string[]): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // 更新佣金状态
        await tx.commissionCalculation.updateMany({
          where: { id: { in: calculationIds } },
          data: {
            status: 'PAID',
            paidDate: new Date()
          }
        });

        // 获取支付详情
        const calculations = await tx.commissionCalculation.findMany({
          where: { id: { in: calculationIds } },
          select: { userId: true, totalCommission: true }
        });

        // 发送支付事件
        for (const calc of calculations) {
          await eventBus.emit('commission.paid', {
            userId: calc.userId,
            amount: calc.totalCommission,
            calculationIds
          } as CommissionEvent);
        }
      });

      // 清理缓存
      await cacheService.deleteByPattern(`${this.cachePrefix}*`);

      logger.info('佣金支付完成', { calculationIds, count: calculationIds.length });
    } catch (error) {
      logger.error('支付佣金失败', {
        calculationIds,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取用户佣金统计
   */
  async getCommissionStats(userId: string, period?: string): Promise<CommissionStats> {
    const cacheKey = `${this.cachePrefix}stats:${userId}:${period || 'all'}`;

    // 尝试从缓存获取
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const whereCondition: any = { userId };
      if (period) {
        whereCondition.period = period;
      }

      const calculations = await prisma.commissionCalculation.findMany({
        where: whereCondition,
        orderBy: { calculatedAt: 'desc' }
      });

      // 获取用户等级和团队信息
      const user = await this.getUserInfo(userId);
      const teamStructure = await this.getUserTeamStructure(userId);

      const stats = calculations.reduce((acc, calc) => ({
        totalCommission: acc.totalCommission + calc.totalCommission,
        personalCommission: acc.personalCommission + calc.personalCommission,
        teamCommission: acc.teamCommission + calc.teamCommission,
        referralCommission: acc.referralCommission + calc.referralCommission,
        bonusCommission: acc.bonusCommission + calc.bonusCommission,
        paidAmount: acc.paidAmount + (calc.status === 'PAID' ? calc.totalCommission : 0),
        pendingAmount: acc.pendingAmount + (calc.status === 'PENDING' ? calc.totalCommission : 0)
      }), {
        totalCommission: 0,
        personalCommission: 0,
        teamCommission: 0,
        referralCommission: 0,
        bonusCommission: 0,
        paidAmount: 0,
        pendingAmount: 0
      });

      const result: CommissionStats = {
        userId,
        period: period || 'all',
        level: user?.level || 'NORMAL',
        orderCount: teamStructure.monthlyStats.orderCount,
        teamSize: teamStructure.totalTeamSize,
        ...stats
      };

      // 缓存结果
      await cacheService.set(cacheKey, result, this.cacheTTL);

      return result;
    } catch (error) {
      logger.error('获取佣金统计失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取佣金记录列表
   */
  async getCommissionRecords(queryParams: CommissionQueryParams) {
    const cacheKey = `${this.cachePrefix}records:${JSON.stringify(queryParams)}`;

    // 尝试从缓存获取
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const {
        userId,
        period,
        status,
        type,
        startDate,
        endDate,
        page = 1,
        perPage = 20
      } = queryParams;

      const skip = (page - 1) * perPage;
      const whereCondition: any = {};

      if (userId) whereCondition.userId = userId;
      if (period) whereCondition.period = period;
      if (status) whereCondition.status = status;
      if (startDate || endDate) {
        whereCondition.calculatedAt = {};
        if (startDate) whereCondition.calculatedAt.gte = startDate;
        if (endDate) whereCondition.calculatedAt.lte = endDate;
      }

      const [records, total] = await Promise.all([
        prisma.commissionCalculation.findMany({
          where: whereCondition,
          include: {
            user: {
              select: { nickname: true, level: true }
            }
          },
          orderBy: { calculatedAt: 'desc' },
          skip,
          take: perPage
        }),
        prisma.commissionCalculation.count({ where: whereCondition })
      ]);

      const result = {
        records,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };

      // 缓存结果
      await cacheService.set(cacheKey, result, Math.min(this.cacheTTL, 60)); // 列表数据缓存时间较短

      return result;
    } catch (error) {
      logger.error('获取佣金记录失败', {
        queryParams,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // ========== 私有辅助方法 ==========

  /**
   * 聚合规则执行结果
   */
  private async aggregateCommissionResults(
    ruleResults: any[],
    params: CommissionCalculationParams,
    seller: any
  ): Promise<CommissionResult[]> {
    const commissionMap = new Map<string, CommissionResult>();

    for (const result of ruleResults) {
      if (!result.success || !result.value) continue;

      for (const action of result.value) {
        if (action.type === 'CALCULATE_COMMISSION') {
          const userId = action.userId || params.sellerId;

          if (!commissionMap.has(userId)) {
            commissionMap.set(userId, {
              userId,
              orderId: params.orderId,
              personalCommission: 0,
              directReferralCommission: 0,
              indirectReferralCommission: 0,
              teamBonus: 0,
              levelBonus: 0,
              performanceBonus: 0,
              totalCommission: 0,
              breakdown: []
            });
          }

          const commission = commissionMap.get(userId)!;

          // 根据佣金类型更新金额
          switch (action.parameters.type) {
            case 'PERSONAL_SALES':
              commission.personalCommission += action.calculatedAmount || 0;
              break;
            case 'DIRECT_REFERRAL':
              commission.directReferralCommission += action.calculatedAmount || 0;
              break;
            case 'INDIRECT_REFERRAL':
              commission.indirectReferralCommission += action.calculatedAmount || 0;
              break;
            case 'TEAM_BONUS':
              commission.teamBonus += action.calculatedAmount || 0;
              break;
            case 'LEVEL_BONUS':
              commission.levelBonus += action.calculatedAmount || 0;
              break;
            case 'PERFORMANCE_BONUS':
              commission.performanceBonus += action.calculatedAmount || 0;
              break;
          }

          // 添加明细
          commission.breakdown.push({
            type: action.parameters.type as CommissionType,
            userId,
            amount: action.calculatedAmount || 0,
            rate: action.parameters.rate || 0,
            sourceOrderId: params.orderId,
            description: action.description || `${action.parameters.type}佣金`
          });

          // 更新总佣金
          commission.totalCommission = commission.personalCommission +
            commission.directReferralCommission +
            commission.indirectReferralCommission +
            commission.teamBonus +
            commission.levelBonus +
            commission.performanceBonus;
        }
      }
    }

    return Array.from(commissionMap.values());
  }

  /**
   * 获取用户信息
   */
  private async getUserInfo(userId: string): Promise<any> {
    return prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        level: true,
        nickname: true,
        referrerId: true,
        teamPath: true
      }
    });
  }

  /**
   * 获取用户团队结构
   */
  private async getUserTeamStructure(userId: string): Promise<UserTeamStructure> {
    // 这里应该调用团队服务获取团队结构
    // 简化实现
    return {
      userId,
      level: 'NORMAL',
      directCount: 0,
      indirectCounts: [],
      totalTeamSize: 0,
      teamLevels: {},
      monthlyStats: {
        orderCount: 0,
        orderAmount: 0
      }
    };
  }

  /**
   * 获取等级排名
   */
  private getLevelRank(level: UserLevel): number {
    const ranks = {
      [UserLevel.NORMAL]: 0,
      [UserLevel.VIP]: 1,
      [UserLevel.STAR_1]: 2,
      [UserLevel.STAR_2]: 3,
      [UserLevel.STAR_3]: 4,
      [UserLevel.STAR_4]: 5,
      [UserLevel.STAR_5]: 6,
      [UserLevel.DIRECTOR]: 7
    };
    return ranks[level];
  }

  /**
   * 获取等级升级奖励
   */
  private async getLevelUpgradeBonus(level: UserLevel): Promise<number> {
    // 从规则配置中获取升级奖励
    const bonusMapping: Record<UserLevel, number> = {
      [UserLevel.NORMAL]: 0,
      [UserLevel.VIP]: 0,
      [UserLevel.STAR_1]: 50,
      [UserLevel.STAR_2]: 100,
      [UserLevel.STAR_3]: 200,
      [UserLevel.STAR_4]: 300,
      [UserLevel.STAR_5]: 500,
      [UserLevel.DIRECTOR]: 1000
    };

    return bonusMapping[level] || 0;
  }
}

// 导出单例实例
export const commissionServiceV2 = new CommissionServiceV2();