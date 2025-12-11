import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { teamService } from '../../../src/modules/user/team.service';
import { prisma } from '../../../src/shared/database/client';
import { logger } from '../../../src/shared/utils/logger';
import { UserLevel } from '../../../src/modules/user/level.service';

// Mock dependencies
vi.mock('../../../src/shared/database/client');
vi.mock('../../../src/shared/utils/logger');

const mockPrisma = prisma as any;
const mockLogger = logger as any;

describe('teamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateTeamRelationship', () => {
    it('应该验证有效的团队关系', async () => {
      // Arrange
      const uplineId = 'upline-001';
      const downlineId = 'downline-001';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: downlineId,
          parentId: uplineId,
          teamPath: '/root/upline-001/downline-001'
        })
        .mockResolvedValueOnce({
          id: uplineId,
          parentId: 'root',
          teamPath: '/root/upline-001'
        });

      // Act
      const result = await teamService.validateTeamRelationship(uplineId, downlineId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.distance).toBe(1);
      expect(result.relationshipType).toBe('direct');
      expect(result.path).toEqual(['upline-001']);
    });

    it('应该验证间接的团队关系', async () => {
      // Arrange
      const uplineId = 'upline-001';
      const downlineId = 'downline-003';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: downlineId,
          teamPath: '/root/upline-001/upline-002/downline-003'
        })
        .mockResolvedValueOnce({
          id: uplineId,
          teamPath: '/root/upline-001'
        });

      // Act
      const result = await teamService.validateTeamRelationship(uplineId, downlineId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.distance).toBe(3);
      expect(result.relationshipType).toBe('indirect');
      expect(result.path).toEqual(['upline-001', 'upline-002']);
    });

    it('应该拒绝无效的团队关系', async () => {
      // Arrange
      const uplineId = 'upline-001';
      const downlineId = 'downline-001';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: downlineId,
          teamPath: '/root/other-upline/downline-001'
        });

      // Act
      const result = await teamService.validateTeamRelationship(uplineId, downlineId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.distance).toBe(0);
      expect(result.relationshipType).toBe('none');
    });

    it('应该处理不存在的用户', async () => {
      // Arrange
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(null);

      // Act
      const result = await teamService.validateTeamRelationship('upline-001', 'downline-001');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('用户不存在');
    });
  });

  describe('getTeamMembers', () => {
    it('应该获取团队成员列表', async () => {
      // Arrange
      const leaderId = 'leader-001';
      const mockMembers = [
        {
          id: 'member-001',
          nickname: 'Member 1',
          level: UserLevel.NORMAL,
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          parentId: leaderId
        },
        {
          id: 'member-002',
          nickname: 'Member 2',
          level: UserLevel.VIP,
          status: 'ACTIVE',
          createdAt: new Date('2024-01-02'),
          parentId: leaderId
        }
      ];

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mockMembers);

      // Act
      const result = await teamService.getTeamMembers(leaderId, {
        page: 1,
        perPage: 10,
        level: UserLevel.NORMAL
      });

      // Assert
      expect(result).toEqual({
        members: mockMembers,
        pagination: {
          page: 1,
          perPage: 10,
          total: 2,
          totalPages: 1
        }
      });

      expect(mockPrisma.users.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { parentId: leaderId },
            { teamPath: { contains: `/${leaderId}/` } }
          ],
          level: UserLevel.NORMAL,
          status: 'ACTIVE'
        },
        select: {
          id: true,
          nickname: true,
          avatar: true,
          level: true,
          status: true,
          createdAt: true,
          parentId: true,
          teamPath: true
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10
      });
    });

    it('应该支持分页查询', async () => {
      // Arrange
      const leaderId = 'leader-001';
      const mockMembers = Array.from({ length: 25 }, (_, i) => ({
        id: `member-${i}`,
        nickname: `Member ${i}`,
        level: UserLevel.NORMAL,
        status: 'ACTIVE',
        createdAt: new Date(`2024-01-${(i % 30) + 1}`)
      }));

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mockMembers.slice(10, 20));

      mockPrisma.users.count = vi.fn()
        .mockResolvedValue(25);

      // Act
      const result = await teamService.getTeamMembers(leaderId, {
        page: 2,
        perPage: 10
      });

      // Assert
      expect(result.members).toHaveLength(10);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('应该处理查询错误', async () => {
      // Arrange
      mockPrisma.users.findMany = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      // Act
      await expect(teamService.getTeamMembers('leader-001'))
        .rejects.toThrow('Database error');
    });
  });

  describe('calculateTeamPerformance', () => {
    it('应该计算团队业绩', async () => {
      // Arrange
      const leaderId = 'leader-001';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue([
          { id: 'member-001', status: 'ACTIVE' },
          { id: 'member-002', status: 'ACTIVE' },
          { id: 'member-003', status: 'INACTIVE' }
        ]);

      mockPrisma.orders.aggregate = vi.fn()
        .mockResolvedValue({
          _count: { id: 50 },
          _sum: { totalAmount: 500000 },
          _avg: { totalAmount: 10000 }
        });

      mockPrisma.commissionRecord.aggregate = vi.fn()
        .mockResolvedValue({
          _sum: { amount: 25000 }
        });

      // Act
      const result = await teamService.calculateTeamPerformance(leaderId, startDate, endDate);

      // Assert
      expect(result).toEqual({
        totalMembers: 3,
        activeMembers: 2,
        totalOrders: 50,
        totalAmount: 500000,
        averageOrderAmount: 10000,
        totalCommission: 25000,
        performanceScore: expect.any(Number)
      });
    });

    it('应该处理空团队', async () => {
      // Arrange
      const leaderId = 'empty-leader';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue([]);

      // Act
      const result = await teamService.calculateTeamPerformance(leaderId, startDate, endDate);

      // Assert
      expect(result).toEqual({
        totalMembers: 0,
        activeMembers: 0,
        totalOrders: 0,
        totalAmount: 0,
        averageOrderAmount: 0,
        totalCommission: 0,
        performanceScore: 0
      });
    });
  });

  describe('moveTeamMember', () => {
    it('应该成功移动团队成员', async () => {
      // Arrange
      const memberId = 'member-001';
      const newParentId = 'new-parent-001';
      const operatorId = 'operator-001';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: memberId,
          parentId: 'old-parent-001',
          teamPath: '/root/old-parent/member-001'
        })
        .mockResolvedValueOnce({
          id: newParentId,
          teamPath: '/root/new-parent'
        });

      mockPrisma.users.update = vi.fn()
        .mockResolvedValue({
          id: memberId,
          parentId: newParentId,
          teamPath: '/root/new-parent/member-001'
        });

      mockPrisma.users.updateMany = vi.fn()
        .mockResolvedValue({ count: 5 }); // 5 sub-members updated

      // Act
      const result = await teamService.moveTeamMember(memberId, newParentId, operatorId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: memberId },
        data: {
          parentId: newParentId,
          teamPath: '/root/new-parent/member-001'
        }
      });

      expect(mockPrisma.users.updateMany).toHaveBeenCalledWith({
        where: {
          teamPath: { startsWith: '/root/old-parent/member-001/' }
        },
        data: {
          teamPath: { replace: '/root/old-parent/member-001/', '/root/new-parent/member-001/' }
        }
      });
    });

    it('应该拒绝移动到自己的下级', async () => {
      // Arrange
      const memberId = 'parent-001';
      const newParentId = 'child-001'; // This is actually a child

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: memberId,
          teamPath: '/root/parent-001'
        })
        .mockResolvedValueOnce({
          id: newParentId,
          teamPath: '/root/parent-001/child-001'
        });

      // Act
      const result = await teamService.moveTeamMember(memberId, newParentId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能将成员移动到其下级');
    });

    it('应该处理不存在的成员', async () => {
      // Arrange
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(null);

      // Act
      const result = await teamService.moveTeamMember('non-existent', 'new-parent');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('成员不存在');
    });
  });

  describe('validateMovePermission', () => {
    it('应该验证移动权限 - 管理员可以移动任何人', async () => {
      // Arrange
      const operatorRole = 'ADMIN';
      const operatorId = 'admin-001';
      const memberId = 'member-001';

      // Act
      const result = teamService.validateMovePermission(operatorId, operatorRole, memberId);

      // Assert
      expect(result).toBe(true);
    });

    it('应该验证移动权限 - 总监可以移动团队内成员', async () => {
      // Arrange
      const operatorId = 'director-001';
      const operatorRole = 'DIRECTOR';
      const memberId = 'member-001';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: operatorId,
          level: UserLevel.DIRECTOR,
          teamPath: '/root/director-001'
        })
        .mockResolvedValueOnce({
          id: memberId,
          teamPath: '/root/director-001/member-001'
        });

      // Act
      const result = await teamService.validateMovePermission(operatorId, operatorRole, memberId);

      // Assert
      expect(result).toBe(true);
    });

    it('应该拒绝移动权限 - 星店长不能移动其他团队的成员', async () => {
      // Arrange
      const operatorId = 'star-001';
      const operatorRole = 'STAR_3';
      const memberId = 'other-team-member';

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: operatorId,
          level: UserLevel.STAR_3,
          teamPath: '/root/team-1/star-001'
        })
        .mockResolvedValueOnce({
          id: memberId,
          teamPath: '/root/team-2/member-001'
        });

      // Act
      const result = await teamService.validateMovePermission(operatorId, operatorRole, memberId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getTeamStructure', () => {
    it('应该获取团队层级结构', async () => {
      // Arrange
      const leaderId = 'leader-001';
      const mockStructure = [
        {
          userId: 'member-001',
          nickname: 'Member 1',
          level: UserLevel.NORMAL,
          children: [
            {
              userId: 'sub-member-001',
              nickname: 'Sub Member 1',
              level: UserLevel.NORMAL,
              children: []
            }
          ]
        },
        {
          userId: 'member-002',
          nickname: 'Member 2',
          level: UserLevel.VIP,
          children: []
        }
      ];

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue([
          {
            id: 'member-001',
            nickname: 'Member 1',
            level: UserLevel.NORMAL,
            parentId: leaderId,
            teamPath: '/root/leader-001/member-001'
          },
          {
            id: 'member-002',
            nickname: 'Member 2',
            level: UserLevel.VIP,
            parentId: leaderId,
            teamPath: '/root/leader-001/member-002'
          },
          {
            id: 'sub-member-001',
            nickname: 'Sub Member 1',
            level: UserLevel.NORMAL,
            parentId: 'member-001',
            teamPath: '/root/leader-001/member-001/sub-member-001'
          }
        ]);

      // Act
      const result = await teamService.getTeamStructure(leaderId, { maxDepth: 3 });

      // Assert
      expect(result).toHaveProperty('root');
      expect(result).toHaveProperty('structure');
      expect(result.structure).toHaveLength(2);
      expect(result.structure[0].children).toHaveLength(1);
      expect(result.stats.totalMembers).toBe(3);
      expect(result.stats.levels).toContain(UserLevel.NORMAL);
      expect(result.stats.levels).toContain(UserLevel.VIP);
    });

    it('应该限制层级深度', async () => {
      // Arrange
      const leaderId = 'leader-001';

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue([
          // Deep structure beyond maxDepth
          {
            id: 'member-001',
            level: UserLevel.NORMAL,
            parentId: leaderId,
            teamPath: '/root/leader-001/member-001/sub-member-001/sub-sub-member-001'
          }
        ]);

      // Act
      const result = await teamService.getTeamStructure(leaderId, { maxDepth: 2 });

      // Assert
      expect(result.stats.maxDepth).toBeLessThanOrEqual(2);
    });
  });
});