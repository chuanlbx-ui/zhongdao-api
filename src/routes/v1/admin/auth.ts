import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { ErrorCode } from '../../../shared/errors';
import { prisma } from '../../../shared/database/client';
import { logger } from '../../../shared/utils/logger';
import { generateToken, generateRefreshToken } from '../../../shared/middleware/auth';
import { admins_role, admins_status } from '@prisma/client';

const router = Router();

// 登录验证规则
const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度必须在3-50字符之间'),
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 6 })
    .withMessage('密码长度不能少于6位')
];

// 管理员登录接口
router.post('/login',
  loginValidation,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createErrorResponse(
          'VALIDATION_ERROR',
          '请求参数验证失败',
          errors.array()
        ));
      }

      const { username, password } = req.body;

      // DEBUG: 检查 prisma 对象
// [DEBUG REMOVED]       console.log('DEBUG: prisma =', prisma);
// [DEBUG REMOVED]       console.log('DEBUG: prisma.admin =', prisma?.admin);
// [DEBUG REMOVED]       console.log('DEBUG: typeof prisma =', typeof prisma);

      // 查找管理员
      const admin = await prisma.admins.findUnique({
        where: { username }
      });

      if (!admin) {
        logger.warn('管理员登录失败 - 用户不存在', { username, ip: req.ip });
        return res.status(401).json(createErrorResponse(
          'INVALID_CREDENTIALS',
          '用户名或密码错误'
        ));
      }

      // 检查账户状态
      if (admin.status === admins_status.LOCKED) {
        if (admin.lockedUntil && admin.lockedUntil > new Date()) {
          logger.warn('管理员登录失败 - 账户已锁定', {
            username,
            lockedUntil: admin.lockedUntil,
            ip: req.ip
          });
          return res.status(423).json(createErrorResponse(
            'ACCOUNT_LOCKED',
            '账户已被锁定，请稍后再试',
            { lockedUntil: admin.lockedUntil }
          ));
        } else {
          // 锁定时间已过，解锁账户
          await prisma.admins.update({
            where: { id: admin.id },
            data: {
              status: admins_status.ACTIVE,
              loginAttempts: 0,
              lockedUntil: null
            }
          });
        }
      }

      if (admin.status !== admins_status.ACTIVE) {
        logger.warn('管理员登录失败 - 账户状态异常', {
          username,
          status: admin.status,
          ip: req.ip
        });
        return res.status(401).json(createErrorResponse(
          'ACCOUNT_INACTIVE',
          '账户状态异常，请联系管理员'
        ));
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        // 增加登录失败次数
        const loginAttempts = admin.loginAttempts + 1;
        const updateData: any = { loginAttempts };

        // 如果失败次数达到5次，锁定账户30分钟
        if (loginAttempts >= 5) {
          updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
          updateData.status = admins_status.LOCKED;

          logger.warn('管理员账户被锁定', {
            username,
            loginAttempts,
            ip: req.ip
          });
        }

        await prisma.admins.update({
          where: { id: admin.id },
          data: updateData
        });

        logger.warn('管理员登录失败 - 密码错误', {
          username,
          loginAttempts,
          ip: req.ip
        });
        return res.status(401).json(createErrorResponse(
          'INVALID_CREDENTIALS',
          '用户名或密码错误'
        ));
      }

      // 登录成功，重置失败次数
      await prisma.admins.update({
        where: { id: admin.id },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: req.ip
        }
      });

      // 生成JWT Token
      const tokenPayload = {
        sub: admin.id,
        scope: ['admin', 'active'],
        role: admin.role.toLowerCase(),
        level: 'admin'
      };

      const accessToken = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      logger.info('管理员登录成功', {
        adminId: admin.id,
        username: admin.username,
        role: admin.role,
        ip: req.ip
      });

      res.json(createSuccessResponse({
        admin: {
          id: admin.id,
          username: admin.username,
          realName: admin.realName,
          email: admin.email,
          phone: admin.phone,
          avatar: admin.avatar,
          role: admin.role,
          permissions: admin.permissions,
          lastLoginAt: admin.lastLoginAt
        },
        tokens: {
          accessToken,
          refreshToken,
          tokenType: 'Bearer'
        }
      }, '登录成功'));

    } catch (error) {
      logger.error('管理员登录失败', {
        error: error instanceof Error ? error.message : '未知错误',
        username: req.body.username,
        ip: req.ip
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '登录失败，请稍后重试',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

// 获取当前管理员信息
router.get('/profile',
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json(createErrorResponse(
          'UNAUTHORIZED',
          '未提供认证令牌'
        ));
      }

      // 这里简化处理，实际应该从JWT token中解析管理员ID
      // 为了演示，我们暂时通过其他方式获取管理员信息
      res.json(createSuccessResponse({
        message: '管理员信息获取功能待完善'
      }, '获取成功'));

    } catch (error) {
      logger.error('获取管理员信息失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取信息失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

// 管理员登出
router.post('/logout',
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      // 这里可以添加token黑名单逻辑
      logger.info('管理员登出', { ip: req.ip });

      res.json(createSuccessResponse(null, '登出成功'));
    } catch (error) {
      logger.error('管理员登出失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '登出失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;