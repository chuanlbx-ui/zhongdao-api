import { PrismaClient } from '@prisma/client';
import { logger } from '@/shared/utils/logger';

const prisma = new PrismaClient();

export class OrdersService {
  /**
   * 查询所有orders
   */
  async findAll(params: any = {}) {
    try {
      const { page = 1, limit = 10, ...filters } = params;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.orders.findMany({
          where: filters,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.orders.count({ where: filters })
      ]);

      return {
        data,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Find all orders error:', error);
      throw error;
    }
  }

  /**
   * 根据ID查询orders
   */
  async findById(id: string) {
    try {
      return await prisma.orders.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Find orders by id error:', error);
      throw error;
    }
  }

  /**
   * 创建orders
   */
  async create(data: any) {
    try {
      return await prisma.orders.create({
        data
      });
    } catch (error) {
      logger.error('Create orders error:', error);
      throw error;
    }
  }

  /**
   * 更新orders
   */
  async update(id: string, data: any) {
    try {
      return await prisma.orders.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error('Update orders error:', error);
      throw error;
    }
  }

  /**
   * 删除orders
   */
  async delete(id: string) {
    try {
      return await prisma.orders.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Delete orders error:', error);
      throw error;
    }
  }
}

export const ordersService = new OrdersService();
