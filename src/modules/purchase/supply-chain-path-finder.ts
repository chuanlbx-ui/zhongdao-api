import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { UserLevel } from '../user/level.service';
import { UserForValidation, UplineSearchResult, SupplyChainPath } from './types';

// 缓存配置
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const MAX_CACHE_SIZE = 1000; // 最大缓存条目数

/**
 * 简单的内存缓存实现
 */
class MemoryCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();

  set(key: string, value: T): void {
    // 如果缓存满了，删除最旧的条目
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + CACHE_TTL
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * 供应链路径查找器
 * 负责查找和计算供应链中的最优路径
 */
export class SupplyChainPathFinder {
  private userCache = new MemoryCache<UserForValidation>();
  private uplineChainCache = new MemoryCache<UserForValidation[]>();

  /**
   * 查找更高级别的上级
   * @param startUserId 起始用户ID
   * @param minLevelIndex 最低等级索引（必须高于这个等级）
   * @param maxDepth 最大搜索深度
   * @returns 查找结果
   */
  async findHigherLevelUpline(
    startUserId: string,
    minLevelIndex: number,
    maxDepth: number = 10
  ): Promise<UplineSearchResult | null> {
    const levels = Object.values(UserLevel);
    const searchPath: string[] = [startUserId];
    let currentUserId = startUserId;

    try {
      // 预先获取所有可能的上级路径
      const uplineChain = await this.getUplineChain(currentUserId, maxDepth);

      if (!uplineChain || uplineChain.length === 0) {
        return null;
      }

      // 在内存中处理等级比较，减少数据库查询
      for (const uplineUser of uplineChain) {
        if (uplineUser.status !== 'ACTIVE') {
          continue;
        }

        const uplineLevel = uplineUser.level;
        const uplineLevelIndex = levels.indexOf(uplineLevel);

        // 找到足够高级别的上级
        if (uplineLevelIndex > minLevelIndex) {
          // 计算搜索路径
          const pathIndex = uplineChain.indexOf(uplineUser);
          const finalSearchPath = searchPath.concat(
            uplineChain.slice(0, pathIndex + 1).map(u => u.id)
          );

          return {
            user: uplineUser,
            level: uplineLevel,
            searchPath: finalSearchPath
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('查找更高级别上级失败', {
        startUserId,
        minLevelIndex,
        maxDepth,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * 获取上级链 - 优化版本，使用单次查询获取完整路径（带缓存）
   * @param userId 用户ID
   * @param maxDepth 最大深度
   * @returns 上级用户链
   */
  async getUplineChain(userId: string, maxDepth: number): Promise<UserForValidation[]> {
    const cacheKey = `upline:${userId}:${maxDepth}`;

    // 尝试从缓存获取
    const cachedChain = this.uplineChainCache.get(cacheKey);
    if (cachedChain) {
      return cachedChain;
    }

    try {
      // 使用 teamPath 字段来优化查询，如果可用的话
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          teamPath: true,
          parentId: true
        }
      });

      if (!user) {
        return [];
      }

      let uplineChain: UserForValidation[] = [];

      // 如果有 teamPath，解析路径来批量获取上级
      if (user.teamPath) {
        uplineChain = await this.getUplineFromPath(user.teamPath, maxDepth);
      } else {
        // 回退到逐级查询
        uplineChain = await this.getUplineByTraversal(userId, maxDepth);
      }

      // 缓存结果
      if (uplineChain.length > 0) {
        this.uplineChainCache.set(cacheKey, uplineChain);
      }

      return uplineChain;
    } catch (error) {
      logger.error('获取上级链失败', {
        userId,
        maxDepth,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 从 teamPath 获取上级链
   * @param teamPath 团队路径
   * @param maxDepth 最大深度
   * @returns 上级用户链
   */
  private async getUplineFromPath(teamPath: string, maxDepth: number): Promise<UserForValidation[]> {
    try {
      // 解析路径，获取所有上级ID
      const pathIds = teamPath.split('/').filter(id => id);
      const uplineIds = pathIds.slice(-maxDepth); // 取最后 maxDepth 个上级

      if (uplineIds.length === 0) {
        return [];
      }

      // 批量查询所有上级用户
      const uplines = await prisma.users.findMany({
        where: {
          id: { in: uplineIds },
          status: 'ACTIVE'
        },
        select: {
          id: true,
          level: true,
          status: true,
          parentId: true,
          teamPath: true
        },
        orderBy: {
          createdAt: 'asc' // 按时间排序，确保正确顺序
        }
      });

      return uplines as UserForValidation[];
    } catch (error) {
      logger.error('从路径获取上级链失败', {
        teamPath,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 通过遍历获取上级链 - 回退方案
   * @param userId 用户ID
   * @param maxDepth 最大深度
   * @returns 上级用户链
   */
  private async getUplineByTraversal(userId: string, maxDepth: number): Promise<UserForValidation[]> {
    const uplines: UserForValidation[] = [];
    let currentUserId = userId;

    try {
      for (let depth = 0; depth < maxDepth; depth++) {
        const user = await prisma.users.findUnique({
          where: { id: currentUserId },
          select: {
            parentId: true
          }
        });

        if (!user || !user.parentId) {
          break;
        }

        // 获取上级用户
        const upline = await prisma.users.findUnique({
          where: { id: user.parentId },
          select: {
            id: true,
            level: true,
            status: true,
            parentId: true,
            teamPath: true
          }
        });

        if (!upline) {
          break;
        }

        uplines.push(upline as UserForValidation);
        currentUserId = user.parentId;

        // 如果到达非活跃用户，继续往上找
        if (upline.status !== 'ACTIVE') {
          continue;
        }
      }

      return uplines;
    } catch (error) {
      logger.error('遍历获取上级链失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 查找最优供应链路径
   * 从用户向上查找可以采购的合格供应商
   * @param userId 用户ID
   * @param maxDepth 最大搜索深度
   * @returns 供应链路径
   */
  async findOptimalSupplyPath(userId: string, maxDepth: number = 10): Promise<SupplyChainPath> {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        return {
          path: [],
          totalDistance: 0,
          isValid: false
        };
      }

      const userLevelIndex = Object.values(UserLevel).indexOf(user.level);
      const uplineChain = await this.getUplineChain(userId, maxDepth);

      // 筛选出可以采购的供应商（等级高于当前用户）
      const validSuppliers = uplineChain
        .filter(upline => {
          const uplineLevelIndex = Object.values(UserLevel).indexOf(upline.level);
          return upline.status === 'ACTIVE' && uplineLevelIndex > userLevelIndex;
        })
        .map((upline, index) => ({
          userId: upline.id,
          level: upline.level,
          distance: index + 1
        }));

      return {
        path: validSuppliers,
        totalDistance: validSuppliers.length,
        isValid: validSuppliers.length > 0
      };
    } catch (error) {
      logger.error('查找最优供应链路径失败', {
        userId,
        maxDepth,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        path: [],
        totalDistance: 0,
        isValid: false
      };
    }
  }

  /**
   * 获取用户信息（带缓存）
   */
  private async getUser(userId: string): Promise<UserForValidation | null> {
    const cacheKey = `user:${userId}`;

    // 尝试从缓存获取
    const cachedUser = this.userCache.get(cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          level: true,
          status: true,
          parentId: true,
          teamPath: true
        }
      });

      if (user) {
        this.userCache.set(cacheKey, user as UserForValidation);
      }

      return user as UserForValidation | null;
    } catch (error) {
      logger.error('获取用户信息失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.userCache.clear();
    this.uplineChainCache.clear();
    logger.info('供应链路径查找器缓存已清理');
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      userCacheSize: this.userCache.size(),
      uplineChainCacheSize: this.uplineChainCache.size()
    };
  }
}