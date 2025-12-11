import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { PointsBalance } from './types';

export class BalanceService {
  // 获取用户通券余额
  async getBalance(userId: string): Promise<PointsBalance> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          pointsBalance: true,
          pointsFrozen: true
        }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      return {
        userId,
        balance: user.pointsBalance,
        frozen: user.pointsFrozen,
        available: user.pointsBalance - user.pointsFrozen
      };
    } catch (error) {
      logger.error('获取通券余额失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 更新用户余额（内部方法）
  async updateUserBalance(
    tx: any,
    userId: string,
    data: {
      balance?: number;
      frozen?: number;
    }
  ): Promise<void> {
    await tx.users.update({
      where: { id: userId },
      data: {
        ...(data.balance !== undefined && { pointsBalance: data.balance }),
        ...(data.frozen !== undefined && { pointsFrozen: data.frozen })
      }
    });
  }

  // 检查用户余额是否足够
  async checkBalance(
    userId: string,
    amount: number,
    includeFrozen: boolean = false
  ): Promise<boolean> {
    const balance = await this.getBalance(userId);
    if (includeFrozen) {
      return balance.balance >= amount;
    }
    return balance.available >= amount;
  }

  // 获取用户余额详情（用于内部验证）
  async getUserBalanceDetails(userId: string) {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          pointsBalance: true,
          pointsFrozen: true,
          level: true,
          status: true,
          nickname: true
        }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      return user;
    } catch (error) {
      logger.error('获取用户余额详情失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const balanceService = new BalanceService();