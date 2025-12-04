import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { generateToken, verifyToken } from '../../../shared/middleware/auth';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { logger } from '../../../shared/utils/logger';
import userNumberService from '../../../modules/user/user-number.service';

const router = Router();

// 微信小程序登录
router.post('/wechat-login',
  [
    body('code')
      .notEmpty()
      .withMessage('微信授权码不能为空'),
    body('nickname')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('昵称长度必须在2-50字符之间'),
    body('avatarUrl')
      .optional()
      .isURL()
      .withMessage('头像URL格式不正确')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { code, nickname, avatarUrl } = req.body;

    // TODO: 实现微信登录逻辑
    // 1. 使用code调用微信API获取access_token和openid
    // 2. 使用openid查询或创建用户
    // 3. 生成JWT token

    // 临时实现：使用code作为openid的模拟
    const mockOpenid = `mock_openid_${code}`;

    // 查找或创建用户
    let user = await prisma.users.findUnique({
      where: { openid: mockOpenid }
    });

    if (!user) {
      // 生成用户编号
      const userNumber = await userNumberService.generateUserNumber();
      
      user = await prisma.users.create({
        data: {
          openid: mockOpenid,
          nickname,
          avatarUrl,
          userNumber,
          level: 'NORMAL',
          status: 'ACTIVE'
        }
      });
    } else if (nickname || avatarUrl) {
      // 更新用户信息
      user = await prisma.users.update({
        where: { id: user.id },
        data: {
          ...(nickname && { nickname }),
          ...(avatarUrl && { avatarUrl })
        }
      });
    }

    // 生成JWT token
    const token = generateToken({
      sub: user.id,
      scope: ['active', 'user'],
      role: 'USER',
      level: user.level.toLowerCase()
    });

    logger.info('用户登录成功', {
      userId: user.id,
      openid: user.openid,
      requestId: req.requestId
    });

    res.json(createSuccessResponse({
      token,
      user: {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        level: user.level.toLowerCase(),
        status: user.status.toLowerCase()
      }
    }, '登录成功'));
  })
);

// 刷新Token
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '缺少刷新Token',
          timestamp: new Date().toISOString()
        }
      });
    }

    try {
      // 验证刷新Token
      const decoded = verifyToken(refreshToken);

      // 检查用户是否仍然活跃
      if (decoded.scope && !decoded.scope.includes('active')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_INACTIVE',
            message: '用户状态不活跃',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 生成新的访问Token
      const newToken = generateToken({
        sub: decoded.sub,
        scope: decoded.scope,
        role: decoded.role,
        level: decoded.level
      });

      logger.info('Token刷新成功', {
        userId: decoded.sub,
        requestId: req.requestId
      });

      res.json(createSuccessResponse({
        token: newToken
      }, 'Token刷新成功'));

    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: '刷新Token无效或已过期',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 登出
router.post('/logout',
  asyncHandler(async (req, res) => {
    // TODO: 实现登出逻辑
    // 1. 将token加入黑名单
    // 2. 清除相关缓存

    logger.info('用户登出', {
      requestId: req.requestId
    });

    res.json(createSuccessResponse(null, '登出成功'));
  })
);

export default router;