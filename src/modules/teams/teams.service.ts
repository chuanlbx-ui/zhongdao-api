import { PrismaClient } from '@prisma/client';
import { logger } from '@/shared/utils/logger';

const prisma = new PrismaClient();

export class TeamsService {
  /**
   * 查询所有teams
   */
  async findAll(params: any = {}) {
    try {
      const { page = 1, limit = 10, ...filters } = params;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.teams.findMany({
          where: filters,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.teams.count({ where: filters })
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
      logger.error('Find all teams error:', error);
      throw error;
    }
  }

  /**
   * 根据ID查询teams
   */
  async findById(id: string) {
    try {
      return await prisma.teams.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Find teams by id error:', error);
      throw error;
    }
  }

  /**
   * 创建teams
   */
  async create(data: any) {
    try {
      return await prisma.teams.create({
        data
      });
    } catch (error) {
      logger.error('Create teams error:', error);
      throw error;
    }
  }

  /**
   * 更新teams
   */
  async update(id: string, data: any) {
    try {
      return await prisma.teams.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error('Update teams error:', error);
      throw error;
    }
  }

  /**
   * 删除teams
   */
  async delete(id: string) {
    try {
      return await prisma.teams.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Delete teams error:', error);
      throw error;
    }
  }
}

export const teamsService = new TeamsService();
