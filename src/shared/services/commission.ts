import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import {
  CommissionCalculationParams,
  CommissionResult,
  CommissionBreakdown,
  CommissionStats,
  CommissionQueryParams,
  UserTeamStructure,
  CommissionType,
  CommissionStatus,
  DEFAULT_COMMISSION_CONFIG,
  UpgradeRewardConfig
} from '../types/commission';
import { UserLevel, UserLevelService } from '../../modules/user/level.service';
import { TeamService } from '../../modules/user/team.service';
import { configService } from '../../modules/config';

/**
 * 佣金计算服务
 * 负责处理销售佣金、推荐佣金、团队奖金等所有佣金相关计算
 */
export class CommissionService {
  private config = DEFAULT_COMMISSION_CONFIG;
  private levelService = new UserLevelService();
  private teamService = new TeamService();

  /**
   * 计算订单佣金
   * 为一个订单计算所有相关用户的佣金
   */
  async calculateOrderCommission(params: CommissionCalculationParams): Promise<CommissionResult[]> {
    try {
      logger.info('开始计算订单佣金', { orderId: params.orderId });

      const results: CommissionResult[] = [];

      // 1. 计算销售者佣金
      if (params.sellerId) {
        const sellerResult = await this.calculatePersonalCommission(params);
        results.push(sellerResult);
      }

      // 2. 计算推荐佣金（直推和间接推荐）
      const referralResults = await this.calculateReferralCommissions(params);
      results.push(...referralResults);

      // 3. 计算团队奖金
      const teamResults = await this.calculateTeamBonuses(params);
      results.push(...teamResults);

      // 4. 保存佣金记录到数据库
      await this.saveCommissionRecords(results);

      logger.info('订单佣金计算完成', {
        orderId: params.orderId,
        totalResults: results.length,
        totalCommission: results.reduce((sum, r) => sum + r.totalCommission, 0)
      });

      return results;
    } catch (error) {
      logger.error('计算订单佣金失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 计算个人销售佣金
   */
  private async calculatePersonalCommission(params: CommissionCalculationParams): Promise<CommissionResult> {
    if (!params.sellerId) {
      throw new Error('销售者ID不能为空');
    }

    // 从动态配置读取佣金率，如果配置不存在则使用默认值
    const personalRate = await configService.getConfig<number>('commission_personal_rate', this.config.personalRate);
    const commissionAmount = params.orderAmount * personalRate;
    const level = await this.levelService.getUserLevel(params.sellerId);

    // 从动态配置读取等级奖金，如果不存在则使用默认值
    const levelBonusKey = `commission_level_bonus_${level.toLowerCase()}`;
    const defaultBonus = this.config.levelBonusAmounts[level] || 0;
    const levelBonus = await configService.getConfig<number>(levelBonusKey, defaultBonus);

    const breakdown: CommissionBreakdown[] = [
      {
        type: CommissionType.PERSONAL_SALES,
        userId: params.sellerId,
        amount: commissionAmount,
        rate: personalRate,
        sourceOrderId: params.orderId,
        description: '个人销售佣金'
      }
    ];

    if (levelBonus > 0) {
      breakdown.push({
        type: CommissionType.LEVEL_BONUS,
        userId: params.sellerId,
        amount: levelBonus,
        description: `${level}等级奖金`
      });
    }

    return {
      userId: params.sellerId,
      orderId: params.orderId,
      personalCommission: commissionAmount,
      directReferralCommission: 0,
      indirectReferralCommission: 0,
      teamBonus: 0,
      levelBonus,
      performanceBonus: 0,
      totalCommission: commissionAmount + levelBonus,
      breakdown
    };
  }

  /**
   * 计算推荐佣金（直推和间接推荐）
   */
  private async calculateReferralCommissions(params: CommissionCalculationParams): Promise<CommissionResult[]> {
    const results: CommissionResult[] = [];

    if (!params.sellerId) {
      return results;
    }

    // 获取推荐链（最多支持10层）
    const referralChain = await this.getReferralChain(params.sellerId, 10);

    for (let i = 0; i < referralChain.length; i++) {
      const referrer = referralChain[i];
      const level = i + 1; // 推荐层级

      let commissionRate = 0;
      let commissionType: CommissionType;

      // 从动态配置读取佣金率
      if (level === 1) {
        // 直推佣金
        commissionRate = await configService.getConfig<number>('commission_direct_referral_rate', this.config.directReferralRate);
        commissionType = CommissionType.DIRECT_REFERRAL;
      } else if (level <= this.config.indirectReferralRates.length + 1) {
        // 间接推荐佣金 - 从配置读取对应的间接推荐费率
        const indirectRateKey = `commission_indirect_referral_rate_level_${level - 1}`;
        commissionRate = await configService.getConfig<number>(indirectRateKey, this.config.indirectReferralRates[level - 2]);
        commissionType = CommissionType.INDIRECT_REFERRAL;
      } else {
        // 超出佣金层级
        break;
      }

      const commissionAmount = params.orderAmount * commissionRate;

      if (commissionAmount > 0) {
        results.push({
          userId: referrer.id,
          orderId: params.orderId,
          personalCommission: 0,
          directReferralCommission: level === 1 ? commissionAmount : 0,
          indirectReferralCommission: level > 1 ? commissionAmount : 0,
          teamBonus: 0,
          levelBonus: 0,
          performanceBonus: 0,
          totalCommission: commissionAmount,
          breakdown: [{
            type: commissionType,
            userId: referrer.id,
            amount: commissionAmount,
            rate: commissionRate,
            level,
            sourceUserId: params.sellerId,
            sourceOrderId: params.orderId,
            description: `${level === 1 ? '直推' : `${level}级间接推荐`}佣金`
          }]
        });
      }
    }

    return results;
  }

  /**
   * 计算团队奖金
   */
  private async calculateTeamBonuses(params: CommissionCalculationParams): Promise<CommissionResult[]> {
    const results: CommissionResult[] = [];

    if (!params.sellerId) {
      return results;
    }

    // 获取销售者的所有上级（有资格获得团队奖金的人）
    const eligibleLeaders = await this.getEligibleTeamLeaders(params.sellerId);

    for (const leader of eligibleLeaders) {
      const level = await this.levelService.getUserLevel(leader.id);

      // 从动态配置读取团队奖金率
      const teamBonusRateKey = `commission_team_bonus_rate_${level.toLowerCase()}`;
      const defaultTeamBonusRate = this.config.teamBonusRates[level] || 0;
      const teamBonusRate = await configService.getConfig<number>(teamBonusRateKey, defaultTeamBonusRate);

      if (teamBonusRate > 0) {
        const teamBonusAmount = params.orderAmount * teamBonusRate;

        results.push({
          userId: leader.id,
          orderId: params.orderId,
          personalCommission: 0,
          directReferralCommission: 0,
          indirectReferralCommission: 0,
          teamBonus: teamBonusAmount,
          levelBonus: 0,
          performanceBonus: 0,
          totalCommission: teamBonusAmount,
          breakdown: [{
            type: CommissionType.TEAM_BONUS,
            userId: leader.id,
            amount: teamBonusAmount,
            rate: teamBonusRate,
            sourceUserId: params.sellerId,
            sourceOrderId: params.orderId,
            description: `${level}团队管理奖金`
          }]
        });
      }
    }

    return results;
  }

  /**
   * 计算业绩奖金
   */
  async calculatePerformanceBonus(userId: string, period: string): Promise<number> {
    try {
      // 获取指定周期的业绩数据
      const performanceData = await this.getUserPerformance(userId, period);
      const totalSales = performanceData.orderAmount;

      // 从动态配置读取业绩奖金阈值
      const thresholds = await this.getPerformanceThresholds();

      let bonusRate = 0;
      for (const threshold of thresholds) {
        if (totalSales >= threshold.threshold) {
          bonusRate = threshold.rate;
        }
      }

      return totalSales * bonusRate;
    } catch (error) {
      logger.error('计算业绩奖金失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return 0;
    }
  }

  /**
   * 处理用户升级奖励
   */
  async processUpgradeReward(userId: string, newLevel: UserLevel, previousLevel: UserLevel): Promise<number> {
    try {
      // 只有升级时才有奖励，降级没有
      if (this.getLevelRank(newLevel) <= this.getLevelRank(previousLevel)) {
        return 0;
      }

      const bonusAmount = this.config.levelBonusAmounts[newLevel];

      if (bonusAmount > 0) {
        // 记录升级奖励
        await prisma.commissionCalculationsCalculation.create({
          data: {
            userId,
            period: new Date().toISOString().substring(0, 7), // YYYY-MM
            totalCommission: bonusAmount,
            bonusCommission: bonusAmount,
            status: 'CALCULATED' as any,
            calculatedAt: new Date()
          }
        });

        logger.info('用户升级奖励处理完成', {
          userId,
          previousLevel,
          newLevel,
          bonusAmount
        });
      }

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
   * 获取用户佣金统计
   */
  async getCommissionStats(userId: string, period?: string): Promise<CommissionStats> {
    try {
      const whereCondition: any = { userId };
      if (period) {
        whereCondition.period = period;
      }

      const calculations = await prisma.commissionCalculationsCalculation.findMany({
        where: whereCondition,
        orderBy: { calculatedAt: 'desc' }
      });

      const level = await this.levelService.getUserLevel(userId);
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

      return {
        userId,
        period: period || 'all',
        level,
        orderCount: teamStructure.monthlyStats.orderCount,
        teamSize: teamStructure.totalTeamSize,
        ...stats
      };
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
        prisma.commissionCalculationsCalculation.findMany({
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
        prisma.commissionCalculationsCalculation.count({ where: whereCondition })
      ]);

      return {
        records,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };
    } catch (error) {
      logger.error('获取佣金记录失败', {
        queryParams,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 结算佣金（将状态从PENDING改为CALCULATED）
   */
  async settleCommission(calculationIds: string[]): Promise<void> {
    try {
      await prisma.commissionCalculationsCalculation.updateMany({
        where: { id: { in: calculationIds } },
        data: {
          status: 'CALCULATED' as any,
          calculatedAt: new Date()
        }
      });

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
      await prisma.commissionCalculationsCalculation.updateMany({
        where: { id: { in: calculationIds } },
        data: {
          status: 'PAID' as any,
          paidDate: new Date()
        }
      });

      logger.info('佣金支付完成', { calculationIds, count: calculationIds.length });
    } catch (error) {
      logger.error('支付佣金失败', {
        calculationIds,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // ========== 私有辅助方法 ==========

  /**
   * 获取推荐链
   */
  private async getReferralChain(userId: string, maxLevels: number): Promise<Array<{ id: string; level: UserLevel }>> {
    const chain: Array<{ id: string; level: UserLevel }> = [];
    let currentUserId = userId;
    let level = 0;

    while (level < maxLevels && currentUserId) {
      const user = await prisma.users.findUnique({
        where: { id: currentUserId },
        select: { referrerId: true }
      });

      if (!user?.referrerId) break;

      const referrer = await prisma.users.findUnique({
        where: { id: user.referrerId },
        select: { id: true, level: true }
      });

      if (!referrer) break;

      chain.push({
        id: referrer.id,
        level: referrer.level as UserLevel
      });

      currentUserId = user.referrerId;
      level++;
    }

    return chain;
  }

  /**
   * 获取有资格的团队领导
   */
  private async getEligibleTeamLeaders(userId: string): Promise<Array<{ id: string; level: UserLevel }>> {
    const leaders: Array<{ id: string; level: UserLevel }> = [];
    const processedIds = new Set<string>();
    let currentLevelUsers = [userId];

    // 逐层向上查找，直到找到所有有资格的领导
    while (currentLevelUsers.length > 0) {
      const nextLevelUsers: string[] = [];

      for (const currentUserId of currentLevelUsers) {
        if (processedIds.has(currentUserId)) continue;

        const user = await prisma.users.findUnique({
          where: { id: currentUserId },
          select: { referrerId: true }
        });

        if (user?.referrerId && !processedIds.has(user.referrerId)) {
          const referrer = await prisma.users.findUnique({
            where: { id: user.referrerId },
            select: { id: true, level: true }
          });

          if (referrer) {
            const level = referrer.level as UserLevel;
            // 只有VIP及以上等级才有团队奖金
            if (this.config.teamBonusRates[level] > 0) {
              leaders.push({ id: referrer.id, level });
            }

            nextLevelUsers.push(referrer.id);
            processedIds.add(referrer.id);
          }
        }
      }

      currentLevelUsers = nextLevelUsers;
    }

    return leaders;
  }

  /**
   * 获取用户团队结构
   */
  private async getUserTeamStructure(userId: string): Promise<UserTeamStructure> {
    const level = await this.levelService.getUserLevel(userId);

    // 获取团队统计
    const teamStats = await this.teamService.getTeamStats(userId);

    // 获取本月业绩
    const monthlyStats = await this.getUserPerformance(userId, new Date().toISOString().substring(0, 7));

    return {
      userId,
      level,
      directCount: teamStats.totalMembers,
      indirectCounts: [], // 简化实现
      totalTeamSize: teamStats.totalMembers,
      teamLevels: teamStats.levelDistribution,
      monthlyStats
    };
  }

  /**
   * 获取用户业绩数据
   */
  private async getUserPerformance(userId: string, period: string): Promise<{ orderCount: number; orderAmount: number }> {
    const [startDate, endDate] = this.getPeriodDateRange(period);

    const orders = await prisma.orders.findMany({
      where: {
        sellerId: userId,
        status: 'COMPLETED',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: { finalAmount: true }
    });

    const orderCount = orders.length;
    const orderAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0);

    return { orderCount, orderAmount };
  }

  /**
   * 获取周期的日期范围
   */
  private getPeriodDateRange(period: string): [Date, Date] {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return [startDate, endDate];
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
   * 获取业绩奖金阈值配置
   */
  private async getPerformanceThresholds(): Promise<Array<{ threshold: number; rate: number }>> {
    try {
      // 从动态配置读取业绩奖金阈值
      const thresholdsConfig = await configService.getConfig<string>('commission_performance_thresholds', '');

      if (thresholdsConfig) {
        // 解析JSON格式的配置，如: '[{"threshold": 10000, "rate": 0.01}, {"threshold": 50000, "rate": 0.02}]'
        return JSON.parse(thresholdsConfig);
      }

      // 如果配置不存在，使用默认值
      return this.config.performanceThresholds;
    } catch (error) {
      logger.warn('读取业绩奖金阈值配置失败，使用默认值', { error: error instanceof Error ? error.message : '未知错误' });
      return this.config.performanceThresholds;
    }
  }

  /**
   * 保存佣金记录
   */
  private async saveCommissionRecords(results: CommissionResult[]): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        for (const result of results) {
          const period = new Date().toISOString().substring(0, 7);

          // 检查是否已存在该订单的佣金记录
          const existingRecord = await tx.commissionCalculation.findFirst({
            where: {
              userId: result.userId,
              period,
              // 这里可以添加更多条件来避免重复计算
            }
          });

          if (existingRecord) {
            // 更新现有记录
            await tx.commissionCalculation.update({
              where: { id: existingRecord.id },
              data: {
                totalCommission: existingRecord.totalCommission + result.totalCommission,
                personalCommission: existingRecord.personalCommission + result.personalCommission,
                teamCommission: existingRecord.teamCommission + result.teamCommission,
                referralCommission: existingRecord.referralCommission + result.directReferralCommission + result.indirectReferralCommission,
                bonusCommission: existingRecord.bonusCommission + result.levelBonus + result.performanceBonus,
                updatedAt: new Date()
              }
            });
          } else {
            // 创建新记录
            await tx.commissionCalculation.create({
              data: {
                userId: result.userId,
                period,
                totalCommission: result.totalCommission,
                personalCommission: result.personalCommission,
                teamCommission: result.teamCommission,
                referralCommission: result.directReferralCommission + result.indirectReferralCommission,
                bonusCommission: result.levelBonus + result.performanceBonus,
                status: 'PENDING' as any
              }
            });
          }
        }
      });
    } catch (error) {
      logger.error('保存佣金记录失败', {
        resultsCount: results.length,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const commissionService = new CommissionService();