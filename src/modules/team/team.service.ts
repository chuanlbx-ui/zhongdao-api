/**
 * 团队管理体系 - 业务逻辑服务
 * 多层级供应链社交电商平台的团队管理核心服务
 */

import {
  TeamMember,
  TeamStructure,
  ReferralRelationship,
  PerformanceMetrics,
  CommissionCalculation,
  TeamStatistics,
  NetworkTree,
  TeamRole,
  TeamStatus,
  RelationshipType,
  CommissionType,
  CommissionStatus,
  TeamActionType,
  CreateReferralParams,
  TeamQueryParams,
  PromotionParams,
  PerformanceQueryParams,
  CommissionQueryParams,
  TeamActionLog
} from './types';

export class TeamService {
  private static instance: TeamService;

  private constructor() {}

  public static getInstance(): TeamService {
    if (!TeamService.instance) {
      TeamService.instance = new TeamService();
    }
    return TeamService.instance;
  }

  // ==================== 推荐关系链管理 ====================

  /**
   * 建立推荐关系
   */
  async createReferralRelationship(params: CreateReferralParams): Promise<{
    success: boolean;
    relationship?: ReferralRelationship;
    message: string;
  }> {
    try {
      // 验证参数
      if (!params.referrerId || !params.refereeId) {
        return {
          success: false,
          message: '推荐人和被推荐人ID不能为空'
        };
      }

      // 检查是否已存在推荐关系
      const existingRelationship = await this.getReferralRelationship(
        params.referrerId,
        params.refereeId
      );

      if (existingRelationship) {
        return {
          success: false,
          message: '推荐关系已存在'
        };
      }

      // 获取推荐人信息
      const referrer = await this.getTeamMember(params.referrerId);
      if (!referrer) {
        return {
          success: false,
          message: '推荐人不存在'
        };
      }

      // 确定关系类型和层级
      const relationshipType = params.relationshipType || RelationshipType.DIRECT;
      const level = relationshipType === RelationshipType.DIRECT ? 1 :
                   await this.calculateRelationshipLevel(params.referrerId, params.refereeId);

      // 生成推荐路径
      const path = await this.generateReferralPath(params.referrerId, params.refereeId);

      // 创建推荐关系
      const relationship: ReferralRelationship = {
        id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        referrerId: params.referrerId,
        refereeId: params.refereeId,
        relationshipType,
        level,
        path,
        depth: path.split('>').length,
        referralSales: 0,
        referralCommission: 0,
        bonusEarned: 0,
        isActive: true,
        isQualified: false,
        establishedDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 更新被推荐人的团队信息
      await this.updateMemberTeamInfo(params.refereeId, {
        referrerId: params.referrerId,
        referrerNickname: referrer.nickname,
        uplineId: params.referrerId,
        uplineNickname: referrer.nickname,
        teamId: referrer.teamId,
        teamName: referrer.teamName,
        level: referrer.level + 1,
        joinDate: new Date()
      });

      // 更新推荐人的团队统计
      await this.updateReferrerStats(params.referrerId);

      console.log('创建推荐关系成功', { relationship });

      return {
        success: true,
        relationship,
        message: '推荐关系建立成功'
      };

    } catch (error) {
      console.error('创建推荐关系失败', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '建立推荐关系时发生错误'
      };
    }
  }

  /**
   * 获取推荐关系
   */
  async getReferralRelationship(referrerId: string, refereeId: string): Promise<ReferralRelationship | null> {
    // 模拟数据库查询
    // 在实际实现中，这里会查询数据库
    return null;
  }

  /**
   * 计算关系层级
   */
  private async calculateRelationshipLevel(referrerId: string, refereeId: string): Promise<number> {
    // 模拟计算推荐关系层级
    // 在实际实现中，会通过推荐路径计算
    return Math.floor(Math.random() * 8) + 1; // 1-9级
  }

  /**
   * 生成推荐路径
   */
  private async generateReferralPath(referrerId: string, refereeId: string): Promise<string> {
    // 模拟生成推荐路径
    // 在实际实现中，会递归查找上级推荐关系
    return `${referrerId}>${refereeId}`;
  }

  /**
   * 更新成员团队信息
   */
  private async updateMemberTeamInfo(memberId: string, updates: Partial<TeamMember>): Promise<void> {
    console.log('更新成员团队信息', { memberId, updates });
    // 在实际实现中，会更新数据库
  }

  /**
   * 更新推荐人统计
   */
  private async updateReferrerStats(referrerId: string): Promise<void> {
    console.log('更新推荐人统计', { referrerId });
    // 在实际实现中，会更新推荐人的直推人数等统计信息
  }

  // ==================== 团队层级结构管理 ====================

  /**
   * 获取团队结构
   */
  async getTeamStructure(teamId: string): Promise<TeamStructure | null> {
    try {
      // 模拟获取团队结构
      const teamStructure: TeamStructure = {
        id: teamId,
        name: `团队_${teamId}`,
        description: '测试团队',
        leaderId: 'leader_001',
        leaderNickname: '团队负责人',
        rootMemberId: 'root_001',
        totalMembers: 156,
        activeMembers: 142,
        totalLevels: 6,
        totalSales: 2580000,
        levelStatistics: [
          { level: 1, memberCount: 12, sales: 856000 },
          { level: 2, memberCount: 28, sales: 682000 },
          { level: 3, memberCount: 45, sales: 524000 },
          { level: 4, memberCount: 38, sales: 368000 },
          { level: 5, memberCount: 23, sales: 128000 },
          { level: 6, memberCount: 10, sales: 22000 }
        ],
        status: TeamStatus.ACTIVE,
        establishedDate: new Date('2023-01-15'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return teamStructure;

    } catch (error) {
      console.error('获取团队结构失败', error);
      return null;
    }
  }

  /**
   * 获取团队成员列表
   */
  async getTeamMembers(params: TeamQueryParams): Promise<{
    members: TeamMember[];
    total: number;
    page: number;
    perPage: number;
  }> {
    try {
      // 模拟获取团队成员
      const mockMembers: TeamMember[] = [
        {
          id: 'member_001',
          userId: 'user_001',
          nickname: '张三',
          avatar: 'https://example.com/avatar1.jpg',
          phone: '13800138001',
          role: TeamRole.DIRECTOR,
          level: 3,
          status: TeamStatus.ACTIVE,
          referrerId: 'referrer_001',
          referrerNickname: '推荐人A',
          uplineId: 'upline_001',
          uplineNickname: '上级A',
          teamId: params.teamId || 'team_001',
          teamName: '金牌团队',
          position: '高级店长',
          personalSales: 156800,
          teamSales: 892000,
          directCount: 12,
          teamCount: 45,
          activeDirectCount: 11,
          activeTeamCount: 42,
          joinDate: new Date('2023-03-15'),
          promotedDate: new Date('2023-08-20'),
          lastActiveDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'member_002',
          userId: 'user_002',
          nickname: '李四',
          role: TeamRole.MANAGER,
          level: 4,
          status: TeamStatus.ACTIVE,
          referrerId: 'referrer_002',
          referrerNickname: '推荐人B',
          uplineId: 'upline_002',
          uplineNickname: '上级B',
          teamId: params.teamId || 'team_001',
          teamName: '金牌团队',
          position: '店长经理',
          personalSales: 234500,
          teamSales: 1456000,
          directCount: 18,
          teamCount: 67,
          activeDirectCount: 16,
          activeTeamCount: 58,
          joinDate: new Date('2023-02-10'),
          promotedDate: new Date('2023-07-15'),
          lastActiveDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const page = params.page || 1;
      const perPage = params.perPage || 20;

      return {
        members: mockMembers,
        total: mockMembers.length,
        page,
        perPage
      };

    } catch (error) {
      console.error('获取团队成员失败', error);
      return {
        members: [],
        total: 0,
        page: 1,
        perPage: 20
      };
    }
  }

  /**
   * 获取团队成员详情
   */
  async getTeamMember(memberId: string): Promise<TeamMember | null> {
    try {
      // 模拟获取成员详情
      const member: TeamMember = {
        id: memberId,
        userId: `user_${memberId}`,
        nickname: '测试成员',
        role: TeamRole.CAPTAIN,
        level: 2,
        status: TeamStatus.ACTIVE,
        teamId: 'team_001',
        teamName: '测试团队',
        position: '队長',
        personalSales: 89500,
        teamSales: 234000,
        directCount: 5,
        teamCount: 12,
        activeDirectCount: 4,
        activeTeamCount: 10,
        joinDate: new Date('2023-05-10'),
        promotedDate: new Date('2023-09-01'),
        lastActiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return member;

    } catch (error) {
      console.error('获取团队成员详情失败', error);
      return null;
    }
  }

  /**
   * 获取网络树结构
   */
  async getNetworkTree(userId: string, maxDepth: number = 9): Promise<NetworkTree | null> {
    try {
      // 模拟获取网络树
      const networkTree: NetworkTree = {
        userId,
        nickname: '网络根节点',
        role: TeamRole.DIRECTOR,
        level: 1,
        personalSales: 156800,
        teamSales: 892000,
        directCount: 3,
        teamCount: 15,
        status: TeamStatus.ACTIVE,
        children: [
          {
            userId: 'child_001',
            nickname: '下级A',
            role: TeamRole.MANAGER,
            level: 2,
            personalSales: 89500,
            teamSales: 234000,
            directCount: 2,
            teamCount: 6,
            status: TeamStatus.ACTIVE,
            children: [
              {
                userId: 'grandchild_001',
                nickname: '下下级A',
                role: TeamRole.CAPTAIN,
                level: 3,
                personalSales: 45200,
                teamSales: 68000,
                directCount: 1,
                teamCount: 2,
                status: TeamStatus.ACTIVE,
                children: []
              }
            ]
          },
          {
            userId: 'child_002',
            nickname: '下级B',
            role: TeamRole.CAPTAIN,
            level: 2,
            personalSales: 67800,
            teamSales: 95000,
            directCount: 2,
            teamCount: 4,
            status: TeamStatus.ACTIVE,
            children: []
          }
        ]
      };

      return networkTree;

    } catch (error) {
      console.error('获取网络树失败', error);
      return null;
    }
  }

  // ==================== 业绩统计计算 ====================

  /**
   * 获取业绩指标
   */
  async getPerformanceMetrics(params: PerformanceQueryParams): Promise<{
    metrics: PerformanceMetrics[];
    total: number;
  }> {
    try {
      // 模拟获取业绩指标
      const mockMetrics: PerformanceMetrics[] = [
        {
          id: 'perf_001',
          userId: params.userId || 'user_001',
          period: params.period || '2025-11',
          personalMetrics: {
            salesAmount: 25680,
            orderCount: 45,
            newCustomers: 8,
            repeatRate: 0.68,
            averageOrderValue: 570.67
          },
          teamMetrics: {
            teamSales: 156800,
            teamOrders: 234,
            newMembers: 12,
            activeRate: 0.89,
            productivity: 670.09
          },
          referralMetrics: {
            directReferrals: 3,
            indirectReferrals: 8,
            referralRevenue: 8950,
            networkGrowth: 0.15
          },
          rankProgress: {
            currentRole: TeamRole.MANAGER,
            nextRole: TeamRole.DIRECTOR,
            progressPercentage: 0.75,
            requirementsMet: ['个人销售额达标', '直推人数达标'],
            requirementsPending: ['团队活跃率提升']
          },
          calculationDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      return {
        metrics: mockMetrics,
        total: mockMetrics.length
      };

    } catch (error) {
      console.error('获取业绩指标失败', error);
      return {
        metrics: [],
        total: 0
      };
    }
  }

  /**
   * 计算团队业绩统计
   */
  async calculateTeamStatistics(teamId: string, period?: string): Promise<TeamStatistics | null> {
    try {
      // 模拟计算团队统计
      const teamStatistics: TeamStatistics = {
        overview: {
          totalMembers: 156,
          activeMembers: 142,
          totalSales: 2580000,
          averagePerformance: 16538.46,
          growthRate: 0.18
        },
        levelDistribution: [
          { level: 1, memberCount: 12, salesContribution: 856000, percentage: 0.332 },
          { level: 2, memberCount: 28, salesContribution: 682000, percentage: 0.264 },
          { level: 3, memberCount: 45, salesContribution: 524000, percentage: 0.203 },
          { level: 4, memberCount: 38, salesContribution: 368000, percentage: 0.143 },
          { level: 5, memberCount: 23, salesContribution: 128000, percentage: 0.050 },
          { level: 6, memberCount: 10, salesContribution: 22000, percentage: 0.009 }
        ],
        roleDistribution: [
          {
            role: TeamRole.CAPTAIN,
            count: 45,
            sales: 524000,
            avgPerformance: 11644.44
          },
          {
            role: TeamRole.MANAGER,
            count: 28,
            sales: 682000,
            avgPerformance: 24357.14
          },
          {
            role: TeamRole.DIRECTOR,
            count: 12,
            sales: 856000,
            avgPerformance: 71333.33
          }
        ],
        performanceMetrics: {
          topPerformers: [
            {
              userId: 'top_001',
              nickname: '业绩之星',
              role: TeamRole.DIRECTOR,
              sales: 156800,
              teamSize: 45
            },
            {
              userId: 'top_002',
              nickname: '增长达人',
              role: TeamRole.MANAGER,
              sales: 234500,
              teamSize: 67
            }
          ],
          growthTrends: [
            { period: '2025-09', sales: 1850000, newMembers: 18, activeRate: 0.87 },
            { period: '2025-10', sales: 2150000, newMembers: 22, activeRate: 0.88 },
            { period: '2025-11', sales: 2580000, newMembers: 28, activeRate: 0.91 }
          ]
        }
      };

      return teamStatistics;

    } catch (error) {
      console.error('计算团队统计失败', error);
      return null;
    }
  }

  // ==================== 佣金计算 ====================

  /**
   * 计算佣金
   */
  async calculateCommission(params: {
    userId: string;
    period: string;
    orderId?: string;
  }): Promise<{
    success: boolean;
    commission?: CommissionCalculation;
    message: string;
  }> {
    try {
      // 获取用户信息
      const member = await this.getTeamMember(params.userId);
      if (!member) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 获取业绩指标
      const performanceResult = await this.getPerformanceMetrics({
        userId: params.userId,
        period: params.period
      });

      if (performanceResult.metrics.length === 0) {
        return {
          success: false,
          message: '未找到业绩数据'
        };
      }

      const performance = performanceResult.metrics[0];

      // 计算各类佣金
      const commissionDetails = [
        {
          type: CommissionType.PERSONAL_SALES,
          amount: performance.personalMetrics.salesAmount * 0.15, // 15%个人销售佣金
          rate: 0.15,
          baseAmount: performance.personalMetrics.salesAmount,
          description: '个人销售佣金'
        },
        {
          type: CommissionType.DIRECT_REFERRAL,
          amount: performance.referralMetrics.directReferrals * 500, // 直推奖励
          rate: 1,
          baseAmount: performance.referralMetrics.directReferrals,
          description: '直推推荐奖励'
        },
        {
          type: CommissionType.TEAM_BONUS,
          amount: performance.teamMetrics.teamSales * 0.03, // 3%团队奖金
          rate: 0.03,
          baseAmount: performance.teamMetrics.teamSales,
          description: '团队管理奖金'
        },
        {
          type: CommissionType.LEVEL_BONUS,
          amount: this.calculateLevelBonus(member.role, performance.teamMetrics.teamSales),
          rate: this.getLevelBonusRate(member.role),
          baseAmount: performance.teamMetrics.teamSales,
          description: `${member.role}等级奖金`
        }
      ];

      // 计算总佣金
      const totalCommission = commissionDetails.reduce((sum, detail) => sum + detail.amount, 0);

      // 创建佣金记录
      const commission: CommissionCalculation = {
        id: `commission_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        userId: params.userId,
        orderId: params.orderId,
        period: params.period,
        commissionDetails,
        totalCommission,
        personalCommission: commissionDetails.find(d => d.type === CommissionType.PERSONAL_SALES)?.amount || 0,
        teamCommission: commissionDetails.find(d => d.type === CommissionType.TEAM_BONUS)?.amount || 0,
        referralCommission: commissionDetails.filter(d =>
          d.type === CommissionType.DIRECT_REFERRAL || d.type === CommissionType.INDIRECT_REFERRAL
        ).reduce((sum, d) => sum + d.amount, 0),
        bonusCommission: commissionDetails.filter(d =>
          d.type === CommissionType.LEVEL_BONUS || d.type === CommissionType.PERFORMANCE_BONUS
        ).reduce((sum, d) => sum + d.amount, 0),
        status: CommissionStatus.CALCULATED,
        calculatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('佣金计算完成', { commission });

      return {
        success: true,
        commission,
        message: '佣金计算成功'
      };

    } catch (error) {
      console.error('计算佣金失败', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '计算佣金时发生错误'
      };
    }
  }

  /**
   * 计算等级奖金
   */
  private calculateLevelBonus(role: TeamRole, teamSales: number): number {
    const bonusRates = {
      [TeamRole.MEMBER]: 0,
      [TeamRole.CAPTAIN]: 0.01,
      [TeamRole.MANAGER]: 0.02,
      [TeamRole.DIRECTOR]: 0.03,
      [TeamRole.SENIOR_DIRECTOR]: 0.04,
      [TeamRole.PARTNER]: 0.05,
      [TeamRole.AMBASSADOR]: 0.06
    };

    return teamSales * (bonusRates[role] || 0);
  }

  /**
   * 获取等级奖金比例
   */
  private getLevelBonusRate(role: TeamRole): number {
    const rates = {
      [TeamRole.MEMBER]: 0,
      [TeamRole.CAPTAIN]: 0.01,
      [TeamRole.MANAGER]: 0.02,
      [TeamRole.DIRECTOR]: 0.03,
      [TeamRole.SENIOR_DIRECTOR]: 0.04,
      [TeamRole.PARTNER]: 0.05,
      [TeamRole.AMBASSADOR]: 0.06
    };

    return rates[role] || 0;
  }

  // ==================== 团队管理操作 ====================

  /**
   * 成员晋升
   */
  async promoteMember(params: PromotionParams): Promise<{
    success: boolean;
    message: string;
    member?: TeamMember;
  }> {
    try {
      const member = await this.getTeamMember(params.userId);
      if (!member) {
        return {
          success: false,
          message: '成员不存在'
        };
      }

      // 检查晋升条件
      const canPromote = await this.checkPromotionEligibility(params.userId, params.newRole);
      if (!canPromote) {
        return {
          success: false,
          message: '不满足晋升条件'
        };
      }

      // 更新成员角色
      const updatedMember = {
        ...member,
        role: params.newRole,
        promotedDate: params.effectiveDate || new Date(),
        updatedAt: new Date()
      };

      // 记录操作日志
      await this.logTeamAction({
        userId: params.userId,
        operatorId: 'system', // 在实际实现中应该是操作员ID
        actionType: TeamActionType.PROMOTE,
        oldData: { role: member.role },
        newData: { role: params.newRole },
        reason: params.reason,
        notes: params.notes
      });

      console.log('成员晋升成功', { updatedMember });

      return {
        success: true,
        message: '晋升成功',
        member: updatedMember
      };

    } catch (error) {
      console.error('成员晋升失败', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '晋升时发生错误'
      };
    }
  }

  /**
   * 检查晋升资格
   */
  private async checkPromotionEligibility(userId: string, newRole: TeamRole): Promise<boolean> {
    // 模拟晋升条件检查
    // 在实际实现中，会根据具体角色的要求进行检查
    return Math.random() > 0.2; // 80%概率通过检查
  }

  /**
   * 记录团队操作日志
   */
  private async logTeamAction(logData: {
    userId: string;
    operatorId: string;
    actionType: TeamActionType;
    oldData?: any;
    newData?: any;
    reason: string;
    notes?: string;
  }): Promise<void> {
    const log: TeamActionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      ...logData,
      createdAt: new Date()
    };

    console.log('记录团队操作日志', { log });
    // 在实际实现中，会保存到数据库
  }

  // ==================== 工具方法 ====================

  /**
   * 获取角色权限
   */
  getRolePermissions(role: TeamRole): string[] {
    const permissions = {
      [TeamRole.MEMBER]: ['view_personal_stats', 'view_direct_referrals'],
      [TeamRole.CAPTAIN]: ['view_personal_stats', 'view_direct_referrals', 'view_team_stats'],
      [TeamRole.MANAGER]: [
        'view_personal_stats',
        'view_direct_referrals',
        'view_team_stats',
        'promote_to_captain'
      ],
      [TeamRole.DIRECTOR]: [
        'view_personal_stats',
        'view_direct_referrals',
        'view_team_stats',
        'view_network_stats',
        'promote_to_manager',
        'approve_team_actions'
      ],
      [TeamRole.SENIOR_DIRECTOR]: [
        'view_all_stats',
        'promote_to_director',
        'manage_team_structure'
      ],
      [TeamRole.PARTNER]: [
        'view_all_stats',
        'promote_to_senior_director',
        'manage_team_structure',
        'access_advanced_reports'
      ],
      [TeamRole.AMBASSADOR]: [
        'view_all_stats',
        'promote_to_partner',
        'manage_team_structure',
        'access_advanced_reports',
        'system_administration'
      ]
    };

    return permissions[role] || [];
  }

  /**
   * 计算团队业绩排名
   */
  async calculateTeamRanking(teamId: string, period?: string): Promise<Array<{
    userId: string;
    nickname: string;
    role: TeamRole;
    sales: number;
    rank: number;
  }>> {
    try {
      // 模拟团队排名计算
      const rankings = [
        { userId: 'user_001', nickname: '业绩王', role: TeamRole.DIRECTOR, sales: 156800, rank: 1 },
        { userId: 'user_002', nickname: '增长达人', role: TeamRole.MANAGER, sales: 234500, rank: 2 },
        { userId: 'user_003', nickname: '销售精英', role: TeamRole.CAPTAIN, sales: 89500, rank: 3 }
      ];

      return rankings;

    } catch (error) {
      console.error('计算团队排名失败', error);
      return [];
    }
  }
}

// 导出单例实例
export const teamService = TeamService.getInstance();