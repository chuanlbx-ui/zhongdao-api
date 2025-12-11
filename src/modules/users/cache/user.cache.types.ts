/**
 * 用户缓存类型定义
 */

export interface CachedUser {
  id: string;
  openid: string;
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  level: string;
  status: string;
  pointsBalance: number;
  pointsFrozen: number;
  parentId: string | null;
  teamPath: string | null;
  teamLevel: number;
  totalSales: number;
  totalBottles: number;
  directSales: number;
  teamSales: number;
  directCount: number;
  teamCount: number;
  cloudShopLevel: number;
  hasWutongShop: boolean;
  referralCode: string;
  isAdmin?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLevelProgress {
  currentLevel: {
    key: string;
    name: string;
    discount: number;
    monthlyReward: number;
    monthlyBonus: number;
    benefits: string[];
  };
  nextLevel: {
    key: string;
    name: string;
    discount: number;
    benefits: string[];
  } | null;
  progress: number;
  upgradeProgress: Record<string, any>;
  userData: {
    directCount: number;
    teamSales: number;
    pointsBalance: number;
  };
}

export interface UserReferralInfo {
  referralCode: string;
  directCount: number;
  teamCount: number;
  teamLevel: number;
  userLevel: string;
  recentReferrals: Array<{
    id: string;
    nickname: string | null;
    level: string;
    createdAt: Date;
  }>;
  levelStats: Record<string, any>;
}

export interface UserTeamInfo {
  directCount: number;
  teamCount: number;
  members: Array<{
    id: string;
    nickname: string | null;
    level: string;
    status: string;
    teamPath: string | null;
    totalPurchases: number;
    joinedAt: Date;
    lastActiveAt: Date;
  }>;
  stats: {
    totalMembers: number;
    activeMembers: number;
    totalSales: number;
    totalPurchases: number;
  };
}

export interface UserStatistics {
  totalSales: number;
  totalBottles: number;
  directSales: number;
  teamSales: number;
  directCount: number;
  teamCount: number;
  pointsBalance: number;
  monthlyPerformance?: Array<{
    year: number;
    month: number;
    sales: number;
    bottles: number;
    newMembers: number;
  }>;
  totalUsers?: number;
  levelDistribution?: Record<string, number>;
}

export interface UserReferrals {
  referralCode: string;
  referrals: Array<{
    id: string;
    nickname: string | null;
    level: string;
    createdAt: Date;
  }>;
  directCount: number;
  teamCount: number;
}