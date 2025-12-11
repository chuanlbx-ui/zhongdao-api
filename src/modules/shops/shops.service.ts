import { PrismaClient } from '@prisma/client';
import { logger } from '@/shared/utils/logger';

const prisma = new PrismaClient();

export class ShopsService {
  /**
   * 查询所有shops
   */
  async findAll(params: any = {}) {
    try {
      const { page = 1, limit = 10, ...filters } = params;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.shops.findMany({
          where: filters,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.shops.count({ where: filters })
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
      logger.error('Find all shops error:', error);
      throw error;
    }
  }

  /**
   * 根据ID查询shops
   */
  async findById(id: string) {
    try {
      return await prisma.shops.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Find shops by id error:', error);
      throw error;
    }
  }

  /**
   * 创建shops
   */
  async create(data: any) {
    try {
      return await prisma.shops.create({
        data
      });
    } catch (error) {
      logger.error('Create shops error:', error);
      throw error;
    }
  }

  /**
   * 更新shops
   */
  async update(id: string, data: any) {
    try {
      return await prisma.shops.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error('Update shops error:', error);
      throw error;
    }
  }

  /**
   * 删除shops
   */
  async delete(id: string) {
    try {
      return await prisma.shops.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Delete shops error:', error);
      throw error;
    }
  }
}

export const shopsService = new ShopsService();
