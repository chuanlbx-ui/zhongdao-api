import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { wechatAuthService } from '../../../shared/services/wechat-auth';
import {
  wechatSecurityGuard,
  wechatRateLimit,
  validateWechatHeaders,
  validateWechatCode
} from '../../../shared/middleware/wechat-security';

const router = Router();

// 应用所有安全中间件
router.use(wechatSecurityGuard);
router.use(validateWechatHeaders);
router.use(wechatRateLimit(5, 15 * 60 * 1000)); // 5次/15分钟

/**
 * 微信小程序登录接口
 * POST /api/v1/auth/wechat-login
 *
 * 安全特性：
 * - IP限流
 * - User-Agent检查
 * - 请求头验证
 * - Code格式验证
 * - 防重放攻击
 */
router.post('/login',
  validateWechatCode,
  [
    body('userInfo')
      .optional()
      .isObject()
      .withMessage('用户信息必须是对象格式'),
    body('encryptedData')
      .optional()
      .isLength({ min: 1 })
      .withMessage('加密数据不能为空'),
    body('iv')
      .optional()
      .isLength({ min: 16, max: 24 })
      .withMessage('初始向量长度必须在16-24之间')
      .matches(/^[a-zA-Z0-9+/]+={0,2}$/)
      .withMessage('初始向量必须是有效的Base64编码'),
    body('signature')
      .optional()
      .isLength({ min: 40, max: 40 })
      .withMessage('签名必须是40位字符')
      .matches(/^[a-f0-9]{40}$/i)
      .withMessage('签名格式无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { code, userInfo, encryptedData, iv, signature, rawData } = req.body;

      // 额外的安全检查：检查时间差，防止重放攻击
      const requestTime = parseInt(req.get('X-Request-Time') || '0');
      const now = Date.now();
      if (requestTime && Math.abs(now - requestTime) > 30000) { // 30秒容差
        logger.warn('请求时间戳异常，可能是重放攻击', {
          requestTime,
          now,
          diff: now - requestTime,
          ip: req.clientIP,
          requestId: req.requestId
        });

        return res.status(400).json(createErrorResponse(
          'INVALID_TIMESTAMP',
          '请求时间戳无效',
          undefined,
          { requestId: req.requestId }
        ));
      }

      // 调用微信认证服务
      const result = await wechatAuthService.login(
        code,
        userInfo,
        encryptedData,
        iv
      );

      if (result.success) {
        // 设置安全响应头
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // 返回成功响应
        const responseData: any = {
          user: result.user,
          tokens: result.tokens
        };

        // 仅在开发环境返回sessionKey（用于调试）
        if (process.env.NODE_ENV === 'development' && result.sessionKey) {
          responseData.sessionKey = result.sessionKey;
        }

        res.json(createSuccessResponse(
          responseData,
          result.user?.isNewUser ? '登录成功，欢迎新用户' : '登录成功'
        ));

        // 记录登录成功事件
        logger.info('微信登录成功', {
          userId: result.user?.id,
          isNewUser: result.user?.isNewUser,
          ip: req.clientIP,
          requestId: req.requestId
        });
      } else {
        // 根据错误类型返回不同的HTTP状态码
        let statusCode = 400;
        let shouldLog = true;

        switch (result.error) {
          case 'WECHAT_CONFIG_MISSING':
          case 'INVALID_CODE':
          case 'INVALID_USER_DATA':
          case 'INVALID_CODE_FORMAT':
            statusCode = 400;
            break;
          case 'RATE_LIMIT_EXCEEDED':
            statusCode = 429;
            break;
          case 'USER_INACTIVE':
            statusCode = 403;
            break;
          case 'INTERNAL_ERROR':
            statusCode = 500;
            break;
          default:
            statusCode = 400;
            shouldLog = false; // 某些错误不需要额外记录
        }

        if (shouldLog) {
          logger.warn('微信登录失败', {
            error: result.error,
            message: result.message,
            ip: req.clientIP,
            requestId: req.requestId
          });
        }

        res.status(statusCode).json(createErrorResponse(
          result.error || 'LOGIN_FAILED',
          result.message || '登录失败',
          undefined,
          { requestId: req.requestId }
        ));
      }
    } catch (error) {
      logger.error('微信登录处理异常', {
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.clientIP,
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

/**
 * 微信登录状态检查
 * GET /api/v1/auth/wechat-login/status
 * 检查微信认证服务是否正常
 */
router.get('/status',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const health = await wechatAuthService.checkHealth();

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json(createSuccessResponse(
        {
          service: 'wechat-auth',
          status: health.status,
          details: health.details,
          timestamp: new Date().toISOString()
        },
        health.message
      ));
    } catch (error) {
      logger.error('微信服务状态检查失败', {
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(503).json(createErrorResponse(
        'SERVICE_UNAVAILABLE',
        '微信认证服务不可用'
      ));
    }
  })
);

export default router;