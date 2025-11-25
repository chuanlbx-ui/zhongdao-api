import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { smsService } from '../../../shared/services/sms';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// 发送短信验证码
router.post('/send-code',
  authenticate,
  [
    body('phone')
      .notEmpty()
      .withMessage('手机号不能为空')
      .isMobilePhone('zh-CN')
      .withMessage('手机号格式不正确'),
    body('type')
      .optional()
      .isIn(['bind', 'unbind', 'login', 'transfer'])
      .withMessage('验证码类型不正确')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { phone, type = 'bind' } = req.body;
    const userId = req.user!.id;

    try {
      // 检查用户当前手机号状态
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true }
      });

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 业务逻辑验证
      if (type === 'bind') {
        // 绑定手机号：检查当前是否已绑定
        if (currentUser.phone) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PHONE_ALREADY_BOUND',
              message: '您已绑定手机号，如需更换请先解绑',
              timestamp: new Date().toISOString()
            }
          });
        }
      } else if (type === 'unbind') {
        // 解绑手机号：检查是否绑定了该手机号
        if (currentUser.phone !== phone) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PHONE_NOT_BOUND',
              message: '该手机号未绑定到您的账户',
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      // 发送验证码
      await smsService.sendVerificationCode(phone, type);

      logger.info('短信验证码发送成功', {
        userId,
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        type,
        requestId: req.requestId
      });

      res.json(createSuccessResponse({
        message: '验证码已发送，请注意查收',
        expiresIn: 300 // 5分钟
      }, '验证码发送成功'));

    } catch (error) {
      logger.error('发送短信验证码失败', {
        userId,
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        type,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'SMS_SEND_FAILED',
          message: error instanceof Error ? error.message : '发送验证码失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 验证短信验证码并绑定/解绑手机号
router.post('/verify-and-bind',
  authenticate,
  [
    body('phone')
      .notEmpty()
      .withMessage('手机号不能为空')
      .isMobilePhone('zh-CN')
      .withMessage('手机号格式不正确'),
    body('code')
      .notEmpty()
      .withMessage('验证码不能为空')
      .isLength({ min: 6, max: 6 })
      .withMessage('验证码必须是6位数字')
      .isNumeric()
      .withMessage('验证码必须是数字'),
    body('type')
      .isIn(['bind', 'unbind'])
      .withMessage('操作类型必须是bind或unbind')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { phone, code, type } = req.body;
    const userId = req.user!.id;

    try {
      // 验证短信验证码
      const isValidCode = await smsService.verifyCode(phone, code, type);
      if (!isValidCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: '验证码错误或已过期',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 获取用户当前信息
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true }
      });

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在',
            timestamp: new Date().toISOString()
          }
        });
      }

      let updatedUser;

      if (type === 'bind') {
        // 绑定手机号
        if (currentUser.phone) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PHONE_ALREADY_BOUND',
              message: '您已绑定手机号',
              timestamp: new Date().toISOString()
            }
          });
        }

        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { phone },
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

        logger.info('用户绑定手机号成功', {
          userId,
          phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
          requestId: req.requestId
        });

      } else if (type === 'unbind') {
        // 解绑手机号
        if (currentUser.phone !== phone) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PHONE_NOT_MATCH',
              message: '手机号不匹配',
              timestamp: new Date().toISOString()
            }
          });
        }

        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { phone: null },
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

        logger.info('用户解绑手机号成功', {
          userId,
          phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
          requestId: req.requestId
        });
      }

      res.json(createSuccessResponse({
        user: {
          ...updatedUser,
          level: updatedUser.level.toLowerCase(),
          status: updatedUser.status.toLowerCase()
        }
      }, `${type === 'bind' ? '绑定' : '解绑'}手机号成功`));

    } catch (error) {
      logger.error('验证并绑定手机号失败', {
        userId,
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        type,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : '验证失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 检查手机号是否已被绑定
router.get('/check-phone/:phone',
  asyncHandler(async (req, res) => {
    const { phone } = req.params;

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PHONE_FORMAT',
          message: '手机号格式不正确',
          timestamp: new Date().toISOString()
        }
      });
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { phone },
        select: {
          id: true,
          nickname: true,
          createdAt: true
        }
      });

      const isBound = !!existingUser;

      res.json(createSuccessResponse({
        isBound,
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        boundAt: existingUser?.createdAt
      }, isBound ? '手机号已被绑定' : '手机号未被绑定'));

    } catch (error) {
      logger.error('检查手机号绑定状态失败', {
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'CHECK_FAILED',
          message: '检查手机号状态失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

export default router;