/**
 * 团队缓存服务
 * 提供团队相关数据的缓存管理
 */

import { cacheManager } from '../../../shared/cache/CacheManager';
import { logger } from '../../../shared/utils/logger';
import {
  TeamMember,
  TeamHierarchy,
  TeamStats,
  TeamCommission,
  TeamRanking,
  TeamPath,
  TeamNetwork,
  TeamActivity,
  TeamPerformance,
  TeamCacheStats
} from './team.cache.types';

export class TeamCacheService {
  private readonly KEY_PREFIX = 'team';

  // 团队层级结构缓存
  async getTeamHierarchy(userId: string): Promise<TeamHierarchy | null> {
    const key = `${this.KEY_PREFIX}:hierarchy:${userId}`;
    return await cacheManager.get<TeamHierarchy>(key);
  }

  async setTeamHierarchy(userId: string, data: TeamHierarchy): Promise<void> {
    const key = `${this.KEY_PREFIX}:hierarchy:${userId}`;
    await cacheManager.set(key, data, {
      ttl: 900, // 15分钟
      tags: ['team-hierarchy', `team:${userId}`]
    });
  }

  async invalidateTeamHierarchy(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['team-hierarchy', `team:${userId}`]);
  }

  // 团队统计缓存
  async getTeamStats(userId: string): Promise<TeamStats | null> {
    const key = `${this.KEY_PREFIX}:stats:${userId}`;
    return await cacheManager.get<TeamStats>(key);
  }

  async setTeamStats(userId: string, data: TeamStats): Promise<void> {
    const key = `${this.KEY_PREFIX}:stats:${userId}`;
    await cacheManager.set(key, data, {
      ttl: 300, // 5分钟
      tags: ['team-stats', `team:${userId}`]
    });
  }

  async invalidateTeamStats(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['team-stats', `team:${userId}`]);
  }

  // 团队成员列表缓存
  async getTeamMembers(userId: string, params: {
    page: number;
    perPage: number;
    level?: string;
    status?: string;
  }): Promise<TeamMember[] | null> {
    const key = this.generateTeamMembersKey(userId, params);
    return await cacheManager.get<TeamMember[]>(key);
  }

  async setTeamMembers(userId: string, params: {
    page: number;
    perPage: number;
    level?: string;
    status?: string;
  }, data: TeamMember[]): Promise<void> {
    const key = this.generateTeamMembersKey(userId, params);
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['team-members', `team:${userId}`]
    });
  }

  private generateTeamMembersKey(userId: string, params: any): string {
    const { page, perPage, level, status } = params;
    let key = `${this.KEY_PREFIX}:members:${userId}:${page}:${perPage}`;
    if (level) key += `:level:${level}`;
    if (status) key += `:status:${status}`;
    return key;
  }

  // 直接下级缓存
  async getDirectChildren(userId: string): Promise<TeamMember[] | null> {
    const key = `${this.KEY_PREFIX}:direct:${userId}`;
    return await cacheManager.get<TeamMember[]>(key);
  }

  async setDirectChildren(userId: string, data: TeamMember[]): Promise<void> {
    const key = `${this.KEY_PREFIX}:direct:${userId}`;
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['team-children', `team:${userId}`]
    });
  }

  async invalidateDirectChildren(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['team-children', `team:${userId}`]);
  }

  // 团队路径缓存（重要，优化查询）
  async getTeamPath(userId: string): Promise<TeamPath | null> {
    const key = `${this.KEY_PREFIX}:path:${userId}`;
    return await cacheManager.get<TeamPath>(key);
  }

  async setTeamPath(userId: string, data: TeamPath): Promise<void> {
    const key = `${this.KEY_PREFIX}:path:${userId}`;
    await cacheManager.set(key, data, {
      ttl: 3600, // 1小时
      tags: ['team-path', `team:${userId}`]
    });
  }

  async invalidateTeamPath(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['team-path', `team:${userId}`]);
  }

  // 团队佣金缓存
  async getTeamCommission(userId: string, period: string): Promise<TeamCommission | null> {
    const key = `${this.KEY_PREFIX}:commission:${userId}:${period}`;
    return await cacheManager.get<TeamCommission>(key);
  }

  async setTeamCommission(userId: string, period: string, data: TeamCommission): Promise<void> {
    const key = `${this.KEY_PREFIX}:commission:${userId}:${period}`;
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['team-commission', `team:${userId}`]
    });
  }

  async invalidateTeamCommission(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['team-commission', `team:${userId}`]);
  }

  // 团队排行缓存
  async getTeamRanking(period: 'day' | 'week' | 'month' = 'week'): Promise<TeamRanking | null> {
    const key = `${this.KEY_PREFIX}:ranking:${period}`;
    return await cacheManager.get<TeamRanking>(key);
  }

  async setTeamRanking(period: 'day' | 'week' | 'month' = 'week', data: TeamRanking): Promise<void> {
    const key = `${this.KEY_PREFIX}:ranking:${period}`;
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['team-ranking']
    });
  }

  async invalidateTeamRanking(): Promise<void> {
    await cacheManager.invalidateTags(['team-ranking']);
  }

  // 团队网络图缓存
  async getTeamNetwork(userId: string, maxDepth: number = 5): Promise<TeamNetwork | null> {
    const key = `${this.KEY_PREFIX}:network:${userId}:depth:${maxDepth}`;
    return await cacheManager.get<TeamNetwork>(key);
  }

  async setTeamNetwork(userId: string, maxDepth: number, data: TeamNetwork): Promise<void> {
    const key = `${this.KEY_PREFIX}:network:${userId}:depth:${maxDepth}`;
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['team-network', `team:${userId}`]
    });
  }

  async invalidateTeamNetwork(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['team-network', `team:${userId}`]);
  }

  // 团队活动缓存
  async getTeamActivities(userId: string, params: {
    page: number;
    perPage: number;
    type?: string;
    days?: number;
  }): Promise<TeamActivity[] | null> {
    const key = this.generateTeamActivitiesKey(userId, params);
    return await cacheManager.get<TeamActivity[]>(key);
  }

  async setTeamActivities(userId: string, params: {
    page: number;
    perPage: number;
    type?: string;
    days?: number;
  }, data: TeamActivity[]): Promise<void> {
    const key = this.generateTeamActivitiesKey(userId, params);
    await cacheManager.set(key, data, {
      ttl: 300, // 5分钟
      tags: ['team-activity', `team:${userId}`]
    });
  }

  private generateTeamActivitiesKey(userId: string, params: any): string {
    const { page, perPage, type, days } = params;
    let key = `${this.KEY_PREFIX}:activities:${userId}:${page}:${perPage}`;
    if (type) key += `:type:${type}`;
    if (days) key += `:days:${days}`;
    return key;
  }

  // 团队业绩缓存
  async getTeamPerformance(userId: string, period: string): Promise<TeamPerformance | null> {
    const key = `${this.KEY_PREFIX}:performance:${userId}:${period}`;
    return await cacheManager.get<TeamPerformance>(key);
  }

  async setTeamPerformance(userId: string, period: string, data: TeamPerformance): Promise<void> {
    const key = `${this.KEY_PREFIX}:performance:${userId}:${period}`;
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['team-performance', `team:${userId}`]
    });
  }

  async invalidateTeamPerformance(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['team-performance', `team:${userId}`]);
  }

  // 团队升级进度缓存
  async getUpgradeProgress(userId: string): Promise<{
    currentLevel: string;
    nextLevel?: string;
    progress: number;
    requirements: Record<string, any>;
  } | null> {
    const key = `${this.KEY_PREFIX}:upgrade:${userId}`;
    return await cacheManager.get<any>(key);
  }

  async setUpgradeProgress(userId: string, data: any): Promise<void> {
    const key = `${this.KEY_PREFIX}:upgrade:${userId}`;
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['team-upgrade', `team:${userId}`]
    });
  }

  async invalidateUpgradeProgress(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['team-upgrade', `team:${userId}`]);
  }

  // 批量获取团队成员路径
  async getTeamPaths(userIds: string[]): Promise<Map<string, TeamPath | null>> {
    const keys = userIds.map(id => `${this.KEY_PREFIX}:path:${id}`);
    const values = await cacheManager.mget<TeamPath>(keys);

    const result = new Map<string, TeamPath | null>();
    userIds.forEach((id, index) => {
      result.set(id, values[index]);
    });

    return result;
  }

  // 批量设置团队成员路径
  async setTeamPaths(paths: Array<{ userId: string; data: TeamPath }>): Promise<void> {
    const items = paths.map(path => ({
      key: `${this.KEY_PREFIX}:path:${path.userId}`,
      value: path.data,
      options: {
        ttl: 3600,
        tags: ['team-path', `team:${path.userId}`]
      }
    }));

    await cacheManager.mset(items);
  }

  // 查找团队成员（通过路径）
  async findMembersByPath(rootUserId: string, pathPattern: string): Promise<TeamMember[] | null> {
    const key = `${this.KEY_PREFIX}:find:${rootUserId}:${pathPattern}`;
    return await cacheManager.get<TeamMember[]>(key);
  }

  async setMembersByPath(rootUserId: string, pathPattern: string, data: TeamMember[]): Promise<void> {
    const key = `${this.KEY_PREFIX}:find:${rootUserId}:${pathPattern}`;
    await cacheManager.set(key, data, {
      ttl: 900, // 15分钟
      tags: ['team-search', `team:${rootUserId}`]
    });
  }

  // 清除团队所有缓存
  async invalidateAllTeamCache(userId: string): Promise<void> {
    await cacheManager.invalidateTags([`team:${userId}`]);
  }

  // 清除团队层级缓存（当有成员变动时）
  async invalidateTeamHierarchyCache(userId: string): Promise<void> {
    // 获取团队路径
    const teamPath = await this.getTeamPath(userId);
    if (teamPath) {
      // 清除路径上所有用户的相关缓存
      const pathUserIds = teamPath.path.split(',').filter(Boolean);
      for (const pathUserId of pathUserIds) {
        await this.invalidateTeamHierarchy(pathUserId);
      }
    }
  }

  // 预热团队缓存
  async warmupTeamCache(userId: string): Promise<void> {
    // 预热关键数据
    await Promise.all([
      this.getTeamHierarchy(userId),
      this.getTeamStats(userId),
      this.getDirectChildren(userId),
      this.getTeamPath(userId)
    ]);
    logger.info(`预热团队缓存: ${userId}`);
  }

  // 批量预热团队缓存
  async warmupTeamCaches(userIds: string[]): Promise<void> {
    const promises = userIds.map(id => this.warmupTeamCache(id));
    await Promise.all(promises);
  }

  // 获取缓存统计
  async getCacheStats(): Promise<TeamCacheStats> {
    const stats = await cacheManager.getStats();

    // 获取各类型缓存数量
    const hierarchyKeys = await cacheManager.keys(`${this.KEY_PREFIX}:hierarchy:*`);
    const statsKeys = await cacheManager.keys(`${this.KEY_PREFIX}:stats:*`);
    const membersKeys = await cacheManager.keys(`${this.KEY_PREFIX}:members:*`);
    const commissionKeys = await cacheManager.keys(`${this.KEY_PREFIX}:commission:*`);
    const rankingKeys = await cacheManager.keys(`${this.KEY_PREFIX}:ranking:*`);
    const pathKeys = await cacheManager.keys(`${this.KEY_PREFIX}:path:*`);
    const networkKeys = await cacheManager.keys(`${this.KEY_PREFIX}:network:*`);
    const activityKeys = await cacheManager.keys(`${this.KEY_PREFIX}:activities:*`);

    return {
      totalCached: hierarchyKeys.length + statsKeys.length + membersKeys.length +
                  commissionKeys.length + rankingKeys.length + pathKeys.length +
                  networkKeys.length + activityKeys.length,
      byType: {
        teamHierarchy: hierarchyKeys.length,
        teamStats: statsKeys.length,
        teamCommission: commissionKeys.length,
        teamRanking: rankingKeys.length,
        teamPath: pathKeys.length,
        teamNetwork: networkKeys.length,
        teamActivity: activityKeys.length
      },
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsage || 0,
      lastUpdate: new Date()
    };
  }

  // 清理过期团队缓存
  async cleanupExpiredTeamCache(): Promise<number> {
    const keys = await cacheManager.keys(`${this.KEY_PREFIX}:*`);
    let cleanedCount = 0;

    for (const key of keys) {
      const ttl = await cacheManager.ttl(key);
      if (ttl === -2) { // 已过期
        await cacheManager.del(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理了${cleanedCount}个过期的团队缓存`);
    }

    return cleanedCount;
  }

  // 获取团队影响力排行榜（按业绩）
  async getTeamInfluenceRanking(limit: number = 50): Promise<Array<{
    userId: string;
    nickname: string | null;
    level: string;
    teamSize: number;
    totalSales: number;
    score: number;
  }>> | null> {
    const key = `${this.KEY_PREFIX}:influence:ranking:${limit}`;
    return await cacheManager.get<any>(key);
  }

  async setTeamInfluenceRanking(data: any, limit: number = 50): Promise<void> {
    const key = `${this.KEY_PREFIX}:influence:ranking:${limit}`;
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['team-ranking']
    });
  }
}