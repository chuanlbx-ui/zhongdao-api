import { Router, Request, Response } from 'express';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler2 } from '../../../shared/middleware/error';
import { logger } from '../../../shared/utils/logger';
import { testUsers } from '../../../test-data/create-users';

const router = Router();

/**
 * 创建测试用户数据
 */
router.post('/create-test-users',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { prisma } = await import('../../../shared/database/client');

      console.log('🚀 开始创建测试用户...')

      // 清理现有测试用户
      console.log('🗑️ 清理现有测试用户...')
      await prisma.users.deleteMany({
        where: {
          openid: {
            in: testUsers.map(u => u.openid)
          }
        }
      })

      // 创建新用户
      console.log('👥 创建测试用户...')
      const createdUsers = []
      for (const userData of testUsers) {
        const user = await prisma.users.create({
          data: {
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        })
        createdUsers.push(user)
        console.log(`  ✓ 创建用户: ${user.nickname} (${user.level})`)
      }

      // 统计用户数量
      const totalUsers = await prisma.users.count()

      // 统计各等级用户数
      const levelStats = await prisma.users.groupBy({
        by: ['level'],
        _count: { level: true }
      })

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
      }

      console.log(`\n✅ 创建完成！总用户数: ${totalUsers}`)
      console.log('\n📊 用户等级分布:')
      levelStats.forEach(stat => {
        console.log(`  ${stat.level}: ${stat._count.level} 人`)
      })

      res.json(createSuccessResponse(response, '测试用户创建成功'))
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