/**
 * 基础仓储类
 * 提供通用的数据访问功能
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { AppError, ErrorFactory } from '../errors';

export abstract class BaseRepository<TModel, TCreateInput, TUpdateInput> {
  protected prisma: PrismaClient = prisma;
  protected abstract modelName: string;
  protected abstract model: any;

  /**
   * 创建记录
   */
  async create(data: TCreateInput): Promise<TModel> {
    try {
      const result = await this.model.create({ data });
      logger.debug('创建记录成功', {
        model: this.modelName,
        id: (result as any).id
      });
      return result as TModel;
    } catch (error) {
      logger.error('创建记录失败', {
        model: this.modelName,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 批量创建记录
   */
  async createMany(data: TCreateInput[]): Promise<{ count: number }> {
    try {
      const result = await this.model.createMany({ data });
      logger.debug('批量创建记录成功', {
        model: this.modelName,
        count: result.count
      });
      return result;
    } catch (error) {
      logger.error('批量创建记录失败', {
        model: this.modelName,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 根据ID查找记录
   */
  async findById(
    id: string,
    options?: {
      include?: any;
      select?: any;
    }
  ): Promise<TModel | null> {
    try {
      const result = await this.model.findUnique({
        where: { id },
        include: options?.include,
        select: options?.select
      });
      return result as TModel | null;
    } catch (error) {
      logger.error('查找记录失败', {
        model: this.modelName,
        id,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 根据条件查找单条记录
   */
  async findOne(
    where: any,
    options?: {
      include?: any;
      select?: any;
      orderBy?: any;
    }
  ): Promise<TModel | null> {
    try {
      const result = await this.model.findFirst({
        where,
        include: options?.include,
        select: options?.select,
        orderBy: options?.orderBy
      });
      return result as TModel | null;
    } catch (error) {
      logger.error('查找记录失败', {
        model: this.modelName,
        where,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 根据条件查找多条记录
   */
  async findMany(
    where: any = {},
    options?: {
      include?: any;
      select?: any;
      orderBy?: any;
      skip?: number;
      take?: number;
      cursor?: any;
    }
  ): Promise<TModel[]> {
    try {
      const result = await this.model.findMany({
        where,
        include: options?.include,
        select: options?.select,
        orderBy: options?.orderBy,
        skip: options?.skip,
        take: options?.take,
        cursor: options?.cursor
      });
      return result as TModel[];
    } catch (error) {
      logger.error('查找记录失败', {
        model: this.modelName,
        where,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 分页查询
   */
  async findPaginated(
    where: any = {},
    options: {
      page: number;
      perPage: number;
      include?: any;
      select?: any;
      orderBy?: any;
    }
  ): Promise<{
    items: TModel[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  }> {
    try {
      const { page, perPage } = options;
      const skip = (page - 1) * perPage;

      const [items, total] = await Promise.all([
        this.model.findMany({
          where,
          skip,
          take: perPage,
          include: options.include,
          select: options.select,
          orderBy: options.orderBy
        }),
        this.model.count({ where })
      ]);

      return {
        items: items as TModel[],
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage)
      };
    } catch (error) {
      logger.error('分页查询失败', {
        model: this.modelName,
        where,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 更新记录
   */
  async update(
    id: string,
    data: TUpdateInput,
    options?: {
      include?: any;
      select?: any;
    }
  ): Promise<TModel> {
    try {
      const result = await this.model.update({
        where: { id },
        data,
        include: options?.include,
        select: options?.select
      });
      logger.debug('更新记录成功', {
        model: this.modelName,
        id
      });
      return result as TModel;
    } catch (error) {
      logger.error('更新记录失败', {
        model: this.modelName,
        id,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 批量更新记录
   */
  async updateMany(
    where: any,
    data: TUpdateInput
  ): Promise<{ count: number }> {
    try {
      const result = await this.model.updateMany({ where, data });
      logger.debug('批量更新记录成功', {
        model: this.modelName,
        count: result.count
      });
      return result;
    } catch (error) {
      logger.error('批量更新记录失败', {
        model: this.modelName,
        where,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 删除记录
   */
  async delete(
    id: string,
    options?: {
      include?: any;
      select?: any;
    }
  ): Promise<TModel> {
    try {
      const result = await this.model.delete({
        where: { id },
        include: options?.include,
        select: options?.select
      });
      logger.debug('删除记录成功', {
        model: this.modelName,
        id
      });
      return result as TModel;
    } catch (error) {
      logger.error('删除记录失败', {
        model: this.modelName,
        id,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 批量删除记录
   */
  async deleteMany(where: any): Promise<{ count: number }> {
    try {
      const result = await this.model.deleteMany({ where });
      logger.debug('批量删除记录成功', {
        model: this.modelName,
        count: result.count
      });
      return result;
    } catch (error) {
      logger.error('批量删除记录失败', {
        model: this.modelName,
        where,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 软删除记录（如果支持）
   */
  async softDelete(id: string): Promise<TModel> {
    // 假设模型有 deletedAt 字段
    return this.update(id, { deletedAt: new Date() } as any);
  }

  /**
   * 恢复软删除记录
   */
  async restore(id: string): Promise<TModel> {
    return this.update(id, { deletedAt: null } as any);
  }

  /**
   * 计数
   */
  async count(where: any = {}): Promise<number> {
    try {
      return await this.model.count({ where });
    } catch (error) {
      logger.error('计数失败', {
        model: this.modelName,
        where,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 聚合查询
   */
  async aggregate(
    args: Prisma.AggregateArgs
  ): Promise<any> {
    try {
      return await this.model.aggregate(args);
    } catch (error) {
      logger.error('聚合查询失败', {
        model: this.modelName,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 分组查询
   */
  async groupBy(
    args: Prisma.GroupByArgs
  ): Promise<any> {
    try {
      return await this.model.groupBy(args);
    } catch (error) {
      logger.error('分组查询失败', {
        model: this.modelName,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 检查记录是否存在
   */
  async exists(where: any): Promise<boolean> {
    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * 原生SQL查询（慎用）
   */
  async queryRaw<T = any>(
    query: string,
    parameters?: any[]
  ): Promise<T[]> {
    try {
      const result = await this.prisma.$queryRaw`${query}`;
      return result as T[];
    } catch (error) {
      logger.error('原生查询失败', {
        model: this.modelName,
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 执行原始SQL（慎用）
   */
  async executeRaw(
    query: string,
    parameters?: any[]
  ): Promise<number> {
    try {
      const result = await this.prisma.$executeRaw`${query}`;
      return result as number;
    } catch (error) {
      logger.error('执行原始SQL失败', {
        model: this.modelName,
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw this.handleError(error);
    }
  }

  /**
   * 处理数据库错误
   */
  private handleError(error: any): AppError {
    // Prisma错误处理
    if (error.code) {
      switch (error.code) {
        case 'P2002':
          return ErrorFactory.conflict('数据已存在', {
            field: error.meta?.target?.[0]
          });
        case 'P2025':
          return ErrorFactory.notFound('记录不存在');
        case 'P2003':
          return ErrorFactory.businessRuleViolation('外键约束违反', {
            field: error.meta?.field_name
          });
        case 'P2014':
          return ErrorFactory.businessRuleViolation('关系约束违反');
        case 'P2021':
          return ErrorFactory.internalError('表不存在');
        case 'P2022':
          return ErrorFactory.internalError('列不存在');
      }
    }

    // 未知错误
    if (error instanceof AppError) {
      return error;
    }

    return ErrorFactory.internalError('数据库操作失败');
  }
}