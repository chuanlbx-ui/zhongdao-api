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

const router = Router();

// 跳过CSRF验证的中间件
const skipCSRF = (req: Request, res: Response, next: any) => {
  (req as any).skipCSRF = true;
  next();
};

// 简单的异步处理包装器
const asyncHandler = (fn: any) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 登录状态检查接口
router.get('/status',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'authenticated',
        message: '认证模块正常工作',
        timestamp: new Date().toISOString()
      },
      message: '认证服务正常'
    });
  })
);

// 微信小程序登录接口（简化版）
router.post('/wechat-login',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { code } = req.body;

      console.log('收到微信登录请求', {
        code: code ? code.substring(0, 10) + '...' : 'no code'
      });

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
    } catch (error) {
      console.error('微信登录失败', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '登录处理失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 登出接口
router.post('/logout',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: { message: '登出成功' },
      message: '已成功登出'
    });
  })
);

// Token刷新接口
router.post('/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      console.log('收到Token刷新请求');

      const newTokens = {
        accessToken: 'new_mock_access_token_' + Date.now(),
        refreshToken: 'new_mock_refresh_token_' + Date.now(),
        expiresIn: '7d'
      };

      res.json({
        success: true,
        data: newTokens,
        message: 'Token刷新成功（模拟）'
      });
    } catch (error) {
      console.error('Token刷新失败', error);

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token刷新失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 密码登录接口
router.post('/password-login',
  skipCSRF,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phone, password } = req.body;

      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '手机号和密码不能为空',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 查找用户
      const user = await prisma.users.findUnique({
        where: { phone }
      });

      if (!user) {
        logger.warn('密码登录失败 - 用户不存在', { phone });
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '手机号或密码错误',
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.info('用户登录成功', { userId: user.id, phone });

      // 生成JWT token
      const token = generateToken({
        sub: user.id,
        scope: ['active', 'user'],
        role: 'USER',
        level: user.level.toLowerCase()
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            level: user.level.toLowerCase(),
            status: user.status.toLowerCase()
          },
          token
        },
        message: '登录成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('密码登录失败', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '登录失败，请稍后重试',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 密码注册接口
router.post('/password-register',
  skipCSRF,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phone, password, referralCode } = req.body;

      // ... 验证输入
      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '手机号和密码不能为空',
            timestamp: new Date().toISOString()
          }
        });
      }

      // ... 检查手机号是否已注册
      const existingUser = await prisma.users.findUnique({
        where: { phone }
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: '该手机号已注册，请直接登录或使用其他手机号',
            details: {
              phone: phone,
              suggestion: '您可以尝试使用该手机号登录，或使用新的手机号注册'
            },
            timestamp: new Date().toISOString()
          }
        });
      }

      // ... 验证推荐码（如果有提供）
      let parentId: string | null = null;
      if (referralCode) {
        const validationResult = await validateReferralCode(referralCode);
        if (!validationResult.valid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_REFERRAL_CODE',
              message: validationResult.error,
              details: {
                provided: referralCode,
                suggestion: '请检查推荐码是否正确（6位数字和字母组合）'
              },
              timestamp: new Date().toISOString()
            }
          });
        }
        parentId = validationResult.referrer?.id || null;
      }

      // ... 生成推荐码和密码哈希
      const userReferralCode = await generateUniqueReferralCode();
      const passwordHash = await bcrypt.hash(password, 10);
      const openid = `phone_${phone}_${Date.now()}`;

      // ... 创建用户
      const user = await prisma.users.create({
        data: {
          openid,
          phone,
          nickname: phone,
          referralCode: userReferralCode,
          level: 'NORMAL',
          status: 'ACTIVE',
          parentId,
          teamLevel: parentId ? 2 : 1,
          teamPath: parentId ? `/${parentId}/` : null
        }
      });

      logger.info('用户注册成功', { 
        userId: user.id, 
        phone,
        parentId,
        referralCode: userReferralCode
      });

      // ... 生成JWT token
      const token = generateToken({
        sub: user.id,
        scope: ['active', 'user'],
        role: 'USER',
        level: user.level.toLowerCase()
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            level: user.level.toLowerCase(),
            status: user.status.toLowerCase(),
            referralCode: user.referralCode
          },
          token,
          referralInfo: {
            yourCode: userReferralCode,
            message: '您的推荐码已生成，可分享给朋友注册时使用'
          }
        },
        message: '注册成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('密码注册失败', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '注册失败，请稍后重试',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

export default router;