import { Router, Request, Response } from 'express';
import { PrismaClient, commissionCalculations_status, paymentRefunds_status } from '@prisma/client';
import { authenticate, requirePermission } from '../../../shared/middleware/auth';
import { AuditService, AuditLogType, AuditLogLevel } from '../../../shared/services/admin/audit.service';
import { logger } from '../../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { body, query, param, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// 所有财务管理路由都需要认证
router.use(authenticate);

/**
 * 获取提现申请列表
 * GET /api/v1/admin/finance-manage/withdrawals
 */
router.get('/withdrawals',
  requirePermission('finance:withdraw'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED']),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('userId').optional().isString(),
    query('amountMin').optional().isFloat({ min: 0 }).toFloat(),
    query('amountMax').optional().isFloat({ min: 0 }).toFloat(),
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
        status,
        startDate,
        endDate,
        userId,
        amountMin,
        amountMax
      } = req.query as any;

      // 构建查询条件
      const where: any = {
        type: 'WITHDRAW'
      };

      if (status) where.status = status;
      if (userId) where.userId = userId;
      if (amountMin || amountMax) {
        where.amount = {};
        if (amountMin) where.amount.gte = amountMin;
        if (amountMax) where.amount.lte = amountMax;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      // 查询提现申请
      const [total, withdrawals] = await Promise.all([
        prisma.pointsTransactions.count({ where }),
        prisma.pointsTransactions.findMany({
          where,
          select: {
            id: true,
            transactionNo: true,
            userId: true,
            amount: true,
            status: true,
            description: true,
            balanceBefore: true,
            balanceAfter: true,
            metadata: true,
            createdAt: true,
            completedAt: true,
            users_pointsTransactions_toUserIdTousers: {
              select: {
                id: true,
                nickname: true,
                userNumber: true,
                phone: true,
                level: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        })
      ]);

      // 解析metadata获取额外信息
      const formattedWithdrawals = withdrawals.map(withdrawal => ({
        ...withdrawal,
        metadata: withdrawal.metadata ? JSON.parse(withdrawal.metadata as string) : null,
      }));

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'finance',
        action: 'view_withdrawals',
        description: '查看提现申请列表',
        details: { page, limit, total, filters: { status, startDate, endDate, userId } },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          withdrawals: formattedWithdrawals,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        })
      );
    } catch (error) {
      logger.error('获取提现申请列表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取提现申请列表失败'
        )
      );
    }
  }
);

/**
 * 审核提现申请
 * POST /api/v1/admin/finance-manage/withdrawals/:withdrawalId/approve
 */
router.post('/withdrawals/:withdrawalId/approve',
  requirePermission('finance:withdraw'),
  [
    param('withdrawalId').isString().notEmpty(),
    body('action').isIn(['approve', 'reject']),
    body('remark').optional().isString().isLength({ max: 500 }),
    body('rejectReason').if(body('action').equals('reject')).isString().isLength({ min: 1, max: 500 }),
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

      const { withdrawalId } = req.params;
      const { action, remark, rejectReason } = req.body;

      // 检查提现申请是否存在
      const withdrawal = await prisma.pointsTransactions.findUnique({
        where: { id: withdrawalId },
        include: {
          users_pointsTransactions_toUserIdTousers: {
            select: {
              id: true,
              nickname: true,
              userNumber: true,
              pointsBalance: true,
            }
          }
        }
      });

      if (!withdrawal) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '提现申请不存在'
          )
        );
      }

      if (withdrawal.status !== 'PENDING') {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '提现申请已被处理'
          )
        );
      }

      // 开始事务
      const result = await prisma.$transaction(async (tx) => {
        let updatedTransaction;

        if (action === 'approve') {
          // 批准提现
          updatedTransaction = await tx.pointsTransactions.update({
            where: { id: withdrawalId },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              description: withdrawal.description + ` - 已批准，操作员：${req.user!.nickname}`,
              metadata: {
                ...(withdrawal.metadata ? JSON.parse(withdrawal.metadata as string) : {}),
                approveBy: req.user!.id,
                approveAt: new Date().toISOString(),
                approveRemark: remark,
              }
            }
          });

          // TODO: 调用第三方支付接口进行实际转账
          // 这里应该调用银行或支付平台的API

        } else {
          // 拒绝提现，退还积分
          updatedTransaction = await tx.pointsTransactions.update({
            where: { id: withdrawalId },
            data: {
              status: 'CANCELLED',
              completedAt: new Date(),
              description: withdrawal.description + ` - 已拒绝，原因：${rejectReason}`,
              metadata: {
                ...(withdrawal.metadata ? JSON.parse(withdrawal.metadata as string) : {}),
                rejectBy: req.user!.id,
                rejectAt: new Date().toISOString(),
                rejectReason,
              }
            }
          });

          // 退还积分到用户账户
          await tx.users.update({
            where: { id: withdrawal.userId },
            data: {
              pointsBalance: {
                increment: withdrawal.amount
              },
              updatedAt: new Date(),
            }
          });

          // 创建退还记录
          await tx.pointsTransactions.create({
            data: {
              id: `refund_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              transactionNo: `RF${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
              fromUserId: 'system',
              toUserId: withdrawal.userId,
              amount: withdrawal.amount,
              type: 'REFUND',
              description: `提现申请拒绝，退还积分：${rejectReason}`,
              status: 'COMPLETED',
              balanceBefore: withdrawal.users_pointsTransactions_toUserIdTousers.pointsBalance,
              balanceAfter: withdrawal.users_pointsTransactions_toUserIdTousers.pointsBalance + withdrawal.amount,
              completedAt: new Date(),
              createdAt: new Date(),
            }
          });
        }

        return updatedTransaction;
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.APPROVE,
        level: AuditLogLevel.WARNING,
        module: 'finance',
        action: action === 'approve' ? 'approve_withdrawal' : 'reject_withdrawal',
        targetId: withdrawalId,
        targetType: 'withdrawal',
        description: `${action === 'approve' ? '批准' : '拒绝'}提现申请：${withdrawal.amount}积分`,
        details: {
          action,
          amount: withdrawal.amount,
          userId: withdrawal.userId,
          userNumber: withdrawal.users_pointsTransactions_toUserIdTousers.userNumber,
          remark,
          rejectReason
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          message: `提现申请已${action === 'approve' ? '批准' : '拒绝'}`,
          withdrawal: result
        })
      );
    } catch (error) {
      logger.error('审核提现申请失败', {
        error: error instanceof Error ? error.message : '未知错误',
        withdrawalId: req.params.withdrawalId,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '审核提现申请失败'
        )
      );
    }
  }
);

/**
 * 获取佣金结算列表
 * GET /api/v1/admin/finance-manage/commissions
 */
router.get('/commissions',
  requirePermission('finance:commission'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(Object.values(commissionCalculations_status)),
    query('period').optional().isString(),
    query('userId').optional().isString(),
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

      const {
        page = 1,
        limit = 20,
        status,
        period,
        userId,
        startDate,
        endDate
      } = req.query as any;

      // 构建查询条件
      const where: any = {};

      if (status) where.status = status;
      if (period) where.period = period;
      if (userId) where.userId = userId;

      if (startDate || endDate) {
        where.calculatedAt = {};
        if (startDate) where.calculatedAt.gte = startDate;
        if (endDate) where.calculatedAt.lte = endDate;
      }

      // 查询佣金结算
      const [total, commissions] = await Promise.all([
        prisma.commissionCalculations.count({ where }),
        prisma.commissionCalculations.findMany({
          where,
          select: {
            id: true,
            userId: true,
            period: true,
            totalCommission: true,
            personalCommission: true,
            teamCommission: true,
            referralCommission: true,
            bonusCommission: true,
            status: true,
            paidDate: true,
            calculatedAt: true,
            createdAt: true,
            users: {
              select: {
                id: true,
                nickname: true,
                userNumber: true,
                phone: true,
                level: true,
              }
            }
          },
          orderBy: { calculatedAt: 'desc' },
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
        module: 'finance',
        action: 'view_commissions',
        description: '查看佣金结算列表',
        details: { page, limit, total, filters: { status, period, userId } },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          commissions,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        })
      );
    } catch (error) {
      logger.error('获取佣金结算列表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取佣金结算列表失败'
        )
      );
    }
  }
);

/**
 * 批量支付佣金
 * POST /api/v1/admin/finance-manage/commissions/pay
 */
router.post('/commissions/pay',
  requirePermission('finance:commission'),
  [
    body('commissionIds').isArray({ min: 1 }),
    body('commissionIds.*').isString(),
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

      const { commissionIds, remark } = req.body;

      // 检查所有佣金结算是否存在且状态为CALCULATED
      const commissions = await prisma.commissionCalculations.findMany({
        where: {
          id: { in: commissionIds },
          status: 'CALCULATED'
        },
        include: {
          users: {
            select: {
              id: true,
              nickname: true,
              userNumber: true,
              pointsBalance: true,
            }
          }
        }
      });

      if (commissions.length !== commissionIds.length) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '部分佣金结算不存在或已被处理'
          )
        );
      }

      // 计算总金额
      const totalAmount = commissions.reduce((sum, c) => sum + c.totalCommission, 0);

      // 开始事务
      const result = await prisma.$transaction(async (tx) => {
        const updatedCommissions = [];

        for (const commission of commissions) {
          // 更新佣金结算状态
          const updated = await tx.commissionCalculations.update({
            where: { id: commission.id },
            data: {
              status: 'PAID',
              paidDate: new Date(),
              updatedAt: new Date(),
            }
          });

          // 给用户账户增加积分
          await tx.users.update({
            where: { id: commission.userId },
            data: {
              pointsBalance: {
                increment: commission.totalCommission
              },
              updatedAt: new Date(),
            }
          });

          // 创建佣金发放记录
          await tx.pointsTransactions.create({
            data: {
              id: `commission_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              transactionNo: `CM${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
              fromUserId: 'system',
              toUserId: commission.userId,
              amount: commission.totalCommission,
              type: 'COMMISSION',
              description: `佣金发放 - ${commission.period}${remark ? `，备注：${remark}` : ''}`,
              status: 'COMPLETED',
              balanceBefore: commission.users.pointsBalance,
              balanceAfter: commission.users.pointsBalance + commission.totalCommission,
              metadata: {
                commissionId: commission.id,
                period: commission.period,
                breakdown: {
                  personal: commission.personalCommission,
                  team: commission.teamCommission,
                  referral: commission.referralCommission,
                  bonus: commission.bonusCommission,
                },
                paidBy: req.user!.id,
                paidAt: new Date().toISOString(),
                remark,
              },
              completedAt: new Date(),
              createdAt: new Date(),
            }
          });

          updatedCommissions.push(updated);
        }

        return updatedCommissions;
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.BULK_OPERATION,
        level: AuditLogLevel.WARNING,
        module: 'finance',
        action: 'batch_pay_commissions',
        description: `批量支付佣金，共${result.length}笔，总金额${totalAmount}积分`,
        details: {
          commissionIds,
          count: result.length,
          totalAmount,
          remark
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          message: '佣金批量支付成功',
          commissions: result,
          summary: {
            count: result.length,
            totalAmount,
          }
        })
      );
    } catch (error) {
      logger.error('批量支付佣金失败', {
        error: error instanceof Error ? error.message : '未知错误',
        commissionIds: req.body.commissionIds,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '批量支付佣金失败'
        )
      );
    }
  }
);

/**
 * 获取退款申请列表
 * GET /api/v1/admin/finance-manage/refunds
 */
router.get('/refunds',
  requirePermission('order:refund'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(Object.values(paymentRefunds_status)),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('userId').optional().isString(),
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
        status,
        startDate,
        endDate,
        userId
      } = req.query as any;

      // 构建查询条件
      const where: any = {};

      if (status) where.status = status;
      if (userId) where.applyUserId = userId;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      // 查询退款申请
      const [total, refunds] = await Promise.all([
        prisma.paymentRefunds.count({ where }),
        prisma.paymentRefunds.findMany({
          where,
          select: {
            id: true,
            refundNo: true,
            paymentId: true,
            refundAmount: true,
            refundReason: true,
            status: true,
            refundedAt: true,
            failedReason: true,
            createdAt: true,
            updatedAt: true,
            users_paymentRefunds_applyUserIdTousers: {
              select: {
                id: true,
                nickname: true,
                userNumber: true,
                phone: true,
              }
            },
            users_paymentRefunds_approveUserIdTousers: {
              select: {
                id: true,
                nickname: true,
                userNumber: true,
              }
            },
            paymentRecords: {
              select: {
                paymentNo: true,
                amount: true,
                paymentMethod: true,
                paymentChannel: true,
                orders: {
                  select: {
                    id: true,
                    orderNo: true,
                  }
                }
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
        module: 'finance',
        action: 'view_refunds',
        description: '查看退款申请列表',
        details: { page, limit, total, filters: { status, startDate, endDate, userId } },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          refunds,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        })
      );
    } catch (error) {
      logger.error('获取退款申请列表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取退款申请列表失败'
        )
      );
    }
  }
);

/**
 * 获取财务统计报表
 * GET /api/v1/admin/finance-manage/statistics
 */
router.get('/statistics',
  requirePermission('finance:view'),
  [
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
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
        startDate = new Date(new Date().setDate(new Date().getDate() - 30)),
        endDate = new Date(),
        period = 'day'
      } = req.query as any;

      // 获取财务统计数据
      const [
        totalRevenue,
        totalWithdrawals,
        totalCommissions,
        totalRefunds,
        withdrawalStats,
        commissionStats,
        revenueStats
      ] = await Promise.all([
        // 总收入
        prisma.paymentRecords.aggregate({
          where: {
            status: 'PAID',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: { amount: true },
          _count: { id: true }
        }),

        // 总提现
        prisma.pointsTransactions.aggregate({
          where: {
            type: 'WITHDRAW',
            status: 'COMPLETED',
            completedAt: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: { amount: true },
          _count: { id: true }
        }),

        // 总佣金
        prisma.commissionCalculations.aggregate({
          where: {
            status: 'PAID',
            paidDate: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: { totalCommission: true },
          _count: { id: true }
        }),

        // 总退款
        prisma.paymentRefunds.aggregate({
          where: {
            status: 'SUCCESS',
            refundedAt: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: { refundAmount: true },
          _count: { id: true }
        }),

        // 提现趋势
        prisma.$queryRaw`
          SELECT DATE_FORMAT(completedAt, ${
            period === 'day' ? '%Y-%m-%d' :
            period === 'week' ? '%Y-%u' :
            period === 'month' ? '%Y-%m' : '%Y'
          }) as date,
          SUM(amount) as amount,
          COUNT(*) as count
          FROM pointsTransactions
          WHERE type = 'WITHDRAW'
            AND status = 'COMPLETED'
            AND completedAt >= ${startDate}
            AND completedAt <= ${endDate}
          GROUP BY date
          ORDER BY date DESC
          LIMIT 30
        `,

        // 佣金趋势
        prisma.$queryRaw`
          SELECT DATE_FORMAT(paidDate, ${
            period === 'day' ? '%Y-%m-%d' :
            period === 'week' ? '%Y-%u' :
            period === 'month' ? '%Y-%m' : '%Y'
          }) as date,
          SUM(totalCommission) as amount,
          COUNT(*) as count
          FROM commissionCalculations
          WHERE status = 'PAID'
            AND paidDate >= ${startDate}
            AND paidDate <= ${endDate}
          GROUP BY date
          ORDER BY date DESC
          LIMIT 30
        `,

        // 收入趋势
        prisma.$queryRaw`
          SELECT DATE_FORMAT(paidAt, ${
            period === 'day' ? '%Y-%m-%d' :
            period === 'week' ? '%Y-%u' :
            period === 'month' ? '%Y-%m' : '%Y'
          }) as date,
          SUM(amount) as amount,
          COUNT(*) as count
          FROM paymentRecords
          WHERE status = 'PAID'
            AND paidAt >= ${startDate}
            AND paidAt <= ${endDate}
          GROUP BY date
          ORDER BY date DESC
          LIMIT 30
        `
      ]);

      // 获取用户积分统计
      const pointsStats = await prisma.users.aggregate({
        _sum: {
          pointsBalance: true,
          pointsFrozen: true
        },
        _count: { id: true }
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'finance',
        action: 'view_finance_statistics',
        description: '查看财务统计报表',
        details: { startDate, endDate, period },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          summary: {
            totalRevenue: totalRevenue._sum.amount || 0,
            totalRevenueCount: totalRevenue._count,
            totalWithdrawals: totalWithdrawals._sum.amount || 0,
            totalWithdrawalsCount: totalWithdrawals._count,
            totalCommissions: totalCommissions._sum.totalCommission || 0,
            totalCommissionsCount: totalCommissions._count,
            totalRefunds: totalRefunds._sum.refundAmount || 0,
            totalRefundsCount: totalRefunds._count,
            netRevenue: (totalRevenue._sum.amount || 0) - (totalRefunds._sum.refundAmount || 0),
            totalPointsBalance: pointsStats._sum.pointsBalance || 0,
            totalPointsFrozen: pointsStats._sum.pointsFrozen || 0,
            totalUsers: pointsStats._count,
          },
          trends: {
            withdrawal: withdrawalStats,
            commission: commissionStats,
            revenue: revenueStats,
          }
        })
      );
    } catch (error) {
      logger.error('获取财务统计报表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取财务统计报表失败'
        )
      );
    }
  }
);

/**
 * 资金调整
 * POST /api/v1/admin/finance-manage/adjust
 */
router.post('/adjust',
  requirePermission('finance:adjust'),
  [
    body('userId').isString().notEmpty(),
    body('type').isIn(['ADJUST_IN', 'ADJUST_OUT']),
    body('amount').isFloat({ min: 0.01 }),
    body('reason').isString().isLength({ min: 1, max: 500 }),
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

      const { userId, type, amount, reason, remark } = req.body;

      // 检查用户是否存在
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nickname: true,
          userNumber: true,
          pointsBalance: true,
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

      // 检查余额是否足够（如果是减少）
      if (type === 'ADJUST_OUT' && user.pointsBalance < amount) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '用户积分余额不足'
          )
        );
      }

      // 开始事务
      const result = await prisma.$transaction(async (tx) => {
        // 更新用户积分
        const updatedUser = await tx.users.update({
          where: { id: userId },
          data: {
            pointsBalance: type === 'ADJUST_IN'
              ? { increment: amount }
              : { decrement: amount },
            updatedAt: new Date(),
          }
        });

        // 创建调整记录
        const transaction = await tx.pointsTransactions.create({
          data: {
            id: `adjust_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            transactionNo: `AD${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            fromUserId: type === 'ADJUST_OUT' ? userId : 'system',
            toUserId: type === 'ADJUST_IN' ? userId : 'system',
            amount,
            type: type,
            description: reason + (remark ? `，备注：${remark}` : ''),
            status: 'COMPLETED',
            balanceBefore: user.pointsBalance,
            balanceAfter: type === 'ADJUST_IN'
              ? user.pointsBalance + amount
              : user.pointsBalance - amount,
            metadata: {
              adjustBy: req.user!.id,
              adjustAt: new Date().toISOString(),
              reason,
              remark,
            },
            completedAt: new Date(),
            createdAt: new Date(),
          }
        });

        return { user: updatedUser, transaction };
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.SENSITIVE_OPERATION,
        level: AuditLogLevel.CRITICAL,
        module: 'finance',
        action: 'adjust_user_funds',
        targetId: userId,
        targetType: 'user',
        description: `${type === 'ADJUST_IN' ? '增加' : '减少'}用户积分：${amount}，原因：${reason}`,
        details: { userId, type, amount, reason, remark },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          message: '资金调整成功',
          adjustment: result
        })
      );
    } catch (error) {
      logger.error('资金调整失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.body.userId,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '资金调整失败'
        )
      );
    }
  }
);

export default router;