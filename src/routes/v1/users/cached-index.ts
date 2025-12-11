import { Router, Request, Response } from 'express';
import * as expressValidator from 'express-validator';
const { body, query } = expressValidator;
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { UserLevelService } from '../../../shared/services/userLevelService';
import { getReferralStats } from '../../../shared/services/teamStatsService';
import { logger } from '../../../shared/utils/logger';
import {
  userCacheMiddleware,
  invalidateCacheMiddleware,
  invalidateTagsMiddleware,
  cacheStatsRoute,
  clearCacheRoute,
  warmupCacheRoute
} from '../../../shared/middleware/cache';
import { cacheManager } from '../../../shared/cache/CacheManager';
import { CachedUser, UserCacheService } from '../../../modules/users/cache';

const userCacheService = new UserCacheService();
const router = Router();

// 缓存管理路由
router.get('/cache/stats', cacheStatsRoute());
router.post('/cache/clear', clearCacheRoute());
router.post('/cache/warmup', warmupCacheRoute());

// 获取当前用户信息（带缓存）
router.get('/me',
  authenticate,
  userCacheMiddleware({
    ttl: 600, // 10分钟
    tags: ['user-profile'],
    keyGenerator: (req) => `user:${req.user?.id}:profile`
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // 尝试从缓存服务获取
    const cachedUser = await userCacheService.getUserProfile(userId);
    if (cachedUser) {
      return res.json(createSuccessResponse({
        user: cachedUser
      }));
    }

    // 缓存未命中，从数据库获取
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        openid: true,
        nickname: true,
        phone: true,
        avatarUrl: true,
        level: true,
        status: true,
        pointsBalance: true,
        pointsFrozen: true,
        totalSales: true,
        totalBottles: true,
        directCount: true,
        teamCount: true,
        cloudShopLevel: true,
        hasWutongShop: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 转换数据格式
    const userResponse = {
      ...user,
      level: user.level.toLowerCase(),
      status: user.status.toLowerCase()
    };

    // 缓存结果
    await userCacheService.setUserProfile(userId, userResponse);

    res.json(createSuccessResponse({
      user: userResponse
    }));
  })
);

// 更新用户信息（带缓存失效）
router.put('/me',
  authenticate,
  invalidateTagsMiddleware(['user-profile']),
  asyncHandler(async (req, res) => {
    const { nickname, avatarUrl } = req.body;
    const userId = req.user!.id;

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        ...(nickname && { nickname }),
        ...(avatarUrl && { avatarUrl })
      },
      select: {
        id: true,
        openid: true,
        nickname: true,
        phone: true,
        avatarUrl: true,
        level: true,
        status: true,
        pointsBalance: true,
        pointsFrozen: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // 更新缓存
    const userResponse = {
      ...updatedUser,
      level: updatedUser.level.toLowerCase(),
      status: updatedUser.status.toLowerCase()
    };
    await userCacheService.setUserProfile(userId, userResponse);

    res.json(createSuccessResponse({
      user: userResponse
    }, '用户信息更新成功'));
  })
);

// 获取用户列表（管理员权限，带缓存）
router.get('/',
  authenticate,
  userCacheMiddleware({
    ttl: 300, // 5分钟
    tags: ['user-list'],
    skipCache: (req) => {
      // 不缓存第一页外的请求
      const page = parseInt(req.query.page as string) || 1;
      return page > 1;
    }
  }),
  asyncHandler(async (req, res) => {
    // 检查管理员权限
    if (!req.user || req.user.level !== 'DIRECTOR') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要管理员权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);
    const skip = (page - 1) * perPage;

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        skip,
        take: perPage,
        select: {
          id: true,
          openid: true,
          nickname: true,
          phone: true,
          avatarUrl: true,
          level: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.users.count()
    ]);

    const response = {
      users: users.map(user => ({
        ...user,
        level: user.level.toLowerCase(),
        status: user.status.toLowerCase()
      })),
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNext: page < Math.ceil(total / perPage),
        hasPrev: page > 1
      }
    };

    // 缓存非分页请求
    if (page === 1) {
      const cacheKey = `users:list:page:${page}:perPage:${perPage}`;
      await cacheManager.set(cacheKey, response, { ttl: 300, tags: ['user-list'] });
    }

    res.json(createSuccessResponse(response));
  })
);

// 获取用户等级进度（带缓存）
router.get('/level/progress',
  authenticate,
  userCacheMiddleware({
    ttl: 1800, // 30分钟
    tags: ['user-level'],
    keyGenerator: (req) => `user:${req.user?.id}:level-progress`
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // 尝试从缓存获取
    const cachedProgress = await userCacheService.getUserLevelProgress(userId);
    if (cachedProgress) {
      return res.json(createSuccessResponse(cachedProgress));
    }

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

    const responseData = {
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
      progress: upgradeProgress.progressPercentage,
      upgradeProgress: upgradeProgress.requirements,
      userData: {
        directCount: user.directCount,
        teamSales: user.teamSales,
        pointsBalance: user.pointsBalance
      }
    };

    // 缓存结果
    await userCacheService.setUserLevelProgress(userId, responseData);

    res.json(createSuccessResponse(responseData, '获取用户等级进度成功'));
  })
);

// 获取推荐信息（带缓存）
router.get('/referral-info',
  authenticate,
  userCacheMiddleware({
    ttl: 600, // 10分钟
    tags: ['user-referral'],
    keyGenerator: (req) => `user:${req.user?.id}:referral-info`
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // 尝试从缓存获取
    const cachedReferral = await userCacheService.getUserReferralInfo(userId);
    if (cachedReferral) {
      return res.json(createSuccessResponse(cachedReferral));
    }

    const referralStats = await getReferralStats(userId);

    const responseData = {
      referralCode: referralStats.user.referralCode,
      directCount: referralStats.user.directCount,
      teamCount: referralStats.user.teamCount,
      teamLevel: referralStats.user.teamLevel,
      userLevel: referralStats.user.level.toLowerCase(),
      recentReferrals: referralStats.recentReferrals.map(referral => ({
        ...referral,
        level: referral.level.toLowerCase()
      })),
      levelStats: referralStats.levelStats
    };

    // 缓存结果
    await userCacheService.setUserReferralInfo(userId, responseData);

    res.json(createSuccessResponse(responseData, '获取推荐信息成功'));
  })
);

// 获取用户详细信息（带缓存）
router.get('/profile',
  authenticate,
  userCacheMiddleware({
    ttl: 600,
    tags: ['user-profile'],
    keyGenerator: (req) => `user:${req.user?.id}:profile`
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // 尝试从缓存获取
    const cachedProfile = await userCacheService.getUserProfile(userId);
    if (cachedProfile) {
      return res.json(createSuccessResponse(cachedProfile));
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        openid: true,
        nickname: true,
        phone: true,
        avatarUrl: true,
        level: true,
        status: true,
        pointsBalance: true,
        pointsFrozen: true,
        parentId: true,
        teamPath: true,
        teamLevel: true,
        totalSales: true,
        totalBottles: true,
        directSales: true,
        teamSales: true,
        directCount: true,
        teamCount: true,
        cloudShopLevel: true,
        hasWutongShop: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    const responseData = {
      id: user.id,
      openid: user.openid,
      nickname: user.nickname,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      level: user.level,
      status: user.status,
      pointsBalance: user.pointsBalance,
      pointsFrozen: user.pointsFrozen,
      parentId: user.parentId,
      teamPath: user.teamPath,
      teamLevel: user.teamLevel,
      totalSales: user.totalSales,
      totalBottles: user.totalBottles,
      directSales: user.directSales,
      teamSales: user.teamSales,
      directCount: user.directCount,
      teamCount: user.teamCount,
      cloudShopLevel: user.cloudShopLevel,
      hasWutongShop: user.hasWutongShop,
      referralCode: user.referralCode,
      isAdmin: user.level === 'DIRECTOR',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // 缓存结果
    await userCacheService.setUserProfile(userId, responseData);

    res.json(createSuccessResponse(responseData, '获取用户信息成功'));
  })
);

// 更新用户信息（带缓存失效）
router.put('/profile',
  authenticate,
  invalidateTagsMiddleware(['user-profile']),
  asyncHandler(async (req, res) => {
    const { nickname, avatarUrl, phone } = req.body;
    const userId = req.user!.id;

    // 检查是否尝试更新关键字段
    const forbiddenFields = ['level', 'pointsBalance', 'pointsFrozen', 'parentId', 'teamPath'];
    const hasForbiddenFields = forbiddenFields.some(field => req.body[field] !== undefined);

    if (hasForbiddenFields) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FORBIDDEN_FIELDS',
          message: '不允许更新以下字段：level, pointsBalance, pointsFrozen, parentId, teamPath',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 如果更新手机号，检查是否已被使用
    if (phone) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PHONE_FORMAT',
            message: '手机号格式不正确',
            timestamp: new Date().toISOString()
          },
          errors: ['phone']
        });
      }

      const existingUserCount = await prisma.users.count({
        where: {
          phone,
          id: { not: userId }
        }
      });

      if (existingUserCount > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PHONE_EXISTS',
            message: '该手机号已被其他用户使用',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        ...(nickname && { nickname }),
        ...(avatarUrl && { avatarUrl }),
        ...(phone && { phone })
      },
      select: {
        id: true,
        openid: true,
        nickname: true,
        phone: true,
        avatarUrl: true,
        level: true,
        status: true,
        pointsBalance: true,
        pointsFrozen: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // 更新缓存
    const responseData = {
      ...updatedUser,
      level: updatedUser.level.toLowerCase(),
      status: updatedUser.status.toLowerCase()
    };
    await userCacheService.setUserProfile(userId, responseData);

    res.json(createSuccessResponse(responseData, '用户信息更新成功'));
  })
);

// 获取团队信息（带缓存）
router.get('/team',
  authenticate,
  userCacheMiddleware({
    ttl: 300, // 5分钟
    tags: ['user-team'],
    keyGenerator: (req) => {
      const page = req.query.page || 1;
      return `user:${req.user?.id}:team:page:${page}`;
    }
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const userLevel = req.user!.level;

    // 权限检查
    const allowedLevels = [
      'VIP', 'vip',
      'STAR_1', 'star_1', 'STAR1', 'star1',
      'STAR_2', 'star_2', 'STAR2', 'star2',
      'STAR_3', 'star_3', 'STAR3', 'star3',
      'STAR_4', 'star_4', 'STAR4', 'star4',
      'STAR_5', 'star_5', 'STAR5', 'star5',
      'DIRECTOR', 'director', 'ADMIN', 'admin'
    ];

    if (!allowedLevels.includes(userLevel)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_LEVEL',
          message: '需要VIP及以上等级才能查看团队信息',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 尝试从缓存获取
    const cachedTeam = await userCacheService.getUserTeamInfo(userId);
    if (cachedTeam) {
      return res.json(createSuccessResponse(cachedTeam));
    }

    // 管理员查看所有用户
    const isAdmin = ['DIRECTOR', 'director', 'ADMIN', 'admin'].includes(userLevel);

    if (isAdmin) {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);
      const skip = (page - 1) * perPage;

      const [users, total] = await Promise.all([
        prisma.users.findMany({
          skip,
          take: perPage,
          select: {
            id: true,
            nickname: true,
            level: true,
            status: true,
            parentId: true,
            directCount: true,
            teamCount: true,
            totalSales: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.users.count()
      ]);

      return res.json(createSuccessResponse(users.map(user => ({
        ...user,
        level: user.level.toLowerCase(),
        status: user.status.toLowerCase()
      }))));
    }

    // 普通用户获取自己的团队信息
    const directMembers = await prisma.users.findMany({
      where: { parentId: userId },
      select: {
        id: true,
        nickname: true,
        level: true,
        status: true,
        teamPath: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const responseData = {
      directCount: directMembers.length,
      teamCount: directMembers.length,
      members: directMembers.map(member => ({
        id: member.id,
        nickname: member.nickname,
        level: member.level.toLowerCase(),
        status: member.status.toLowerCase(),
        teamPath: member.teamPath,
        totalPurchases: 0,
        joinedAt: member.createdAt,
        lastActiveAt: member.updatedAt
      })),
      stats: {
        totalMembers: directMembers.length,
        activeMembers: directMembers.length,
        totalSales: 0,
        totalPurchases: 0
      }
    };

    // 缓存结果
    await userCacheService.setUserTeamInfo(userId, responseData);

    res.json(createSuccessResponse(responseData, '获取团队信息成功'));
  })
);

// 获取用户统计数据（带缓存）
router.get('/statistics',
  authenticate,
  userCacheMiddleware({
    ttl: 300, // 5分钟
    tags: ['user-stats'],
    keyGenerator: (req) => {
      const global = req.query.global || false;
      return `user:${req.user?.id}:statistics:global:${global}`;
    }
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const userLevel = req.user!.level;
    const { global } = req.query;

    // 全局统计权限检查
    if (global === 'true') {
      const adminLevels = ['DIRECTOR', 'director', 'ADMIN', 'admin'];
      if (!adminLevels.includes(userLevel)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSION',
            message: '需要管理员权限才能查看全局统计',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 尝试从缓存获取
    const cachedStats = await userCacheService.getUserStatistics(userId, global === 'true');
    if (cachedStats) {
      return res.json(createSuccessResponse(cachedStats));
    }

    // 获取用户基本信息
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        level: true,
        totalSales: true,
        totalBottles: true,
        directSales: true,
        teamSales: true,
        directCount: true,
        teamCount: true,
        pointsBalance: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    const responseData: any = {
      totalSales: user.totalSales,
      totalBottles: user.totalBottles,
      directSales: user.directSales,
      teamSales: user.teamSales,
      directCount: user.directCount,
      teamCount: user.teamCount,
      pointsBalance: user.pointsBalance
    };

    // 星店长及以上添加月度业绩
    const starLevels = ['STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR',
                       'star_1', 'star_2', 'star_3', 'star_4', 'star_5', 'director'];
    if (starLevels.includes(user.level)) {
      // 简化处理
      responseData.monthlyPerformance = [];
    }

    // 管理员添加全局统计
    const adminLevels = ['DIRECTOR', 'director', 'ADMIN', 'admin'];
    if (adminLevels.includes(userLevel) && global === 'true') {
      const [totalUsers, levelStats] = await Promise.all([
        prisma.users.count(),
        prisma.users.groupBy({
          by: ['level'],
          _count: { level: true }
        })
      ]);

      responseData.totalUsers = totalUsers;
      responseData.levelDistribution = levelStats.reduce((acc, stat) => {
        acc[stat.level.toLowerCase()] = stat._count.level;
        return acc;
      }, {});
    }

    // 缓存结果
    await userCacheService.setUserStatistics(userId, global === 'true', responseData);

    res.json(createSuccessResponse(responseData, '获取统计数据成功'));
  })
);

// 获取推荐记录（带缓存）
router.get('/referrals',
  authenticate,
  userCacheMiddleware({
    ttl: 600, // 10分钟
    tags: ['user-referrals'],
    keyGenerator: (req) => {
      const page = req.query.page || 1;
      return `user:${req.user?.id}:referrals:page:${page}`;
    }
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const userLevel = req.user!.level;

    // 尝试从缓存获取
    const cachedReferrals = await userCacheService.getUserReferrals(userId);
    if (cachedReferrals) {
      return res.json(createSuccessResponse(cachedReferrals));
    }

    const referralStats = await getReferralStats(userId);

    const responseData = {
      referralCode: referralStats.user.referralCode,
      referrals: referralStats.recentReferrals.map(ref => ({
        ...ref,
        level: ref.level.toLowerCase()
      })),
      directCount: referralStats.user.directCount,
      teamCount: referralStats.user.teamCount
    };

    // 缓存结果
    await userCacheService.setUserReferrals(userId, responseData);

    res.json(createSuccessResponse(responseData, '获取推荐记录成功'));
  })
);

// 批量预热用户缓存
router.post('/cache/warmup-users',
  authenticate,
  invalidateCacheMiddleware(['*']),
  asyncHandler(async (req, res) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'userIds 必须是数组'
        }
      });
    }

    const warmupResults = [];

    for (const userId of userIds) {
      try {
        // 预热用户基本信息
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            openid: true,
            nickname: true,
            phone: true,
            avatarUrl: true,
            level: true,
            status: true,
            pointsBalance: true,
            pointsFrozen: true,
            totalSales: true,
            totalBottles: true,
            directCount: true,
            teamCount: true,
            cloudShopLevel: true,
            hasWutongShop: true,
            referralCode: true,
            createdAt: true,
            updatedAt: true
          }
        });

        if (user) {
          const userData = {
            ...user,
            level: user.level.toLowerCase(),
            status: user.status.toLowerCase()
          };
          await userCacheService.setUserProfile(userId, userData);
          warmupResults.push({ userId, success: true });
        } else {
          warmupResults.push({ userId, success: false, error: '用户不存在' });
        }
      } catch (error) {
        warmupResults.push({ userId, success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    }

    res.json(createSuccessResponse({
      warmed: warmupResults.filter(r => r.success).length,
      failed: warmupResults.filter(r => !r.success).length,
      results: warmupResults
    }, '用户缓存预热完成'));
  })
);

export default router;