import { logger } from '../utils/logger';
import { prisma } from '../database/client';

// 通券交易类型
export enum PointsTransactionType {
  PURCHASE = 'PURCHASE',    // 采购支付
  TRANSFER = 'TRANSFER',    // 用户转账
  RECHARGE = 'RECHARGE',    // 充值
  WITHDRAW = 'WITHDRAW',    // 提现
  REFUND = 'REFUND',        // 退款
  COMMISSION = 'COMMISSION', // 佣金
  REWARD = 'REWARD',        // 奖励
  FREEZE = 'FREEZE',        // 冻结
  UNFREEZE = 'UNFREEZE'    // 解冻
}

// 通券交易状态
export enum PointsTransactionStatus {
  PENDING = 'PENDING',     // 待处理
  PROCESSING = 'PROCESSING', // 处理中
  COMPLETED = 'COMPLETED',   // 已完成
  FAILED = 'FAILED',       // 失败
  CANCELLED = 'CANCELLED'   // 已取消
}

// 通券交易接口
export interface PointsTransactionData {
  fromUserId?: string;
  toUserId: string;
  amount: number;
  type: PointsTransactionType;
  description?: string;
  relatedOrderId?: string;
  metadata?: Record<string, any>;
}

// 转账结果接口
export interface PointsTransferResult {
  success: boolean;
  message?: string;
  data?: {
    transactionId?: string;
    fromUserId?: string;
    toUserId: string;
    amount: number;
  };
  transactionNo?: string;
  fromUserId?: string;
  toUserId?: string;
  type?: PointsTransactionType;
  description?: string;
  relatedOrderId?: string;
  metadata?: Record<string, any>;
}

// 通券余额信息
export interface PointsBalance {
  userId: string;
  balance: number;
  frozen: number;
  available: number;
}

// 提现信息接口
export interface WithdrawalInfo {
  bankAccount?: string;
  bankName?: string;
  accountName?: string;
  phone?: string;
  withdrawalPassword?: string;
}

// 防重复提交接口
export interface DeduplicationResult {
  success: boolean;
  existingTransaction?: any;
}

// 通券服务类
export class PointsService {
  // 生成交易号
  private generateTransactionNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PT${timestamp}${random}`.toUpperCase();
  }

  // 获取用户通券余额
  async getBalance(userId: string): Promise<PointsBalance> {
    try {
      const user = await prisma.user.findUnique({
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

  // 防重复提交检查
  async checkDuplicateSubmission(
    userId: string,
    amount: number,
    type: PointsTransactionType,
    timeWindow: number = 30 // 时间窗口（秒）
  ): Promise<DeduplicationResult> {
    try {
      const timeThreshold = new Date(Date.now() - timeWindow * 1000);

      const existingTransaction = await prisma.pointsTransaction.findFirst({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId }
          ],
          amount: type === 'FREEZE' || type === 'WITHDRAW' ? -amount : amount,
          type,
          createdAt: {
            gte: timeThreshold
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (existingTransaction) {
        logger.warn('检测到重复提交', {
          userId,
          amount,
          type,
          existingTransactionId: existingTransaction.id,
          timeWindow
        });

        return {
          success: false,
          existingTransaction
        };
      }

      return { success: true };
    } catch (error) {
      logger.error('防重复检查失败', {
        userId,
        amount,
        type,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 通券转账（增强版，含防重复和权限验证）
  async transfer(data: PointsTransactionData): Promise<PointsTransferResult> {
    const { fromUserId, toUserId, amount, type, description, relatedOrderId, metadata } = data;

    if (!fromUserId) {
      throw new Error('转出用户ID不能为空');
    }

    // 检查金额
    if (amount <= 0) {
      throw new Error('转账金额必须大于0');
    }

    // 检查是否给自己转账
    if (fromUserId === toUserId) {
      throw new Error('不能给自己转账');
    }

    // 防重复提交检查
    const duplicateCheck = await this.checkDuplicateSubmission(fromUserId, amount, type);
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
        const fromUser = await tx.user.findUnique({
          where: { id: fromUserId },
          select: {
            pointsBalance: true,
            pointsFrozen: true,
            level: true,
            status: true
          }
        });

        if (!fromUser) {
          throw new Error('转出用户不存在');
        }

        if (fromUser.status !== 'ACTIVE') {
          throw new Error('转出用户账户状态异常');
        }

        const availableBalance = fromUser.pointsBalance - fromUser.pointsFrozen;
        if (availableBalance < amount) {
          throw new Error('通券余额不足');
        }

        // 检查转入用户是否存在
        const toUser = await tx.user.findUnique({
          where: { id: toUserId },
          select: {
            id: true,
            nickname: true,
            status: true
          }
        });

        if (!toUser) {
          throw new Error('转入用户不存在');
        }

        if (toUser.status !== 'ACTIVE') {
          throw new Error('转入用户账户状态异常');
        }

        // 获取当前转入用户余额
        const toUserCurrentBalance = await tx.user.findUnique({
          where: { id: toUserId },
          select: { pointsBalance: true }
        });

        // 生成交易号
        const transactionNo = this.generateTransactionNo();

        // 创建转出交易记录
        const fromTransaction = await tx.pointsTransaction.create({
          data: {
            transactionNo: `${transactionNo}_OUT`,
            fromUserId,
            toUserId,
            amount: -amount,
            type,
            description: description || `转账给用户${toUser.nickname || toUserId}`,
            relatedOrderId,
            metadata: {
              ...metadata,
              transferType: 'outgoing',
              fromUserLevel: fromUser.level
            },
            status: 'COMPLETED',
            balanceBefore: fromUser.pointsBalance,
            balanceAfter: fromUser.pointsBalance - amount,
            completedAt: new Date()
          }
        });

        // 创建转入交易记录
        const toTransaction = await tx.pointsTransaction.create({
          data: {
            transactionNo: `${transactionNo}_IN`,
            fromUserId,
            toUserId,
            amount,
            type,
            description: description || `用户${fromUserId}转账`,
            relatedOrderId,
            metadata: {
              ...metadata,
              transferType: 'incoming',
              fromUserLevel: fromUser.level
            },
            status: 'COMPLETED',
            balanceBefore: toUserCurrentBalance?.pointsBalance || 0,
            balanceAfter: (toUserCurrentBalance?.pointsBalance || 0) + amount,
            completedAt: new Date()
          }
        });

        // 更新转出用户余额
        await tx.user.update({
          where: { id: fromUserId },
          data: {
            pointsBalance: fromUser.pointsBalance - amount
          }
        });

        // 更新转入用户余额
        await tx.user.update({
          where: { id: toUserId },
          data: {
            pointsBalance: (toUserCurrentBalance?.pointsBalance || 0) + amount
          }
        });

        logger.info('通券转账成功', {
          transactionNo,
          fromUserId,
          toUserId,
          amount,
          type,
          fromUserLevel: fromUser.level
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
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            pointsBalance: true,
            level: true,
            status: true,
            nickname: true
          }
        });

        if (!user) {
          throw new Error('用户不存在');
        }

        // 只有五星和董事可以充值
        const validLevels = ['FIVE_STAR', 'DIRECTOR'];
        if (!validLevels.includes(user.level)) {
          throw new Error('只有五星店长和董事可以充值');
        }

        if (user.status !== 'ACTIVE') {
          throw new Error('用户账户状态异常');
        }

        // 生成交易号
        const transactionNo = this.generateTransactionNo();

        // 创建充值交易记录
        const transaction = await tx.pointsTransaction.create({
          data: {
            transactionNo: `${transactionNo}_RECHARGE`,
            fromUserId: 'SYSTEM', // 系统充值
            toUserId: userId,
            amount,
            type: 'RECHARGE',
            description: description || `用户${user.nickname || userId}充值`,
            metadata: {
              paymentMethod,
              operatorId,
              userLevel: user.level,
              rechargeType: 'manual'
            },
            status: 'COMPLETED',
            balanceBefore: user.pointsBalance,
            balanceAfter: user.pointsBalance + amount,
            completedAt: new Date()
          }
        });

        // 更新用户余额
        await tx.user.update({
          where: { id: userId },
          data: {
            pointsBalance: user.pointsBalance + amount
          }
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
        const user = await tx.user.findUnique({
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
        await tx.user.update({
          where: { id: userId },
          data: {
            pointsFrozen: user.pointsFrozen + amount
          }
        });

        // 创建冻结记录
        const transactionNo = this.generateTransactionNo();
        await tx.pointsTransaction.create({
          data: {
            transactionNo: `${transactionNo}_FREEZE`,
            fromUserId: userId,
            toUserId: userId,
            amount: -amount,
            type: 'FREEZE',
            description: reason || '积分冻结',
            relatedOrderId,
            status: 'COMPLETED',
            balanceBefore: user.pointsBalance,
            balanceAfter: user.pointsBalance,
            completedAt: new Date(),
            metadata: {
              freezeType: 'freeze',
              frozenAmount: amount,
              totalFrozen: user.pointsFrozen + amount,
              userLevel: user.level
            }
          }
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
        const user = await tx.user.findUnique({
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
        await tx.user.update({
          where: { id: userId },
          data: {
            pointsFrozen: user.pointsFrozen - amount
          }
        });

        // 创建解冻记录
        const transactionNo = this.generateTransactionNo();
        await tx.pointsTransaction.create({
          data: {
            transactionNo: `${transactionNo}_UNFREEZE`,
            fromUserId: userId,
            toUserId: userId,
            amount,
            type: 'UNFREEZE',
            description: reason || '积分解冻',
            relatedOrderId,
            status: 'COMPLETED',
            balanceBefore: user.pointsBalance,
            balanceAfter: user.pointsBalance,
            completedAt: new Date(),
            metadata: {
              freezeType: 'unfreeze',
              unfrozenAmount: amount,
              remainingFrozen: user.pointsFrozen - amount,
              userLevel: user.level
            }
          }
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
        const user = await tx.user.findUnique({
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
        await tx.user.update({
          where: { id: userId },
          data: {
            pointsFrozen: user.pointsFrozen + amount
          }
        });

        // 创建提现交易记录（初始状态为PENDING）
        const transactionNo = this.generateTransactionNo();
        const transaction = await tx.pointsTransaction.create({
          data: {
            transactionNo: `${transactionNo}_WITHDRAW`,
            fromUserId: userId,
            toUserId: 'SYSTEM', // 提现到系统
            amount: -amount,
            type: 'WITHDRAW',
            description: description || `用户${user.nickname || userId}申请提现`,
            status: 'PENDING', // 待审核
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
        const transaction = await tx.pointsTransaction.findUnique({
          where: { id: transactionId },
          include: {
            fromUser: {
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
          await tx.user.update({
            where: { id: transaction.fromUserId! },
            data: {
              pointsFrozen: transaction.fromUser!.pointsFrozen - withdrawalAmount,
              pointsBalance: transaction.fromUser!.pointsBalance - withdrawalAmount
            }
          });

          // 更新交易状态为已完成
          await tx.pointsTransaction.update({
            where: { id: transactionId },
            data: {
              status: 'COMPLETED',
              balanceAfter: transaction.fromUser!.pointsBalance - withdrawalAmount,
              completedAt: new Date(),
              metadata: {
                ...transaction.metadata as any,
                auditResult: 'approved',
                auditRemark,
                auditorId,
                auditTime: new Date().toISOString()
              }
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
          await tx.user.update({
            where: { id: transaction.fromUserId! },
            data: {
              pointsFrozen: transaction.fromUser!.pointsFrozen - withdrawalAmount
            }
          });

          // 更新交易状态为已取消
          await tx.pointsTransaction.update({
            where: { id: transactionId },
            data: {
              status: 'CANCELLED',
              completedAt: new Date(),
              metadata: {
                ...transaction.metadata as any,
                auditResult: 'rejected',
                auditRemark,
                auditorId,
                auditTime: new Date().toISOString()
              }
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

  // 获取通券流水记录
  async getTransactions(
    userId: string,
    page: number = 1,
    perPage: number = 20,
    type?: PointsTransactionType,
    startDate?: Date,
    endDate?: Date
  ) {
    const skip = (page - 1) * perPage;

    const where: any = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    };

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          fromUser: {
            select: {
              id: true,
              nickname: true,
              phone: true
            }
          },
          toUser: {
            select: {
              id: true,
              nickname: true,
              phone: true
            }
          }
        }
      }),
      prisma.pointsTransaction.count({ where })
    ]);

    return {
      transactions: transactions.map(t => ({
        ...t,
        isIncoming: t.toUserId === userId,
        isOutgoing: t.fromUserId === userId
      })),
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNext: page * perPage < total,
        hasPrev: page > 1
      }
    };
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

  // 获取通券统计信息
  async getPointsStatistics(userId: string) {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        totalReceived,
        totalSent,
        totalReceivedToday,
        totalSentToday,
        latestTransactions
      ] = await Promise.all([
        // 总收入
        prisma.pointsTransaction.aggregate({
          where: {
            toUserId: userId,
            status: 'COMPLETED'
          },
          _sum: {
            amount: true
          }
        }),
        // 总支出
        prisma.pointsTransaction.aggregate({
          where: {
            fromUserId: userId,
            status: 'COMPLETED'
          },
          _sum: {
            amount: true
          }
        }),
        // 今日收入
        prisma.pointsTransaction.aggregate({
          where: {
            toUserId: userId,
            status: 'COMPLETED',
            createdAt: {
              gte: todayStart
            }
          },
          _sum: {
            amount: true
          }
        }),
        // 今日支出
        prisma.pointsTransaction.aggregate({
          where: {
            fromUserId: userId,
            status: 'COMPLETED',
            createdAt: {
              gte: todayStart
            }
          },
          _sum: {
            amount: true
          }
        }),
        // 最近交易记录
        prisma.pointsTransaction.findMany({
          where: {
            OR: [
              { fromUserId: userId },
              { toUserId: userId }
            ]
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            type: true,
            description: true,
            createdAt: true,
            fromUser: {
              select: { nickname: true }
            },
            toUser: {
              select: { nickname: true }
            }
          }
        })
      ]);

      const balance = await this.getBalance(userId);

      return {
        balance,
        statistics: {
          totalReceived: totalReceived._sum.amount || 0,
          totalSent: Math.abs(totalSent._sum.amount || 0),
          totalReceivedToday: totalReceivedToday._sum.amount || 0,
          totalSentToday: Math.abs(totalSentToday._sum.amount || 0),
          netReceived: (totalReceived._sum.amount || 0) + (totalSent._sum.amount || 0)
        },
        recentTransactions: latestTransactions
      };

    } catch (error) {
      logger.error('获取通券统计信息失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const pointsService = new PointsService();