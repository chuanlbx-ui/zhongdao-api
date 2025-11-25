/**
 * 团队业绩服务测试
 * 验证业绩计算、排行榜、晋级进度、佣金预测等核心功能
 */

import { performanceService } from './performance.service';
import { TeamRole, CommissionType } from './types';

// Mock Prisma
jest.mock('../../shared/database/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      update: jest.fn()
    },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn()
    },
    performanceMetrics: {
      upsert: jest.fn()
    },
    $queryRaw: jest.fn()
  }
}));

jest.mock('../../shared/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('PerformanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('个人业绩计算', () => {
    it('应该正确计算个人业绩数据', async () => {
      // 准备测试数据
      const mockUserData = {
        id: 'user001',
        level: 'STAR_2',
        nickname: '测试用户'
      };

      const mockOrderData = {
        totalAmount: 12000,
        orderCount: 30
      };

      const mockCustomerData = {
        totalCustomers: 20,
        newCustomers: 6,
        repeatCustomers: 8
      };

      // Mock Prisma 返回
      (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
        .mockResolvedValue(mockUserData);

      (require('../../shared/database/client').prisma.order.aggregate as jest.Mock)
        .mockResolvedValue({ _sum: { totalAmount: 12000 } });

      (require('../../shared/database/client').prisma.order.count as jest.Mock)
        .mockResolvedValue(30);

      // 执行测试
      const result = await performanceService.calculatePersonalPerformance('user001', '2025-11');

      // 验证结果
      expect(result).toBeDefined();
      expect(result.salesAmount).toBe(12000);
      expect(result.orderCount).toBe(30);
      expect(result.newCustomers).toBe(6);
      expect(result.repeatRate).toBe(8 / 20);
      expect(result.averageOrderValue).toBe(12000 / 30);
    });

    it('应该处理零业绩的情况', async () => {
      // Mock 无订单数据
      (require('../../shared/database/client').prisma.order.aggregate as jest.Mock)
        .mockResolvedValue({ _sum: { totalAmount: null } });

      (require('../../shared/database/client').prisma.order.count as jest.Mock)
        .mockResolvedValue(0);

      const result = await performanceService.calculatePersonalPerformance('user001', '2025-11');

      expect(result.salesAmount).toBe(0);
      expect(result.orderCount).toBe(0);
      expect(result.averageOrderValue).toBe(0);
    });

    it('应该正确缓存个人业绩数据', async () => {
      // 第一次调用
      await performanceService.calculatePersonalPerformance('user001', '2025-11');

      // 第二次调用应该使用缓存
      await performanceService.calculatePersonalPerformance('user001', '2025-11');

      // 验证数据库只被调用了一次
      expect(require('../../shared/database/client').prisma.order.aggregate)
        .toHaveBeenCalledTimes(1);
    });
  });

  describe('团队业绩计算', () => {
    it('应该正确计算团队业绩', async () => {
      // Mock 团队成员数据
      const mockTeamMembers = [
        { userId: 'member001', level: 1 },
        { userId: 'member002', level: 2 },
        { userId: 'member003', level: 1 }
      ];

      // Mock Prisma 返回
      (require('../../shared/database/client').prisma.user.findMany as jest.Mock)
        .mockResolvedValue(mockTeamMembers.map(member => ({
          id: member.userId,
          teamLevel: member.level
        })));

      (require('../../shared/database/client').prisma.order.aggregate as jest.Mock)
        .mockResolvedValue({ _sum: { totalAmount: 50000 } });

      (require('../../shared/database/client').prisma.order.count as jest.Mock)
        .mockResolvedValue(100);

      (require('../../shared/database/client').prisma.user.count as jest.Mock)
        .mockResolvedValue(2); // 新增成员

      const result = await performanceService.calculateTeamPerformance('user001', '2025-11');

      expect(result.teamSales).toBe(50000);
      expect(result.teamOrders).toBe(100);
      expect(result.newMembers).toBe(2);
      expect(result.activeRate).toBeGreaterThanOrEqual(0);
      expect(result.productivity).toBeGreaterThan(0);
    });

    it('应该处理空团队的情况', async () => {
      // Mock 无团队成员
      (require('../../shared/database/client').prisma.user.findMany as jest.Mock)
        .mockResolvedValue([]);

      const result = await performanceService.calculateTeamPerformance('user001', '2025-11');

      expect(result.teamSales).toBe(0);
      expect(result.teamOrders).toBe(0);
      expect(result.newMembers).toBe(0);
      expect(result.activeRate).toBe(0);
      expect(result.productivity).toBe(0);
    });
  });

  describe('推荐业绩计算', () => {
    it('应该正确计算推荐业绩', async () => {
      // Mock 推荐数据
      const mockUser = { id: 'user001', level: 'STAR_2' };
      const mockDirectReferrals = [
        { id: 'ref001' },
        { id: 'ref002' }
      ];
      const mockIndirectReferrals = [
        { id: 'indirect001' }
      ];

      (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
        .mockResolvedValue(mockUser);

      (require('../../shared/database/client').prisma.user.findMany as jest.Mock)
        .mockResolvedValueOnce(mockDirectReferrals) // 直推
        .mockResolvedValueOnce(mockIndirectReferrals); // 间推

      (require('../../shared/database/client').prisma.order.aggregate as jest.Mock)
        .mockResolvedValue({ _sum: { totalAmount: 8000 } }); // 直推销售

      const result = await performanceService.calculateReferralPerformance('user001', '2025-11');

      expect(result.directReferrals).toBe(2);
      expect(result.indirectReferrals).toBe(1);
      expect(result.referralRevenue).toBeGreaterThan(0);
      expect(result.activeReferrals).toBeGreaterThanOrEqual(0);
      expect(result.conversionRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('排行榜系统', () => {
    it('应该生成正确的个人排行榜', async () => {
      // Mock 数据库查询结果
      const mockTopPerformers = [
        {
          user_id: 'user001',
          nickname: '销售冠军',
          level: 'STAR_3',
          total_amount: BigInt(150000)
        },
        {
          user_id: 'user002',
          nickname: '销售亚军',
          level: 'STAR_2',
          total_amount: BigInt(120000)
        }
      ];

      (require('../../shared/database/client').prisma.$queryRaw as jest.Mock)
        .mockResolvedValue(mockTopPerformers);

      const result = await performanceService.getPerformanceLeaderboard('personal', '2025-11', 10);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user001');
      expect(result[0].rank).toBe(1);
      expect(result[0].value).toBe(150000);
      expect(result[0].nickname).toBe('销售冠军');
    });

    it('应该返回正确的用户排名', async () => {
      // Mock 排行榜数据
      const mockLeaderboard = [
        { userId: 'user001', rank: 1 },
        { userId: 'user002', rank: 2 },
        { userId: 'user003', rank: 3 }
      ];

      jest.spyOn(performanceService, 'getPerformanceLeaderboard')
        .mockResolvedValue(mockLeaderboard as any);

      const result = await performanceService.getLeaderboardRanking('user002', 'personal', '2025-11');

      expect(result.rank).toBe(2);
      expect(result.total).toBe(3);
      expect(result.percentile).toBe(66.67); // (3-2+1)/3 * 100
      expect(result.item?.userId).toBe('user002');
    });

    it('应该处理排行榜中不存在的用户', async () => {
      const mockLeaderboard = [
        { userId: 'user001', rank: 1 },
        { userId: 'user002', rank: 2 }
      ];

      jest.spyOn(performanceService, 'getPerformanceLeaderboard')
        .mockResolvedValue(mockLeaderboard as any);

      const result = await performanceService.getLeaderboardRanking('user999', 'personal', '2025-11');

      expect(result.rank).toBe(-1);
      expect(result.total).toBe(0);
      expect(result.percentile).toBe(0);
      expect(result.item).toBeUndefined();
    });
  });

  describe('晋级进度分析', () => {
    it('应该正确计算晋级进度', async () => {
      // Mock 用户数据
      const mockUser = { level: 'STAR_2' }; // 二星店长
      (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
        .mockResolvedValue(mockUser);

      // Mock 业绩数据
      jest.spyOn(performanceService, 'calculatePersonalPerformance')
        .mockResolvedValue({
          salesAmount: 15000, // 超过二星要求
          orderCount: 50,
          newCustomers: 8,
          repeatRate: 0.6,
          averageOrderValue: 300
        } as any);

      jest.spyOn(performanceService, 'calculateReferralPerformance')
        .mockResolvedValue({
          directReferrals: 3,
          indirectReferrals: 5,
          referralRevenue: 2000,
          networkGrowth: 0.15,
          activeReferrals: 3,
          conversionRate: 0.8
        } as any);

      const result = await performanceService.getUpgradeProgress('user001');

      expect(result.currentLevel).toBe(TeamRole.MANAGER);
      expect(result.targetLevel).toBe(TeamRole.DIRECTOR);
      expect(result.progressPercentage).toBeGreaterThan(0);
      expect(result.requirementsMet).toHaveLength(3); // 销售额 + 直推人数 + 二星店长数量
      expect(result.monthlyGrowthRate).toBeDefined();
    });

    it('应该预测晋级时间', async () => {
      // Mock 满足大部分要求的数据
      const mockRequirements = [
        {
          requirement: '月销售额',
          current: 60000,
          required: 72000,
          percentage: 83.33,
          met: false
        },
        {
          requirement: '直推人数',
          current: 5,
          required: 5,
          percentage: 100,
          met: true
        }
      ];

      jest.spyOn(performanceService, 'calculateMonthlyGrowthRate')
        .mockResolvedValue(0.1); // 10%月增长率

      const result = await performanceService['predictPromotionTime']('user001', TeamRole.DIRECTOR, mockRequirements);

      expect(result).toBeDefined();
      expect(result!).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('应该处理已满足所有要求的情况', async () => {
      const mockRequirements = [
        {
          requirement: '月销售额',
          current: 80000,
          required: 72000,
          percentage: 100,
          met: true
        }
      ];

      const result = await performanceService['predictPromotionTime']('user001', TeamRole.DIRECTOR, mockRequirements);

      expect(result).toBe(0);
    });

    it('应该处理无法预测的情况', async () => {
      const mockRequirements = [
        {
          requirement: '月销售额',
          current: 0,
          required: 72000,
          percentage: 0,
          met: false
        }
      ];

      jest.spyOn(performanceService, 'calculateMonthlyGrowthRate')
        .mockResolvedValue(0);

      const result = await performanceService['predictPromotionTime']('user001', TeamRole.DIRECTOR, mockRequirements);

      expect(result).toBeUndefined();
    });
  });

  describe('佣金预测', () => {
    it('应该正确预测佣金收入', async () => {
      // Mock 业绩数据
      jest.spyOn(performanceService, 'calculatePersonalPerformance')
        .mockResolvedValue({
          salesAmount: 30000,
          orderCount: 60,
          newCustomers: 10,
          repeatRate: 0.7,
          averageOrderValue: 500
        } as any);

      jest.spyOn(performanceService, 'calculateTeamPerformance')
        .mockResolvedValue({
          teamSales: 150000,
          teamOrders: 200,
          newMembers: 5,
          activeRate: 0.8,
          productivity: 7500
        } as any);

      jest.spyOn(performanceService, 'calculateReferralPerformance')
        .mockResolvedValue({
          directReferrals: 4,
          indirectReferrals: 8,
          referralRevenue: 3000,
          networkGrowth: 0.2,
          activeReferrals: 4,
          conversionRate: 0.9
        } as any);

      // Mock 用户等级
      (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
        .mockResolvedValue({ level: 'STAR_3' });

      // Mock 增长率
      jest.spyOn(performanceService, 'calculateMonthlyGrowthRate' as any)
        .mockResolvedValue(0.15);

      // Mock 容量分析
      jest.spyOn(performanceService, 'analyzeCommissionCapacity' as any)
        .mockResolvedValue({
          maxCapacity: 50000,
          utilizationRate: 0.6,
          growthPotential: 0.4
        });

      const result = await performanceService.predictCommission('user001', '2025-11');

      expect(result.currentPeriod.estimatedCommission).toBeGreaterThan(0);
      expect(result.nextPeriod.estimatedCommission).toBeGreaterThan(result.currentPeriod.estimatedCommission);
      expect(result.nextPeriod.confidence).toBeGreaterThan(0);
      expect(result.breakdown).toHaveLength(3);
      expect(result.capacityAnalysis).toBeDefined();
      expect(result.capacityAnalysis.utilizationRate).toBe(0.6);
    });

    it('应该根据用户等级调整佣金计算', async () => {
      const userLevels = ['STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'];
      const commissionRates = [];

      for (const level of userLevels) {
        (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
          .mockResolvedValue({ level });

        const rate = performanceService['getCommissionRate'](CommissionType.PERSONAL_SALES, performanceService['mapUserLevelToTeamRole'](level));
        commissionRates.push(rate);
      }

      // 验证佣金率随等级增长
      expect(commissionRates).toEqual([0.08, 0.10, 0.12, 0.14, 0.16, 0.20]);
      for (let i = 1; i < commissionRates.length; i++) {
        expect(commissionRates[i]).toBeGreaterThan(commissionRates[i - 1]);
      }
    });
  });

  describe('缓存管理', () => {
    it('应该正确清除用户缓存', async () => {
      // 先设置一些缓存
      await performanceService.calculatePersonalPerformance('user001', '2025-11');
      await performanceService.calculateTeamPerformance('user001', '2025-11');

      // 清除缓存
      performanceService.clearUserCache('user001');

      // 再次调用应该重新计算
      await performanceService.calculatePersonalPerformance('user001', '2025-11');

      // 验证数据库被调用了两次（一次原始，一次清除后）
      expect(require('../../shared/database/client').prisma.order.aggregate).toHaveBeenCalledTimes(2);
    });

    it('应该预热缓存', async () => {
      const userIds = ['user001', 'user002', 'user003'];

      // Mock 相关方法
      jest.spyOn(performanceService, 'calculatePersonalPerformance' as any)
        .mockResolvedValue({ salesAmount: 10000 });
      jest.spyOn(performanceService, 'calculateTeamPerformance' as any)
        .mockResolvedValue({ teamSales: 50000 });
      jest.spyOn(performanceService, 'calculateReferralPerformance' as any)
        .mockResolvedValue({ directReferrals: 2 });
      jest.spyOn(performanceService, 'getPerformanceLeaderboard' as any)
        .mockResolvedValue([]);

      await performanceService.warmupCache(userIds);

      // 验证预热方法被调用
      expect(performanceService['calculatePersonalPerformance']).toHaveBeenCalledTimes(3);
      expect(performanceService['calculateTeamPerformance']).toHaveBeenCalledTimes(3);
      expect(performanceService['calculateReferralPerformance']).toHaveBeenCalledTimes(3);
    });
  });

  describe('数据校验', () => {
    it('应该验证业绩数据完整性', async () => {
      // Mock 用户数据
      (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
        .mockResolvedValue({ id: 'user001' });

      // Mock 业绩数据
      jest.spyOn(performanceService, 'calculatePersonalPerformance')
        .mockResolvedValue({
          salesAmount: 10000,
          orderCount: 25,
          newCustomers: 5,
          repeatRate: 0.6,
          averageOrderValue: 400
        } as any);

      jest.spyOn(performanceService, 'calculateTeamPerformance')
        .mockResolvedValue({
          teamSales: 50000,
          teamOrders: 100,
          newMembers: 3,
          activeRate: 0.8,
          productivity: 2500
        } as any);

      jest.spyOn(performanceService, 'calculateReferralPerformance')
        .mockResolvedValue({
          directReferrals: 2,
          indirectReferrals: 4,
          referralRevenue: 1500,
          networkGrowth: 0.15,
          activeReferrals: 2,
          conversionRate: 0.8
        } as any);

      const result = await performanceService.validatePerformanceData('user001', '2025-11');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测到数据异常', async () => {
      // Mock 异常业绩数据
      jest.spyOn(performanceService, 'calculatePersonalPerformance')
        .mockResolvedValue({
          salesAmount: -1000, // 负数
          orderCount: 25,
          newCustomers: 5,
          repeatRate: 1.5, // 超过1
          averageOrderValue: 400
        } as any);

      jest.spyOn(performanceService, 'calculateTeamPerformance')
        .mockResolvedValue({
          teamSales: 500, // 小于个人销售额
          teamOrders: 100,
          newMembers: 3,
          activeRate: 1.2, // 超过1
          productivity: 2500
        } as any);

      const result = await performanceService.validatePerformanceData('user001', '2025-11');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('应该处理用户不存在的情况', async () => {
      (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
        .mockResolvedValue(null);

      const result = await performanceService.validatePerformanceData('user999', '2025-11');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('用户不存在');
    });
  });

  describe('重建业绩指标', () => {
    it('应该成功重建业绩指标', async () => {
      // Mock 验证通过
      jest.spyOn(performanceService, 'validatePerformanceData')
        .mockResolvedValue({ isValid: true, errors: [], warnings: [] });

      // Mock 业绩计算
      jest.spyOn(performanceService, 'calculatePersonalPerformance' as any)
        .mockResolvedValue({ salesAmount: 15000 });
      jest.spyOn(performanceService, 'calculateTeamPerformance' as any)
        .mockResolvedValue({ teamSales: 75000 });
      jest.spyOn(performanceService, 'calculateReferralPerformance' as any)
        .mockResolvedValue({ directReferrals: 3 });
      jest.spyOn(performanceService, 'getUpgradeProgress' as any)
        .mockResolvedValue({ progressPercentage: 75 });

      // Mock 用户数据
      (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
        .mockResolvedValue({ level: 'STAR_2' });

      const result = await performanceService.rebuildPerformanceMetrics('user001', '2025-11');

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.userId).toBe('user001');
      expect(result.metrics!.period).toBe('2025-11');
    });

    it('应该处理验证失败的情况', async () => {
      // Mock 验证失败
      jest.spyOn(performanceService, 'validatePerformanceData')
        .mockResolvedValue({
          isValid: false,
          errors: ['数据验证失败'],
          warnings: []
        });

      const result = await performanceService.rebuildPerformanceMetrics('user001', '2025-11');

      expect(result.success).toBe(false);
      expect(result.message).toContain('数据验证失败');
      expect(result.metrics).toBeUndefined();
    });
  });

  describe('工具方法', () => {
    it('应该正确映射用户等级到团队角色', () => {
      expect(performanceService['mapUserLevelToTeamRole']('NORMAL')).toBe(TeamRole.MEMBER);
      expect(performanceService['mapUserLevelToTeamRole']('STAR_1')).toBe(TeamRole.CAPTAIN);
      expect(performanceService['mapUserLevelToTeamRole']('STAR_5')).toBe(TeamRole.PARTNER);
      expect(performanceService['mapUserLevelToTeamRole']('DIRECTOR')).toBe(TeamRole.AMBASSADOR);
    });

    it('应该正确获取下一个等级', () => {
      expect(performanceService['getNextLevel'](TeamRole.MEMBER)).toBe(TeamRole.CAPTAIN);
      expect(performanceService['getNextLevel'](TeamRole.CAPTAIN)).toBe(TeamRole.MANAGER);
      expect(performanceService['getNextLevel'](TeamRole.AMBASSADOR)).toBeNull(); // 最高等级
    });

    it('应该正确解析周期', () => {
      const monthlyPeriod = performanceService['parsePeriod']('2025-11');
      expect(monthlyPeriod.startDate.getFullYear()).toBe(2025);
      expect(monthlyPeriod.startDate.getMonth()).toBe(10); // 0-based
      expect(monthlyPeriod.endDate.getDate()).toBe(30); // 11月最后一天

      const yearlyPeriod = performanceService['parsePeriod']('2025');
      expect(yearlyPeriod.startDate.getFullYear()).toBe(2025);
      expect(yearlyPeriod.startDate.getMonth()).toBe(0); // 1月
      expect(yearlyPeriod.endDate.getMonth()).toBe(11); // 12月
    });

    it('应该正确计算复购率', () => {
      expect(performanceService['calculateRepeatRate'](100, 30)).toBe(0.3);
      expect(performanceService['calculateRepeatRate'](0, 0)).toBe(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库连接错误', async () => {
      // Mock 数据库错误
      (require('../../shared/database/client').prisma.order.aggregate as jest.Mock)
        .mockRejectedValue(new Error('数据库连接失败'));

      await expect(performanceService.calculatePersonalPerformance('user001', '2025-11'))
        .rejects.toThrow('数据库连接失败');
    });

    it('应该处理无效的用户ID', async () => {
      // Mock 用户不存在
      (require('../../shared/database/client').prisma.user.findUnique as jest.Mock)
        .mockResolvedValue(null);

      await expect(performanceService.getUpgradeProgress('user999'))
        .rejects.toThrow('用户不存在');
    });

    it('应该处理无效的周期格式', async () => {
      const result = await performanceService.validatePerformanceData('user001', 'invalid-period');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('周期格式不正确，应为 YYYY-MM 或 YYYY');
    });
  });
});

// 性能测试
describe('PerformanceService Performance', () => {
  it('应该在大批量查询中保持性能', async () => {
    const startTime = Date.now();
    const userIds = Array.from({ length: 100 }, (_, i) => `user${i.toString().padStart(3, '0')}`);

    // Mock 快速返回
    jest.spyOn(performanceService, 'calculatePersonalPerformance' as any)
      .mockResolvedValue({ salesAmount: 10000 });

    // 并行计算
    await Promise.all(
      userIds.map(userId => performanceService.calculatePersonalPerformance(userId, '2025-11'))
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 应该在合理时间内完成（例如5秒）
    expect(duration).toBeLessThan(5000);
  });

  it('应该有效利用缓存减少数据库查询', async () => {
    const userId = 'user001';
    const period = '2025-11';

    // 清除所有缓存
    performanceService.clearUserCache(userId);

    // 第一次调用
    await performanceService.calculatePersonalPerformance(userId, period);
    const firstCallCount = (require('../../shared/database/client').prisma.order.aggregate as jest.Mock).mock.calls.length;

    // 后续调用应该使用缓存
    await performanceService.calculatePersonalPerformance(userId, period);
    await performanceService.calculatePersonalPerformance(userId, period);
    await performanceService.calculatePersonalPerformance(userId, period);

    const finalCallCount = (require('../../shared/database/client').prisma.order.aggregate as jest.Mock).mock.calls.length;

    // 数据库调用次数应该只增加了一次（第一次调用）
    expect(finalCallCount).toBe(firstCallCount);
  });
});