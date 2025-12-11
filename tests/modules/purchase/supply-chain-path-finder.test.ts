import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupplyChainPathFinder } from '../../../src/modules/purchase/supply-chain-path-finder';
import { prisma } from '../../../src/shared/database/client';
import { UserLevel } from '../../../src/modules/user/level.service';
import { logger } from '../../../src/shared/utils/logger';
import type { UserForValidation, UplineSearchResult, SupplyChainPath } from '../../../src/modules/purchase/types';

// Mock dependencies
vi.mock('../../../src/shared/database/client');
vi.mock('../../../src/shared/utils/logger');

const mockPrisma = prisma as any;
const mockLogger = logger as any;

describe('SupplyChainPathFinder', () => {
  let pathFinder: SupplyChainPathFinder;
  let testUser: UserForValidation;
  let testUplineChain: UserForValidation[];

  beforeEach(() => {
    pathFinder = new SupplyChainPathFinder();

    // Setup test data
    testUser = {
      id: 'user-001',
      level: UserLevel.NORMAL,
      status: 'ACTIVE',
      parentId: 'user-002',
      teamPath: '/root/user-002/user-001'
    };

    testUplineChain = [
      {
        id: 'user-002',
        level: UserLevel.VIP,
        status: 'ACTIVE',
        parentId: 'user-003',
        teamPath: '/root/user-002'
      },
      {
        id: 'user-003',
        level: UserLevel.STAR_1,
        status: 'ACTIVE',
        parentId: 'user-004',
        teamPath: '/root/user-002/user-003'
      },
      {
        id: 'user-004',
        level: UserLevel.STAR_2,
        status: 'ACTIVE',
        parentId: 'user-005',
        teamPath: '/root/user-002/user-003/user-004'
      }
    ];

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findHigherLevelUpline', () => {
    it('应该成功找到更高级别的上级', async () => {
      // Arrange
      const minLevelIndex = Object.values(UserLevel).indexOf(UserLevel.NORMAL);

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: '/root/user-002/user-003/user-004',
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(testUplineChain);

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        testUser.id,
        minLevelIndex,
        10
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result!.user.id).toBe('user-002');  // First higher level upline
      expect(result!.level).toBe(UserLevel.VIP);
      expect(result!.searchPath).toEqual([
        'user-001',
        'user-002'
      ]);
    });

    it('应该返回null如果没有找到更高级别的上级', async () => {
      // Arrange
      const minLevelIndex = Object.values(UserLevel).indexOf(UserLevel.STAR_3);

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: '/root/user-002/user-003',
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(testUplineChain);  // All uplines are lower level

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        testUser.id,
        minLevelIndex,
        10
      );

      // Assert
      expect(result).toBeNull();
    });

    it('应该跳过非活跃的上级用户', async () => {
      // Arrange
      const inactiveUplineChain = [
        {
          ...testUplineChain[0],
          status: 'INACTIVE' as const
        },
        testUplineChain[1],
        testUplineChain[2]
      ];

      const minLevelIndex = Object.values(UserLevel).indexOf(UserLevel.NORMAL);

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: '/root/user-002/user-003/user-004',
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(inactiveUplineChain);

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        testUser.id,
        minLevelIndex,
        10
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result!.user.id).toBe('user-003');  // Skip inactive user-002
      expect(result!.level).toBe(UserLevel.STAR_1);
    });

    it('应该处理数据库错误并返回null', async () => {
      // Arrange
      const minLevelIndex = Object.values(UserLevel).indexOf(UserLevel.NORMAL);

      mockPrisma.users.findUnique = vi.fn()
        .mockRejectedValueOnce(new Error('Database connection failed'));

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        testUser.id,
        minLevelIndex,
        10
      );

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '查找更高级别上级失败',
        expect.objectContaining({
          startUserId: testUser.id,
          error: 'Database connection failed'
        })
      );
    });

    it('应该返回null如果没有上级链', async () => {
      // Arrange
      const minLevelIndex = Object.values(UserLevel).indexOf(UserLevel.NORMAL);

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: '/root/user-002/user-003/user-004',
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue([]);  // Empty upline chain

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        testUser.id,
        minLevelIndex,
        10
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getUplineChain', () => {
    it('应该使用teamPath优化查询', async () => {
      // Arrange
      const userId = 'user-001';
      const maxDepth = 10;
      const teamPath = '/root/user-002/user-003/user-004';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath,
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(testUplineChain);

      // Act
      const result = await pathFinder.getUplineChain(userId, maxDepth);

      // Assert
      expect(result).toEqual(testUplineChain);
      expect(mockPrisma.users.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['user-002', 'user-003', 'user-004'] },
          status: 'ACTIVE'
        },
        select: {
          id: true,
          level: true,
          status: true,
          parentId: true,
          teamPath: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
    });

    it('应该回退到遍历查询如果没有teamPath', async () => {
      // Arrange
      const userId = 'user-001';
      const maxDepth = 10;

      // First call - get parent info
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: null,
          parentId: 'user-002'
        });

      // Traversal queries
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({ parentId: 'user-002' })
        .mockResolvedValueOnce({ parentId: 'user-003' })
        .mockResolvedValueOnce({ parentId: 'user-004' })
        .mockResolvedValueOnce({ parentId: null });

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testUplineChain[0])
        .mockResolvedValueOnce(testUplineChain[1])
        .mockResolvedValueOnce(testUplineChain[2]);

      // Act
      const result = await pathFinder.getUplineChain(userId, maxDepth);

      // Assert
      expect(result).toEqual(testUplineChain);
    });

    it('应该缓存查询结果', async () => {
      // Arrange
      const userId = 'user-001';
      const maxDepth = 10;
      const teamPath = '/root/user-002/user-003/user-004';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath,
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(testUplineChain);

      // Act - First call
      const result1 = await pathFinder.getUplineChain(userId, maxDepth);

      // Act - Second call (should use cache)
      const result2 = await pathFinder.getUplineChain(userId, maxDepth);

      // Assert
      expect(result1).toEqual(testUplineChain);
      expect(result2).toEqual(testUplineChain);
      expect(mockPrisma.users.findMany).toHaveBeenCalledTimes(1);  // Called only once due to cache
    });

    it('应该处理缓存过期', async () => {
      // Arrange
      const userId = 'user-001';
      const maxDepth = 10;
      const teamPath = '/root/user-002/user-003/user-004';

      // First call setup
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath,
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValueOnce(testUplineChain);

      // Act - First call
      await pathFinder.getUplineChain(userId, maxDepth);

      // Clear cache to simulate expiry
      pathFinder.clearCache();

      // Second call setup
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath,
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValueOnce(testUplineChain);

      // Act - Second call after cache clear
      const result2 = await pathFinder.getUplineChain(userId, maxDepth);

      // Assert
      expect(result2).toEqual(testUplineChain);
      expect(mockPrisma.users.findMany).toHaveBeenCalledTimes(2);  // Called twice
    });

    it('应该返回空数组如果用户不存在', async () => {
      // Arrange
      const userId = 'non-existent-user';
      const maxDepth = 10;

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(null);

      // Act
      const result = await pathFinder.getUplineChain(userId, maxDepth);

      // Assert
      expect(result).toEqual([]);
    });

    it('应该处理查询错误并返回空数组', async () => {
      // Arrange
      const userId = 'user-001';
      const maxDepth = 10;

      mockPrisma.users.findUnique = vi.fn()
        .mockRejectedValueOnce(new Error('Database error'));

      // Act
      const result = await pathFinder.getUplineChain(userId, maxDepth);

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '获取上级链失败',
        expect.objectContaining({
          userId,
          error: 'Database error'
        })
      );
    });
  });

  describe('findOptimalSupplyPath', () => {
    it('应该找到有效的供应链路径', async () => {
      // Arrange
      const userId = 'user-001';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testUser);

      // Mock getUplineChain through direct method call
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: '/root/user-002/user-003/user-004',
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(testUplineChain);

      // Act
      const result = await pathFinder.findOptimalSupplyPath(userId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.path).toHaveLength(3);
      expect(result.path[0]).toEqual({
        userId: 'user-002',
        level: UserLevel.VIP,
        distance: 1
      });
      expect(result.totalDistance).toBe(3);
    });

    it('应该返回无效路径如果用户不存在', async () => {
      // Arrange
      const userId = 'non-existent-user';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(null);

      // Act
      const result = await pathFinder.findOptimalSupplyPath(userId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.totalDistance).toBe(0);
    });

    it('应该只包含活跃的更高等级供应商', async () => {
      // Arrange
      const userId = 'user-001';
      const mixedUplineChain = [
        testUplineChain[0],  // VIP - valid
        { ...testUplineChain[1], status: 'INACTIVE' },  // STAR_1 but inactive
        testUplineChain[2]   // STAR_2 - valid
      ];

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testUser);

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: '/root/user-002/user-003/user-004',
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mixedUplineChain);

      // Act
      const result = await pathFinder.findOptimalSupplyPath(userId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.path).toHaveLength(2);  // Only active, higher level suppliers
      expect(result.path[0].userId).toBe('user-002');
      expect(result.path[1].userId).toBe('user-004');
    });

    it('应该返回无效路径如果没有有效供应商', async () => {
      // Arrange
      const userId = 'user-001';
      const lowLevelUser = {
        ...testUser,
        level: UserLevel.STAR_5
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(lowLevelUser);

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: '/root/user-002/user-003',
          parentId: 'user-002'
        });

      // All uplines are lower or same level
      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(testUplineChain);

      // Act
      const result = await pathFinder.findOptimalSupplyPath(userId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.totalDistance).toBe(0);
    });

    it('应该处理查询错误并返回无效路径', async () => {
      // Arrange
      const userId = 'user-001';

      mockPrisma.users.findUnique = vi.fn()
        .mockRejectedValueOnce(new Error('Database error'));

      // Act
      const result = await pathFinder.findOptimalSupplyPath(userId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.totalDistance).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '查找最优供应链路径失败',
        expect.objectContaining({
          userId,
          error: 'Database error'
        })
      );
    });
  });

  describe('缓存管理', () => {
    it('clearCache应该清理所有缓存', async () => {
      // Arrange
      const userId = 'user-001';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          teamPath: '/root/user-002',
          parentId: 'user-002'
        });

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue([testUplineChain[0]]);

      // Act - Create cache entries
      await pathFinder.getUplineChain(userId, 10);
      const statsBefore = pathFinder.getCacheStats();

      // Clear cache
      pathFinder.clearCache();
      const statsAfter = pathFinder.getCacheStats();

      // Assert
      expect(statsBefore.userCacheSize).toBeGreaterThan(0);
      expect(statsBefore.uplineChainCacheSize).toBeGreaterThan(0);
      expect(statsAfter.userCacheSize).toBe(0);
      expect(statsAfter.uplineChainCacheSize).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('供应链路径查找器缓存已清理');
    });

    it('getCacheStats应该返回正确的缓存统计', () => {
      // Act
      const stats = pathFinder.getCacheStats();

      // Assert
      expect(stats).toEqual({
        userCacheSize: 0,
        uplineChainCacheSize: 0
      });
    });

    it('应该缓存用户信息', async () => {
      // Arrange
      const userId = 'user-001';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testUser);

      // Act - First call through getUser (private method)
      await pathFinder['getUser'](userId);

      // Clear mock to verify cache usage
      vi.clearAllMocks();

      // Second call - should use cache
      const cachedUser = await pathFinder['getUser'](userId);

      // Assert
      expect(cachedUser).toEqual(testUser);
      expect(mockPrisma.users.findUnique).not.toHaveBeenCalled();
    });
  });
});