import { PrismaClient } from '@prisma/client';
import { logger } from '@/shared/utils/logger';

const prisma = new PrismaClient();

export class UsersService {
  /**
   * 查询所有users
   */
  async findAll(params: any = {}) {
    try {
      const { page = 1, limit = 10, ...filters } = params;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.users.findMany({
          where: filters,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.users.count({ where: filters })
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
      logger.error('Find all users error:', error);
      throw error;
    }
  }

  /**
   * 根据ID查询users
   */
  async findById(id: string) {
    try {
      return await prisma.users.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Find users by id error:', error);
      throw error;
    }
  }

  /**
   * 创建users
   */
  async create(data: any) {
    try {
      return await prisma.users.create({
        data
      });
    } catch (error) {
      logger.error('Create users error:', error);
      throw error;
    }
  }

  /**
   * 更新users
   */
  async update(id: string, data: any) {
    try {
      return await prisma.users.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error('Update users error:', error);
      throw error;
    }
  }

  /**
   * 删除users
   */
  async delete(id: string) {
    try {
      return await prisma.users.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Delete users error:', error);
      throw error;
    }
  }
}

export const usersService = new UsersService();
