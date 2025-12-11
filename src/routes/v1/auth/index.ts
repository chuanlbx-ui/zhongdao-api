import { Router } from 'express';
import { AuthService } from '../../../modules/auth';
import { body } from 'express-validator';
import { asyncHandler, ValidationError, AuthenticationError, NotFoundError } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { generateToken, verifyToken } from '../../../shared/middleware/auth';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { logger } from '../../../shared/utils/logger';
import userNumberService from '../../../modules/user/user-number.service';
import wechatRoutes from './wechat';

const authService = new AuthService();
const router = Router();
const { createHash } = require('crypto');

// 使用微信专用接口路由
router.use('/wechat', wechatRoutes);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: 用户名密码登录
 *     description: 使用用户名和密码进行登录
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名（手机号或用户编号）
 *                 example: "13800138000"
 *               password:
 *                 type: string
 *                 description: 密码
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token:
 *                           type: string
 *                           description: JWT访问令牌
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                         refreshToken:
 *                           type: string
 *                           description: JWT刷新令牌
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                         user:
 *                           $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 用户名或密码错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 用户名密码登录
router.post('/login',
  [
    body('username')
      .notEmpty()
      .withMessage('用户名不能为空'),
    body('password')
      .notEmpty()
      .withMessage('密码不能为空')
      .isLength({ min: 6 })
      .withMessage('密码长度不能少于6位')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // 尝试通过手机号或用户编号查找用户
    let user = await prisma.users.findFirst({
      where: {
        OR: [
          { phone: username },
          { userNumber: username }
        ]
      }
    });

    if (!user) {
      throw new AuthenticationError('用户不存在');
    }

    // 验证密码
    const hashedPassword = createHash('sha256').update(password).digest('hex');
    if (user.password !== hashedPassword) {
      throw new AuthenticationError('密码错误');
    }

    // 检查用户状态
    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('用户账户已被禁用');
    }

    // 生成JWT token和refresh token
    const token = generateToken({
      sub: user.id,
      scope: ['active', 'user'],
      role: user.level === 'ADMIN' ? 'ADMIN' : 'USER',
      level: user.level
    });

    // 生成refresh token
    const refreshTokenValue = generateToken({
      sub: user.id,
      scope: ['active', 'user', 'refresh'],
      role: user.level === 'ADMIN' ? 'ADMIN' : 'USER',
      level: user.level
    });

    // 更新最后登录时间
    await prisma.users.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip
      }
    });

    logger.info('用户登录成功', {
      userId: user.id,
      username: username,
      requestId: req.requestId
    });

    res.json(createSuccessResponse({
      token,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        phone: user.phone,
        userNumber: user.userNumber,
        nickname: user.nickname,
        avatarUrl: null,
        level: user.level,
        status: user.status
      }
    }, '登录成功', undefined, req.requestId));
  })
);

/**
 * @swagger
 * /api/v1/auth/wechat-login:
 *   post:
 *     summary: 微信小程序登录
 *     description: 使用微信小程序授权码进行登录，自动创建或更新用户信息
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: 微信小程序授权码
 *                 example: "071XPGGa1l5yRp2KlSGa1mYvD83XPGGk"
 *                 minLength: 1
 *               nickname:
 *                 type: string
 *                 description: 用户昵称
 *                 example: "张三"
 *                 minLength: 2
 *                 maxLength: 50
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 description: 用户头像URL
 *                 example: "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKicT8dLcSswnYfJYrdUCgBibibUoZ3TrIu5wsNuuibvuKG5t6sLzT2gSgSfJpGyAics9QV9e3aKh8Cicw/132"
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token:
 *                           type: string
 *                           description: JWT访问令牌
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                         user:
 *                           $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

    // 生成JWT token - 修复1：JWT Token一致性保证，保持原始级别格式
    const token = generateToken({
      sub: user.id,
      scope: ['active', 'user'],
      role: 'USER',
      level: user.level // 保持原始格式（如DIRECTOR），不转换为小写
    });

    logger.info('用户登录成功', {
      userId: user.id,
      openid: user.openid,
      requestId: req.requestId
    });

    // 生成refresh token
    const refreshTokenValue = generateToken({
      sub: user.id,
      scope: ['active', 'user', 'refresh'],
      role: 'USER',
      level: user.level
    });

    res.json(createSuccessResponse({
      token,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatarUrl: null,
        level: user.level, // 保持原始格式，确保Token一致性
        status: user.status
      }
    }, '登录成功'));
  })
);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: 刷新访问令牌
 *     description: 使用刷新令牌获取新的访问令牌
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: 刷新令牌
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: 刷新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token:
 *                           type: string
 *                           description: 新的JWT访问令牌
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ErrorResponse'
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                           example: "VALIDATION_ERROR"
 *                         message:
 *                           type: string
 *                           example: "缺少刷新Token"
 *       401:
 *         description: 令牌无效或已过期
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ErrorResponse'
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                           enum: ["USER_INACTIVE", "INVALID_REFRESH_TOKEN"]
 *                         message:
 *                           type: string
 *                           example: "刷新Token无效或已过期"
 */
// 刷新Token
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('缺少刷新Token');
    }

    // 验证刷新Token
    const decoded = verifyToken(refreshToken);

    // 检查用户是否仍然活跃
    if (decoded.scope && !decoded.scope.includes('active')) {
      throw new AuthenticationError('用户状态不活跃');
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
    }, 'Token刷新成功', undefined, req.requestId));
  })
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: 用户登出
 *     description: 用户登出系统，将令牌加入黑名单
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: 登出成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
// 登出
router.post('/logout',
  asyncHandler(async (req, res) => {
    // TODO: 实现登出逻辑
    // 1. 将token加入黑名单
    // 2. 清除相关缓存

    logger.info('用户登出', {
      requestId: req.requestId
    });

    res.json(createSuccessResponse(null, '登出成功', undefined, req.requestId));
  })
);

export default router;