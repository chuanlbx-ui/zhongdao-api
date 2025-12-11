import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { PointsTransferResult, PointsTransactionType } from './types';
import { balanceService } from './balance.service';
import { transactionService } from './transaction.service';

export class RechargeService {
  // 通券充值（五星/董事专属）
  async recharge(
    userId: string,
    amount: number,
    paymentMethod: string = 'manual',
    description?: string,
    operatorId?: string
  ): Promise<PointsTransferResult> {
    if (amount <= 0) {
      throw new Error('充值金额必须大于0');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 检查用户权限和状态
        const user = await balanceService.getUserBalanceDetails(userId);

        // 充值权限已在路由层验证，这里不需要额外检查

        if (user.status !== 'ACTIVE') {
          throw new Error('用户账户状态异常');
        }

        // 生成交易号
        const transactionNo = transactionService.generateTransactionNo();

        // 创建充值交易记录
        const transaction = await transactionService.createTransaction(tx, {
          transactionNo: `${transactionNo}_RECHARGE`,
          fromUserId: 'SYSTEM', // 系统充值
          toUserId: userId,
          amount,
          type: PointsTransactionType.RECHARGE,
          description: description || `用户${user.nickname || userId}充值`,
          status: 'COMPLETED' as any,
          balanceBefore: user.pointsBalance,
          balanceAfter: user.pointsBalance + amount,
          metadata: {
            paymentMethod,
            operatorId,
            userLevel: user.level,
            rechargeType: 'manual'
          },
          completedAt: new Date()
        });

        // 更新用户余额
        await balanceService.updateUserBalance(tx, userId, {
          balance: user.pointsBalance + amount
        });

        logger.info('通券充值成功', {
          transactionNo,
          userId,
          amount,
          userLevel: user.level,
          paymentMethod,
          operatorId
        });

        return {
          success: true,
          data: {
            transactionId: transaction.id,
            fromUserId: 'SYSTEM',
            toUserId: userId,
            amount
          },
          transactionNo: transaction.transactionNo,
          fromUserId: 'SYSTEM',
          toUserId: userId,
          type: PointsTransactionType.RECHARGE,
          description: description || '充值'
        };
      });
    } catch (error) {
      logger.error('通券充值失败', {
        userId,
        amount,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const rechargeService = new RechargeService();