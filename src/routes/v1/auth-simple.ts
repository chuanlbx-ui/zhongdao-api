import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../../shared/middleware/auth';
import { prisma } from '../../shared/database/client';
import { logger } from '../../shared/utils/logger';
import {
  generateUniqueReferralCode,
  validateReferralCode
} from '../../shared/utils/referralCode';
import { createReferralRelationship, updateReferralChainStats } from '../../shared/services/teamStatsService';
import {
  asyncHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError
} from '../../shared/middleware/error';
import { createErrorResponse, createSuccessResponse } from '../../shared/types/response';

const router = Router();

// 跳过CSRF验证的中间件
const skipCSRF = (req: Request, res: Response, next: any) => {
  (req as any).skipCSRF = true;
  next();
};


// 登录状态检查接口
router.get('/status',
  asyncHandler(async (req: Request, res: Response) => {
    res.json(createSuccessResponse({
      status: 'authenticated',
      message: '认证模块正常工作'
    }, '认证服务正常', undefined, req.requestId));
  })
);

// 微信小程序登录接口（简化版）
router.post('/wechat-login',
  asyncHandler(async (req: Request, res: Response) => {
      const { code } = req.body;

      // 模拟登录成功
      const mockUser = {
        id: 'mock_user_id',
        openid: 'mock_openid_' + Date.now(),
        nickname: '测试用户',
        avatarUrl: '',
        level: 'NORMAL',
        role: 'USER',
        status: 'ACTIVE',
        isNewUser: true
      };

      const mockTokens = {
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        expiresIn: '7d'
      };

      res.json({
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens
        },
        message: '模拟登录成功（开发模式）'
      });
  })
);

// 登出接口
router.post('/logout',
  asyncHandler(async (req: Request, res: Response) => {
    res.json(createSuccessResponse({ message: '登出成功' }, '已成功登出', undefined, req.requestId));
  })
);

// Token刷新接口
router.post('/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('缺少刷新Token');
    }

// [DEBUG REMOVED]     console.log('收到Token刷新请求');

    const newTokens = {
      accessToken: 'new_mock_access_token_' + Date.now(),
      refreshToken: 'new_mock_refresh_token_' + Date.now(),
      expiresIn: '7d'
    };

    res.json(createSuccessResponse(newTokens, 'Token刷新成功（模拟）', undefined, req.requestId));
  })
);

// 密码登录接口
router.post('/password-login',
  skipCSRF,
  asyncHandler(async (req: Request, res: Response) => {
    const { phone, password } = req.body;

      // 输入验证
      if (!phone || !password) {
        throw new ValidationError('手机号和密码不能为空');
      }

      // 查找用户
      const user = await prisma.users.findUnique({
        where: { phone }
      });

      if (!user) {
        logger.warn('密码登录失败 - 用户不存在', { phone });
        throw new AuthenticationError('手机号或密码错误');
      }

      // 验证密码
      if (!user.password) {
        logger.warn('密码登录失败 - 用户未设置密码', { phone });
        throw new AuthenticationError('手机号或密码错误');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        logger.warn('密码登录失败 - 密码错误', { phone });
        throw new AuthenticationError('手机号或密码错误');
      }

      logger.info('用户登录成功', { userId: user.id, phone });

      // 生成JWT token
      const token = generateToken({
        sub: user.id,
        scope: ['active', 'user'],
        role: 'USER',
        level: user.level.toLowerCase()
      });

      res.json(createSuccessResponse({
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          avatarUrl: null,
          level: user.level.toLowerCase(),
          status: user.status.toLowerCase()
        },
        token
      }, '登录成功', undefined, req.requestId));
  })
);

// 获取当前用户信息 (auth/me)
router.get('/me',
  asyncHandler(async (req: Request, res: Response) => {
    const { verifyToken } = await import('@/shared/middleware/auth');

    // 获取Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('缺少认证令牌');
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    // 从数据库获取用户信息
    const user = await prisma.users.findUnique({
      where: { id: decoded.sub },
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
      throw new NotFoundError('用户不存在');
    }

    res.json(createSuccessResponse({
      id: user.id,
      openid: user.openid,
      nickname: user.nickname,
      phone: user.phone,
      avatarUrl: null,
      level: user.level.toLowerCase(),
      status: user.status.toLowerCase(),
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, '获取用户信息成功', undefined, req.requestId));
  })
);

// 密码注册接口
router.post('/password-register',
  skipCSRF,
  asyncHandler(async (req: Request, res: Response) => {
    const { phone, password, referralCode } = req.body;

    // 输入验证
    if (!phone || !password) {
      throw new ValidationError('手机号和密码不能为空');
    }

    // 检查手机号是否已注册
    const existingUser = await prisma.users.findUnique({
      where: { phone }
    });

    if (existingUser) {
      throw new ConflictError('该手机号已注册，请直接登录或使用其他手机号', {
        phone: phone,
        suggestion: '您可以尝试使用该手机号登录，或使用新的手机号注册'
      });
    }

    // 验证推荐码（如果有提供）
    let parentId: string | null = null;
    if (referralCode) {
      const validationResult = await validateReferralCode(referralCode);
      if (!validationResult.valid) {
        throw new ValidationError(validationResult.error, {
          provided: referralCode,
          suggestion: '请检查推荐码是否正确（6位数字和字母组合）'
        });
      }
      parentId = validationResult.referrer?.id || null;
    }

    // 生成推荐码和密码哈希
    const userReferralCode = await generateUniqueReferralCode();
    const passwordHash = await bcrypt.hash(password, 10);
    const openid = `phone_${phone}_${Date.now()}`;

    // 创建用户
    const user = await prisma.users.create({
      data: {
        id: "sdjslkdjflksdfjlsdf",
        openid,
        phone,
        nickname: phone,
        password: passwordHash,
        referralCode: userReferralCode,
        level: 'NORMAL',
        status: 'ACTIVE',
        parentId: parentId || null,
        teamLevel: parentId ? 2 : 1,
        teamPath: parentId ? `/${parentId}/` : null,
      }
    });

    logger.info('用户注册成功', {
      userId: user.id,
      phone,
      parentId,
      referralCode: userReferralCode
    });

    // 生成JWT token
    const token = generateToken({
      sub: user.id,
      scope: ['active', 'user'],
      role: 'USER',
      level: user.level.toLowerCase()
    });

    res.status(201).json(createSuccessResponse({
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatarUrl: null,
        level: user.level.toLowerCase(),
        status: user.status.toLowerCase(),
        referralCode: user.referralCode
      },
      token,
      referralInfo: {
        yourCode: userReferralCode,
        message: '您的推荐码已生成，可分享给朋友注册时使用'
      }
    }, '注册成功', undefined, req.requestId));
  })
);

export default router;