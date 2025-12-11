import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { createSuccessResponse } from '../../../shared/types/response';
import { UserLevelService, LEVEL_CONFIGS } from '../../../shared/services/userLevelService';
import { prisma } from '../../../shared/database/client';

const router = Router();

/**
 * 获取所有等级体系配置
 */
router.get('/system',
  asyncHandler(async (req, res) => {
    const levels = await UserLevelService.getAllLevels();

    res.json(createSuccessResponse({
      levels: levels.map(level => ({
        key: level.key,
        name: level.name,
        order: level.order,
        discount: level.discount,
        monthlyReward: level.monthlyReward,
        monthlyBonus: level.monthlyBonus,
        upgradeRequires: level.upgradeRequires,
        benefits: level.benefits
      }))
    }, '获取等级体系成功'));
  })
);

/**
 * 获取当前用户的等级信息
 */
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        level: true,
        directCount: true,
        teamSales: true,
        pointsBalance: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
    }

    const currentLevelConfig = await UserLevelService.getLevelConfig(user.level);
    const upgradeProgress = await UserLevelService.calculateUpgradeProgress(
      user.level,
      user.directCount,
      user.teamSales
    );

    res.json(createSuccessResponse({
      currentLevel: {
        key: user.level,
        name: currentLevelConfig.name,
        discount: currentLevelConfig.discount,
        monthlyReward: currentLevelConfig.monthlyReward,
        monthlyBonus: currentLevelConfig.monthlyBonus,
        benefits: currentLevelConfig.benefits
      },
      nextLevel: upgradeProgress.nextLevel ? {
        key: upgradeProgress.nextLevel.key,
        name: upgradeProgress.nextLevel.name,
        discount: upgradeProgress.nextLevel.discount,
        benefits: upgradeProgress.nextLevel.benefits
      } : null,
      upgradeProgress: {
        progressPercentage: upgradeProgress.progressPercentage,
        requirements: upgradeProgress.requirements
      },
      userData: {
        directCount: user.directCount,
        teamSales: user.teamSales,
        pointsBalance: user.pointsBalance
      }
    }, '获取用户等级信息成功'));
  })
);

/**
 * 获取用户等级升级历史
 */
router.get('/me/upgrade-history',
  authenticate,
  asyncHandler(async (req, res) => {
    // TODO: 待Prisma schema中添加LevelUpgradeRecord模形后实现
    // 目前返回示例响应
    res.json(createSuccessResponse({
      records: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    }, '获取升级历史成功'));
  })
);

/**
 * 获取指定用户的等级信息（管理员接口）
 */
router.get('/:userId',
  authenticate,
  asyncHandler(async (req, res) => {
    // 检查管理员权限
    if (req.user!.level !== 'DIRECTOR' && req.user!.id !== req.params.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '无权限查看其他用户的等级信息'
        }
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        level: true,
        directCount: true,
        teamSales: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
    }

    const currentLevelConfig = await UserLevelService.getLevelConfig(user.level);
    const upgradeProgress = await UserLevelService.calculateUpgradeProgress(
      user.level,
      user.directCount,
      user.teamSales
    );

    res.json(createSuccessResponse({
      userId: user.id,
      level: user.level,
      levelName: currentLevelConfig.name,
      directCount: user.directCount,
      teamSales: user.teamSales,
      upgradeProgress: {
        progressPercentage: upgradeProgress.progressPercentage,
        requirements: upgradeProgress.requirements
      },
      joinDate: user.createdAt
    }, '获取用户等级信息成功'));
  })
);

/**
 * 手动升级用户等级（管理员接口）
 */
router.post('/:userId/upgrade',
  authenticate,
  asyncHandler(async (req, res) => {
    // 检查管理员权限
    if (req.user!.level !== 'DIRECTOR') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '仅董事可以手动升级用户等级'
        }
      });
    }

    const { targetLevel, reason } = req.body;
    
    if (!targetLevel || !Object.keys(LEVEL_CONFIGS).includes(targetLevel)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LEVEL',
          message: '无效的目标等级'
        }
      });
    }

    try {
      const updatedUser = await UserLevelService.upgradeLevel(
        req.params.userId,
        targetLevel,
        reason || '管理员手动升级'
      );

      res.json(createSuccessResponse({
        userId: updatedUser.id,
        newLevel: updatedUser.level,
        upgradedAt: new Date().toISOString()
      }, '用户等级升级成功'));
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'UPGRADE_FAILED',
          message: error.message
        }
      });
    }
  })
);

/**
 * 系统批量检查并升级用户（定时任务接口）
 */
router.post('/system/check-upgrades',
  authenticate,
  asyncHandler(async (req, res) => {
    // 只允许系统或管理员调用
    if (req.user!.level !== 'DIRECTOR') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '无权限'
        }
      });
    }

    try {
      const upgraded = await UserLevelService.checkAndUpgradeUsers();
      
      res.json(createSuccessResponse({
        upgradedCount: upgraded.length,
        upgrades: upgraded
      }, '批量升级检查完成'));
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SYSTEM_ERROR',
          message: error.message
        }
      });
    }
  })
);

/**
 * 获取等级权益详情
 */
router.get('/benefits/:level',
  asyncHandler(async (req, res) => {
    const { level } = req.params;
    
    if (!Object.keys(LEVEL_CONFIGS).includes(level)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LEVEL',
          message: '无效的等级'
        }
      });
    }

    const config = await UserLevelService.getLevelConfig(level as any);
    const benefits = await UserLevelService.getLevelBenefits(level as any);

    res.json(createSuccessResponse({
      level: level,
      name: config.name,
      ...benefits
    }, '获取等级权益成功'));
  })
);

export default router;
