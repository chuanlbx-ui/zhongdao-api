import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import {
  PointsTransactionData,
  PointsTransferResult,
  PointsTransactionType,
  DeduplicationResult
} from './types';
import { balanceService } from './balance.service';
import { transactionService } from './transaction.service';

export class TransferService {
  // 根据标识符查找用户ID
  // 支持：userId、userNumber、phone
  private async getUserIdByIdentifier(identifier: string): Promise<string> {
    // 首先尝试直接按ID查找
    let user = await prisma.users.findUnique({
      where: { id: identifier },
      select: { id: true }
    });

    // 如果找不到，尝试按userNumber查找
    if (!user) {
      user = await prisma.users.findUnique({
        where: { userNumber: identifier },
        select: { id: true }
      });
    }

    // 如果找不到，尝试按phone查找
    if (!user) {
      user = await prisma.users.findUnique({
        where: { phone: identifier },
        select: { id: true }
      });
    }

    if (!user) {
      throw new Error('用户不存在');
    }

    return user.id;
  }

  // 通券转账（增强版，含防重复和权限验证）
  async transfer(data: PointsTransactionData): Promise<PointsTransferResult> {
    let { fromUserId, toUserId, amount, type, description, relatedOrderId, metadata } = data;

    if (!fromUserId) {
      throw new Error('转出用户ID不能为空');
    }

    // 检查金额
    if (amount <= 0) {
      throw new Error('转账金额必须大于0');
    }

    // 解析转出用户ID（确保是有效的用户ID）
    fromUserId = await this.getUserIdByIdentifier(fromUserId);

    // 解析转入用户ID（支持userId、userNumber、phone）
    const resolvedToUserId = await this.getUserIdByIdentifier(toUserId);
    toUserId = resolvedToUserId;

    // 检查是否给自己转账
    if (fromUserId === toUserId) {
      throw new Error('不能给自己转账');
    }

    // 防重复提交检查
    const duplicateCheck: DeduplicationResult = await transactionService.checkDuplicateSubmission(
      fromUserId,
      amount,
      type
    );
    if (!duplicateCheck.success) {
      return {
        success: false,
        message: '请勿重复提交，请稍后再试',
        data: {
          transactionId: duplicateCheck.existingTransaction?.id,
          fromUserId,
          toUserId,
          amount
        }
      };
    }

    try {
      // 开启事务
      return await prisma.$transaction(async (tx) => {
        // 检查转出用户余额
        const fromUserId = await balanceService.getUserBalanceDetails(fromUserId);

        if (fromUserId.status !== 'ACTIVE') {
          throw new Error('转出用户账户状态异常');
        }

        const availableBalance = fromUserId.pointsBalance - fromUserId.pointsFrozen;
        if (availableBalance < amount) {
          throw new Error('通券余额不足');
        }

        // 检查转入用户是否存在
        const toUser = await tx.users.findUnique({
          where: { id: toUserId },
          select: {
            id: true,
            nickname: true,
            status: true,
            pointsBalance: true
          }
        });

        if (!toUser) {
          throw new Error('转入用户不存在');
        }

        if (toUser.status !== 'ACTIVE') {
          throw new Error('转入用户账户状态异常');
        }

        // 生成交易号
        const transactionNo = transactionService.generateTransactionNo();

        // 创建转出交易记录
        const fromTransaction = await transactionService.createTransaction(tx, {
          transactionNo: `${transactionNo}_OUT`,
          fromUserId,
          toUserId,
          amount: -amount,
          type,
          description: description || `转账给用户${toUser.nickname || toUserId}`,
          relatedOrderId,
          status: 'COMPLETED' as any,
          balanceBefore: fromUserId.pointsBalance,
          balanceAfter: fromUserId.pointsBalance - amount,
          metadata: {
            ...metadata,
            transferType: 'outgoing',
            fromUserLevel: fromUserId.level
          },
          completedAt: new Date()
        });

        // 创建转入交易记录
        const toTransaction = await transactionService.createTransaction(tx, {
          transactionNo: `${transactionNo}_IN`,
          fromUserId,
          toUserId,
          amount,
          type,
          description: description || `用户${fromUserId}转账`,
          relatedOrderId,
          status: 'COMPLETED' as any,
          balanceBefore: toUser.pointsBalance || 0,
          balanceAfter: (toUser.pointsBalance || 0) + amount,
          metadata: {
            ...metadata,
            transferType: 'incoming',
            fromUserLevel: fromUserId.level
          },
          completedAt: new Date()
        });

        // 更新转出用户余额
        await balanceService.updateUserBalance(tx, fromUserId, {
          balance: fromUserId.pointsBalance - amount
        });

        // 更新转入用户余额
        await balanceService.updateUserBalance(tx, toUserId, {
          balance: (toUser.pointsBalance || 0) + amount
        });

        logger.info('通券转账成功', {
          transactionNo,
          fromUserId,
          toUserId,
          amount,
          type,
          fromUserLevel: fromUserId.level
        });

        return {
          success: true,
          data: {
            transactionId: toTransaction.id,
            fromUserId,
            toUserId,
            amount
          },
          transactionNo,
          fromUserId,
          toUserId,
          type,
          description,
          relatedOrderId,
          metadata
        };

      });
    } catch (error) {
      logger.error('通券转账失败', {
        fromUserId,
        toUserId,
        amount,
        type,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 批量转账功能
  async batchTransfer(
    transfers: Array<{
      fromUserId: string;
      toUserId: string;
      amount: number;
      description?: string;
    }>,
    type: PointsTransactionType = PointsTransactionType.TRANSFER
  ): Promise<PointsTransferResult[]> {
    if (transfers.length === 0) {
      throw new Error('转账列表不能为空');
    }

    if (transfers.length > 100) {
      throw new Error('批量转账一次最多支持100笔');
    }

    const results: PointsTransferResult[] = [];

    try {
      await prisma.$transaction(async (tx) => {
        for (const transfer of transfers) {
          try {
            const result = await this.transfer({
              ...transfer,
              type,
              metadata: { batchTransfer: true }
            });
            results.push(result);
          } catch (error) {
            results.push({
              success: false,
              message: error instanceof Error ? error.message : '转账失败',
              data: {
                fromUserId: transfer.fromUserId,
                toUserId: transfer.toUserId,
                amount: transfer.amount
              }
            });
          }
        }
      });

      logger.info('批量转账完成', {
        totalCount: transfers.length,
        successCount: results.filter(r => r.success).length,
        failCount: results.filter(r => !r.success).length
      });

      return results;
    } catch (error) {
      logger.error('批量转账失败', {
        totalCount: transfers.length,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const transferService = new TransferService();