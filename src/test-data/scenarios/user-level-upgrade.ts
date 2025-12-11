/**
 * 用户升级场景生成器
 * 生成用户从普通用户升级到董事的完整路径数据
 */

import { faker } from '@faker-js/faker';
import { PrismaClient, UserLevel, TransactionType } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import type { UserLevelUpgradeScenario } from '../types';

const prisma = new PrismaClient();

// 升级要求配置
const UPGRADE_REQUIREMENTS = {
  NORMAL: {
    to: 'VIP',
    requirements: {
      totalPurchase: 2000,      // 累计消费2000元
      activeDays: 7            // 活跃7天
    }
  },
  VIP: {
    to: 'STAR_1',
    requirements: {
      totalPurchase: 10000,     // 累计消费10000元
      directReferrals: 3,       // 直推3人
      monthlyPerformance: 2400  // 月业绩2400元
    }
  },
  STAR_1: {
    to: 'STAR_2',
    requirements: {
      directReferrals: 5,       // 直推5人
      teamReferrals: 10,        // 团队推荐10人
      monthlyPerformance: 12000 // 月业绩12000元
    }
  },
  STAR_2: {
    to: 'STAR_3',
    requirements: {
      teamSize: 20,            // 团队20人
      teamMonthlySales: 30000,  // 团队月销售3万
      directStar2: 2           // 直推2个二星店长
    }
  },
  STAR_3: {
    to: 'STAR_4',
    requirements: {
      teamSize: 50,            // 团队50人
      teamMonthlySales: 60000,  // 团队月销售6万
      directStar3: 2           // 直推2个三星店长
    }
  },
  STAR_4: {
    to: 'STAR_5',
    requirements: {
      teamSize: 100,           // 团队100人
      teamMonthlySales: 120000, // 团队月销售12万
      directStar4: 2           // 直推2个四星店长
    }
  },
  STAR_5: {
    to: 'DIRECTOR',
    requirements: {
      teamSize: 200,           // 团队200人
      teamMonthlySales: 300000, // 团队月销售30万
      directStar5: 3           // 直推3个五星店长
    }
  }
};

export class UserLevelUpgradeScenarioGenerator {
  /**
   * 生成用户升级场景数据
   */
  async generateScenario(): Promise<UserLevelUpgradeScenario[]> {
    console.log('📈 开始生成用户升级场景数据...');

    const scenarios: UserLevelUpgradeScenario[] = [];

    // 获取用户数据
    const users = await prisma.users.findMany({
      orderBy: { createdAt: 'asc' },
      take: 50 // 选择前50个用户进行升级场景生成
    });

    // 为每个用户生成升级路径
    for (const user of users) {
      const scenario: UserLevelUpgradeScenario = {
        userId: user.id,
        upgradePath: [],
        commissions: []
      };

      let currentLevel = user.level as string;
      let pathCount = 0;
      const maxPath = Math.floor(faker.number.int({ min: 3, max: 7 }));

      // 生成升级路径
      while (currentLevel !== 'DIRECTOR' && pathCount < maxPath) {
        const requirement = UPGRADE_REQUIREMENTS[currentLevel];
        if (!requirement) break;
        const nextLevel = requirement.to;

        // 模拟升级时间（间隔1-3个月）
        const upgradeDate = faker.date.past({
          days: (maxPath - pathCount) * 90,
          years: 1
        });

        // 记录升级
        scenario.upgradePath.push({
          fromLevel: currentLevel,
          toLevel: nextLevel,
          upgradedAt: upgradeDate,
          requirements: requirement.requirements
        });

        // 生成升级相关的佣金记录
        const commissionAmount = faker.number.float({
          min: 500,
          max: 5000,
          fractionDigits: 2
        });

        await prisma.pointsTransactions.create({
          data: {
            id: createId(),
            userId: user.id,
            type: TransactionType.COMMISSION,
            amount: commissionAmount,
            balance: 0, // 将在更新用户余额时计算
            description: `升级到${this.getLevelName(nextLevel)}奖励`,
            status: 'COMPLETED',
            metadata: {
              upgrade: true,
              fromLevel: currentLevel,
              toLevel: nextLevel
            },
            createdAt: upgradeDate,
            updatedAt: upgradeDate
          }
        });

        scenario.commissions.push({
          id: createId(),
          userId: user.id,
          type: TransactionType.COMMISSION,
          amount: commissionAmount,
          balance: 0,
          description: `升级到${this.getLevelName(nextLevel)}奖励`,
          metadata: {},
          status: 'COMPLETED',
          createdAt: upgradeDate,
          updatedAt: upgradeDate
        });

        // 更新用户等级
        await prisma.users.update({
          where: { id: user.id },
          data: {
            level: nextLevel,
            updatedAt: upgradeDate
          }
        });

        currentLevel = nextLevel;
        pathCount++;
      }

      if (scenario.upgradePath.length > 0) {
        scenarios.push(scenario);
        console.log(`  👤 ${user.nickname}: ${user.level} → ${currentLevel} (${scenario.upgradePath.length}次升级)`);
      }
    }

    console.log(`\n✅ 用户升级场景生成完成！`);
    console.log(`  📊 总计: ${scenarios.length} 个用户的升级路径`);

    return scenarios;
  }

  /**
   * 生成团队业绩数据
   */
  async generateTeamPerformance() {
    console.log('\n📊 生成团队业绩数据...');

    // 获取有团队的用户
    const usersWithTeam = await prisma.users.findMany({
      where: {
        NOT: {
          teamPath: null
        }
      }
    });

    for (const user of usersWithTeam) {
      // 生成过去6个月的月度业绩
      for (let i = 0; i < 6; i++) {
        const monthDate = faker.date.past({ months: i });
        const month = monthDate.getMonth();
        const year = monthDate.getFullYear();

        // 随机生成业绩数据
        const monthlySales = faker.number.float({
          min: 1000,
          max: 50000,
          fractionDigits: 2
        });

        const monthlyBottles = faker.number.int({ min: 10, max: 500 });

        // 保存月度业绩记录
        await prisma.monthlyPerformance.create({
          data: {
            id: createId(),
            userId: user.id,
            month,
            year,
            personalSales: monthlySales,
            teamSales: monthlySales * faker.number.float({ min: 2, max: 10, fractionDigits: 2 }),
            personalBottles: monthlyBottles,
            teamBottles: monthlyBottles * faker.number.int({ min: 5, max: 50 }),
            newMembers: faker.number.int({ min: 0, max: 20 }),
            createdAt: monthDate,
            updatedAt: new Date()
          }
        });
      }
    }

    console.log(`  ✅ 已为 ${usersWithTeam.length} 个用户生成团队业绩数据`);
  }

  /**
   * 生成推荐关系数据
   */
  async generateReferralRelations() {
    console.log('\n🔗 生成推荐关系数据...');

    // 获取所有用户
    const users = await prisma.users.findMany({
      orderBy: { createdAt: 'asc' }
    });

    // 为每个用户生成推荐码
    for (const user of users) {
      if (!user.referralCode) {
        await prisma.users.update({
          where: { id: user.id },
          data: {
            referralCode: this.generateReferralCode()
          }
        });
      }
    }

    // 生成推荐记录
    let referralCount = 0;
    for (let i = 1; i < users.length; i++) {
      // 随机选择一个已经注册的用户作为推荐人
      const referrerIndex = faker.number.int({ min: 0, max: Math.max(0, i - 1) });
      const referrer = users[referrerIndex];
      const referee = users[i];

      if (referrer.id !== referee.id) {
        // 创建推荐记录
        await prisma.referralRecords.create({
          data: {
            id: createId(),
            referrerId: referrer.id,
            refereeId: referee.id,
            referralCode: referrer.referralCode!,
            status: 'SUCCESS',
            reward: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
            createdAt: referee.createdAt,
            updatedAt: new Date()
          }
        });

        referralCount++;
      }
    }

    console.log(`  ✅ 已生成 ${referralCount} 个推荐关系`);
  }

  /**
   * 生成积分流转记录
   */
  async generatePointsTransactions() {
    console.log('\n💰 生成积分流转记录...');

    // 获取所有用户
    const users = await prisma.users.findMany();

    const transactionTypes = [
      { type: TransactionType.RECHARGE, description: '充值' },
      { type: TransactionType.TRANSFER, description: '转账' },
      { type: TransactionType.WITHDRAW, description: '提现' }
    ];

    for (const type of transactionTypes) {
      const count = faker.number.int({ min: 50, max: 200 });

      for (let i = 0; i < count; i++) {
        const user = faker.helpers.arrayElement(users);
        const amount = type === TransactionType.RECHARGE
          ? faker.number.float({ min: 100, max: 10000, fractionDigits: 2 })
          : -faker.number.float({ min: 10, max: 5000, fractionDigits: 2 });

        await prisma.pointsTransactions.create({
          data: {
            id: createId(),
            userId: user.id,
            type,
            amount,
            balance: 0, // 将在实际使用时计算
            relatedUserId: type === TransactionType.TRANSFER
              ? faker.helpers.arrayElement(users).id
              : null,
            description: `${type.description}-${faker.lorem.words(3)}`,
            status: 'COMPLETED',
            metadata: {},
            createdAt: faker.date.past({ days: 30 }),
            updatedAt: new Date()
          }
        });
      }

      console.log(`  ✅ ${type.description}: ${count} 条记录`);
    }
  }

  /**
   * 生成推荐码
   */
  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 获取等级名称
   */
  private getLevelName(level: string): string {
    const names = {
      'NORMAL': '普通会员',
      'VIP': 'VIP会员',
      'STAR_1': '一星店长',
      'STAR_2': '二星店长',
      'STAR_3': '三星店长',
      'STAR_4': '四星店长',
      'STAR_5': '五星店长',
      'DIRECTOR': '董事'
    };
    return names[level] || level;
  }
}

// 导出默认实例
export const userLevelUpgradeGenerator = new UserLevelUpgradeScenarioGenerator();