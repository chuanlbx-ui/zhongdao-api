import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupplyChainPathFinder } from '@/modules/purchase/supply-chain-path-finder';
import { UserLevel } from '@/modules/user/level.service';
import { prisma } from '@/shared/database/client';

// Mock dependencies
vi.mock('@/shared/database/client');
vi.mock('@/shared/utils/logger');

const mockPrisma = prisma as any;

describe('SupplyChainPathFinder', () => {
  let pathFinder: SupplyChainPathFinder;

  beforeEach(() => {
    vi.clearAllMocks();
    pathFinder = new SupplyChainPathFinder();
  });

  describe('findHigherLevelUpline', () => {
    it('should find higher level upline successfully', async () => {
      // Arrange
      const uplineChain = [
        { id: 'upline-1', level: UserLevel.VIP, status: 'ACTIVE' },
        { id: 'upline-2', level: UserLevel.STAR_1, status: 'ACTIVE' },
        { id: 'upline-3', level: UserLevel.STAR_2, status: 'ACTIVE' }
      ];

      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'user-1',
        teamPath: '/root/upline-1/upline-2/upline-3/'
      });

      mockPrisma.users.findMany.mockResolvedValue(uplineChain);

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        'user-1',
        0, // NORMAL level index
        10
      );

      // Assert
      expect(result).toBeTruthy();
      expect(result?.user.id).toBe('upline-1');
      expect(result?.level).toBe(UserLevel.VIP);
      expect(result?.searchPath).toContain('user-1');
      expect(result?.searchPath).toContain('upline-1');
    });

    it('should return null when no higher upline found', async () => {
      // Arrange
      const uplineChain = [
        { id: 'upline-1', level: UserLevel.NORMAL, status: 'ACTIVE' }, // Same level
        { id: 'upline-2', level: UserLevel.NORMAL, status: 'ACTIVE' }  // Same level
      ];

      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'user-1',
        teamPath: '/root/upline-1/upline-2/'
      });

      mockPrisma.users.findMany.mockResolvedValue(uplineChain);

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        'user-1',
        0, // NORMAL level index
        10
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should handle user not found', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValue(null);

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        'invalid-user',
        0,
        10
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should skip inactive users in upline chain', async () => {
      // Arrange
      const uplineChain = [
        { id: 'upline-1', level: UserLevel.NORMAL, status: 'INACTIVE' },
        { id: 'upline-2', level: UserLevel.VIP, status: 'ACTIVE' }
      ];

      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'user-1',
        teamPath: '/root/upline-1/upline-2/'
      });

      mockPrisma.users.findMany.mockResolvedValue(uplineChain);

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        'user-1',
        0, // NORMAL level index
        10
      );

      // Assert
      expect(result).toBeTruthy();
      expect(result?.user.id).toBe('upline-2');
      expect(result?.level).toBe(UserLevel.VIP);
    });

    it('should respect max depth limit', async () => {
      // Arrange
      const uplineChain = [
        { id: 'upline-1', level: UserLevel.NORMAL, status: 'ACTIVE' },
        { id: 'upline-2', level: UserLevel.NORMAL, status: 'ACTIVE' },
        { id: 'upline-3', level: UserLevel.VIP, status: 'ACTIVE' } // Beyond max depth
      ];

      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'user-1',
        teamPath: '/root/upline-1/upline-2/upline-3/'
      });

      mockPrisma.users.findMany.mockResolvedValue(uplineChain);

      // Act
      const result = await pathFinder.findHigherLevelUpline(
        'user-1',
        0, // NORMAL level index
        2 // Max depth 2
      );

      // Assert
      expect(result).toBeNull(); // Should not find VIP upline at depth 3
    });
  });

  describe('getUplineChain', () => {
    it('should get upline chain from teamPath', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'user-1',
        teamPath: '/root/upline-1/upline-2/upline-3/'
      });

      mockPrisma.users.findMany.mockResolvedValue([
        { id: 'upline-1', level: UserLevel.VIP, status: 'ACTIVE', parentId: 'root' },
        { id: 'upline-2', level: UserLevel.STAR_1, status: 'ACTIVE', parentId: 'upline-1' },
        { id: 'upline-3', level: UserLevel.STAR_2, status: 'ACTIVE', parentId: 'upline-2' }
      ]);

      // Act
      const result = await pathFinder.getUplineChain('user-1', 5);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('upline-1');
      expect(result[1].id).toBe('upline-2');
      expect(result[2].id).toBe('upline-3');
    });

    it('should fallback to traversal when no teamPath', async () => {
      // Arrange
      mockPrisma.users.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          parentId: 'upline-1',
          teamPath: null
        })
        .mockResolvedValueOnce({ parentId: 'upline-2' })
        .mockResolvedValueOnce({
          id: 'upline-1',
          level: UserLevel.VIP,
          status: 'ACTIVE',
          parentId: 'upline-2',
          teamPath: null
        });

      // Act
      const result = await pathFinder.getUplineChain('user-1', 5);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('upline-1');
      expect(result[0].level).toBe(UserLevel.VIP);
    });

    it('should handle empty teamPath', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'user-1',
        teamPath: ''
      });

      // Act
      const result = await pathFinder.getUplineChain('user-1', 5);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should cache results', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'user-1',
        teamPath: '/root/upline-1/'
      });

      mockPrisma.users.findMany.mockResolvedValue([
        { id: 'upline-1', level: UserLevel.VIP, status: 'ACTIVE' }
      ]);

      // Act
      await pathFinder.getUplineChain('user-1', 5);
      const result = await pathFinder.getUplineChain('user-1', 5);

      // Assert
      expect(mockPrisma.users.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOptimalSupplyPath', () => {
    it('should find optimal supply path', async () => {
      // Arrange
      const user = {
        id: 'user-1',
        level: UserLevel.NORMAL,
        status: 'ACTIVE'
      };

      const uplineChain = [
        { id: 'upline-1', level: UserLevel.VIP, status: 'ACTIVE' },
        { id: 'upline-2', level: UserLevel.STAR_1, status: 'ACTIVE' },
        { id: 'upline-3', level: UserLevel.STAR_2, status: 'ACTIVE' }
      ];

      mockPrisma.users.findUnique.mockResolvedValue(user);
      mockPrisma.users.findMany.mockResolvedValue(uplineChain);

      // Act
      const result = await pathFinder.findOptimalSupplyPath('user-1', 10);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.path).toHaveLength(3);
      expect(result.path[0].userId).toBe('upline-1');
      expect(result.path[0].level).toBe(UserLevel.VIP);
      expect(result.path[0].distance).toBe(1);
      expect(result.totalDistance).toBe(3);
    });

    it('should filter out lower or same level users', async () => {
      // Arrange
      const user = {
        id: 'user-1',
        level: UserLevel.VIP,
        status: 'ACTIVE'
      };

      const uplineChain = [
        { id: 'upline-1', level: UserLevel.NORMAL, status: 'ACTIVE' }, // Lower level
        { id: 'upline-2', level: UserLevel.VIP, status: 'ACTIVE' },    // Same level
        { id: 'upline-3', level: UserLevel.STAR_1, status: 'ACTIVE' }   // Higher level
      ];

      mockPrisma.users.findUnique.mockResolvedValue(user);
      mockPrisma.users.findMany.mockResolvedValue(uplineChain);

      // Act
      const result = await pathFinder.findOptimalSupplyPath('user-1', 10);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.path).toHaveLength(1); // Only STAR_1 should be included
      expect(result.path[0].userId).toBe('upline-3');
      expect(result.path[0].level).toBe(UserLevel.STAR_1);
    });

    it('should return invalid path when user not found', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValue(null);

      // Act
      const result = await pathFinder.findOptimalSupplyPath('invalid-user', 10);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.path).toHaveLength(0);
      expect(result.totalDistance).toBe(0);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      // Act
      pathFinder.clearCache();

      // Assert - No exception should be thrown
      expect(true).toBe(true);
    });

    it('should return cache stats', () => {
      // Act
      const stats = pathFinder.getCacheStats();

      // Assert
      expect(stats).toHaveProperty('userCacheSize');
      expect(stats).toHaveProperty('uplineChainCacheSize');
      expect(typeof stats.userCacheSize).toBe('number');
      expect(typeof stats.uplineChainCacheSize).toBe('number');
    });
  });
});