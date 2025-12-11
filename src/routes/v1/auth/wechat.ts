import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { wechatAuthService } from '../../../shared/services/wechat-auth';
import { authenticateToken } from '../../../shared/middleware/auth';
import {
  wechatSecurityGuard,
  wechatRateLimit,
  validateWechatHeaders,
  validateWechatCode
} from '../../../shared/middleware/wechat-security';

const router = Router();

/**
 * 获取微信小程序登录码
 * GET /api/v1/auth/wechat/qr
 * 返回小程序码或登录引导信息
 */
router.get('/qr',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // 微信小程序使用wx.login()获取code，不需要生成二维码
      // 这里返回登录指引和配置信息
      const config = {
        appId: process.env.WECHAT_APP_ID?.substring(0, 8) + '...',
        loginUrl: `${req.protocol}://${req.get('host')}/api/v1/auth/wechat/login`,
        supportedFeatures: {
          phone: true, // 支持获取手机号
          userInfo: true, // 支持获取用户信息
          realName: false // 暂不支持实名认证
        },
        instructions: {
          step1: '调用 wx.login() 获取临时登录凭证 code',
          step2: '调用 wx.getUserProfile() 获取用户信息（可选）',
          step3: '将 code 和用户信息提交到登录接口',
          step4: '获取 JWT token 并存储在本地'
        }
      };

      res.json(createSuccessResponse(
        config,
        '获取微信小程序登录指引成功'
      ));
    } catch (error) {
      logger.error('获取登录指引失败', {
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取登录指引失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

/**
 * 微信小程序用户信息解密
 * POST /api/v1/auth/wechat/decrypt
 * 使用session_key解密微信返回的加密数据
 */
router.post('/decrypt',
  authenticateToken, // 需要登录后才能使用
  [
    body('sessionKey')
      .notEmpty()
      .withMessage('session_key不能为空'),
    body('encryptedData')
      .notEmpty()
      .withMessage('加密数据不能为空'),
    body('iv')
      .notEmpty()
      .withMessage('初始向量不能为空'),
    body('type')
      .isIn(['userInfo', 'phone'])
      .withMessage('解密类型必须是 userInfo 或 phone')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { sessionKey, encryptedData, iv, type } = req.body;
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json(createErrorResponse(
          'UNAUTHORIZED',
          '用户未认证'
        ));
      }

      let result;

      if (type === 'userInfo') {
        result = wechatAuthService.decryptUserInfo(sessionKey, encryptedData, iv);
      } else if (type === 'phone') {
        result = await wechatAuthService.decryptPhoneNumber(sessionKey, encryptedData, iv);

        // 如果是解密手机号，自动绑定到用户
        if (result.phoneNumber) {
          const bindResult = await wechatAuthService.bindPhone(
            userId,
            sessionKey,
            encryptedData,
            iv
          );

          if (!bindResult.success) {
            return res.status(400).json(createErrorResponse(
              bindResult.error,
              bindResult.message
            ));
          }
        }
      }

      logger.info('微信数据解密成功', {
        userId,
        type,
        requestId: req.requestId
      });

      res.json(createSuccessResponse(
        result,
        `${type === 'userInfo' ? '用户信息' : '手机号'}解密成功`
      ));
    } catch (error) {
      logger.error('微信数据解密失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.sub,
        requestId: req.requestId
      });

      res.status(400).json(createErrorResponse(
        'DECRYPT_FAILED',
        '数据解密失败',
        error instanceof Error ? error.message : '解密过程出错'
      ));
    }
  })
);

/**
 * 绑定微信手机号
 * POST /api/v1/auth/wechat/bind-phone
 * 使用微信获取的手机号绑定到用户账号
 */
router.post('/bind-phone',
  authenticateToken,
  [
    body('sessionKey')
      .notEmpty()
      .withMessage('session_key不能为空'),
    body('encryptedData')
      .notEmpty()
      .withMessage('加密数据不能为空'),
    body('iv')
      .notEmpty()
      .withMessage('初始向量不能为空')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { sessionKey, encryptedData, iv } = req.body;
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json(createErrorResponse(
          'UNAUTHORIZED',
          '用户未认证'
        ));
      }

      const result = await wechatAuthService.bindPhone(
        userId,
        sessionKey,
        encryptedData,
        iv
      );

      if (result.success) {
        logger.info('用户手机号绑定成功', {
          userId,
          phone: result.phone,
          requestId: req.requestId
        });

        res.json(createSuccessResponse(
          { phone: result.phone },
          '手机号绑定成功'
        ));
      } else {
        res.status(400).json(createErrorResponse(
          result.error || 'BIND_PHONE_FAILED',
          result.message || '手机号绑定失败'
        ));
      }
    } catch (error) {
      logger.error('绑定手机号失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.sub,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '绑定手机号失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

/**
 * 获取微信用户信息
 * GET /api/v1/auth/wechat/user-info
 * 获取当前登录用户的微信相关信息
 */
router.get('/user-info',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json(createErrorResponse(
          'UNAUTHORIZED',
          '用户未认证'
        ));
      }

      // 从数据库获取用户信息
      const { prisma } = await import('../../../shared/database/client');
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          userNumber: true,
          openid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          level: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json(createErrorResponse(
          'USER_NOT_FOUND',
          '用户不存在'
        ));
      }

      // 不返回敏感信息
      const safeUserInfo = {
        id: user.id,
        userNumber: user.userNumber,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
        level: user.level,
        status: user.status,
        isPhoneBound: !!user.phone,
        registeredAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      res.json(createSuccessResponse(
        safeUserInfo,
        '获取用户信息成功'
      ));
    } catch (error) {
      logger.error('获取用户信息失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.sub,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取用户信息失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

/**
 * 微信服务健康检查
 * GET /api/v1/auth/wechat/health
 * 检查微信认证服务状态
 */
router.get('/health',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const health = await wechatAuthService.checkHealth();

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json(createSuccessResponse(
        health,
        health.message
      ));
    } catch (error) {
      logger.error('微信服务健康检查失败', {
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(503).json(createErrorResponse(
        'HEALTH_CHECK_FAILED',
        '服务健康检查失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;