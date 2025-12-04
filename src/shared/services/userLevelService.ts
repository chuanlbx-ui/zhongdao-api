import { UserLevel } from '@prisma/client';
import { prisma } from '../database/client';
import { SystemConfigService } from './systemConfigService';

/**
 * 用户等级配置
 */
export interface LevelConfig {
  key: UserLevel;
  name: string;
  order: number;
  discount: number; // 折扣比例 0-1
  monthlyReward: number; // 月度通券奖励
  monthlyBonus?: number; // 月度现金奖励（单位：元）
  
  // 升级要求
  upgradeRequires: {
    // 直推条件：需要多少位与自己平级的直推用户
    directCountOfSameLevel?: number;
    // 销售数量条件：销售额/单价系数 必须超过的数量
    salesQuantity?: {
      amount: number; // 销售额
      unitPrice: number; // 单价系数（如599）
      requiredQuantity: number; // 要求的销售数量（销售额/单价系数 向下取整）
    };
  };
  
  // 权益
  benefits: string[];
}

/**
 * 等级体系配置（保留为默认值，动态配置优先）
 */
export const LEVEL_CONFIGS: Record<UserLevel, LevelConfig> = {
  NORMAL: {
    key: 'NORMAL',
    name: '普通会员',
    order: 1,
    discount: 1.0,
    monthlyReward: 0,
    upgradeRequires: {},
    benefits: ['基础购物功能', '参与平台活动', '积累消费升级']
  },
  VIP: {
    key: 'VIP',
    name: 'VIP会员',
    order: 2,
    discount: 0.8,
    monthlyReward: 100,
    upgradeRequires: {
      salesQuantity: {
        amount: 1000,
        unitPrice: 1,
        requiredQuantity: 1000
      }
    },
    benefits: ['享受8折优惠', '优先客服支持', '每月赠送100通券']
  },
  STAR_1: {
    key: 'STAR_1',
    name: '一星店长',
    order: 3,
    discount: 0.75,
    monthlyReward: 200,
    monthlyBonus: 100,
    upgradeRequires: {
      directCountOfSameLevel: 1,
      salesQuantity: {
        amount: 5000,
        unitPrice: 599,
        requiredQuantity: 9
      }
    },
    benefits: ['享受7.5折优惠', '专属客服支持', '每月赠送200通券', '店长营销权限']
  },
  STAR_2: {
    key: 'STAR_2',
    name: '二星店长',
    order: 4,
    discount: 0.7,
    monthlyReward: 300,
    monthlyBonus: 150,
    upgradeRequires: {
      directCountOfSameLevel: 2,
      salesQuantity: {
        amount: 15000,
        unitPrice: 599,
        requiredQuantity: 25
      }
    },
    benefits: ['享受7折优惠', '专属客服支持', '每月赠送300通券', '店长营销权限', '团队管理权限']
  },
  STAR_3: {
    key: 'STAR_3',
    name: '三星店长',
    order: 5,
    discount: 0.65,
    monthlyReward: 500,
    monthlyBonus: 250,
    upgradeRequires: {
      directCountOfSameLevel: 3,
      salesQuantity: {
        amount: 30000,
        unitPrice: 599,
        requiredQuantity: 50
      }
    },
    benefits: ['享受6.5折优惠', '专属客服支持', '每月赠送500通券', '店长营销权限', '团队管理权限', '佣金提升权限']
  },
  STAR_4: {
    key: 'STAR_4',
    name: '四星店长',
    order: 6,
    discount: 0.6,
    monthlyReward: 800,
    monthlyBonus: 400,
    upgradeRequires: {
      directCountOfSameLevel: 4,
      salesQuantity: {
        amount: 50000,
        unitPrice: 599,
        requiredQuantity: 84
      }
    },
    benefits: ['享受6折优惠', '专属客服支持', '每月赠送800通券', '店长营销权限', '团队管理权限', '佣金提升权限', '区域营销权限']
  },
  STAR_5: {
    key: 'STAR_5',
    name: '五星店长',
    order: 7,
    discount: 0.55,
    monthlyReward: 1200,
    monthlyBonus: 600,
    upgradeRequires: {
      directCountOfSameLevel: 5,
      salesQuantity: {
        amount: 80000,
        unitPrice: 599,
        requiredQuantity: 134
      }
    },
    benefits: ['享受5.5折优惠', '专属客服支持', '每月赠送1200通券', '店长营销权限', '团队管理权限', '佣金提升权限', '区域营销权限', '品牌合作权限']
  },
  DIRECTOR: {
    key: 'DIRECTOR',
    name: '董事',
    order: 8,
    discount: 0.5,
    monthlyReward: 2000,
    monthlyBonus: 1000,
    upgradeRequires: {
      directCountOfSameLevel: 6,
      salesQuantity: {
        amount: 150000,
        unitPrice: 599,
        requiredQuantity: 250
      }
    },
    benefits: ['享受5折优惠', '专属客服支持', '每月赠送2000通券', '店长营销权限', '团队管理权限', '佣金提升权限', '区域营销权限', '品牌合作权限', '公司治理权限']
  }
};

/**
 * 等级体系服务
 */
export class UserLevelService {
  /**
   * 不需要改动的有效配置缓存
   */
  private static levelConfigCache: Record<UserLevel, LevelConfig> | null = null;
  private static levelConfigCacheTime = 0;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 加载配置（优先步：数据库配置 > 默认配置）
   */
  private static async loadLevelConfigs(): Promise<Record<UserLevel, LevelConfig>> {
    // 检逓缓存
    if (
      this.levelConfigCache &&
      Date.now() - this.levelConfigCacheTime < this.CACHE_DURATION
    ) {
      return this.levelConfigCache;
    }

    try {
      const dbConfigs = await SystemConfigService.getLevelConfig();
      if (dbConfigs && typeof dbConfigs === 'object') {
        // 使用数据库配置，需要验证并转换
        const validatedConfigs: Record<UserLevel, LevelConfig> = {} as any;
        Object.entries(dbConfigs).forEach(([key, value]: any) => {
          if (LEVEL_CONFIGS[key as UserLevel]) {
            validatedConfigs[key as UserLevel] = {
              ...LEVEL_CONFIGS[key as UserLevel],
              ...value,
              key: key as UserLevel
            };
          }
        });
        this.levelConfigCache = validatedConfigs;
        this.levelConfigCacheTime = Date.now();
        return validatedConfigs;
      }
    } catch (error) {
      console.warn('加载数据库配置失败，使用默认配置:', error);
    }

    // 欄输护：使用默认配置
    this.levelConfigCache = LEVEL_CONFIGS;
    this.levelConfigCacheTime = Date.now();
    return LEVEL_CONFIGS;
  }

  /**
   * 清除配置缓存（配置修改后调用）
   */
  static clearConfigCache(): void {
    this.levelConfigCache = null;
    this.levelConfigCacheTime = 0;
  }

  /**
   * 获取等级配置
   */
  static async getLevelConfig(level: UserLevel): Promise<LevelConfig> {
    const configs = await this.loadLevelConfigs();
    return configs[level];
  }

  /**
   * 获取所有等级（按顺序）
   */
  static async getAllLevels(): Promise<LevelConfig[]> {
    const configs = await this.loadLevelConfigs();
    return Object.values(configs).sort((a, b) => a.order - b.order);
  }

  /**
   * 获取下一级等级
   */
  static async getNextLevel(currentLevel: UserLevel): Promise<LevelConfig | null> {
    const levels = await this.getAllLevels();
    const currentIndex = levels.findIndex((l) => l.key === currentLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  }

  /**
   * 检查用户是否可以升级
   * 升级需要满足：直推同级人数 AND 销售数量 两个条件都符合
   * @param currentLevel 当前等级
   * @param directCountOfSameLevel 直推同级用户数量
   * @param salesAmount 销售总额
   */
  static async canUpgrade(
    currentLevel: UserLevel,
    directCountOfSameLevel: number,
    salesAmount: number
  ): Promise<boolean> {
    const nextLevel = await this.getNextLevel(currentLevel);
    if (!nextLevel) return false;

    const requires = nextLevel.upgradeRequires;

    // 检查直推同级用户数
    if (requires.directCountOfSameLevel && directCountOfSameLevel < requires.directCountOfSameLevel) {
      return false;
    }

    // 检查销售数量条件
    if (requires.salesQuantity) {
      const { unitPrice, requiredQuantity } = requires.salesQuantity;
      const actualQuantity = Math.floor(salesAmount / unitPrice);
      if (actualQuantity < requiredQuantity) {
        return false;
      }
    }

    return true;
  }

  /**
   * 计算升级进度
   * @param currentLevel 当前等级
   * @param directCountOfSameLevel 直推同级用户数量
   * @param salesAmount 销售总额
   */
  static async calculateUpgradeProgress(
    currentLevel: UserLevel,
    directCountOfSameLevel: number,
    salesAmount: number
  ): Promise<{
    nextLevel: LevelConfig | null;
    progressPercentage: number;
    requirements: {
      directCountOfSameLevel: { current: number; required: number | null; percentage: number };
      salesQuantity: { current: number; required: number | null; percentage: number; actualQuantity: number };
    };
  }> {
    const nextLevel = await this.getNextLevel(currentLevel);
    if (!nextLevel) {
      return {
        nextLevel: null,
        progressPercentage: 100,
        requirements: {
          directCountOfSameLevel: { current: directCountOfSameLevel, required: null, percentage: 100 },
          salesQuantity: { current: salesAmount, required: null, percentage: 100, actualQuantity: 0 },
        },
      };
    }

    const requires = nextLevel.upgradeRequires;
    
    // 计算直推同级用户进度
    const directCountPercentage = requires.directCountOfSameLevel
      ? Math.min(100, (directCountOfSameLevel / requires.directCountOfSameLevel) * 100)
      : 100;
    
    // 计算销售数量进度
    let salesPercentage = 100;
    let requiredQuantity: number | null = null;
    let actualQuantity = 0;
    
    if (requires.salesQuantity) {
      const { unitPrice, requiredQuantity: req } = requires.salesQuantity;
      actualQuantity = Math.floor(salesAmount / unitPrice);
      requiredQuantity = req;
      salesPercentage = Math.min(100, (actualQuantity / requiredQuantity) * 100);
    }

    // 整体进度为两项要求的平均值
    const progressPercentage = requires.directCountOfSameLevel && requires.salesQuantity
      ? (directCountPercentage + salesPercentage) / 2
      : Math.max(directCountPercentage, salesPercentage);

    return {
      nextLevel,
      progressPercentage,
      requirements: {
        directCountOfSameLevel: {
          current: directCountOfSameLevel,
          required: requires.directCountOfSameLevel || null,
          percentage: directCountPercentage
        },
        salesQuantity: {
          current: salesAmount,
          required: requires.salesQuantity?.requiredQuantity || null,
          percentage: salesPercentage,
          actualQuantity
        }
      }
    };
  }

  /**
   * 执行等级升级
   */
  static async upgradeLevel(
    userId: string,
    targetLevel: UserLevel,
    reason: string = '自动升级'
  ) {
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    const oldLevel = user.level;
    const oldConfig = await this.getLevelConfig(oldLevel);
    const newConfig = await this.getLevelConfig(targetLevel);

    if (oldConfig.order >= newConfig.order) {
      throw new Error('不能升级到更低的等级');
    }

    // 更新用户等级
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { level: targetLevel, updatedAt: new Date() }
    });

    // TODO: 记录升级历史到levelUpgradeRecord表
    // 待Prisma schema中添加LevelUpgradeRecord模形后实现

    // 清除缓存，便于需要时立即反映配置改动
    this.clearConfigCache();

    return updatedUser;
  }

  /**
   * 批量检查并处理等级升级
   * 注意：此方法需要数据库中具有以下字段支持：
   * - 用户表：level, teamSales
   * - 关联表：用于查询同级直推用户的关系
   */
  static async checkAndUpgradeUsers() {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        level: true,
        teamSales: true
      }
    });

    const upgradedUsers = [];

    for (const user of users) {
      try {
        let currentLevel = user.level as UserLevel;
        let canContinueUpgrade = true;

        // 不断尝试升级直到无法升级
        while (canContinueUpgrade) {
          // TODO: 需要从数据库查询直推同级用户数
          // 临时使用销售额 / 10 作为直推同级用户的估算
          const estimatedDirectCountOfSameLevel = Math.floor(user.teamSales / 10000);
          
          if (await this.canUpgrade(currentLevel, estimatedDirectCountOfSameLevel, user.teamSales)) {
            const nextLevel = await this.getNextLevel(currentLevel);
            if (nextLevel) {
              await this.upgradeLevel(user.id, nextLevel.key, '系统自动升级');
              upgradedUsers.push({
                userId: user.id,
                fromLevel: currentLevel,
                toLevel: nextLevel.key
              });
              currentLevel = nextLevel.key;
            } else {
              canContinueUpgrade = false;
            }
          } else {
            canContinueUpgrade = false;
          }
        }
      } catch (error) {
        console.error(`用户${user.id}升级失败:`, error);
      }
    }

    return upgradedUsers;
  }

  /**
   * 获取用户等级权益
   */
  static async getLevelBenefits(level: UserLevel) {
    const config = await this.getLevelConfig(level);
    return {
      discount: config.discount,
      monthlyReward: config.monthlyReward,
      monthlyBonus: config.monthlyBonus,
      benefits: config.benefits
    };
  }

  /**
   * 获取价格折扣后的价格
   */
  static async getDiscountedPrice(originalPrice: number, level: UserLevel): Promise<number> {
    const config = await this.getLevelConfig(level);
    return Math.round(originalPrice * config.discount * 100) / 100;
  }
}

/**
 * 等级升级记录类型
 */
export interface LevelUpgradeRecord {
  id: string;
  userId: string;
  oldLevel: UserLevel;
  newLevel: UserLevel;
  reason: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
