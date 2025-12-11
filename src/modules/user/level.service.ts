import { logger } from '@/shared/utils/logger';
import { prisma } from '@/shared/database/client';

// 用户等级枚举 - 与数据库保持一致
export enum UserLevel {
  NORMAL = 'NORMAL',         // 普通会员
  VIP = 'VIP',              // VIP会员
  STAR_1 = 'STAR_1',        // 一星店长
  STAR_2 = 'STAR_2',        // 二星店长
  STAR_3 = 'STAR_3',        // 三星店长
  STAR_4 = 'STAR_4',        // 四星店长
  STAR_5 = 'STAR_5',        // 五星店长
  DIRECTOR = 'DIRECTOR'     // 董事
}

// 类型定义
interface LevelRequirement {
  minBottles: number;
  minTeamSize: number;
  minDirectVIP: number;
  description: string;
}

interface LevelRequirements {
  [key: string]: LevelRequirement;
}

interface UpgradeCheckResult {
  canUpgrade: boolean;
  currentLevel: UserLevel;
  nextLevel?: UserLevel;
  requirements?: LevelRequirement;
  currentStats?: {
    totalBottles: number;
    teamSize: number;
    directVIPCount: number;
  };
}

interface UserStats {
  totalBottles: number;
  teamSize: number;
  directVIPCount: number;
}

interface UpgradeResult {
  success: boolean;
  previousLevel: UserLevel;
  newLevel: UserLevel;
  message: string;
}

interface TeamUpgradeCheck {
  userId: string;
  canUpgrade: boolean;
  currentLevel: UserLevel;
  nextLevel?: UserLevel;
}

interface LevelBenefits {
  purchaseDiscount: number;
  commissionRate: number;
  teamDepth: number;
  specialRights: string[];
}

// 等级要求配置
export const LEVEL_REQUIREMENTS: LevelRequirements = {
  [UserLevel.NORMAL]: {
    minBottles: 0,
    minTeamSize: 0,
    minDirectVIP: 0,
    description: '普通会员，无门槛'
  },
  [UserLevel.VIP]: {
    minBottles: 10,
    minTeamSize: 0,
    minDirectVIP: 0,
    description: 'VIP会员，累计购买10箱产品'
  },
  [UserLevel.STAR_1]: {
    minBottles: 30,
    minTeamSize: 0,
    minDirectVIP: 0,
    description: '一星店长，累计购买30箱产品'
  },
  [UserLevel.STAR_2]: {
    minBottles: 60,
    minTeamSize: 2,
    minDirectVIP: 2,
    description: '二星店长，累计购买60箱产品，直接VIP会员2人'
  },
  [UserLevel.STAR_3]: {
    minBottles: 120,
    minTeamSize: 5,
    minDirectVIP: 5,
    description: '三星店长，累计购买120箱产品，直接VIP会员5人'
  },
  [UserLevel.STAR_4]: {
    minBottles: 200,
    minTeamSize: 10,
    minDirectVIP: 10,
    description: '四星店长，累计购买200箱产品，直接VIP会员10人'
  },
  [UserLevel.STAR_5]: {
    minBottles: 350,
    minTeamSize: 15,
    minDirectVIP: 15,
    description: '五星店长，累计购买350箱产品，直接VIP会员15人'
  },
  [UserLevel.DIRECTOR]: {
    minBottles: 500,
    minTeamSize: 20,
    minDirectVIP: 20,
    description: '董事，累计购买500箱产品，直接VIP会员20人'
  }
};

// 用户等级服务类
export class UserLevelService {
  // 获取用户当前等级
  async getUserLevel(userId: string): Promise<UserLevel> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      return user.level as UserLevel;
    } catch (error) {
      logger.error('获取用户等级失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 检查用户是否满足升级条件
  async checkUpgradeConditions(userId: string): Promise<UpgradeCheckResult> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const currentLevel = user.level as UserLevel;
      const levels = Object.values(UserLevel);
      const currentLevelIndex = levels.indexOf(currentLevel);

      // 已经是最高等级
      if (currentLevelIndex === levels.length - 1) {
        return {
          canUpgrade: false,
          currentLevel
        };
      }

      const nextLevel = levels[currentLevelIndex + 1];
      const requirements = LEVEL_REQUIREMENTS[nextLevel];

      // 获取用户当前统计数据
      const stats = await this.getUserStats(userId);

      // 检查是否满足升级条件
      const canUpgrade = this.validateUpgradeRequirements(stats, requirements);

      return {
        canUpgrade,
        currentLevel,
        nextLevel,
        requirements,
        currentStats: stats
      };
    } catch (error) {
      logger.error('检查升级条件失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取用户统计数据
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      const [
        totalPurchases,
        directTeamSize,
        directVIPCount,
        teamStats
      ] = await Promise.all([
        // 总购买箱数
        prisma.purchaseOrders.aggregate({
          where: {
            buyerId: userId,
            status: 'COMPLETED'
          },
          _sum: { totalBottles: true }
        }),

        // 直推团队人数
        prisma.users.count({
          where: { parentId: userId }
        }),

        // 直推VIP人数
        prisma.users.count({
          where: {
            parentId: userId,
            level: 'VIP'
          }
        }),

        // 团队总人数（所有下级）
        this.getTeamSize(userId)
      ]);

      const totalBottles = totalPurchases._sum.totalBottles || 0;

      return {
        totalBottles,
        directTeamSize,
        directVIPCount,
        teamSize: teamStats.total,
        activeTeamSize: teamStats.active
      };
    } catch (error) {
      logger.error('获取用户统计数据失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取团队规模
  private async getTeamSize(userId: string): Promise<{ total: number; active: number }> {
    // 这里需要实现递归查询所有下级用户
    // 简化实现，实际项目中需要优化
    try {
      const allDownlines = await this.getAllDownlines(userId);
      const activeCount = await prisma.users.count({
        where: {
          id: { in: allDownlines },
          status: 'ACTIVE'
        }
      });

      return {
        total: allDownlines.length,
        active: activeCount
      };
    } catch (error) {
      logger.error('获取团队规模失败', { userId });
      return { total: 0, active: 0 };
    }
  }

  // 递归获取所有下级用户
  private async getAllDownlines(userId: string): Promise<string[]> {
    const downlines: string[] = [];

    try {
      const directDownlines = await prisma.users.findMany({
        where: { parentId: userId },
        select: { id: true }
      });

      for (const downline of directDownlines) {
        downlines.push(downline.id);
        const indirectDownlines = await this.getAllDownlines(downline.id);
        downlines.push(...indirectDownlines);
      }
    } catch (error) {
      logger.error('获取下级用户失败', { userId });
    }

    return downlines;
  }

  // 验证升级要求
  private validateUpgradeRequirements(stats: UserStats, requirements: LevelRequirement): boolean {
    return (
      stats.totalBottles >= requirements.minBottles &&
      stats.teamSize >= requirements.minTeamSize &&
      stats.directVIPCount >= requirements.minDirectVIP
    );
  }

  // 执行用户升级
  async upgradeUser(userId: string, targetLevel?: UserLevel): Promise<UpgradeResult> {
    try {
      const upgradeCheck = await this.checkUpgradeConditions(userId);

      if (!upgradeCheck.canUpgrade) {
        return {
          success: false,
          previousLevel: upgradeCheck.currentLevel,
          newLevel: upgradeCheck.currentLevel,
          message: '不满足升级条件'
        };
      }

      const newLevel = targetLevel || upgradeCheck.nextLevel!;
      const previousLevel = upgradeCheck.currentLevel;

      // 更新用户等级
      await prisma.users.update({
        where: { id: userId },
        data: { level: newLevel }
      });

      // 创建升级记录
      await prisma.levelUpgradeRecords.create({
        data: {
          userId,
          previousLevel,
          newLevel,
          upgradeType: 'AUTO',
          approvedById: 'system',
          stats: upgradeCheck.currentStats,
          requirements: upgradeCheck.requirements
        }
      });

      logger.info('用户升级成功', {
        userId,
        previousLevel,
        newLevel,
        stats: upgradeCheck.currentStats
      });

      return {
        success: true,
        previousLevel,
        newLevel,
        message: `恭喜升级到${this.getLevelDisplayName(newLevel)}！`
      };
    } catch (error) {
      logger.error('用户升级失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取等级显示名称
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

  // 批量检查团队升级
  async batchCheckTeamUpgrades(userId: string): Promise<TeamUpgradeCheck[]> {
    try {
      const downlines = await this.getAllDownlines(userId);
      const upgradeChecks = await Promise.all(
        downlines.map(async (downlineId) => {
          const check = await this.checkUpgradeConditions(downlineId);
          return {
            userId: downlineId,
            canUpgrade: check.canUpgrade,
            currentLevel: check.currentLevel,
            nextLevel: check.nextLevel
          };
        })
      );

      return upgradeChecks.filter(check => check.canUpgrade);
    } catch (error) {
      logger.error('批量检查团队升级失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取等级权益说明
  getLevelBenefits(level: UserLevel): LevelBenefits {
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

    return benefits[level];
  }
}

// 导出单例实例
export const userLevelService = new UserLevelService();