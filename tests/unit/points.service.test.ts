import { PointsService, PointsTransactionType, PointsTransactionStatus } from '../../src/shared/services/points';
import { prisma } from '../../src/shared/database/client';

// Mock Prisma
jest.mock('../../src/shared/database/client', () => ({
  prisma: {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    pointsTransaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn()
    }
  }
}));

const mockPrisma = prisma as any;

describe('PointsService', () => {
  let pointsService: PointsService;

  beforeEach(() => {
    jest.clearAllMocks();
    pointsService = new PointsService();
  });

  describe('getBalance', () => {
    it('应该返回用户积分余额信息', async () => {
      const userId = 'user123';
      const mockUser = {
        pointsBalance: 1000,
        pointsFrozen: 200
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await pointsService.getBalance(userId);

      expect(result).toEqual({
        userId,
        balance: 1000,
        frozen: 200,
        available: 800
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          pointsBalance: true,
          pointsFrozen: true
        }
      });
    });

    it('用户不存在时应该抛出错误', async () => {
      const userId = 'nonexistent';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(pointsService.getBalance(userId)).rejects.toThrow('用户不存在');
    });
  });

  describe('checkDuplicateSubmission', () => {
    it('应该检测到重复提交', async () => {
      const userId = 'user123';
      const amount = 500;
      const type = PointsTransactionType.TRANSFER;

      const mockTransaction = {
        id: 'tx123',
        amount: 500,
        type: 'TRANSFER'
      };

      mockPrisma.pointsTransaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await pointsService.checkDuplicateSubmission(userId, amount, type);

      expect(result.success).toBe(false);
      expect(result.existingTransaction).toEqual(mockTransaction);
    });

    it('没有重复提交时应该返回成功', async () => {
      const userId = 'user123';
      const amount = 500;
      const type = PointsTransactionType.TRANSFER;

      mockPrisma.pointsTransaction.findFirst.mockResolvedValue(null);

      const result = await pointsService.checkDuplicateSubmission(userId, amount, type);

      expect(result.success).toBe(true);
      expect(result.existingTransaction).toBeUndefined();
    });
  });

  describe('transfer', () => {
    const mockTransferData = {
      fromUserId: 'user123',
      toUserId: 'user456',
      amount: 500,
      type: PointsTransactionType.TRANSFER,
      description: '测试转账'
    };

    it('应该成功转账', async () => {
      const mockFromUser = {
        pointsBalance: 1000,
        pointsFrozen: 0,
        level: 'ONE_STAR',
        status: 'ACTIVE'
      };

      const mockToUser = {
        id: 'user456',
        nickname: 'Test User',
        status: 'ACTIVE'
      };

      const mockToUserBalance = {
        pointsBalance: 500
      };

      const mockTransaction = {
        id: 'tx123',
        transactionNo: 'PT123456789ABC'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockFromUser) // 转出用户
        .mockResolvedValueOnce(mockToUser)    // 转入用户
        .mockResolvedValueOnce(mockToUserBalance); // 转入用户余额

      mockPrisma.pointsTransaction.create
        .mockResolvedValueOnce(mockTransaction) // 转出记录
        .mockResolvedValueOnce(mockTransaction); // 转入记录

      mockPrisma.user.update.mockResolvedValue({});

      const result = await pointsService.transfer(mockTransferData);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(500);
      expect(result.fromUserId).toBe('user123');
      expect(result.toUserId).toBe('user456');
    });

    it('余额不足时应该抛出错误', async () => {
      const mockFromUser = {
        pointsBalance: 300,
        pointsFrozen: 0,
        level: 'ONE_STAR',
        status: 'ACTIVE'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockFromUser);

      await expect(pointsService.transfer(mockTransferData)).rejects.toThrow('通券余额不足');
    });

    it('不能给自己转账', async () => {
      const invalidTransferData = {
        ...mockTransferData,
        fromUserId: 'user123',
        toUserId: 'user123'
      };

      await expect(pointsService.transfer(invalidTransferData)).rejects.toThrow('不能给自己转账');
    });
  });

  describe('recharge', () => {
    it('五星店长应该可以充值', async () => {
      const userId = 'five_star_user';
      const amount = 10000;

      const mockUser = {
        pointsBalance: 5000,
        level: 'FIVE_STAR',
        status: 'ACTIVE',
        nickname: 'Five Star User'
      };

      const mockTransaction = {
        id: 'recharge_tx123',
        transactionNo: 'PT_RECHARGE_123'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.pointsTransaction.create.mockResolvedValue(mockTransaction);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await pointsService.recharge(userId, amount);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(amount);
      expect(result.fromUserId).toBe('SYSTEM');
      expect(result.toUserId).toBe(userId);
    });

    it('非五星/董事用户不能充值', async () => {
      const userId = 'normal_user';
      const amount = 1000;

      const mockUser = {
        pointsBalance: 500,
        level: 'ONE_STAR',
        status: 'ACTIVE'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(pointsService.recharge(userId, amount)).rejects.toThrow('只有五星店长和董事可以充值');
    });
  });

  describe('freezePoints', () => {
    it('应该成功冻结积分', async () => {
      const userId = 'user123';
      const amount = 200;
      const reason = '测试冻结';

      const mockUser = {
        pointsBalance: 1000,
        pointsFrozen: 100,
        status: 'ACTIVE',
        level: 'ONE_STAR',
        nickname: 'Test User'
      };

      const mockTransaction = {
        id: 'freeze_tx123'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.pointsTransaction.create.mockResolvedValue(mockTransaction);

      const result = await pointsService.freezePoints(userId, amount, reason);

      expect(result).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          pointsFrozen: 300 // 100 + 200
        }
      });
    });

    it('可用余额不足时不能冻结', async () => {
      const userId = 'user123';
      const amount = 900; // 超过可用余额

      const mockUser = {
        pointsBalance: 1000,
        pointsFrozen: 200, // 可用余额只有800
        status: 'ACTIVE'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(pointsService.freezePoints(userId, amount)).rejects.toThrow('可用余额不足，无法冻结');
    });
  });

  describe('unfreezePoints', () => {
    it('应该成功解冻积分', async () => {
      const userId = 'user123';
      const amount = 200;
      const reason = '测试解冻';

      const mockUser = {
        pointsBalance: 1000,
        pointsFrozen: 300,
        status: 'ACTIVE',
        level: 'ONE_STAR'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.pointsTransaction.create.mockResolvedValue({ id: 'unfreeze_tx123' });

      const result = await pointsService.unfreezePoints(userId, amount, reason);

      expect(result).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          pointsFrozen: 100 // 300 - 200
        }
      });
    });

    it('冻结余额不足时不能解冻', async () => {
      const userId = 'user123';
      const amount = 500; // 超过冻结余额

      const mockUser = {
        pointsBalance: 1000,
        pointsFrozen: 300,
        status: 'ACTIVE'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(pointsService.unfreezePoints(userId, amount)).rejects.toThrow('冻结余额不足，无法解冻');
    });
  });

  describe('withdrawPoints', () => {
    const mockWithdrawalInfo = {
      bankAccount: '6228481234567890123',
      bankName: '中国工商银行',
      accountName: '张三',
      phone: '13800138000'
    };

    it('店长应该可以申请提现', async () => {
      const userId = 'shop_manager123';
      const amount = 5000;

      const mockUser = {
        pointsBalance: 10000,
        pointsFrozen: 1000,
        level: 'THREE_STAR',
        status: 'ACTIVE',
        nickname: 'Shop Manager',
        phone: '13800138000'
      };

      const mockTransaction = {
        id: 'withdraw_tx123',
        transactionNo: 'PT_WITHDRAW_123'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.pointsTransaction.create.mockResolvedValue(mockTransaction);

      const result = await pointsService.withdrawPoints(userId, amount, mockWithdrawalInfo);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(amount);
      expect(result.type).toBe(PointsTransactionType.WITHDRAW);
    });

    it('非店长用户不能提现', async () => {
      const userId = 'normal_user';
      const amount = 1000;

      const mockUser = {
        pointsBalance: 2000,
        pointsFrozen: 0,
        level: 'NORMAL',
        status: 'ACTIVE'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(pointsService.withdrawPoints(userId, amount, mockWithdrawalInfo))
        .rejects.toThrow('只有店长级别才能申请提现');
    });
  });

  describe('auditWithdrawal', () => {
    it('应该成功审核通过提现申请', async () => {
      const transactionId = 'withdraw_tx123';
      const auditorId = 'finance_manager';

      const mockTransaction = {
        id: transactionId,
        type: 'WITHDRAW',
        status: 'PENDING',
        amount: -5000,
        fromUser: {
          id: 'user123',
          pointsBalance: 10000,
          pointsFrozen: 5000,
          level: 'THREE_STAR',
          nickname: 'Test User'
        }
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.pointsTransaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.pointsTransaction.update.mockResolvedValue({});

      await expect(pointsService.auditWithdrawal(transactionId, true, '审核通过', auditorId))
        .resolves.not.toThrow();
    });

    it('提现记录不存在时应该抛出错误', async () => {
      const transactionId = 'nonexistent_tx';

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.pointsTransaction.findUnique.mockResolvedValue(null);

      await expect(pointsService.auditWithdrawal(transactionId, true))
        .rejects.toThrow('提现记录不存在');
    });

    it('已处理的提现申请不能重复审核', async () => {
      const transactionId = 'processed_tx';

      const mockTransaction = {
        id: transactionId,
        type: 'WITHDRAW',
        status: 'COMPLETED', // 已处理
        amount: -5000
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.pointsTransaction.findUnique.mockResolvedValue(mockTransaction);

      await expect(pointsService.auditWithdrawal(transactionId, true))
        .rejects.toThrow('提现记录已处理，无法重复审核');
    });
  });

  describe('batchTransfer', () => {
    it('应该成功执行批量转账', async () => {
      const transfers = [
        { fromUserId: 'user1', toUserId: 'user2', amount: 100 },
        { fromUserId: 'user3', toUserId: 'user4', amount: 200 }
      ];

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      // Mock successful transfers
      jest.spyOn(pointsService, 'transfer').mockResolvedValue({
        success: true,
        data: { transactionId: 'tx1', fromUserId: 'user1', toUserId: 'user2', amount: 100 }
      } as any);

      const results = await pointsService.batchTransfer(transfers);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
    });

    it('转账列表为空时应该抛出错误', async () => {
      await expect(pointsService.batchTransfer([]))
        .rejects.toThrow('转账列表不能为空');
    });

    it('转账数量超过限制时应该抛出错误', async () => {
      const transfers = Array(101).fill({
        fromUserId: 'user1',
        toUserId: 'user2',
        amount: 100
      });

      await expect(pointsService.batchTransfer(transfers))
        .rejects.toThrow('批量转账一次最多支持100笔');
    });
  });

  describe('getPointsStatistics', () => {
    it('应该返回用户积分统计信息', async () => {
      const userId = 'user123';

      const mockStats = {
        totalReceived: { _sum: { amount: 5000 } },
        totalSent: { _sum: { amount: -2000 } },
        totalReceivedToday: { _sum: { amount: 500 } },
        totalSentToday: { _sum: { amount: -100 } },
        latestTransactions: [
          { id: 'tx1', amount: 100, type: 'TRANSFER', description: '测试', createdAt: new Date() }
        ]
      };

      mockPrisma.pointsTransaction.aggregate.mockResolvedValue(mockStats.totalReceived);
      mockPrisma.pointsTransaction.findMany.mockResolvedValue(mockStats.latestTransactions);

      jest.spyOn(pointsService, 'getBalance').mockResolvedValue({
        userId,
        balance: 3000,
        frozen: 500,
        available: 2500
      });

      const result = await pointsService.getPointsStatistics(userId);

      expect(result.balance.balance).toBe(3000);
      expect(result.statistics.totalReceived).toBe(5000);
      expect(result.statistics.totalSent).toBe(2000);
      expect(result.statistics.netReceived).toBe(3000);
      expect(result.recentTransactions).toHaveLength(1);
    });
  });
});