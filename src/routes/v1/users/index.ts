import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { UserLevelService } from '../../../shared/services/userLevelService';
import { generateUniqueReferralCode, validateReferralCode } from '../../../shared/utils/referralCode';
import { createReferralRelationship, getReferralStats } from '../../../shared/services/teamStatsService';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// 涓虹壒瀹氳矾鐢辫烦杩嘋SRF楠岃瘉鐨勪腑闂翠欢
const skipCSRFForRegister = (req: Request, res: Response, next: NextFunction) => {
  // 鏍囪�姝よ�姹傝烦杩嘋SRF楠岃瘉
  (req as any).skipCSRF = true;
  next();
};

// 鐢ㄦ埛娉ㄥ唽锛堣烦杩嘋SRF楠岃瘉渚夸簬寮€鍙戞祴璇曪級
router.post('/register',
  skipCSRFForRegister,
  // 涓存椂绉婚櫎璁よ瘉闇€姹傦紝渚夸簬寮€鍙戞祴璇�
  // authenticate,
  [
    body('openid')
      .notEmpty()
      .withMessage('openid涓嶈兘涓虹┖')
      .isLength({ min: 1, max: 100 })
      .withMessage('openid闀垮害蹇呴』鍦�1-100瀛楃�涔嬮棿'),
    body('nickname')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('鏄电О闀垮害蹇呴』鍦�1-50瀛楃�涔嬮棿'),
    body('phone')
      .optional()
      .trim(),
    body('avatarUrl')
      .optional()
      .trim(),
    body('referralCode')
      .optional()
      .isLength({ min: 6, max: 6 })
      .withMessage('推荐码必须是6位数字字母组合')
      .matches(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/)
      .withMessage('推荐码格式错误，应为6位数字字母组合，排除易混淆字符0,O,1,I,l')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { openid, nickname, phone, avatarUrl, referralCode } = req.body;

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { openid }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: '用户已存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查是否为第一个用户（系统初始化）
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // 如果不是第一个用户，必须有推荐码
    if (!isFirstUser && !referralCode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REFERRAL_CODE_REQUIRED',
          message: '系统已有用户，注册时必须提供推荐码',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 验证推荐码（如果有提供）
    let referralValidation = null;
    if (referralCode) {
      referralValidation = await validateReferralCode(referralCode);
      if (!referralValidation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_CODE',
            message: referralValidation.error,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    try {
      // 生成用户的推荐码
      const userReferralCode = await generateUniqueReferralCode();

      // 创建用户（先不设置推荐关系）
      const user = await prisma.user.create({
        data: {
          openid,
          nickname,
          phone,
          avatarUrl,
          referralCode: userReferralCode,
          level: 'NORMAL',
          status: 'ACTIVE',
          // 推荐关系将在后续步骤中设置
          parentId: null,
          teamPath: null,
          teamLevel: 1
        }
      });

      // 创建推荐关系并更新统计信息（如果有推荐码）
      let referralRelationship = null;
      if (referralValidation) {
        referralRelationship = await createReferralRelationship(referralCode, user.id);
      }

      // 重新获取用户信息（包含更新后的推荐关系）
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          openid: true,
          nickname: true,
          phone: true,
          avatarUrl: true,
          referralCode: true,
          level: true,
          status: true,
          parentId: true,
          teamLevel: true,
          createdAt: true
        }
      });

      const responseData: any = {
        user: {
          id: updatedUser!.id,
          openid: updatedUser!.openid,
          nickname: updatedUser!.nickname,
          phone: updatedUser!.phone,
          avatarUrl: updatedUser!.avatarUrl,
          referralCode: updatedUser!.referralCode,
          level: updatedUser!.level.toLowerCase(),
          status: updatedUser!.status.toLowerCase(),
          parentId: updatedUser!.parentId,
          teamLevel: updatedUser!.teamLevel,
          createdAt: updatedUser!.createdAt
        }
      };

      // 如果有推荐人，添加推荐人信息
      if (referralValidation) {
        responseData.referrer = {
          id: referralRelationship!.referrerId,
          nickname: referralValidation.referrer.nickname,
          level: referralValidation.referrer.level.toLowerCase()
        };
      }

      logger.info('用户注册成功', {
        userId: user.id,
        nickname,
        referralCode,
        isFirstUser,
        referrerId: referralRelationship?.referrerId,
        teamLevel: referralRelationship?.teamLevel
      });

      res.status(201).json(createSuccessResponse(responseData, '用户注册成功', 201));

    } catch (error) {
      logger.error('用户注册失败', {
        openid,
        referralCode,
        error: error instanceof Error ? error.message : '未知错误'
      });

      // 如果注册失败，删除已创建的用户记录
      try {
        await prisma.user.delete({
          where: { openid }
        });
      } catch (deleteError) {
        logger.error('删除失败用户记录时出错', { openid });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: '注册失败，请稍后重试',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 鑾峰彇褰撳墠鐢ㄦ埛淇℃伅
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '鐢ㄦ埛涓嶅瓨鍦�',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json(createSuccessResponse({
      user: {
        ...user,
        level: user.level.toLowerCase(),
        status: user.status.toLowerCase()
      }
    }));
  })
);

// 鏇存柊鐢ㄦ埛淇℃伅
router.put('/me',
  authenticate,
  [
    body('nickname')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('鏄电О闀垮害蹇呴』鍦�2-50瀛楃�涔嬮棿'),
    body('avatarUrl')
      .optional()
      .isURL()
      .withMessage('澶村儚URL鏍煎紡涓嶆�纭�')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { nickname, avatarUrl } = req.body;
    const userId = req.user!.id;

    const updatedUser = await prisma.user.update({
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
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(createSuccessResponse({
      user: {
        ...updatedUser,
        level: updatedUser.level.toLowerCase(),
        status: updatedUser.status.toLowerCase()
      }
    }, '鐢ㄦ埛淇℃伅鏇存柊鎴愬姛'));
  })
);

// 鑾峰彇鐢ㄦ埛鍒楄〃锛堢�鐞嗗憳鏉冮檺锛�
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    // 妫€鏌ョ�鐞嗗憳鏉冮檺
    if (!req.user || req.user.level !== 'director') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '闇€瑕佺�鐞嗗憳鏉冮檺',
          timestamp: new Date().toISOString()
        }
      });
    }
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);
    const skip = (page - 1) * perPage;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
      prisma.user.count()
    ]);

    res.json(createSuccessResponse({
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
    }));
  })
);

// 验证推荐码接口
router.post('/validate-referral',
  [
    body('referralCode')
      .notEmpty()
      .withMessage('推荐码不能为空')
      .isLength({ min: 6, max: 6 })
      .withMessage('推荐码必须是6位数字字母组合')
      .matches(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/)
      .withMessage('推荐码格式错误，应为6位数字字母组合，排除易混淆字符0,O,1,I,l')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { referralCode } = req.body;

    const validation = await validateReferralCode(referralCode);

    if (validation.valid) {
      res.json(createSuccessResponse({
        valid: true,
        referrer: validation.referrer
      }, '推荐码验证成功'));
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_CODE',
          message: validation.error,
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 获取用户等级进度
router.get('/level/progress',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    
    const user = await prisma.user.findUnique({
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
      progress: upgradeProgress.progressPercentage,
      upgradeProgress: upgradeProgress.requirements,
      userData: {
        directCount: user.directCount,
        teamSales: user.teamSales,
        pointsBalance: user.pointsBalance
      }
    }, '获取用户等级进度成功'));
  })
);

// 获取我的推荐信息
router.get('/referral-info',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const referralStats = await getReferralStats(req.user!.id);

      res.json(createSuccessResponse({
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
      }, '获取推荐信息成功'));

    } catch (error) {
      logger.error('获取推荐信息失败', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_REFERRAL_INFO_FAILED',
          message: '获取推荐信息失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

export default router;
