import { prisma } from '../database/client';
import { logger } from '../utils/logger';

/**
 * 团队统计服务
 * 处理用户注册后团队统计数据的更新
 */

/**
 * 更新推荐人的直推人数和团队人数统计
 * @param referrerId 推荐人ID
 */
export async function updateReferrerStats(referrerId: string) {
  try {
    // 获取推荐人的所有直推用户
    const directReferrals = await prisma.users.findMany({
      where: { parentId: referrerId },
      select: { id: true }
    });

    // 计算团队总人数（包括所有下级）
    const teamCount = await calculateTeamCount(referrerId);

    // 更新推荐人的统计数据
    await prisma.users.update({
      where: { id: referrerId },
      data: {
        directCount: directReferrals.length,
        teamCount
      }
    });

    logger.info('推荐人统计更新成功', {
      referrerId,
      directCount: directReferrals.length,
      teamCount
    });

  } catch (error) {
    logger.error('更新推荐人统计失败', {
      referrerId,
      error: error instanceof Error ? error.message : '未知错误'
    });
    throw error;
  }
}

/**
 * 递归计算团队总人数
 * @param userId 用户ID
 * @returns 团队总人数
 */
async function calculateTeamCount(userId: string): Promise<number> {
  try {
    const directReferrals = await prisma.users.findMany({
      where: { parentId: userId },
      select: { id: true }
    });

    let totalCount = directReferrals.length;

    // 递归计算每个直推用户的团队人数
    for (const referral of directReferrals) {
      totalCount += await calculateTeamCount(referral.id);
    }

    return totalCount;
  } catch (error) {
    logger.error('计算团队人数失败', {
      userId,
      error: error instanceof Error ? error.message : '未知错误'
    });
    return 0;
  }
}

/**
 * 更新整个推荐链上的统计信息
 * @param userId 新注册用户ID
 */
export async function updateReferralChainStats(userId: string) {
  try {
    // 获取用户的推荐人
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { parentId: true }
    });

    if (!user?.parentId) {
      return; // 没有推荐人，不需要更新
    }

    // 从直接推荐人开始，向上更新整个推荐链
    let currentReferrerId = user.parentId;

    while (currentReferrerId) {
      await updateReferrerStats(currentReferrerId);

      // 获取当前推荐人的推荐人，继续向上更新
      const currentReferrer = await prisma.users.findUnique({
        where: { id: currentReferrerId },
        select: { parentId: true }
      });

      currentReferrerId = currentReferrer?.parentId || null;
    }

    logger.info('推荐链统计更新完成', { userId });

  } catch (error) {
    logger.error('更新推荐链统计失败', {
      userId,
      error: error instanceof Error ? error.message : '未知错误'
    });
    throw error;
  }
}

/**
 * 验证并创建推荐关系
 * @param referralCode 推荐码
 * @param newUserId 新用户ID
 * @returns 推荐关系信息
 */
export async function createReferralRelationship(referralCode: string, newUserId: string) {
  try {
    // 查找推荐人
    const referrer = await prisma.users.findUnique({
      where: { referralCode },
      select: {
        id: true,
        teamLevel: true,
        teamPath: true,
        parentId: true
      }
    });

    if (!referrer) {
      throw new Error('推荐码不存在');
    }

    // 计算新用户的团队层级和路径
    const newTeamLevel = (referrer.teamLevel || 1) + 1;
    const newTeamPath = referrer.teamPath
      ? `${referrer.teamPath}${referrer.id}/`
      : `/${referrer.id}/`;

    // 更新新用户的推荐关系
    await prisma.users.update({
      where: { id: newUserId },
      data: {
        parentId: referrer.id,
        teamLevel: newTeamLevel,
        teamPath: newTeamPath
      }
    });

    // 更新整个推荐链的统计信息
    await updateReferralChainStats(newUserId);

    logger.info('推荐关系创建成功', {
      newUserId,
      referrerId: referrer.id,
      teamLevel: newTeamLevel
    });

    return {
      referrerId: referrer.id,
      teamLevel: newTeamLevel,
      teamPath: newTeamPath
    };

  } catch (error) {
    logger.error('创建推荐关系失败', {
      referralCode,
      newUserId,
      error: error instanceof Error ? error.message : '未知错误'
    });
    throw error;
  }
}

/**
 * 获取用户的推荐统计信息
 * @param userId 用户ID
 * @returns 推荐统计信息
 */
export async function getReferralStats(userId: string) {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        referralCode: true,
        directCount: true,
        teamCount: true,
        teamLevel: true,
        level: true
      }
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    // 获取最近的直推用户
    const recentReferrals = await prisma.users.findMany({
      where: { parentId: userId },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        level: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // 计算各等级的用户数量
    const levelStats = await prisma.users.groupBy({
      by: ['level'],
      where: { parentId: userId },
      _count: true
    });

    return {
      user,
      recentReferrals,
      levelStats: levelStats.map(stat => ({
        level: stat.level.toLowerCase(),
        count: stat._count
      }))
    };

  } catch (error) {
    logger.error('获取推荐统计失败', {
      userId,
      error: error instanceof Error ? error.message : '未知错误'
    });
    throw error;
  }
}