/**
 * 佣金控制器
 * 处理佣金相关的HTTP请求
 */

import { Request, Response } from 'express';
import { commissionService, CommissionService } from '../../../modules/commission';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  ErrorCode
} from '../../../shared/types/response';
import { AuthenticatedRequest } from '../../../types';
import { logger } from '../../../shared/utils/logger';
import { ErrorCode } from '../../../shared/errors';

export class CommissionController {
  constructor(private service: CommissionService = commissionService) {}

  /**
   * 获取佣金列表
   */
  getCommissions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const {
      page = 1,
      perPage = 10,
      status,
      startDate,
      endDate,
      allUsers
    } = req.query;

    // 管理员可以查看所有用户的佣金记录
    const isAdmin = ['ADMIN', 'DIRECTOR'].includes(userRole);
    const queryUserId = isAdmin && allUsers === 'true' ? undefined : userId;

    const { items, total } = await this.service.getUserCommissions(
      queryUserId || userId,
      {
        page: Number(page),
        perPage: Number(perPage),
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      }
    );

    res.json(createPaginatedResponse(
      items,
      total,
      Number(page),
      Number(perPage),
      '获取佣金记录成功',
      req.requestId
    ));
  });

  /**
   * 获取佣金汇总
   */
  getCommissionSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userRole = req.user!.role;
    const { period = 'month', chart } = req.query;

    // 管理员可以查看所有用户的汇总
    const isAdmin = ['ADMIN', 'DIRECTOR'].includes(userRole);
    const userId = isAdmin ? undefined : req.user!.id;

    const summary = await this.service.getCommissionSummary(
      userId,
      {
        period: period as any,
        includeChart: chart === 'true'
      }
    );

    res.json(createSuccessResponse(
      summary,
      '获取佣金汇总成功',
      undefined,
      req.requestId
    ));
  });

  /**
   * 计算订单佣金
   */
  calculateCommission = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userRole = req.user!.role;

    // 检查权限
    if (!['ADMIN', 'DIRECTOR'].includes(userRole)) {
      res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        '无权限执行此操作',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }

    const result = await this.service.calculateCommission(req.body);

    res.json(createSuccessResponse(
      result,
      '计算佣金成功',
      undefined,
      req.requestId
    ));
  });

  /**
   * 创建佣金记录
   */
  createCommissionRecords = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userRole = req.user!.role;

    // 检查权限
    if (!['ADMIN', 'DIRECTOR'].includes(userRole)) {
      res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        '无权限执行此操作',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }

    await this.service.createCommissionRecords(req.body);

    res.json(createSuccessResponse(
      null,
      '创建佣金记录成功',
      undefined,
      req.requestId
    ));
  });

  /**
   * 结算佣金
   */
  settleCommissions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userRole = req.user!.role;

    // 检查权限
    if (!['ADMIN', 'DIRECTOR'].includes(userRole)) {
      res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        '无权限执行此操作',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }

    const { commissionIds, settleDate, remark } = req.body;

    const result = await this.service.settleCommissions(
      commissionIds,
      settleDate ? new Date(settleDate) : undefined,
      req.user!.id,
      remark
    );

    res.json(createSuccessResponse(
      result,
      '结算佣金成功',
      undefined,
      req.requestId
    ));
  });

  /**
   * 申请提现
   */
  applyWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const result = await this.service.applyForWithdrawal(userId, req.body);

    res.json(createSuccessResponse(
      result,
      '申请提现成功',
      undefined,
      req.requestId
    ));
  });

  /**
   * 获取提现记录
   */
  getWithdrawals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { page = 1, perPage = 10, status, allUsers } = req.query;

    // 管理员可以查看所有用户的提现记录
    const isAdmin = ['ADMIN', 'DIRECTOR'].includes(userRole);
    const queryUserId = isAdmin && allUsers === 'true' ? undefined : userId;

    const { items, total } = await this.service.getWithdrawals(
      queryUserId,
      {
        page: Number(page),
        perPage: Number(perPage),
        status: status as string
      }
    );

    res.json(createPaginatedResponse(
      items,
      total,
      Number(page),
      Number(perPage),
      '获取提现记录成功',
      req.requestId
    ));
  });

  /**
   * 批准提现
   */
  approveWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userRole = req.user!.role;

    // 检查权限
    if (!['ADMIN', 'DIRECTOR'].includes(userRole)) {
      res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        '无权限执行此操作',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }

    const { id } = req.params;
    const { remark, transactionId } = req.body;

    await this.service.reviewWithdrawal(
      id,
      true,
      req.user!.id,
      remark,
      transactionId
    );

    res.json(createSuccessResponse(
      { withdrawId: id, status: 'COMPLETED' },
      '批准提现成功',
      undefined,
      req.requestId
    ));
  });

  /**
   * 拒绝提现
   */
  rejectWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userRole = req.user!.role;

    // 检查权限
    if (!['ADMIN', 'DIRECTOR'].includes(userRole)) {
      res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        '无权限执行此操作',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json(createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        '拒绝原因不能为空',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }

    await this.service.reviewWithdrawal(
      id,
      false,
      req.user!.id,
      reason
    );

    res.json(createSuccessResponse(
      { withdrawId: id, status: 'CANCELLED', reason },
      '拒绝提现成功',
      undefined,
      req.requestId
    ));
  });

  /**
   * 获取佣金规则
   */
  getCommissionRules = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // 这里可以返回动态配置的佣金规则
    // 暂时返回硬编码的规则
    const rules = [
      {
        level: 'VIP',
        rate: 0.15,
        conditions: {
          minOrders: 0,
          minSales: 0,
          minTeamSize: 0
        },
        description: 'VIP用户佣金规则',
        isActive: true
      },
      {
        level: 'STAR_1',
        rate: 0.18,
        conditions: {
          minOrders: 10,
          minSales: 10000,
          minTeamSize: 5
        },
        description: '一星店长佣金规则',
        isActive: true
      },
      // ... 其他等级规则
    ];

    res.json(createSuccessResponse(
      rules,
      '获取佣金规则成功',
      undefined,
      req.requestId
    ));
  });

  /**
   * 获取当前佣金费率
   */
  getCommissionRates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userLevel = req.user!.level;

    // 基于用户等级的佣金费率
    const levelRates = {
      'NORMAL': { personalRate: 0, teamRates: [] },
      'VIP': { personalRate: 0.15, teamRates: [] },
      'STAR_1': { personalRate: 0.18, teamRates: [0.10] },
      'STAR_2': { personalRate: 0.20, teamRates: [0.10, 0.05] },
      'STAR_3': { personalRate: 0.22, teamRates: [0.10, 0.05, 0.03] },
      'STAR_4': { personalRate: 0.25, teamRates: [0.10, 0.05, 0.03, 0.02] },
      'STAR_5': { personalRate: 0.30, teamRates: [0.10, 0.05, 0.03, 0.02, 0.01] },
      'DIRECTOR': { personalRate: 0.35, teamRates: [0.10, 0.05, 0.03, 0.02, 0.01, 0.005] }
    };

    const rates = levelRates[userLevel as keyof typeof levelRates] || levelRates.NORMAL;

    // 添加团队奖金费率
    const teamBonusRates = {
      'VIP': 0.01,
      'STAR_1': 0.02,
      'STAR_2': 0.03,
      'STAR_3': 0.05,
      'STAR_4': 0.07,
      'STAR_5': 0.10,
      'DIRECTOR': 0.15
    };

    res.json(createSuccessResponse({
      personalRate: rates.personalRate,
      teamRates: rates.teamRates,
      teamBonusRate: teamBonusRates[userLevel as keyof typeof teamBonusRates] || 0,
      effectiveDate: new Date().toISOString(),
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90天后
    }, '获取佣金费率成功', undefined, req.requestId));
  });
}

// 导出控制器实例
export const commissionController = new CommissionController();