import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { wechatAuthService } from '../../../shared/services/wechat-auth';
import { authenticateToken } from '../../../shared/middleware/auth';

const router = Router();

// 登录状态检查接口
router.get('/status',
  asyncHandler(async (req: Request, res: Response) => {
    res.json(createSuccessResponse(
      {
        status: 'authenticated',
        message: '认证模块正常工作',
        timestamp: new Date().toISOString()
      },
      '认证服务正常'
    ));
  })
);

// 微信小程序登录接口
router.post('/wechat/login',
  [
    body('code')
      .notEmpty()
      .withMessage('微信授权码不能为空')
      .isLength({ min: 10 })
      .withMessage('授权码格式不正确'),
    body('userInfo')
      .optional()
      .isObject()
      .withMessage('用户信息必须是对象格式'),
    body('encryptedData')
      .optional()
      .isString()
      .withMessage('加密数据必须是字符串'),
    body('iv')
      .optional()
      .isString()
      .withMessage('初始向量必须是字符串')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { code, userInfo, encryptedData, iv } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

      logger.info('收到微信登录请求', {
        code: code.substring(0, 10) + '...',
        hasUserInfo: !!userInfo,
        hasEncryptedData: !!encryptedData,
        clientIp,
        requestId: req.requestId
      });

      // 调用微信认证服务
      const result = await wechatAuthService.login(
        code,
        userInfo,
        encryptedData,
        iv
      );

      if (result.success) {
        // 设置安全相关的HTTP头
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');

        res.json(createSuccessResponse(
          {
            user: result.user,
            tokens: result.tokens,
            sessionKey: result.sessionKey // 仅用于后续解密，不存储在客户端
          },
          result.user?.isNewUser ? '登录成功，欢迎新用户' : '登录成功'
        ));
      } else {
        // 根据错误类型返回不同的HTTP状态码
        let statusCode = 400;
        switch (result.error) {
          case 'WECHAT_CONFIG_MISSING':
          case 'INVALID_CODE':
          case 'INVALID_USER_DATA':
            statusCode = 400;
            break;
          case 'RATE_LIMIT_EXCEEDED':
            statusCode = 429;
            break;
          case 'USER_INACTIVE':
            statusCode = 403;
            break;
          default:
            statusCode = 500;
        }

        res.status(statusCode).json(createErrorResponse(
          result.error || 'LOGIN_FAILED',
          result.message || '登录失败',
          undefined,
          { requestId: req.requestId }
        ));
      }
    } catch (error) {
      logger.error('微信登录处理失败', {
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '登录处理失败',
        error instanceof Error ? error.message : '服务器内部错误',
        { requestId: req.requestId }
      ));
    }
  })
);

// 登出接口
router.post('/logout',
  asyncHandler(async (req: Request, res: Response) => {
    res.json(createSuccessResponse(
      { message: '登出成功' },
      '已成功登出'
    ));
  })
);

// Token刷新接口
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('刷新Token不能为空')
      .isJWT()
      .withMessage('刷新Token格式无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      logger.info('收到Token刷新请求', {
        requestId: req.requestId
      });

      // 调用微信认证服务刷新Token
      const result = await wechatAuthService.refreshToken(refreshToken);

      if (result.success) {
        // 设置安全相关的HTTP头
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');

        res.json(createSuccessResponse(
          {
            user: result.user,
            tokens: result.tokens
          },
          'Token刷新成功'
        ));
      } else {
        let statusCode = 401;
        switch (result.error) {
          case 'INVALID_REFRESH_TOKEN':
          case 'USER_NOT_FOUND':
            statusCode = 401;
            break;
          case 'USER_INACTIVE':
            statusCode = 403;
            break;
          default:
            statusCode = 500;
        }

        res.status(statusCode).json(createErrorResponse(
          result.error || 'REFRESH_FAILED',
          result.message || 'Token刷新失败',
          undefined,
          { requestId: req.requestId }
        ));
      }
    } catch (error) {
      logger.error('Token刷新失败', {
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
        requestId: req.requestId
      });

      res.status(401).json(createErrorResponse(
        'UNAUTHORIZED',
        'Token刷新失败',
        error instanceof Error ? error.message : '认证失败',
        { requestId: req.requestId }
      ));
    }
  })
);

export default router;