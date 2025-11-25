import { pointsService, PointsTransactionType } from '../src/shared/services/points';

/**
 * 中道商城积分通券多源流转引擎使用示例
 *
 * 本文件展示如何使用积分通券系统的各种功能：
 * 1. 采购支付（P0优先级）
 * 2. 直推奖励（P0优先级）
 * 3. 平台充值（P1优先级 - 五星/董事专属）
 * 4. 用户间转账（P1优先级）
 * 5. 提现申请（所有店长可申请）
 * 6. 余额管理和冻结机制
 */

class PointsUsageExamples {
  // ===============================
  // P0 优先级功能（核心业务功能）
  // ===============================

  /**
   * 示例1: 下级采购支付给上级
   * 场景：下级店长向上级采购商品，使用积分支付
   */
  async examplePurchasePayment() {
    console.log('=== 采购支付示例 ===');

    try {
      // 下级店长A向上级店长B采购1000积分的商品
      const result = await pointsService.transfer({
        fromUserId: 'shop_manager_a_id', // 下级店长A
        toUserId: 'shop_manager_b_id',   // 上级店长B
        amount: 1000,
        type: PointsTransactionType.PURCHASE,
        description: '采购商品支付',
        relatedOrderId: 'order_12345',
        metadata: {
          productIds: ['prod_001', 'prod_002'],
          purchaseType: 'inventory_replenishment'
        }
      });

      console.log('采购支付成功:', result);
      return result;
    } catch (error) {
      console.error('采购支付失败:', error);
      throw error;
    }
  }

  /**
   * 示例2: 直推奖励发放
   * 场景：系统向下级发放直推奖励
   */
  async exampleDirectReferralReward() {
    console.log('=== 直推奖励示例 ===');

    try {
      // 向店长A发放直推奖励500积分
      const result = await pointsService.transfer({
        fromUserId: 'SYSTEM', // 系统账户
        toUserId: 'shop_manager_a_id',
        amount: 500,
        type: PointsTransactionType.REWARD,
        description: '直推奖励',
        metadata: {
          rewardType: 'direct_referral',
          referredUserId: 'new_user_123',
          rewardAmount: 500,
          policyId: 'policy_direct_reward_001'
        }
      });

      console.log('直推奖励发放成功:', result);
      return result;
    } catch (error) {
      console.error('直推奖励发放失败:', error);
      throw error;
    }
  }

  /**
   * 示例3: 订单支付时冻结积分
   * 场景：用户下单时先冻结积分，订单完成后解冻或扣减
   */
  async exampleOrderPaymentWithFreeze() {
    console.log('=== 订单支付冻结示例 ===');

    try {
      const userId = 'customer_001';
      const orderAmount = 800;
      const orderId = 'order_67890';

      // 1. 先冻结订单金额的积分
      const freezeTransactionNo = await pointsService.freezePoints(
        userId,
        orderAmount,
        '订单支付冻结',
        orderId
      );

      console.log('积分冻结成功:', freezeTransactionNo);

      // 2. 模拟订单处理流程...
      console.log('订单处理中...');

      // 3. 订单完成，执行实际支付转账
      const transferResult = await pointsService.transfer({
        fromUserId: userId,
        toUserId: 'merchant_001',
        amount: orderAmount,
        type: PointsTransactionType.PURCHASE,
        description: '订单支付',
        relatedOrderId: orderId
      });

      // 4. 解冻之前冻结的积分
      await pointsService.unfreezePoints(
        userId,
        orderAmount,
        '订单完成解冻',
        orderId
      );

      console.log('订单支付完成:', transferResult);
      return transferResult;
    } catch (error) {
      console.error('订单支付失败:', error);
      throw error;
    }
  }

  // ===============================
  // P1 优先级功能（扩展功能）
  // ===============================

  /**
   * 示例4: 平台充值（五星/董事专属）
   * 场景：五星店长或董事进行平台充值
   */
  async examplePlatformRecharge() {
    console.log('=== 平台充值示例 ===');

    try {
      // 五星店长充值10000积分
      const result = await pointsService.recharge(
        'five_star_manager_id',
        10000,
        'bank_transfer', // 充值方式
        '银行转账充值',
        'admin_operator_id' // 操作员ID
      );

      console.log('平台充值成功:', result);
      return result;
    } catch (error) {
      console.error('平台充值失败:', error);
      throw error;
    }
  }

  /**
   * 示例5: 用户间转账
   * 场景：用户之间的灵活积分转账
   */
  async exampleUserTransfer() {
    console.log('=== 用户间转账示例 ===');

    try {
      const result = await pointsService.transfer({
        fromUserId: 'user_001',
        toUserId: 'user_002',
        amount: 200,
        type: PointsTransactionType.TRANSFER,
        description: '朋友间转账',
        metadata: {
          transferReason: 'friend_help',
          relationship: 'friend'
        }
      });

      console.log('用户转账成功:', result);
      return result;
    } catch (error) {
      console.error('用户转账失败:', error);
      throw error;
    }
  }

  /**
   * 示例6: 店长提现申请
   * 场景：店长申请将积分提现
   */
  async exampleWithdrawalApplication() {
    console.log('=== 店长提现申请示例 ===');

    try {
      const withdrawalInfo = {
        bankAccount: '6228481234567890123',
        bankName: '中国工商银行',
        accountName: '张三',
        phone: '13800138000'
      };

      const result = await pointsService.withdrawPoints(
        'shop_manager_id',
        5000,
        withdrawalInfo,
        '月度提现申请'
      );

      console.log('提现申请成功:', result);
      return result;
    } catch (error) {
      console.error('提现申请失败:', error);
      throw error;
    }
  }

  /**
   * 示例7: 管理员审核提现申请
   * 场景：财务审核店长的提现申请
   */
  async exampleWithdrawalAudit() {
    console.log('=== 提现审核示例 ===');

    try {
      const transactionId = 'withdrawal_transaction_id';

      // 审核通过
      await pointsService.auditWithdrawal(
        transactionId,
        true, // 通过审核
        '审核通过，资金将在3个工作日内到账',
        'finance_manager_id'
      );

      console.log('提现审核通过');

      // 如果要拒绝提现申请
      /*
      await pointsService.auditWithdrawal(
        transactionId,
        false, // 拒绝审核
        '账户信息异常，请核实后重新申请',
        'finance_manager_id'
      );
      console.log('提现审核拒绝');
      */
    } catch (error) {
      console.error('提现审核失败:', error);
      throw error;
    }
  }

  // ===============================
  // 高级功能和批量操作
  // ===============================

  /**
   * 示例8: 批量发放奖励
   * 场景：系统批量向多个用户发放奖励
   */
  async exampleBatchRewards() {
    console.log('=== 批量奖励发放示例 ===');

    try {
      const rewardList = [
        { fromUserId: 'SYSTEM', toUserId: 'user_001', amount: 100, description: '活动奖励' },
        { fromUserId: 'SYSTEM', toUserId: 'user_002', amount: 150, description: '活动奖励' },
        { fromUserId: 'SYSTEM', toUserId: 'user_003', amount: 200, description: '活动奖励' }
      ];

      const results = await pointsService.batchTransfer(
        rewardList,
        PointsTransactionType.REWARD
      );

      console.log('批量奖励发放完成:', {
        total: results.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;
    } catch (error) {
      console.error('批量奖励发放失败:', error);
      throw error;
    }
  }

  /**
   * 示例9: 获取用户积分统计
   * 场景：查看用户的积分使用情况
   */
  async exampleUserPointsStatistics() {
    console.log('=== 用户积分统计示例 ===');

    try {
      const statistics = await pointsService.getPointsStatistics('user_001');

      console.log('用户积分统计:', {
        当前余额: statistics.balance.balance,
        可用余额: statistics.balance.available,
        冻结余额: statistics.balance.frozen,
        总收入: statistics.statistics.totalReceived,
        总支出: statistics.statistics.totalSent,
        今日收入: statistics.statistics.totalReceivedToday,
        今日支出: statistics.statistics.totalSentToday,
        净收入: statistics.statistics.netReceived,
        最近交易: statistics.recentTransactions.length
      });

      return statistics;
    } catch (error) {
      console.error('获取积分统计失败:', error);
      throw error;
    }
  }

  /**
   * 示例10: 查询交易流水
   * 场景：查询用户的详细交易记录
   */
  async exampleTransactionHistory() {
    console.log('=== 交易流水查询示例 ===');

    try {
      // 查询用户的所有交易记录
      const allTransactions = await pointsService.getTransactions(
        'user_001',
        1, // 页码
        20, // 每页数量
        undefined, // 交易类型（不限制）
        new Date('2024-01-01'), // 开始日期
        new Date('2024-12-31')  // 结束日期
      );

      console.log('交易流水:', {
        总记录数: allTransactions.pagination.total,
        当前页: allTransactions.pagination.page,
        总页数: allTransactions.pagination.totalPages,
        交易记录: allTransactions.transactions.length
      });

      return allTransactions;
    } catch (error) {
      console.error('查询交易流水失败:', error);
      throw error;
    }
  }

  // ===============================
  // 综合业务场景示例
  // ===============================

  /**
   * 示例11: 完整的采购流程
   * 场景：模拟一次完整的采购业务流程
   */
  async exampleCompletePurchaseFlow() {
    console.log('=== 完整采购流程示例 ===');

    try {
      const buyerId = 'buyer_shop_001';
      const sellerId = 'seller_shop_001';
      const purchaseAmount = 5000;
      const orderId = 'purchase_order_' + Date.now();

      // 1. 检查买家余额
      const buyerBalance = await pointsService.getBalance(buyerId);
      console.log('买家余额:', buyerBalance);

      if (buyerBalance.available < purchaseAmount) {
        throw new Error('余额不足，无法完成采购');
      }

      // 2. 冻结采购金额
      await pointsService.freezePoints(
        buyerId,
        purchaseAmount,
        '采购订单冻结',
        orderId
      );

      // 3. 执行转账支付
      const paymentResult = await pointsService.transfer({
        fromUserId: buyerId,
        toUserId: sellerId,
        amount: purchaseAmount,
        type: PointsTransactionType.PURCHASE,
        description: '采购商品支付',
        relatedOrderId: orderId,
        metadata: {
          purchaseFlow: 'complete_flow',
          step: 'payment'
        }
      });

      // 4. 解冻金额
      await pointsService.unfreezePoints(
        buyerId,
        purchaseAmount,
        '采购完成解冻',
        orderId
      );

      // 5. 发放直推奖励（如果有推荐人）
      // 这里假设买家有推荐人
      await pointsService.transfer({
        fromUserId: 'SYSTEM',
        toUserId: 'referrer_001',
        amount: purchaseAmount * 0.1, // 10%的直推奖励
        type: PointsTransactionType.COMMISSION,
        description: '直推佣金奖励',
        relatedOrderId: orderId,
        metadata: {
          commissionRate: 0.1,
          baseAmount: purchaseAmount,
          referredUserId: buyerId
        }
      });

      console.log('完整采购流程完成:', {
        orderId,
        paymentResult: paymentResult.transactionNo,
        buyerBalance: await pointsService.getBalance(buyerId),
        sellerBalance: await pointsService.getBalance(sellerId)
      });

      return {
        orderId,
        paymentResult,
        finalBuyerBalance: await pointsService.getBalance(buyerId),
        finalSellerBalance: await pointsService.getBalance(sellerId)
      };
    } catch (error) {
      console.error('完整采购流程失败:', error);
      throw error;
    }
  }
}

// 导出示例类
export { PointsUsageExamples };

// 使用示例
if (require.main === module) {
  const examples = new PointsUsageExamples();

  async function runExamples() {
    console.log('开始运行积分通券多源流转引擎示例...\n');

    try {
      // 运行基础示例
      await examples.examplePurchasePayment();
      console.log('\n');

      await examples.exampleDirectReferralReward();
      console.log('\n');

      await examples.exampleUserTransfer();
      console.log('\n');

      // 运行高级示例
      await examples.exampleBatchRewards();
      console.log('\n');

      await examples.exampleUserPointsStatistics();
      console.log('\n');

      console.log('所有示例运行完成！');
    } catch (error) {
      console.error('示例运行失败:', error);
    }
  }

  runExamples();
}