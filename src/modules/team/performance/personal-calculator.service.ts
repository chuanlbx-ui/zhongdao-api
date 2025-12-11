/**
 * 个人业绩计算服务
 * 负责计算和统计个人相关的业绩指标
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { performanceCacheService } from './cache.service';
import {
  PersonalPerformance,
  PeriodRange,
  UserSalesData,
  UserOrderData,
  UserCustomerData,
  CacheConfig
} from './types';

export class PersonalCalculatorService {
  private cacheTTL: Pick<CacheConfig, 'performanceMetrics'>;

  constructor() {
    this.cacheTTL = {
      performanceMetrics: 300 // 5分钟
    };
  }

  /**
   * 计算个人业绩
   * @param userId 用户ID
   * @param period 统计周期 (YYYY-MM-DD, YYYY-MM, YYYY-WW, YYYY)
   */
  async calculatePersonalPerformance(
    userId: string,
    period: string
  ): Promise<PersonalPerformance> {
    try {
      const cacheKey = `personal_performance:${userId}:${period}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      // 解析周期
      const { startDate, endDate } = this.parsePeriod(period);

      // 并行查询各项数据
      const [
        salesData,
        orderData,
        customerData,
        monthlyData,
        yearlyData
      ] = await Promise.all([
        // 销售数据
        this.getUserSalesData(userId, startDate, endDate),
        // 订单数据
        this.getUserOrderData(userId, startDate, endDate),
        // 客户数据
        this.getUserCustomerData(userId, startDate, endDate),
        // 月度至今数据
        this.getUserSalesData(userId, this.getMonthStart(), new Date()),
        // 年度至今数据
        this.getUserSalesData(userId, this.getYearStart(), new Date())
      ]);

      const performance: PersonalPerformance = {
        salesAmount: salesData.totalAmount,
        orderCount: orderData.orderCount,
        newCustomers: customerData.newCustomers,
        repeatRate: this.calculateRepeatRate(customerData.totalCustomers, customerData.repeatCustomers),
        averageOrderValue: orderData.orderCount > 0 ? salesData.totalAmount / orderData.orderCount : 0,
        monthToDate: monthlyData.totalAmount,
        yearToDate: yearlyData.totalAmount
      };

      // 缓存结果
      performanceCacheService.set(cacheKey, performance, this.cacheTTL.performanceMetrics);

      logger.info('个人业绩计算完成', {
        userId,
        period,
        salesAmount: performance.salesAmount,
        orderCount: performance.orderCount
      });

      return performance;

    } catch (error) {
      logger.error('计算个人业绩失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取用户销售数据
   */
  async getUserSalesData(userId: string, startDate: Date, endDate: Date): Promise<UserSalesData> {
    try {
      const result = await prisma.orders.aggregate({
        where: {
          sellerId: userId,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          totalAmount: true
        }
      });

      return { totalAmount: result._sum.totalAmount || 0 };
    } catch (error) {
      logger.error('获取用户销售数据失败', { userId, error });
      return { totalAmount: 0 };
    }
  }

  /**
   * 获取用户订单数据
   */
  async getUserOrderData(userId: string, startDate: Date, endDate: Date): Promise<UserOrderData> {
    try {
      const orderCount = await prisma.orders.count({
        where: {
          sellerId: userId,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      return { orderCount };
    } catch (error) {
      logger.error('获取用户订单数据失败', { userId, error });
      return { orderCount: 0 };
    }
  }

  /**
   * 获取用户客户数据
   */
  async getUserCustomerData(userId: string, startDate: Date, endDate: Date): Promise<UserCustomerData> {
    try {
      // 获取购买客户
      const totalCustomers = await prisma.orders.groupBy({
        by: ['buyerId'],
        where: {
          sellerId: userId,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // 获取复购客户（简化实现，实际需要更复杂的逻辑）
      const repeatCustomersResult = await prisma.$queryRaw<Array<{ buyer_id: string; order_count: number }>>`
        SELECT
          buyer_id,
          COUNT(*) as order_count
        FROM orders
        WHERE seller_id = ${userId}
          AND status IN ('PAID', 'SHIPPED', 'DELIVERED')
          AND createdAt >= ${startDate}
          AND createdAt <= ${endDate}
        GROUP BY buyer_id
        HAVING order_count > 1
      `;

      const totalCustomersCount = totalCustomers.length;
      const repeatCustomersCount = repeatCustomersResult.length;
      const newCustomersCount = Math.max(0, totalCustomersCount - repeatCustomersCount);

      return {
        totalCustomers: totalCustomersCount,
        newCustomers: newCustomersCount,
        repeatCustomers: repeatCustomersCount
      };
    } catch (error) {
      logger.error('获取用户客户数据失败', { userId, error });
      return { totalCustomers: 0, newCustomers: 0, repeatCustomers: 0 };
    }
  }

  /**
   * 解析统计周期
   */
  private parsePeriod(period: string): PeriodRange {
    const now = new Date();

    if (period.match(/^\d{4}-\d{2}$/)) { // YYYY-MM (月度)
      const year = parseInt(period.substring(0, 4));
      const month = parseInt(period.substring(5, 7));
      return {
        startDate: new Date(year, month - 1, 1),
        endDate: new Date(year, month, 0)
      };
    } else if (period.match(/^\d{4}$/)) { // YYYY (年度)
      const year = parseInt(period);
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31)
      };
    } else if (period.match(/^\d{4}-W\d{2}$/)) { // YYYY-WWW (周度)
      // 简化实现，实际需要更复杂的周计算
      const year = parseInt(period.substring(0, 4));
      const week = parseInt(period.substring(6, 8));
      const startDate = new Date(year, 0, 1 + (week - 1) * 7);
      const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      return { startDate, endDate };
    }

    // 默认返回当月
    return {
      startDate: this.getMonthStart(),
      endDate: now
    };
  }

  /**
   * 获取月初时间
   */
  private getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * 获取年初时间
   */
  private getYearStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  }

  /**
   * 计算复购率
   */
  private calculateRepeatRate(totalCustomers: number, repeatCustomers: number): number {
    return totalCustomers > 0 ? repeatCustomers / totalCustomers : 0;
  }

  /**
   * 计算月增长率
   */
  async calculateMonthlyGrowthRate(userId: string): Promise<number> {
    try {
      const currentMonth = this.formatPeriod(new Date(), 'monthly');
      const lastMonth = this.getLastPeriod(currentMonth);

      if (!lastMonth) return 0;

      const [currentPerformance, lastPerformance] = await Promise.all([
        this.calculatePersonalPerformance(userId, currentMonth),
        this.calculatePersonalPerformance(userId, lastMonth)
      ]);

      const currentSales = currentPerformance.salesAmount;
      const lastSales = lastPerformance.salesAmount;

      return lastSales > 0 ? (currentSales - lastSales) / lastSales : 0;
    } catch (error) {
      logger.error('计算月增长率失败', { userId, error });
      return 0;
    }
  }

  /**
   * 获取历史最佳业绩
   */
  async getBestPerformance(userId: string): Promise<number> {
    try {
      // 按月分组找到最佳月份
      const monthlyBest = await prisma.$queryRaw<Array<{ month: string; total: bigint }>>`
        SELECT
          DATE_FORMAT(createdAt, '%Y-%m') as month,
          SUM(total_amount) as total
        FROM orders
        WHERE seller_id = ${userId}
          AND status IN ('PAID', 'SHIPPED', 'DELIVERED')
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY total DESC
        LIMIT 1
      `;

      return monthlyBest.length > 0 ? Number(monthlyBest[0].total) : 0;
    } catch (error) {
      logger.error('获取历史最佳业绩失败', { userId, error });
      return 0;
    }
  }

  /**
   * 格式化周期
   */
  private formatPeriod(date: Date, type: 'monthly' | 'yearly'): string {
    switch (type) {
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return `${date.getFullYear()}`;
      default:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  /**
   * 获取上一期周期
   */
  private getLastPeriod(currentPeriod: string): string | null {
    try {
      if (currentPeriod.match(/^\d{4}-\d{2}$/)) { // YYYY-MM
        const year = parseInt(currentPeriod.substring(0, 4));
        const month = parseInt(currentPeriod.substring(5, 7));

        if (month === 1) {
          return `${year - 1}-12`;
        } else {
          return `${year}-${String(month - 1).padStart(2, '0')}`;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

// 导出服务实例
export const personalCalculatorService = new PersonalCalculatorService();