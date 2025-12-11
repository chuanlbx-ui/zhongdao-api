import { Router, Request, Response } from 'express';
import { PrismaClient, users_level, users_status } from '@prisma/client';
import { authenticate, requirePermission } from '../../../shared/middleware/auth';
import { requireAnyPermission } from '../../../shared/services/admin/permission.service';
import { AuditService, AuditLogType, AuditLogLevel } from '../../../shared/services/admin/audit.service';
import { logger } from '../../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { body, query, param, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// 所有用户管理路由都需要认证
router.use(authenticate);

/**
 * 获取用户列表
 * GET /api/v1/admin/users-manage
 */
router.get('/',
  requireAnyPermission([
    'user:view',
    'user:edit'
  ]),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('level').optional().isIn(Object.values(users_level)),
    query('status').optional().isIn(Object.values(users_status)),
    query('keyword').optional().isString(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('sortBy').optional().isIn(['createdAt', 'totalSales', 'totalBottles', 'directCount', 'teamCount']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('hasShop').optional().isBoolean().toBoolean(),
    query('teamId').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const {
        page = 1,
        limit = 20,
        level,
        status,
        keyword,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        hasShop,
        teamId
      } = req.query as any;

      // 构建查询条件
      const where: any = {};

      if (level) where.level = level;
      if (status) where.status = status;
      if (teamId) where.teamPath = { contains: teamId };

      if (keyword) {
        where.OR = [
          { nickname: { contains: keyword } },
          { phone: { contains: keyword } },
          { userNumber: { contains: keyword } },
          { referralCode: { contains: keyword } }
        ];
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      if (hasShop !== undefined) {
        where.shops = hasShop ? { some: {} } : { none: {} };
      }

      // 查询用户列表
      const [total, users] = await Promise.all([
        prisma.users.count({ where }),
        prisma.users.findMany({
          where,
          select: {
            id: true,
            openid: true,
            nickname: true,
            avatarUrl: true,
            phone: true,
            userNumber: true,
            level: true,
            status: true,
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
            pointsBalance: true,
            pointsFrozen: true,
            createdAt: true,
            lastLoginAt: true,
            referralCode: true,
            parent: {
              select: {
                id: true,
                nickname: true,
                userNumber: true,
              }
            },
            shops: {
              select: {
                id: true,
                shopType: true,
                shopLevel: true,
                status: true,
              }
            },
            _count: {
              select: {
                orders_orders_buyerIdTousers: true,
                users: true,
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        })
      ]);

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'user',
        action: 'view_users',
        description: `查看用户列表，筛选条件：${JSON.stringify({
          level, status, keyword, hasShop, teamId
        })}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { page, limit, total, filters: { level, status, keyword, hasShop, teamId } }
      });

      res.json(
        createSuccessResponse({
          users,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        })
      );
    } catch (error) {
      logger.error('获取用户列表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取用户列表失败'
        )
      );
    }
  }
);

/**
 * 获取用户详情
 * GET /api/v1/admin/users-manage/:userId
 */
router.get('/:userId',
  requirePermission('user:view'),
  [
    param('userId').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { userId } = req.params;

      // 获取用户详细信息
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          openid: true,
          nickname: true,
          avatarUrl: true,
          phone: true,
          userNumber: true,
          level: true,
          status: true,
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
          pointsBalance: true,
          pointsFrozen: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          referralCode: true,
          parent: {
            select: {
              id: true,
              nickname: true,
              userNumber: true,
              phone: true,
            }
          },
          shops: {
            select: {
              id: true,
              shopType: true,
              shopLevel: true,
              shopName: true,
              status: true,
              totalSales: true,
              totalOrders: true,
              createdAt: true,
            }
          },
          teamMembers: {
            select: {
              id: true,
              role: true,
              level: true,
              position: true,
              joinDate: true,
              promotedDate: true,
              lastActiveDate: true,
              teams: {
                select: {
                  id: true,
                  name: true,
                  leaderId: true,
                  totalMembers: true,
                  status: true,
                }
              }
            }
          },
          _count: {
            select: {
              orders_orders_buyerIdTousers: true,
              users: true,
              pointsTransactions_toUserIdTousers: true,
              pointsTransactions_pointsTransactions_fromUserIdTousers: true,
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '用户不存在'
          )
        );
      }

      // 获取用户最近的积分流水
      const [recentTransactions, performanceMetrics] = await Promise.all([
        prisma.pointsTransactions.findMany({
          where: {
            OR: [
              { fromUserId: userId },
              { toUserId: userId }
            ]
          },
          select: {
            id: true,
            transactionNo: true,
            type: true,
            amount: true,
            status: true,
            balanceBefore: true,
            balanceAfter: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.performanceMetrics.findMany({
          where: { userId },
          orderBy: { period: 'desc' },
          take: 12,
        })
      ]);

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'user',
        action: 'view_user_detail',
        targetId: userId,
        targetType: 'user',
        description: `查看用户详情：${user.nickname || user.userNumber}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          user,
          recentTransactions,
          performanceMetrics,
        })
      );
    } catch (error) {
      logger.error('获取用户详情失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.params.userId,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取用户详情失败'
        )
      );
    }
  }
);

/**
 * 更新用户信息
 * PUT /api/v1/admin/users-manage/:userId
 */
router.put('/:userId',
  requirePermission('user:edit'),
  [
    param('userId').isString().notEmpty(),
    body('nickname').optional().isString().isLength({ min: 1, max: 50 }),
    body('phone').optional().isMobilePhone('zh-CN'),
    body('level').optional().isIn(Object.values(users_level)),
    body('status').optional().isIn(Object.values(users_status)),
    body('cloudShopLevel').optional().isInt({ min: 1, max: 5 }),
    body('hasWutongShop').optional().isBoolean(),
    body('pointsBalance').optional().isFloat({ min: 0 }),
    body('remark').optional().isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { userId } = req.params;
      const updateData = req.body;

      // 检查用户是否存在
      const existingUser = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, nickname: true, userNumber: true, level: true, status: true }
      });

      if (!existingUser) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '用户不存在'
          )
        );
      }

      // 检查手机号是否已存在
      if (updateData.phone) {
        const phoneUser = await prisma.users.findFirst({
          where: {
            phone: updateData.phone,
            id: { not: userId }
          }
        });

        if (phoneUser) {
          return res.status(400).json(
            createErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              '手机号已被其他用户使用'
            )
          );
        }
      }

      // 记录变更前的数据
      const changes: any = {};
      if (updateData.level !== undefined && updateData.level !== existingUser.level) {
        changes.level = { from: existingUser.level, to: updateData.level };
      }
      if (updateData.status !== undefined && updateData.status !== existingUser.status) {
        changes.status = { from: existingUser.status, to: updateData.status };
      }

      // 更新用户信息
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          nickname: true,
          userNumber: true,
          phone: true,
          level: true,
          status: true,
          cloudShopLevel: true,
          hasWutongShop: true,
          pointsBalance: true,
          updatedAt: true,
        }
      });

      // 如果级别发生变更，创建升级记录
      if (changes.level) {
        await prisma.levelUpgradeRecords.create({
          data: {
            id: `upgrade_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            userId,
            previousLevel: changes.level.from,
            newLevel: changes.level.to,
            upgradeType: 'MANUAL',
            approvedById: req.user!.id,
            remarks: updateData.remark || `管理员手动调整用户级别`,
          }
        });
      }

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.UPDATE,
        level: changes.level || changes.status ? AuditLogLevel.WARNING : AuditLogLevel.INFO,
        module: 'user',
        action: 'update_user',
        targetId: userId,
        targetType: 'user',
        description: `更新用户信息：${existingUser.nickname || existingUser.userNumber}`,
        details: { changes, updateData },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          user: updatedUser,
          message: '用户信息更新成功'
        })
      );
    } catch (error) {
      logger.error('更新用户信息失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.params.userId,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '更新用户信息失败'
        )
      );
    }
  }
);

/**
 * 停用/启用用户
 * POST /api/v1/admin/users-manage/:userId/toggle-status
 */
router.post('/:userId/toggle-status',
  requirePermission('user:suspend'),
  [
    param('userId').isString().notEmpty(),
    body('status').isIn(Object.values(users_status)),
    body('reason').isString().isLength({ min: 1, max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { userId } = req.params;
      const { status, reason } = req.body;

      // 检查用户是否存在
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, nickname: true, userNumber: true, status: true }
      });

      if (!user) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '用户不存在'
          )
        );
      }

      // 更新用户状态
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: {
          status,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          nickname: true,
          userNumber: true,
          status: true,
          updatedAt: true,
        }
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: status === 'SUSPENDED' ? AuditLogType.SUSPEND : AuditLogType.ACTIVATE,
        level: AuditLogLevel.WARNING,
        module: 'user',
        action: status === 'SUSPENDED' ? 'suspend_user' : 'activate_user',
        targetId: userId,
        targetType: 'user',
        description: `${status === 'SUSPENDED' ? '停用' : '启用'}用户：${user.nickname || user.userNumber}`,
        details: { reason, previousStatus: user.status, newStatus: status },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          user: updatedUser,
          message: `用户已${status === 'SUSPENDED' ? '停用' : '启用'}`
        })
      );
    } catch (error) {
      logger.error('切换用户状态失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.params.userId,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '切换用户状态失败'
        )
      );
    }
  }
);

/**
 * 重置用户密码
 * POST /api/v1/admin/users-manage/:userId/reset-password
 */
router.post('/:userId/reset-password',
  requirePermission('user:edit'),
  [
    param('userId').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 6, max: 50 }),
    body('reason').isString().isLength({ min: 1, max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { userId } = req.params;
      const { newPassword, reason } = req.body;

      // 检查用户是否存在
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, nickname: true, userNumber: true, password: true }
      });

      if (!user) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '用户不存在'
          )
        );
      }

      // TODO: 使用安全的密码哈希算法
      const hashedPassword = newPassword; // 实际应该使用bcrypt等

      // 更新密码
      await prisma.users.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        }
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.RESET_PASSWORD,
        level: AuditLogLevel.CRITICAL,
        module: 'user',
        action: 'reset_user_password',
        targetId: userId,
        targetType: 'user',
        description: `重置用户密码：${user.nickname || user.userNumber}`,
        details: { reason },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          message: '密码重置成功'
        })
      );
    } catch (error) {
      logger.error('重置用户密码失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.params.userId,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '重置用户密码失败'
        )
      );
    }
  }
);

/**
 * 获取用户团队结构
 * GET /api/v1/admin/users-manage/:userId/team
 */
router.get('/:userId/team',
  requirePermission('team:view'),
  [
    param('userId').isString().notEmpty(),
    query('maxDepth').optional().isInt({ min: 1, max: 10 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { userId } = req.params;
      const { maxDepth = 5 } = req.query as any;

      // 检查用户是否存在
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nickname: true,
          userNumber: true,
          teamPath: true,
          directCount: true,
          teamCount: true,
        }
      });

      if (!user) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '用户不存在'
          )
        );
      }

      // 获取团队结构
      const teamMembers = await prisma.users.findMany({
        where: {
          teamPath: {
            startsWith: user.teamPath
          },
          id: {
            not: userId
          }
        },
        select: {
          id: true,
          nickname: true,
          userNumber: true,
          phone: true,
          level: true,
          status: true,
          parentId: true,
          teamPath: true,
          teamLevel: true,
          totalSales: true,
          totalBottles: true,
          directCount: true,
          teamCount: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: [
          { teamLevel: 'asc' },
          { createdAt: 'desc' }
        ]
      });

      // 构建层级结构
      const teamTree = buildTeamTree(user, teamMembers, maxDepth);

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'team',
        action: 'view_user_team',
        targetId: userId,
        targetType: 'user',
        description: `查看用户团队结构：${user.nickname || user.userNumber}`,
        details: { teamSize: teamMembers.length, maxDepth },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          user,
          teamTree,
          statistics: {
            totalMembers: teamMembers.length,
            directMembers: teamMembers.filter(m => m.parentId === userId).length,
            totalSales: teamMembers.reduce((sum, m) => sum + m.totalSales, 0),
            totalBottles: teamMembers.reduce((sum, m) => sum + m.totalBottles, 0),
          }
        })
      );
    } catch (error) {
      logger.error('获取用户团队结构失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.params.userId,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取用户团队结构失败'
        )
      );
    }
  }
);

/**
 * 获取用户积分流水
 * GET /api/v1/admin/users-manage/:userId/points-transactions
 */
router.get('/:userId/points-transactions',
  requirePermission('user:view_financial'),
  [
    param('userId').isString().notEmpty(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('type').optional().isString(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { userId } = req.params;
      const {
        page = 1,
        limit = 20,
        type,
        startDate,
        endDate
      } = req.query as any;

      // 检查用户是否存在
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nickname: true,
          userNumber: true,
          pointsBalance: true,
          pointsFrozen: true,
        }
      });

      if (!user) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '用户不存在'
          )
        );
      }

      // 构建查询条件
      const where: any = {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      };

      if (type) where.type = type;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      // 查询积分流水
      const [total, transactions] = await Promise.all([
        prisma.pointsTransactions.count({ where }),
        prisma.pointsTransactions.findMany({
          where,
          select: {
            id: true,
            transactionNo: true,
            fromUserId: true,
            toUserId: true,
            amount: true,
            type: true,
            relatedOrderId: true,
            description: true,
            status: true,
            balanceBefore: true,
            balanceAfter: true,
            metadata: true,
            createdAt: true,
            completedAt: true,
            users_pointsTransactions_fromUserIdTousers: {
              select: {
                nickname: true,
                userNumber: true,
              }
            },
            users_pointsTransactions_toUserIdTousers: {
              select: {
                nickname: true,
                userNumber: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        })
      ]);

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'user',
        action: 'view_user_points_transactions',
        targetId: userId,
        targetType: 'user',
        description: `查看用户积分流水：${user.nickname || user.userNumber}`,
        details: { page, limit, total, filters: { type, startDate, endDate } },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          user,
          transactions,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        })
      );
    } catch (error) {
      logger.error('获取用户积分流水失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.params.userId,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取用户积分流水失败'
        )
      );
    }
  }
);

/**
 * 导出用户数据
 * GET /api/v1/admin/users-manage/export
 */
router.get('/export',
  requirePermission('analytics:export'),
  [
    query('format').optional().isIn(['csv', 'excel']),
    query('level').optional().isIn(Object.values(users_level)),
    query('status').optional().isIn(Object.values(users_status)),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response) => {
    try {
      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.EXPORT,
        level: AuditLogLevel.WARNING,
        module: 'user',
        action: 'export_users',
        description: '导出用户数据',
        details: { query: req.query },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // TODO: 实现导出功能
      res.json(
        createErrorResponse(
          ErrorCode.NOT_IMPLEMENTED,
          '导出功能待实现'
        )
      );
    } catch (error) {
      logger.error('导出用户数据失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '导出用户数据失败'
        )
      );
    }
  }
);

/**
 * 构建团队树结构
 */
function buildTeamTree(root: any, members: any[], maxDepth: number, currentDepth = 0): any {
  if (currentDepth >= maxDepth) {
    return null;
  }

  const directMembers = members.filter(m => m.parentId === root.id);

  const node = {
    ...root,
    depth: currentDepth,
    children: directMembers.map(member =>
      buildTeamTree(member, members, maxDepth, currentDepth + 1)
    ).filter(child => child !== null)
  };

  return node;
}

export default router;