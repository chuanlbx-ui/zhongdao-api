import { Router, Request, Response } from 'express';
import { createSuccessResponse, createErrorResponse } from '../../shared/types/response';
import { asyncHandler2 } from '../../shared/middleware/error';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * 创建测试用户数据（无需认证）
 */
router.post('/init-data',
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      // 动态导入Prisma
      const { prisma } = await import('../../shared/database/client');

      logger.info('开始创建测试用户数据...');

      // 测试用户数据
      const testUsers = [
        {
          id: 'test_user_001',
          openid: 'test_openid_001',
          nickname: '张三',
          phone: '13800138001',
          avatarUrl: 'https://ui-avatars.com/api/?name=张三&background=1890ff',
          level: 'NORMAL',
          status: 'ACTIVE',
          parentId: null,
          teamPath: null,
          teamLevel: 1,
          totalSales: 0,
          totalBottles: 0,
          directSales: 0,
          teamSales: 0,
          directCount: 0,
          teamCount: 0,
          pointsBalance: 100,
          pointsFrozen: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test_user_002',
          openid: 'test_openid_002',
          nickname: '李四',
          phone: '13800138002',
          avatarUrl: 'https://ui-avatars.com/api/?name=李四&background=52c41a',
          level: 'VIP',
          status: 'ACTIVE',
          parentId: 'test_user_001',
          teamPath: 'test_user_001',
          teamLevel: 2,
          totalSales: 5000,
          totalBottles: 50,
          directSales: 5000,
          teamSales: 5000,
          directCount: 5,
          teamCount: 10,
          pointsBalance: 1500,
          pointsFrozen: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test_user_003',
          openid: 'test_openid_003',
          nickname: '王五',
          phone: '13800138003',
          avatarUrl: 'https://ui-avatars.com/api/?name=王五&background=faad14',
          level: 'STAR_1',
          status: 'ACTIVE',
          parentId: 'test_user_001',
          teamPath: 'test_user_001',
          teamLevel: 2,
          totalSales: 15000,
          totalBottles: 150,
          directSales: 15000,
          teamSales: 15000,
          directCount: 15,
          teamCount: 30,
          pointsBalance: 3200,
          pointsFrozen: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test_user_004',
          openid: 'test_openid_004',
          nickname: '赵六',
          phone: '13800138004',
          avatarUrl: 'https://ui-avatars.com/api/?name=赵六&background=13c2c2',
          level: 'STAR_2',
          status: 'ACTIVE',
          parentId: 'test_user_001',
          teamPath: 'test_user_001',
          teamLevel: 2,
          totalSales: 50000,
          totalBottles: 500,
          directSales: 50000,
          teamSales: 50000,
          directCount: 25,
          teamCount: 60,
          pointsBalance: 8500,
          pointsFrozen: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test_user_005',
          openid: 'test_openid_005',
          nickname: '钱七',
          phone: '13800138005',
          avatarUrl: 'https://ui-avatars.com/api/?name=钱七&background=722ed1',
          level: 'STAR_3',
          status: 'ACTIVE',
          parentId: 'test_user_001',
          teamPath: 'test_user_001',
          teamLevel: 2,
          totalSales: 120000,
          totalBottles: 1200,
          directSales: 120000,
          teamSales: 120000,
          directCount: 40,
          teamCount: 100,
          pointsBalance: 15000,
          pointsFrozen: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test_user_006',
          openid: 'test_openid_006',
          nickname: '孙八',
          phone: '13800138006',
          avatarUrl: 'https://ui-avatars.com/api/?name=孙八&background=8c8c8c',
          level: 'NORMAL',
          status: 'ACTIVE',
          parentId: 'test_user_002',
          teamPath: 'test_user_001,test_user_002',
          teamLevel: 3,
          totalSales: 800,
          totalBottles: 8,
          directSales: 800,
          teamSales: 800,
          directCount: 2,
          teamCount: 4,
          pointsBalance: 200,
          pointsFrozen: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // 清理旧数据
      await prisma.users.deleteMany({
        where: {
          openid: {
            in: testUsers.map(u => u.openid)
          }
        }
      });

      // 创建新用户
      const createdUsers = [];
      for (const userData of testUsers) {
        const user = await prisma.users.create({
          data: userData,
        });
        createdUsers.push(user);
        logger.info(`创建用户: ${user.nickname} (${user.level})`);
      }

      // 统计用户数量
      const totalUsers = await prisma.users.count();

      // 统计各等级用户数
      const levelStats = await prisma.users.groupBy({
        by: ['level'],
        _count: { level: true }
      });

      const response = {
        message: '测试用户创建成功',
        totalUsers,
        levelStats,
        createdUsers: createdUsers.map(u => ({
          id: u.id,
          nickname: u.nickname,
          phone: u.phone,
          level: u.level,
          pointsBalance: u.pointsBalance
        }))
      };

      logger.info(`测试数据创建完成，总用户数: ${totalUsers}`);
      res.json(createSuccessResponse(response, '测试用户创建成功'));
    } catch (error) {
      logger.error('创建测试用户失败', { error });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '创建测试用户失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;