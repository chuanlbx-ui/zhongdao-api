// 导出所有类型
export * from './types';

// 导出所有服务类和实例
export { BalanceService, balanceService } from './balance.service';
export { TransactionService, transactionService } from './transaction.service';
export { TransferService, transferService } from './transfer.service';
export { RechargeService, rechargeService } from './recharge.service';
export { StatisticsService, statisticsService } from './statistics.service';

// 导出合并后的 PointsService 类（保持向后兼容）
import { balanceService } from './balance.service';
import { transactionService } from './transaction.service';
import { transferService } from './transfer.service';
import { rechargeService } from './recharge.service';
import { statisticsService } from './statistics.service';
import {
  PointsTransactionData,
  PointsTransferResult,
  PointsTransactionType,
  WithdrawalInfo,
  DeduplicationResult
} from './types';
import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';

// 保持向后兼容的 PointsService 类
export class PointsService {
  // 委托到各个服务

  // 余额相关
  async getBalance(userId: string) {
    return await balanceService.getBalance(userId);
  }

  // 转账相关
  async transfer(data: PointsTransactionData): Promise<PointsTransferResult> {
    return await transferService.transfer(data);
  }

  async batchTransfer(
    transfers: Array<{
      fromUserId: string;
      toUserId: string;
      amount: number;
      description?: string;
    }>,
    type: PointsTransactionType = PointsTransactionType.TRANSFER
  ): Promise<PointsTransferResult[]> {
    return await transferService.batchTransfer(transfers, type);
  }

  // 充值相关
  async recharge(
    userId: string,
    amount: number,
    paymentMethod: string = 'manual',
    description?: string,
    operatorId?: string
  ): Promise<PointsTransferResult> {
    return await rechargeService.recharge(userId, amount, paymentMethod, description, operatorId);
  }

  // 交易相关
  async getTransactions(
    userId: string,
    page: number = 1,
    perPage: number = 20,
    type?: PointsTransactionType,
    startDate?: Date,
    endDate?: Date
  ) {
    return await transactionService.getTransactions(userId, page, perPage, type, startDate, endDate);
  }

  async checkDuplicateSubmission(
    userId: string,
    amount: number,
    type: PointsTransactionType,
    timeWindow: number = 30
  ): Promise<DeduplicationResult> {
    return await transactionService.checkDuplicateSubmission(userId, amount, type, timeWindow);
  }

  // 统计相关
  async getPointsStatistics(userId: string) {
    return await statisticsService.getPointsStatistics(userId);
  }

  // 以下是新增的冻结/解冻和提现相关方法（原文件中的方法）
  // 通券冻结
  async freezePoints(userId: string, amount: number, reason?: string, relatedOrderId?: string): Promise<string> {
    if (amount <= 0) {
      throw new Error('冻结金额必须大于0');
    }

    // 防重复提交检查
    const duplicateCheck = await this.checkDuplicateSubmission(userId, amount, PointsTransactionType.FREEZE);
    if (!duplicateCheck.success) {
      throw new Error('请勿重复提交冻结操作');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 检查用户余额
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: {
            pointsBalance: true,
            pointsFrozen: true,
            status: true,
            level: true,
            nickname: true
          }
        });

        if (!user) {
          throw new Error('用户不存在');
        }

        if (user.status !== 'ACTIVE') {
          throw new Error('用户账户状态异常');
        }

        const availableBalance = user.pointsBalance - user.pointsFrozen;
        if (availableBalance < amount) {
          throw new Error('可用余额不足，无法冻结');
        }

        // 更新冻结金额
        await prisma.users.update({
          where: { id: userId },
          data: {
            pointsFrozen: user.pointsFrozen + amount
          }
        });

        // 创建冻结记录
        const transactionNo = transactionService.generateTransactionNo();
        await transactionService.createTransaction(tx, {
          transactionNo: `${transactionNo}_FREEZE`,
          fromUserId: userId,
          toUserId: userId,
          amount: -amount,
          type: 'FREEZE',
          description: reason || '积分冻结',
          relatedOrderId,
          status: 'COMPLETED' as any,
          balanceBefore: user.pointsBalance,
          balanceAfter: user.pointsBalance,
          metadata: {
            freezeType: 'freeze',
            frozenAmount: amount,
            totalFrozen: user.pointsFrozen + amount,
            userLevel: user.level
          },
          completedAt: new Date()
        });

        logger.info('积分冻结成功', {
          userId,
          amount,
          transactionNo,
          reason,
          userLevel: user.level
        });

        return transactionNo;
      });
    } catch (error) {
      logger.error('积分冻结失败', {
        userId,
        amount,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 通券解冻
  async unfreezePoints(userId: string, amount: number, reason?: string, relatedOrderId?: string): Promise<string> {
    if (amount <= 0) {
      throw new Error('解冻金额必须大于0');
    }

    // 防重复提交检查
    const duplicateCheck = await this.checkDuplicateSubmission(userId, amount, PointsTransactionType.UNFREEZE);
    if (!duplicateCheck.success) {
      throw new Error('请勿重复提交解冻操作');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 检查用户冻结余额
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: {
            pointsBalance: true,
            pointsFrozen: true,
            status: true,
            level: true,
            nickname: true
          }
        });

        if (!user) {
          throw new Error('用户不存在');
        }

        if (user.status !== 'ACTIVE') {
          throw new Error('用户账户状态异常');
        }

        if (user.pointsFrozen < amount) {
          throw new Error('冻结余额不足，无法解冻');
        }

        // 更新冻结金额
        await prisma.users.update({
          where: { id: userId },
          data: {
            pointsFrozen: user.pointsFrozen - amount
          }
        });

        // 创建解冻记录
        const transactionNo = transactionService.generateTransactionNo();
        await transactionService.createTransaction(tx, {
          transactionNo: `${transactionNo}_UNFREEZE`,
          fromUserId: userId,
          toUserId: userId,
          amount,
          type: 'UNFREEZE',
          description: reason || '积分解冻',
          relatedOrderId,
          status: 'COMPLETED' as any,
          balanceBefore: user.pointsBalance,
          balanceAfter: user.pointsBalance,
          metadata: {
            freezeType: 'unfreeze',
            unfrozenAmount: amount,
            remainingFrozen: user.pointsFrozen - amount,
            userLevel: user.level
          },
          completedAt: new Date()
        });

        logger.info('积分解冻成功', {
          userId,
          amount,
          transactionNo,
          reason,
          userLevel: user.level
        });

        return transactionNo;
      });
    } catch (error) {
      logger.error('积分解冻失败', {
        userId,
        amount,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 通券提现申请
  async withdrawPoints(
    userId: string,
    amount: number,
    withdrawalInfo: WithdrawalInfo,
    description?: string
  ): Promise<PointsTransferResult> {
    if (amount <= 0) {
      throw new Error('提现金额必须大于0');
    }

    // 防重复提交检查
    const duplicateCheck = await this.checkDuplicateSubmission(userId, amount, PointsTransactionType.WITHDRAW, 60);
    if (!duplicateCheck.success) {
      return {
        success: false,
        message: '请勿重复提交提现申请，请稍后再试',
        data: {
          transactionId: duplicateCheck.existingTransaction?.id,
          fromUserId: userId,
          toUserId: 'SYSTEM',
          amount
        }
      };
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 检查用户余额和权限
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: {
            pointsBalance: true,
            pointsFrozen: true,
            level: true,
            phone: true,
            nickname: true,
            status: true
          }
        });

        if (!user) {
          throw new Error('用户不存在');
        }

        if (user.status !== 'ACTIVE') {
          throw new Error('用户账户状态异常');
        }

        // 检查用户权限（所有店长都可以提现）
        const validLevels = ['ONE_STAR', 'TWO_STAR', 'THREE_STAR', 'FOUR_STAR', 'FIVE_STAR', 'DIRECTOR'];
        if (!validLevels.includes(user.level)) {
          throw new Error('只有店长级别才能申请提现');
        }

        const availableBalance = user.pointsBalance - user.pointsFrozen;
        if (availableBalance < amount) {
          throw new Error('可用余额不足，无法提现');
        }

        // 冻结提现金额
        await prisma.users.update({
          where: { id: userId },
          data: {
            pointsFrozen: user.pointsFrozen + amount
          }
        });

        // 创建提现交易记录（初始状态为PENDING）
        const transactionNo = transactionService.generateTransactionNo();
        const transaction = await transactionService.createTransaction(tx, {
          transactionNo: `${transactionNo}_WITHDRAW`,
          fromUserId: userId,
          toUserId: 'SYSTEM', // 提现到系统
          amount: -amount,
          type: 'WITHDRAW',
          description: description || `用户${user.nickname || userId}申请提现`,
          status: 'PENDING' as any,
          balanceBefore: user.pointsBalance,
          balanceAfter: user.pointsBalance,
          metadata: {
            withdrawalInfo: {
              bankAccount: withdrawalInfo.bankAccount,
              bankName: withdrawalInfo.bankName,
              accountName: withdrawalInfo.accountName,
              phone: withdrawalInfo.phone,
              userId,
              userLevel: user.level
            },
            requestTime: new Date().toISOString(),
            frozenAmount: amount,
            applicantInfo: {
              nickname: user.nickname,
              phone: user.phone
            }
          }
        });

        logger.info('积分提现申请成功', {
          userId,
          amount,
          transactionNo: transaction.transactionNo,
          userLevel: user.level
        });

        return {
          success: true,
          data: {
            transactionId: transaction.id,
            fromUserId: userId,
            toUserId: 'SYSTEM',
            amount
          },
          transactionNo: transaction.transactionNo,
          fromUserId: userId,
          toUserId: 'SYSTEM',
          type: PointsTransactionType.WITHDRAW,
          description: description || '提现申请'
        };
      });
    } catch (error) {
      logger.error('积分提现申请失败', {
        userId,
        amount,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 审核提现申请
  async auditWithdrawal(
    transactionId: string,
    approved: boolean,
    auditRemark?: string,
    auditorId?: string
  ): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // 查找提现交易记录
        const transaction = await prisma.pointsTransactions.findUnique({
          where: { id: transactionId },
          include: {
            fromUserId: {
              select: {
                id: true,
                pointsBalance: true,
                pointsFrozen: true,
                level: true,
                nickname: true
              }
            }
          }
        });

        if (!transaction) {
          throw new Error('提现记录不存在');
        }

        if (transaction.type !== 'WITHDRAW') {
          throw new Error('非提现交易记录');
        }

        if (transaction.status !== 'PENDING') {
          throw new Error('提现记录已处理，无法重复审核');
        }

        const withdrawalAmount = Math.abs(transaction.amount);

        if (approved) {
          // 审核通过：解冻并扣减余额
          await prisma.users.update({
            where: { id: transaction.fromUserId! },
            data: {
              pointsFrozen: transaction.fromUserId!.pointsFrozen - withdrawalAmount,
              pointsBalance: transaction.fromUserId!.pointsBalance - withdrawalAmount
            }
          });

          // 更新交易状态为已完成
          await transactionService.updateTransactionStatus(tx, transactionId, 'COMPLETED' as any, {
            balanceAfter: transaction.fromUserId!.pointsBalance - withdrawalAmount,
            metadata: {
              ...transaction.metadata as any,
              auditResult: 'approved',
              auditRemark,
              auditorId,
              auditTime: new Date().toISOString()
            }
          });

          logger.info('提现审核通过', {
            transactionId,
            userId: transaction.fromUserId,
            amount: withdrawalAmount,
            auditorId
          });
        } else {
          // 审核拒绝：解冻但余额不变
          await prisma.users.update({
            where: { id: transaction.fromUserId! },
            data: {
              pointsFrozen: transaction.fromUserId!.pointsFrozen - withdrawalAmount
            }
          });

          // 更新交易状态为已取消
          await transactionService.updateTransactionStatus(tx, transactionId, 'CANCELLED' as any, {
            metadata: {
              ...transaction.metadata as any,
              auditResult: 'rejected',
              auditRemark,
              auditorId,
              auditTime: new Date().toISOString()
            }
          });

          logger.info('提现审核拒绝', {
            transactionId,
            userId: transaction.fromUserId,
            amount: withdrawalAmount,
            auditRemark,
            auditorId
          });
        }
      });
    } catch (error) {
      logger.error('提现审核失败', {
        transactionId,
        approved,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const pointsService = new PointsService();