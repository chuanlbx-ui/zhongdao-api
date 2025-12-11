/**
 * 业务指标监控器
 * 监控电商核心业务指标：用户、订单、支付、库存等
 */

import { EventEmitter } from 'events';
import { monitoringConfig, MonitoringConfig } from '../config/monitoring-config';
import { logger } from '../../shared/utils/logger';

// 业务指标定义
export interface UserMetrics {
  registrations: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  userLevels: {
    NORMAL: number;
    VIP: number;
    STAR_1: number;
    STAR_2: number;
    STAR_3: number;
    STAR_4: number;
    STAR_5: number;
    DIRECTOR: number;
  };
  retentionRates: {
    day1: number;
    day7: number;
    day30: number;
  };
}

export interface OrderMetrics {
  orders: {
    total: number;
    pending: number;
    paid: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  revenue: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  averageOrderValue: number;
  conversionRate: number;
  topProducts: Array<{
    productId: string;
    name: string;
    sales: number;
    revenue: number;
  }>;
}

export interface PaymentMetrics {
  payments: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
  successRate: number;
  paymentMethods: {
    wechat: number;
    alipay: number;
    points: number;
  };
  averageProcessingTime: number;
  failureReasons: Record<string, number>;
}

export interface InventoryMetrics {
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  turnoverRate: number;
  warehouseStats: {
    platform: { items: number; value: number };
    cloud: { items: number; value: number };
    local: { items: number; value: number };
  };
  alerts: Array<{
    productId: string;
    warehouse: string;
    currentStock: number;
    threshold: number;
  }>;
}

export interface CommissionMetrics {
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  averageCommissionTime: number; // 从产生到支付的时间（小时）
  topEarners: Array<{
    userId: string;
    name: string;
    level: string;
    commission: number;
  }>;
  commissionByLevel: Record<string, number>;
}

/**
 * 业务指标收集器
 */
export class BusinessMetricsCollector extends EventEmitter {
  private config: MonitoringConfig;
  private isRunning = false;
  private collectTimer?: NodeJS.Timeout;

  // 存储业务指标
  private userMetrics: UserMetrics = this.initializeUserMetrics();
  private orderMetrics: OrderMetrics = this.initializeOrderMetrics();
  private paymentMetrics: PaymentMetrics = this.initializePaymentMetrics();
  private inventoryMetrics: InventoryMetrics = this.initializeInventoryMetrics();
  private commissionMetrics: CommissionMetrics = this.initializeCommissionMetrics();

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
  }

  /**
   * 初始化收集器
   */
  async initialize(): Promise<void> {
    logger.info('初始化业务指标监控器...');
  }

  /**
   * 启动收集器
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // 设置定时收集
    this.collectTimer = setInterval(
      () => this.collectAllMetrics(),
      this.config.system.collectInterval
    );

    logger.info('业务指标监控器已启动');
  }

  /**
   * 停止收集器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = undefined;
    }

    logger.info('业务指标监控器已停止');
  }

  /**
   * 收集所有业务指标
   */
  private async collectAllMetrics(): Promise<void> {
    try {
      await Promise.all([
        this.collectUserMetrics(),
        this.collectOrderMetrics(),
        this.collectPaymentMetrics(),
        this.collectInventoryMetrics(),
        this.collectCommissionMetrics()
      ]);

      // 检查异常
      this.checkAnomalies();

    } catch (error) {
      logger.error('收集业务指标失败', error);
    }
  }

  /**
   * 收集用户指标
   */
  private async collectUserMetrics(): Promise<void> {
    try {
      // 这里应该调用实际的数据库查询
      // 模拟数据
      const newUserRegistrations = await this.getNewUserRegistrations();
      const activeUserCounts = await this.getActiveUserCounts();
      const userLevelDistribution = await this.getUserLevelDistribution();
      const retentionRates = await this.calculateRetentionRates();

      this.userMetrics = {
        registrations: newUserRegistrations,
        activeUsers: activeUserCounts,
        userLevels: userLevelDistribution,
        retentionRates
      };

      this.emit('metrics-collected', { type: 'users', data: this.userMetrics });

    } catch (error) {
      logger.error('收集用户指标失败', error);
    }
  }

  /**
   * 收集订单指标
   */
  private async collectOrderMetrics(): Promise<void> {
    try {
      const orderStats = await this.getOrderStatistics();
      const revenueData = await this.getRevenueData();
      const topProducts = await this.getTopProducts();
      const conversionRate = await this.calculateConversionRate();

      this.orderMetrics = {
        orders: orderStats,
        revenue: revenueData,
        averageOrderValue: revenueData.daily / orderStats.total || 0,
        conversionRate,
        topProducts
      };

      this.emit('metrics-collected', { type: 'orders', data: this.orderMetrics });

    } catch (error) {
      logger.error('收集订单指标失败', error);
    }
  }

  /**
   * 收集支付指标
   */
  private async collectPaymentMetrics(): Promise<void> {
    try {
      const paymentStats = await this.getPaymentStatistics();
      const paymentMethods = await this.getPaymentMethodDistribution();
      const avgProcessingTime = await this.getAveragePaymentProcessingTime();
      const failureReasons = await this.getPaymentFailureReasons();

      this.paymentMetrics = {
        payments: paymentStats,
        successRate: paymentStats.total > 0 ? (paymentStats.successful / paymentStats.total) * 100 : 0,
        paymentMethods,
        averageProcessingTime: avgProcessingTime,
        failureReasons
      };

      this.emit('metrics-collected', { type: 'payments', data: this.paymentMetrics });

    } catch (error) {
      logger.error('收集支付指标失败', error);
    }
  }

  /**
   * 收集库存指标
   */
  private async collectInventoryMetrics(): Promise<void> {
    try {
      const inventoryStats = await this.getInventoryStatistics();
      const warehouseStats = await this.getWarehouseStatistics();
      const alerts = await this.getInventoryAlerts();

      this.inventoryMetrics = {
        ...inventoryStats,
        warehouseStats,
        alerts
      };

      // 如果有库存预警，发出告警
      if (alerts.length > 0) {
        this.emit('inventory-alert', alerts);
      }

      this.emit('metrics-collected', { type: 'inventory', data: this.inventoryMetrics });

    } catch (error) {
      logger.error('收集库存指标失败', error);
    }
  }

  /**
   * 收集佣金指标
   */
  private async collectCommissionMetrics(): Promise<void> {
    try {
      const commissionStats = await this.getCommissionStatistics();
      const avgProcessingTime = await this.getAverageCommissionProcessingTime();
      const topEarners = await this.getTopEarners();
      const commissionByLevel = await this.getCommissionByLevel();

      this.commissionMetrics = {
        ...commissionStats,
        averageCommissionTime: avgProcessingTime,
        topEarners,
        commissionByLevel
      };

      this.emit('metrics-collected', { type: 'commission', data: this.commissionMetrics });

    } catch (error) {
      logger.error('收集佣金指标失败', error);
    }
  }

  /**
   * 检查业务异常
   */
  private checkAnomalies(): void {
    // 检查用户注册异常
    if (this.userMetrics.registrations.daily < 10) {
      this.emit('anomaly', {
        type: 'low_registration',
        severity: 'warning',
        message: '今日用户注册数过低',
        data: { count: this.userMetrics.registrations.daily }
      });
    }

    // 检查订单异常
    if (this.orderMetrics.orders.cancelled / this.orderMetrics.orders.total > 0.3) {
      this.emit('anomaly', {
        type: 'high_cancellation',
        severity: 'critical',
        message: '订单取消率过高',
        data: {
          rate: Math.round((this.orderMetrics.orders.cancelled / this.orderMetrics.orders.total) * 100)
        }
      });
    }

    // 检查支付成功率
    if (this.paymentMetrics.successRate < 90) {
      this.emit('anomaly', {
        type: 'low_payment_success',
        severity: 'critical',
        message: '支付成功率过低',
        data: { rate: this.paymentMetrics.successRate }
      });
    }

    // 检查库存
    if (this.inventoryMetrics.outOfStockItems > 100) {
      this.emit('anomaly', {
        type: 'high_out_of_stock',
        severity: 'high',
        message: '缺货商品数量过多',
        data: { count: this.inventoryMetrics.outOfStockItems }
      });
    }
  }

  /**
   * 获取业务指标报告
   */
  async getReport(): Promise<any> {
    return {
      timestamp: new Date(),
      users: this.userMetrics,
      orders: this.orderMetrics,
      payments: this.paymentMetrics,
      inventory: this.inventoryMetrics,
      commission: this.commissionMetrics,
      summary: {
        totalUsers: Object.values(this.userMetrics.userLevels).reduce((a, b) => a + b, 0),
        totalOrders: this.orderMetrics.orders.total,
        totalRevenue: this.orderMetrics.revenue.daily,
        paymentSuccessRate: this.paymentMetrics.successRate,
        lowStockAlerts: this.inventoryMetrics.alerts.length
      }
    };
  }

  // 模拟数据获取方法（实际应该连接数据库）

  private async getNewUserRegistrations(): Promise<{ daily: number; weekly: number; monthly: number }> {
    // TODO: 实现实际的数据库查询
    return {
      daily: Math.floor(Math.random() * 100) + 20,
      weekly: Math.floor(Math.random() * 500) + 200,
      monthly: Math.floor(Math.random() * 2000) + 1000
    };
  }

  private async getActiveUserCounts(): Promise<{ daily: number; weekly: number; monthly: number }> {
    // TODO: 实现实际的数据库查询
    return {
      daily: Math.floor(Math.random() * 1000) + 500,
      weekly: Math.floor(Math.random() * 3000) + 2000,
      monthly: Math.floor(Math.random() * 10000) + 5000
    };
  }

  private async getUserLevelDistribution(): Promise<UserMetrics['userLevels']> {
    // TODO: 实现实际的数据库查询
    return {
      NORMAL: Math.floor(Math.random() * 10000) + 5000,
      VIP: Math.floor(Math.random() * 5000) + 2000,
      STAR_1: Math.floor(Math.random() * 2000) + 1000,
      STAR_2: Math.floor(Math.random() * 1000) + 500,
      STAR_3: Math.floor(Math.random() * 500) + 200,
      STAR_4: Math.floor(Math.random() * 200) + 100,
      STAR_5: Math.floor(Math.random() * 100) + 50,
      DIRECTOR: Math.floor(Math.random() * 50) + 10
    };
  }

  private async calculateRetentionRates(): Promise<UserMetrics['retentionRates']> {
    // TODO: 实现实际的留存率计算
    return {
      day1: Math.random() * 20 + 70,
      day7: Math.random() * 15 + 45,
      day30: Math.random() * 10 + 25
    };
  }

  private async getOrderStatistics(): Promise<OrderMetrics['orders']> {
    // TODO: 实现实际的订单统计
    return {
      total: Math.floor(Math.random() * 1000) + 500,
      pending: Math.floor(Math.random() * 100),
      paid: Math.floor(Math.random() * 500) + 300,
      shipped: Math.floor(Math.random() * 300) + 100,
      delivered: Math.floor(Math.random() * 200) + 50,
      cancelled: Math.floor(Math.random() * 50)
    };
  }

  private async getRevenueData(): Promise<OrderMetrics['revenue']> {
    // TODO: 实际的收入数据计算
    return {
      daily: Math.floor(Math.random() * 100000) + 50000,
      weekly: Math.floor(Math.random() * 500000) + 300000,
      monthly: Math.floor(Math.random() * 2000000) + 1000000
    };
  }

  private async getTopProducts(): Promise<OrderMetrics['topProducts']> {
    // TODO: 实际的热门商品查询
    return [
      {
        productId: 'prod_001',
        name: '中道精品礼盒',
        sales: Math.floor(Math.random() * 100) + 50,
        revenue: Math.floor(Math.random() * 10000) + 5000
      },
      {
        productId: 'prod_002',
        name: '五谷杂粮套装',
        sales: Math.floor(Math.random() * 80) + 30,
        revenue: Math.floor(Math.random() * 8000) + 3000
      }
    ];
  }

  private async calculateConversionRate(): Promise<number> {
    // TODO: 实际的转化率计算
    return Math.random() * 5 + 2;
  }

  private async getPaymentStatistics(): Promise<PaymentMetrics['payments']> {
    // TODO: 实际的支付统计
    return {
      total: Math.floor(Math.random() * 500) + 300,
      successful: Math.floor(Math.random() * 400) + 200,
      failed: Math.floor(Math.random() * 50),
      pending: Math.floor(Math.random() * 30)
    };
  }

  private async getPaymentMethodDistribution(): Promise<PaymentMetrics['paymentMethods']> {
    // TODO: 实际的支付方式分布
    return {
      wechat: Math.floor(Math.random() * 200) + 100,
      alipay: Math.floor(Math.random() * 150) + 80,
      points: Math.floor(Math.random() * 100) + 50
    };
  }

  private async getAveragePaymentProcessingTime(): Promise<number> {
    // TODO: 实际的平均处理时间
    return Math.random() * 2 + 0.5;
  }

  private async getPaymentFailureReasons(): Promise<Record<string, number>> {
    // TODO: 实际的失败原因统计
    return {
      '余额不足': Math.floor(Math.random() * 10) + 5,
      '网络超时': Math.floor(Math.random() * 5) + 2,
      '支付限额': Math.floor(Math.random() * 3) + 1,
      '其他': Math.floor(Math.random() * 5)
    };
  }

  private async getInventoryStatistics(): Promise<Omit<InventoryMetrics, 'warehouseStats' | 'alerts'>> {
    // TODO: 实际的库存统计
    return {
      lowStockItems: Math.floor(Math.random() * 50) + 10,
      outOfStockItems: Math.floor(Math.random() * 20) + 5,
      totalValue: Math.floor(Math.random() * 1000000) + 500000,
      turnoverRate: Math.random() * 5 + 2
    };
  }

  private async getWarehouseStatistics(): Promise<InventoryMetrics['warehouseStats']> {
    // TODO: 实际的仓库统计
    return {
      platform: {
        items: Math.floor(Math.random() * 1000) + 500,
        value: Math.floor(Math.random() * 500000) + 200000
      },
      cloud: {
        items: Math.floor(Math.random() * 500) + 200,
        value: Math.floor(Math.random() * 200000) + 100000
      },
      local: {
        items: Math.floor(Math.random() * 100) + 50,
        value: Math.floor(Math.random() * 50000) + 20000
      }
    };
  }

  private async getInventoryAlerts(): Promise<InventoryMetrics['alerts']> {
    // TODO: 实际的库存预警
    return [
      {
        productId: 'prod_001',
        warehouse: 'cloud',
        currentStock: 5,
        threshold: 10
      },
      {
        productId: 'prod_002',
        warehouse: 'local',
        currentStock: 0,
        threshold: 5
      }
    ];
  }

  private async getCommissionStatistics(): Promise<Omit<CommissionMetrics, 'averageCommissionTime' | 'topEarners' | 'commissionByLevel'>> {
    // TODO: 实际的佣金统计
    return {
      totalCommission: Math.floor(Math.random() * 100000) + 50000,
      pendingCommission: Math.floor(Math.random() * 20000) + 10000,
      paidCommission: Math.floor(Math.random() * 50000) + 30000
    };
  }

  private async getAverageCommissionProcessingTime(): Promise<number> {
    // TODO: 实际的平均处理时间
    return Math.random() * 24 + 12;
  }

  private async getTopEarners(): Promise<CommissionMetrics['topEarners']> {
    // TODO: 实际的顶尖收益者
    return [
      {
        userId: 'user_001',
        name: '张总监',
        level: 'DIRECTOR',
        commission: Math.floor(Math.random() * 10000) + 5000
      },
      {
        userId: 'user_002',
        name: '李五星',
        level: 'STAR_5',
        commission: Math.floor(Math.random() * 5000) + 2000
      }
    ];
  }

  private async getCommissionByLevel(): Promise<Record<string, number>> {
    // TODO: 实际的按级别统计佣金
    return {
      NORMAL: Math.floor(Math.random() * 5000) + 1000,
      VIP: Math.floor(Math.random() * 10000) + 5000,
      STAR_1: Math.floor(Math.random() * 8000) + 4000,
      STAR_2: Math.floor(Math.random() * 10000) + 6000,
      STAR_3: Math.floor(Math.random() * 12000) + 8000,
      STAR_4: Math.floor(Math.random() * 15000) + 10000,
      STAR_5: Math.floor(Math.random() * 20000) + 15000,
      DIRECTOR: Math.floor(Math.random() * 30000) + 20000
    };
  }

  // 初始化方法
  private initializeUserMetrics(): UserMetrics {
    return {
      registrations: { daily: 0, weekly: 0, monthly: 0 },
      activeUsers: { daily: 0, weekly: 0, monthly: 0 },
      userLevels: {
        NORMAL: 0,
        VIP: 0,
        STAR_1: 0,
        STAR_2: 0,
        STAR_3: 0,
        STAR_4: 0,
        STAR_5: 0,
        DIRECTOR: 0
      },
      retentionRates: { day1: 0, day7: 0, day30: 0 }
    };
  }

  private initializeOrderMetrics(): OrderMetrics {
    return {
      orders: {
        total: 0,
        pending: 0,
        paid: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0
      },
      revenue: { daily: 0, weekly: 0, monthly: 0 },
      averageOrderValue: 0,
      conversionRate: 0,
      topProducts: []
    };
  }

  private initializePaymentMetrics(): PaymentMetrics {
    return {
      payments: {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0
      },
      successRate: 0,
      paymentMethods: {
        wechat: 0,
        alipay: 0,
        points: 0
      },
      averageProcessingTime: 0,
      failureReasons: {}
    };
  }

  private initializeInventoryMetrics(): InventoryMetrics {
    return {
      lowStockItems: 0,
      outOfStockItems: 0,
      totalValue: 0,
      turnoverRate: 0,
      warehouseStats: {
        platform: { items: 0, value: 0 },
        cloud: { items: 0, value: 0 },
        local: { items: 0, value: 0 }
      },
      alerts: []
    };
  }

  private initializeCommissionMetrics(): CommissionMetrics {
    return {
      totalCommission: 0,
      pendingCommission: 0,
      paidCommission: 0,
      averageCommissionTime: 0,
      topEarners: [],
      commissionByLevel: {}
    };
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.isRunning;
  }
}