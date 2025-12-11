/**
 * 晋级进度分析服务
 * 负责分析用户晋级进度和预测晋级时间
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { performanceCacheService } from './cache.service';
import { personalCalculatorService } from './personal-calculator.service';
import { teamCalculatorService } from './team-calculator.service';
import { referralCalculatorService } from './referral-calculator.service';
import {
  UpgradeProgress,
  LevelRequirements,
  LevelRequirement
} from './types';
import { TeamRole } from '../types';

// 等级要求配置
const LEVEL_REQUIREMENTS: LevelRequirements = {
  [TeamRole.CAPTAIN]: {      // 一星店长
    minMonthlySales: 2400,
    minDirectMembers: 0,
    description: '月销售额2,400元'
  },
  [TeamRole.MANAGER]: {      // 二星店长
    minMonthlySales: 12000,
    minDirectMembers: 2,
    minCaptainCount: 2,
    description: '月销售额12,000元 + 2个一星下级'
  },
  [TeamRole.DIRECTOR]: {     // 三星店长
    minMonthlySales: 72000,
    minDirectMembers: 5,
    minManagerCount: 2,
    description: '月销售额72,000元 + 2个二星下级'
  },
  [TeamRole.SENIOR_DIRECTOR]: { // 四星店长
    minMonthlySales: 360000,
    minDirectMembers: 10,
    minDirectorCount: 2,
    description: '月销售额360,000元 + 2个三星下级'
  },
  [TeamRole.PARTNER]: {      // 五星店长
    minMonthlySales: 1200000,
    minDirectMembers: 15,
    minSeniorDirectorCount: 2,
    description: '月销售额1,200,000元 + 2个四星下级'
  },
  [TeamRole.AMBASSADOR]: {   // 董事
    minMonthlySales: 6000000,
    minDirectMembers: 20,
    minPartnerCount: 2,
    description: '月销售额6,000,000元 + 2个五星下级'
  }
};

export class ProgressionService {
  /**
   * 获取晋级进度
   */
  async getUpgradeProgress(
    userId: string,
    targetLevel?: TeamRole
  ): Promise<UpgradeProgress> {
    try {
      // 获取用户当前信息
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const currentLevel = this.mapUserLevelToTeamRole(user.level);
      const targetRole = targetLevel || this.getNextLevel(currentLevel);

      if (!targetRole) {
        throw new Error('已经是最高等级');
      }

      // 获取当前周期业绩数据
      const currentPeriod = this.formatPeriod(new Date(), 'monthly');
      const [personalPerf, teamPerf, referralPerf] = await Promise.all([
        personalCalculatorService.calculatePersonalPerformance(userId, currentPeriod),
        teamCalculatorService.calculateTeamPerformance(userId, currentPeriod),
        referralCalculatorService.calculateReferralPerformance(userId, currentPeriod)
      ]);

      // 检查各项要求
      const requirements = LEVEL_REQUIREMENTS[targetRole];
      if (!requirements) {
        throw new Error('目标等级要求配置不存在');
      }

      const requirementsMet = [
        {
          requirement: '月销售额',
          current: personalPerf.salesAmount,
          required: requirements.minMonthlySales,
          percentage: Math.min((personalPerf.salesAmount / requirements.minMonthlySales) * 100, 100),
          met: personalPerf.salesAmount >= requirements.minMonthlySales
        }
      ];

      // 添加下级数量要求
      if (requirements.minDirectMembers > 0) {
        requirementsMet.push({
          requirement: '直推人数',
          current: referralPerf.directReferrals,
          required: requirements.minDirectMembers,
          percentage: Math.min((referralPerf.directReferrals / requirements.minDirectMembers) * 100, 100),
          met: referralPerf.directReferrals >= requirements.minDirectMembers
        });
      }

      // 添加特定等级下级要求
      await this.addSpecificRoleRequirements(requirementsMet, userId, targetRole, requirements);

      // 计算总体进度
      const progressPercentage = requirementsMet.reduce((sum, req) => sum + req.percentage, 0) / requirementsMet.length;

      // 预测达成时间
      const estimatedTime = await this.predictPromotionTime(userId, targetRole, requirementsMet);

      // 计算月增长率
      const monthlyGrowthRate = await personalCalculatorService.calculateMonthlyGrowthRate(userId);

      const progress: UpgradeProgress = {
        currentLevel,
        targetLevel: targetRole,
        progressPercentage,
        requirementsMet,
        estimatedTime,
        monthlyGrowthRate
      };

      logger.info('晋级进度计算完成', {
        userId,
        currentLevel,
        targetLevel: targetRole,
        progressPercentage,
        estimatedTime
      });

      return progress;

    } catch (error) {
      logger.error('获取晋级进度失败', {
        userId,
        targetLevel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取所有等级的晋级进度
   */
  async getAllLevelProgress(userId: string): Promise<UpgradeProgress[]> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const currentLevel = this.mapUserLevelToTeamRole(user.level);
      const allLevels = [
        TeamRole.CAPTAIN,
        TeamRole.MANAGER,
        TeamRole.DIRECTOR,
        TeamRole.SENIOR_DIRECTOR,
        TeamRole.PARTNER,
        TeamRole.AMBASSADOR
      ];

      // 获取当前等级索引
      const currentIndex = allLevels.indexOf(currentLevel);

      // 只获取高于当前等级的进度
      const targetLevels = allLevels.slice(currentIndex + 1);

      const progresses = await Promise.all(
        targetLevels.map(level => this.getUpgradeProgress(userId, level))
      );

      return progresses;
    } catch (error) {
      logger.error('获取所有等级晋级进度失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 检查是否符合晋级条件
   */
  async checkPromotionEligibility(userId: string, targetLevel: TeamRole): Promise<{
    eligible: boolean;
    requirementsMet: string[];
    requirementsPending: string[];
    currentProgress: UpgradeProgress;
  }> {
    try {
      const progress = await this.getUpgradeProgress(userId, targetLevel);

      const requirementsMet = progress.requirementsMet
        .filter(req => req.met)
        .map(req => req.requirement);

      const requirementsPending = progress.requirementsMet
        .filter(req => !req.met)
        .map(req => req.requirement);

      return {
        eligible: requirementsPending.length === 0,
        requirementsMet,
        requirementsPending,
        currentProgress: progress
      };
    } catch (error) {
      logger.error('检查晋级资格失败', {
        userId,
        targetLevel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 预测晋级时间
   */
  async predictPromotionTime(
    userId: string,
    targetRole: TeamRole,
    requirementsMet: any[]
  ): Promise<number | undefined> {
    try {
      // 如果所有要求都满足，返回0
      if (requirementsMet.every(req => req.met)) {
        return 0;
      }

      // 计算增长率和预测时间
      const monthlyGrowthRate = await personalCalculatorService.calculateMonthlyGrowthRate(userId);

      if (monthlyGrowthRate <= 0) {
        return undefined; // 无法预测
      }

      // 找出最慢达成的要求
      let maxDays = 0;
      for (const req of requirementsMet) {
        if (!req.met && req.current > 0) {
          const remaining = req.required - req.current;
          const dailyGrowth = (req.current * monthlyGrowthRate) / 30; // 日增长
          const daysNeeded = dailyGrowth > 0 ? remaining / dailyGrowth : Infinity;
          maxDays = Math.max(maxDays, daysNeeded);
        }
      }

      return maxDays === Infinity ? undefined : Math.ceil(maxDays);

    } catch (error) {
      logger.error('预测晋级时间失败', {
        userId,
        targetRole,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return undefined;
    }
  }

  /**
   * 获取晋级历史记录
   */
  async getPromotionHistory(userId: string): Promise<Array<{
    date: Date;
    fromLevel: TeamRole;
    toLevel: TeamRole;
    reason?: string;
  }>> {
    try {
      const cacheKey = `promotion_history:${userId}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      // 从用户表中获取等级变更历史（如果有记录）
      // 这里简化实现，实际可能需要专门的历史表

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          level: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return [];
      }

      // 简化返回创建时间作为初始等级
      const history = [{
        date: user.createdAt,
        fromLevel: TeamRole.MEMBER,
        toLevel: this.mapUserLevelToTeamRole(user.level),
        reason: '初始等级'
      }];

      performanceCacheService.set(cacheKey, history, 3600); // 1小时缓存

      return history;
    } catch (error) {
      logger.error('获取晋级历史失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 添加特定角色要求
   */
  private async addSpecificRoleRequirements(
    requirementsMet: any[],
    userId: string,
    targetRole: TeamRole,
    requirements: LevelRequirement
  ): Promise<void> {
    try {
      switch (targetRole) {
        case TeamRole.MANAGER:
          if (requirements.minCaptainCount > 0) {
            const captainCount = await this.getTeamMembersByRole(userId, TeamRole.CAPTAIN);
            requirementsMet.push({
              requirement: '一星店长数量',
              current: captainCount,
              required: requirements.minCaptainCount,
              percentage: Math.min((captainCount / requirements.minCaptainCount) * 100, 100),
              met: captainCount >= requirements.minCaptainCount
            });
          }
          break;

        case TeamRole.DIRECTOR:
          if (requirements.minManagerCount > 0) {
            const managerCount = await this.getTeamMembersByRole(userId, TeamRole.MANAGER);
            requirementsMet.push({
              requirement: '二星店长数量',
              current: managerCount,
              required: requirements.minManagerCount,
              percentage: Math.min((managerCount / requirements.minManagerCount) * 100, 100),
              met: managerCount >= requirements.minManagerCount
            });
          }
          break;

        case TeamRole.SENIOR_DIRECTOR:
          if (requirements.minDirectorCount > 0) {
            const directorCount = await this.getTeamMembersByRole(userId, TeamRole.DIRECTOR);
            requirementsMet.push({
              requirement: '三星店长数量',
              current: directorCount,
              required: requirements.minDirectorCount,
              percentage: Math.min((directorCount / requirements.minDirectorCount) * 100, 100),
              met: directorCount >= requirements.minDirectorCount
            });
          }
          break;

        case TeamRole.PARTNER:
          if (requirements.minSeniorDirectorCount > 0) {
            const seniorDirectorCount = await this.getTeamMembersByRole(userId, TeamRole.SENIOR_DIRECTOR);
            requirementsMet.push({
              requirement: '四星店长数量',
              current: seniorDirectorCount,
              required: requirements.minSeniorDirectorCount,
              percentage: Math.min((seniorDirectorCount / requirements.minSeniorDirectorCount) * 100, 100),
              met: seniorDirectorCount >= requirements.minSeniorDirectorCount
            });
          }
          break;

        case TeamRole.AMBASSADOR:
          if (requirements.minPartnerCount > 0) {
            const partnerCount = await this.getTeamMembersByRole(userId, TeamRole.PARTNER);
            requirementsMet.push({
              requirement: '五星店长数量',
              current: partnerCount,
              required: requirements.minPartnerCount,
              percentage: Math.min((partnerCount / requirements.minPartnerCount) * 100, 100),
              met: partnerCount >= requirements.minPartnerCount
            });
          }
          break;
      }
    } catch (error) {
      logger.error('添加特定角色要求失败', { userId, targetRole, error });
    }
  }

  /**
   * 获取特定角色的团队成员数量
   */
  private async getTeamMembersByRole(userId: string, role: TeamRole): Promise<number> {
    try {
      const teamMembers = await teamCalculatorService.getAllTeamMembers(userId);
      const userIds = teamMembers.map(m => m.userId);

      if (userIds.length === 0) return 0;

      const count = await prisma.users.count({
        where: {
          id: { in: userIds },
          level: this.mapTeamRoleToUserLevel(role)
        }
      });

      return count;
    } catch (error) {
      logger.error('获取特定角色团队成员数量失败', { userId, role, error });
      return 0;
    }
  }

  /**
   * 映射用户等级到团队角色
   */
  private mapUserLevelToTeamRole(userLevel: string): TeamRole {
    const levelMap: Record<string, TeamRole> = {
      'NORMAL': TeamRole.MEMBER,
      'VIP': TeamRole.MEMBER,
      'STAR_1': TeamRole.CAPTAIN,
      'STAR_2': TeamRole.MANAGER,
      'STAR_3': TeamRole.DIRECTOR,
      'STAR_4': TeamRole.SENIOR_DIRECTOR,
      'STAR_5': TeamRole.PARTNER,
      'DIRECTOR': TeamRole.AMBASSADOR
    };

    return levelMap[userLevel] || TeamRole.MEMBER;
  }

  /**
   * 映射团队角色到用户等级
   */
  private mapTeamRoleToUserLevel(role: TeamRole): string {
    const roleMap: Record<TeamRole, string> = {
      [TeamRole.MEMBER]: 'NORMAL',
      [TeamRole.CAPTAIN]: 'STAR_1',
      [TeamRole.MANAGER]: 'STAR_2',
      [TeamRole.DIRECTOR]: 'STAR_3',
      [TeamRole.SENIOR_DIRECTOR]: 'STAR_4',
      [TeamRole.PARTNER]: 'STAR_5',
      [TeamRole.AMBASSADOR]: 'DIRECTOR'
    };

    return roleMap[role] || 'NORMAL';
  }

  /**
   * 获取下一个等级
   */
  private getNextLevel(currentLevel: TeamRole): TeamRole | null {
    const levels = [
      TeamRole.MEMBER,
      TeamRole.CAPTAIN,
      TeamRole.MANAGER,
      TeamRole.DIRECTOR,
      TeamRole.SENIOR_DIRECTOR,
      TeamRole.PARTNER,
      TeamRole.AMBASSADOR
    ];

    const currentIndex = levels.indexOf(currentLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  }

  /**
   * 格式化周期
   */
  private formatPeriod(date: Date, type: 'monthly' | 'yearly'): string {
    switch (type) {
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return `${date.getFullYear()}`;
      default:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }
}

// 导出服务实例
export const progressionService = new ProgressionService();