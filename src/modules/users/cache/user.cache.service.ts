/**
 * 用户缓存服务
 * 提供用户相关数据的缓存管理
 */

import { cacheManager } from '../../../shared/cache/CacheManager';
import { logger } from '../../../shared/utils/logger';
import {
  CachedUser,
  UserLevelProgress,
  UserReferralInfo,
  UserTeamInfo,
  UserStatistics,
  UserReferrals
} from './user.cache.types';

export class UserCacheService {
  private readonly KEY_PREFIX = 'user';

  // 用户基本信息缓存
  async getUserProfile(userId: string): Promise<CachedUser | null> {
    const key = `${this.KEY_PREFIX}:${userId}:profile`;
    return await cacheManager.get<CachedUser>(key);
  }

  async setUserProfile(userId: string, data: CachedUser): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:profile`;
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['user-profile', `user:${userId}`]
    });
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-profile', `user:${userId}`]);
  }

  // 用户等级进度缓存
  async getUserLevelProgress(userId: string): Promise<UserLevelProgress | null> {
    const key = `${this.KEY_PREFIX}:${userId}:level-progress`;
    return await cacheManager.get<UserLevelProgress>(key);
  }

  async setUserLevelProgress(userId: string, data: UserLevelProgress): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:level-progress`;
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['user-level', `user:${userId}`]
    });
  }

  async invalidateUserLevelProgress(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-level', `user:${userId}`]);
  }

  // 用户推荐信息缓存
  async getUserReferralInfo(userId: string): Promise<UserReferralInfo | null> {
    const key = `${this.KEY_PREFIX}:${userId}:referral-info`;
    return await cacheManager.get<UserReferralInfo>(key);
  }

  async setUserReferralInfo(userId: string, data: UserReferralInfo): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:referral-info`;
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['user-referral', `user:${userId}`]
    });
  }

  async invalidateUserReferralInfo(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-referral', `user:${userId}`]);
  }

  // 用户团队信息缓存
  async getUserTeamInfo(userId: string): Promise<UserTeamInfo | null> {
    const key = `${this.KEY_PREFIX}:${userId}:team-info`;
    return await cacheManager.get<UserTeamInfo>(key);
  }

  async setUserTeamInfo(userId: string, data: UserTeamInfo): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:team-info`;
    await cacheManager.set(key, data, {
      ttl: 300, // 5分钟
      tags: ['user-team', `user:${userId}`]
    });
  }

  async invalidateUserTeamInfo(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-team', `user:${userId}`]);
  }

  // 用户统计数据缓存
  async getUserStatistics(userId: string, isGlobal = false): Promise<UserStatistics | null> {
    const key = `${this.KEY_PREFIX}:${userId}:statistics:global:${isGlobal}`;
    return await cacheManager.get<UserStatistics>(key);
  }

  async setUserStatistics(userId: string, isGlobal: boolean, data: UserStatistics): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:statistics:global:${isGlobal}`;
    await cacheManager.set(key, data, {
      ttl: 300, // 5分钟
      tags: ['user-stats', `user:${userId}`]
    });
  }

  async invalidateUserStatistics(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-stats', `user:${userId}`]);
  }

  // 用户推荐记录缓存
  async getUserReferrals(userId: string): Promise<UserReferrals | null> {
    const key = `${this.KEY_PREFIX}:${userId}:referrals`;
    return await cacheManager.get<UserReferrals>(key);
  }

  async setUserReferrals(userId: string, data: UserReferrals): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:referrals`;
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['user-referrals', `user:${userId}`]
    });
  }

  async invalidateUserReferrals(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-referrals', `user:${userId}`]);
  }

  // 用户积分余额缓存（特别短TTL）
  async getUserPointsBalance(userId: string): Promise<number | null> {
    const key = `${this.KEY_PREFIX}:${userId}:points-balance`;
    return await cacheManager.get<number>(key);
  }

  async setUserPointsBalance(userId: string, balance: number): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:points-balance`;
    await cacheManager.set(key, balance, {
      ttl: 30, // 30秒
      tags: ['user-points', `user:${userId}`]
    });
  }

  async invalidateUserPointsBalance(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-points', `user:${userId}`]);
  }

  // 用户团队路径缓存（优化团队查询）
  async getUserTeamPath(userId: string): Promise<string | null> {
    const key = `${this.KEY_PREFIX}:${userId}:team-path`;
    return await cacheManager.get<string>(key);
  }

  async setUserTeamPath(userId: string, teamPath: string): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:team-path`;
    await cacheManager.set(key, teamPath, {
      ttl: 3600, // 1小时
      tags: ['user-team-path', `user:${userId}`]
    });
  }

  async invalidateUserTeamPath(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-team-path', `user:${userId}`]);
  }

  // 用户上级信息缓存
  async getUserParent(userId: string): Promise<{ id: string; nickname: string | null; level: string } | null> {
    const key = `${this.KEY_PREFIX}:${userId}:parent`;
    return await cacheManager.get<{ id: string; nickname: string | null; level: string }>(key);
  }

  async setUserParent(userId: string, parent: { id: string; nickname: string | null; level: string }): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:parent`;
    await cacheManager.set(key, parent, {
      ttl: 1800, // 30分钟
      tags: ['user-parent', `user:${userId}`]
    });
  }

  async invalidateUserParent(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-parent', `user:${userId}`]);
  }

  // 用户直接下级列表缓存
  async getUserDirectChildren(userId: string): Promise<Array<{ id: string; nickname: string | null; level: string }> | null> {
    const key = `${this.KEY_PREFIX}:${userId}:direct-children`;
    return await cacheManager.get<Array<{ id: string; nickname: string | null; level: string }>>(key);
  }

  async setUserDirectChildren(userId: string, children: Array<{ id: string; nickname: string | null; level: string }>): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}:direct-children`;
    await cacheManager.set(key, children, {
      ttl: 600, // 10分钟
      tags: ['user-children', `user:${userId}`]
    });
  }

  async invalidateUserDirectChildren(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['user-children', `user:${userId}`]);
  }

  // 批量操作
  async getUserProfiles(userIds: string[]): Promise<Map<string, CachedUser | null>> {
    const keys = userIds.map(id => `${this.KEY_PREFIX}:${id}:profile`);
    const values = await cacheManager.mget<CachedUser>(keys);

    const result = new Map<string, CachedUser | null>();
    userIds.forEach((id, index) => {
      result.set(id, values[index]);
    });

    return result;
  }

  async setUserProfiles(users: Array<{ id: string; data: CachedUser }>): Promise<void> {
    const items = users.map(user => ({
      key: `${this.KEY_PREFIX}:${user.id}:profile`,
      value: user.data,
      options: {
        ttl: 600,
        tags: ['user-profile', `user:${user.id}`]
      }
    }));

    await cacheManager.mset(items);
  }

  // 批量清除用户缓存
  async invalidateAllUserData(userId: string): Promise<void> {
    await cacheManager.invalidateTags([`user:${userId}`]);
  }

  // 预热用户缓存
  async warmupUserCache(userId: string): Promise<void> {
    // 这个方法可以调用用户服务获取所有相关数据并缓存
    logger.info(`预热用户缓存: ${userId}`);
  }

  // 批量预热用户缓存
  async warmupUserCaches(userIds: string[]): Promise<void> {
    const promises = userIds.map(id => this.warmupUserCache(id));
    await Promise.all(promises);
  }

  // 获取用户缓存统计
  async getUserCacheStats(userId: string): Promise<{
    profile: boolean;
    levelProgress: boolean;
    referralInfo: boolean;
    teamInfo: boolean;
    statistics: boolean;
    referrals: boolean;
  }> {
    const keys = [
      `${this.KEY_PREFIX}:${userId}:profile`,
      `${this.KEY_PREFIX}:${userId}:level-progress`,
      `${this.KEY_PREFIX}:${userId}:referral-info`,
      `${this.KEY_PREFIX}:${userId}:team-info`,
      `${this.KEY_PREFIX}:${userId}:statistics:global:false`,
      `${this.KEY_PREFIX}:${userId}:referrals`
    ];

    const values = await cacheManager.mget<any>(keys);

    return {
      profile: values[0] !== null,
      levelProgress: values[1] !== null,
      referralInfo: values[2] !== null,
      teamInfo: values[3] !== null,
      statistics: values[4] !== null,
      referrals: values[5] !== null
    };
  }

  // 清除过期用户缓存
  async cleanupExpiredUserCache(): Promise<number> {
    // 获取所有用户缓存键
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
      logger.info(`清理了${cleanedCount}个过期的用户缓存`);
    }

    return cleanedCount;
  }
}