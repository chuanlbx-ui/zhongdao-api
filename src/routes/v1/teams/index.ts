import { Router, Request, Response } from 'express';
import { TeamService } from '../../../modules/team/team.service';
import {
  CreateReferralParams,
  TeamQueryParams,
  PromotionParams,
  PerformanceQueryParams,
  CommissionQueryParams,
  TeamRole,
  TeamStatus,
  RelationshipType,
  CommissionType,
  CommissionStatus
} from '../../../modules/team/types';

const teamService = TeamService.getInstance();

const router = Router();

// ==================== 团队模块信息 ====================

router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: '团队管理体系 API - 简化版本',
      version: '1.0.0',
      status: 'working',
      timestamp: new Date().toISOString()
    }
  });
});

// ==================== 推荐关系管理 ====================

// 建立推荐关系
router.post('/referral', async (req: Request, res: Response) => {
  try {
    const params: CreateReferralParams = {
      referrerId: req.body.referrerId,
      refereeId: req.body.refereeId,
      relationshipType: req.body.relationshipType
    };

    const result = await teamService.createReferralRelationship(params);

    if (result.success) {
      res.json({
        success: true,
        data: result.relationship,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        message: '建立推荐关系失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '建立推荐关系异常'
    });
  }
});

// 获取用户推荐关系
router.get('/referral/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const includeDownline = req.query.includeDownline === 'true';

    // 模拟获取推荐关系数据
    const referralData = {
      userId,
      referrerInfo: {
        id: 'referrer_001',
        nickname: '推荐人',
        role: TeamRole.DIRECTOR,
        joinDate: '2023-01-15'
      },
      directReferrals: [
        {
          id: 'referral_001',
          userId: 'user_001',
          nickname: '直推成员A',
          role: TeamRole.MANAGER,
          joinDate: '2023-03-15',
          sales: 156800
        }
      ],
      totalReferrals: 12,
      activeReferrals: 11,
      totalLevels: 4
    };

    res.json({
      success: true,
      data: referralData,
      message: '获取推荐关系成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取推荐关系异常'
    });
  }
});

// ==================== 团队结构管理 ====================

// 获取团队成员列表
router.get('/members', async (req: Request, res: Response) => {
  try {
    const params: TeamQueryParams = {
      teamId: req.query.teamId as string | undefined,
      role: req.query.role as TeamRole | undefined,
      status: req.query.status as TeamStatus | undefined,
      level: req.query.level ? parseInt(req.query.level as string) : undefined,
      includeInactive: req.query.includeInactive === 'true',
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      perPage: req.query.perPage ? parseInt(req.query.perPage as string) : 20,
      sortBy: req.query.sortBy as any | undefined,
      sortOrder: req.query.sortOrder as any | undefined
    };

    const result = await teamService.getTeamMembers(params);

    res.json({
      success: true,
      data: result,
      message: '获取团队成员列表成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取团队成员列表异常'
    });
  }
});

// 获取成员详情
router.get('/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const member = await teamService.getTeamMember(memberId);

    if (member) {
      res.json({
        success: true,
        data: member,
        message: '获取成员详情成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '成员不存在',
        message: '获取成员详情失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取成员详情异常'
    });
  }
});

// 获取团队结构
router.get('/structure/:teamId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const structure = await teamService.getTeamStructure(teamId);

    if (structure) {
      res.json({
        success: true,
        data: structure,
        message: '获取团队结构成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '团队不存在',
        message: '获取团队结构失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取团队结构异常'
    });
  }
});

// 获取网络树结构
router.get('/network/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : 9;

    const networkTree = await teamService.getNetworkTree(userId, maxDepth);

    if (networkTree) {
      res.json({
        success: true,
        data: networkTree,
        message: '获取网络树结构成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '用户不存在或网络为空',
        message: '获取网络树结构失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取网络树结构异常'
    });
  }
});

// ==================== 业绩统计管理 ====================

// 获取业绩指标
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const params: PerformanceQueryParams = {
      userId: req.query.userId as string,
      teamId: req.query.teamId as string,
      period: req.query.period as string,
      role: req.query.role as TeamRole,
      metricType: req.query.metricType as any,
      periodType: req.query.periodType as any,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const result = await teamService.getPerformanceMetrics(params);

    res.json({
      success: true,
      data: result,
      message: '获取业绩指标成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取业绩指标异常'
    });
  }
});

// 获取团队统计
router.get('/statistics/:teamId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const period = req.query.period as string;

    const statistics = await teamService.calculateTeamStatistics(teamId, period);

    if (statistics) {
      res.json({
        success: true,
        data: statistics,
        message: '获取团队统计成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '团队统计数据获取失败',
        message: '获取团队统计失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取团队统计异常'
    });
  }
});

// 获取团队排名
router.get('/ranking/:teamId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const period = req.query.period as string;

    const rankings = await teamService.calculateTeamRanking(teamId, period);

    res.json({
      success: true,
      data: {
        rankings,
        total: rankings.length,
        period: period || 'current'
      },
      message: '获取团队排名成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取团队排名异常'
    });
  }
});

// ==================== 佣金计算管理 ====================

// 计算佣金
router.post('/commission/calculate', async (req: Request, res: Response) => {
  try {
    const params = {
      userId: req.body.userId,
      period: req.body.period,
      orderId: req.body.orderId
    };

    const result = await teamService.calculateCommission(params);

    if (result.success) {
      res.json({
        success: true,
        data: result.commission,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        message: '计算佣金失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '计算佣金异常'
    });
  }
});

// 获取佣金记录
router.get('/commission/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const params: CommissionQueryParams = {
      userId,
      period: req.query.period as string,
      status: req.query.status as CommissionStatus,
      type: req.query.type as CommissionType,
      paidStatus: req.query.paidStatus === 'true',
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      perPage: req.query.perPage ? parseInt(req.query.perPage as string) : 20
    };

    // 模拟获取佣金记录
    const commissionRecords = [
      {
        id: 'commission_001',
        userId,
        period: '2025-11',
        totalCommission: 15680.50,
        status: CommissionStatus.CALCULATED,
        calculatedAt: new Date(),
        commissionDetails: [
          {
            type: CommissionType.PERSONAL_SALES,
            amount: 12580.00,
            description: '个人销售佣金'
          },
          {
            type: CommissionType.TEAM_BONUS,
            amount: 2890.50,
            description: '团队管理奖金'
          },
          {
            type: CommissionType.LEVEL_BONUS,
            amount: 210.00,
            description: '等级奖金'
          }
        ]
      }
    ];

    res.json({
      success: true,
      data: {
        records: commissionRecords,
        total: commissionRecords.length,
        page: params.page,
        perPage: params.perPage
      },
      message: '获取佣金记录成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取佣金记录异常'
    });
  }
});

// ==================== 团队管理操作 ====================

// 成员晋升
router.post('/promote', async (req: Request, res: Response) => {
  try {
    const params: PromotionParams = {
      userId: req.body.userId,
      newRole: req.body.newRole as TeamRole,
      reason: req.body.reason,
      effectiveDate: req.body.effectiveDate ? new Date(req.body.effectiveDate) : undefined,
      notes: req.body.notes
    };

    const result = await teamService.promoteMember(params);

    if (result.success) {
      res.json({
        success: true,
        data: result.member,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        message: '成员晋升失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '成员晋升异常'
    });
  }
});

// 获取用户权限
router.get('/permissions/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const role = req.query.role as TeamRole;

    const permissions = teamService.getRolePermissions(role || TeamRole.MEMBER);

    res.json({
      success: true,
      data: {
        userId,
        role: role || TeamRole.MEMBER,
        permissions
      },
      message: '获取用户权限成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '获取用户权限异常'
    });
  }
});

// 更新成员状态
router.put('/member/:memberId/status', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const { status } = req.body;

    // 模拟更新成员状态
    const updatedMember = {
      id: memberId,
      status: status as TeamStatus,
      updatedAt: new Date()
    };

    res.json({
      success: true,
      data: updatedMember,
      message: '更新成员状态成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
      message: '更新成员状态异常'
    });
  }
});

export default router;