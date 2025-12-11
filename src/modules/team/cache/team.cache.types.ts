/**
 * 团队缓存类型定义
 */

export interface TeamMember {
  id: string;
  userId: string;
  nickname: string | null;
  level: string;
  status: string;
  parentId: string | null;
  teamPath: string;
  teamLevel: number;
  directCount: number;
  teamCount: number;
  totalSales: number;
  totalBottles: number;
  joinedAt: Date;
  lastActiveAt: Date;
  avatar?: string;
  phone?: string;
}

export interface TeamHierarchy {
  userId: string;
  level: number;
  path: string[];
  parent?: {
    id: string;
    nickname: string | null;
    level: string;
  };
  children: TeamMember[];
  totalMembers: number;
  totalSales: number;
  totalBottles: number;
  teamPerformance: {
    monthly: Array<{
      month: string;
      sales: number;
      bottles: number;
      newMembers: number;
    }>;
  };
}

export interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  directMembers: number;
  teamMembers: number;
  totalSales: number;
  totalBottles: number;
  monthlySales: number;
  monthlyBottles: number;
  levelDistribution: Record<string, number>;
  performance: {
    thisMonth: {
      sales: number;
      bottles: number;
      newMembers: number;
      growthRate: number;
    };
    lastMonth: {
      sales: number;
      bottles: number;
      newMembers: number;
    };
  };
}

export interface TeamCommission {
  userId: string;
  period: string;
  totalCommission: number;
  directCommission: number;
  teamCommission: number;
  bonus: number;
  details: Array<{
    sourceUserId: string;
    sourceNickname: string;
    amount: number;
    type: 'direct' | 'team' | 'bonus';
    level: number;
    rate: number;
  }>;
  settledAt?: Date;
  status: 'pending' | 'approved' | 'paid';
}

export interface TeamRanking {
  period: 'day' | 'week' | 'month';
  rankings: Array<{
    rank: number;
    userId: string;
    nickname: string | null;
    level: string;
    teamSales: number;
    teamBottles: number;
    teamMembers: number;
    growthRate: number;
  }>;
  lastUpdated: Date;
}

export interface TeamPath {
  userId: string;
  path: string;
  level: number;
  parentId?: string;
  depth: number;
  branchSize: number;
  updatedAt: Date;
}

export interface TeamNetwork {
  rootUserId: string;
  nodes: Array<{
    userId: string;
    nickname: string | null;
    level: string;
    parentId?: string;
    children: string[];
    depth: number;
    position: {
      x: number;
      y: number;
    };
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: 'direct' | 'team';
  }>;
  maxDepth: number;
  totalNodes: number;
  lastCalculated: Date;
}

export interface TeamActivity {
  id: string;
  userId: string;
  type: 'new_member' | 'promotion' | 'sale' | 'commission';
  description: string;
  data?: Record<string, any>;
  createdAt: Date;
  relatedUserId?: string;
}

export interface TeamCacheStats {
  totalCached: number;
  byType: {
    teamHierarchy: number;
    teamStats: number;
    teamCommission: number;
    teamRanking: number;
    teamPath: number;
    teamNetwork: number;
    teamActivity: number;
  };
  hitRate: number;
  memoryUsage: number;
  lastUpdate: Date;
}

export interface TeamPerformance {
  userId: string;
  period: string;
  metrics: {
    sales: number;
    bottles: number;
    newMembers: number;
    commissionEarned: number;
    teamGrowthRate: number;
    productivity: number;
  };
  comparisons: {
    previousPeriod: number;
    teamAverage: number;
    rank: number;
  };
  achievements: Array<{
    type: string;
    name: string;
    description: string;
    earnedAt: Date;
  }>;
}