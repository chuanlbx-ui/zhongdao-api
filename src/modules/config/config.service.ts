// @ts-nocheck
/**
 * 系统配置管理服务
 * 用于管理所有系统参数（会员等级、折扣、佣金等）
 */

import { prisma } from '../../shared/database/client';
import { logger } from '../../shared/utils/logger';

/**
 * 系统配置服务
 * 所有可变的业务参数都通过这个服务读取
 */
export class ConfigService {
  private static instance: ConfigService;

  // 内存缓存（为了性能）
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5分钟缓存

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * 获取配置值（带缓存）
   */
  async getConfig<T = any>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      // 检查缓存
      if (this.cache.has(key)) {
        const expiry = this.cacheExpiry.get(key);
        if (expiry && expiry > Date.now()) {
          return this.cache.get(key);
        } else {
          this.cache.delete(key);
          this.cacheExpiry.delete(key);
        }
      }

      // 从数据库读取
      const config = await (prisma as any).systemConfig.findUnique({
        where: { key }
      });

      if (!config) {
        return defaultValue !== undefined ? defaultValue : null;
      }

      // 解析值
      const parsedValue = this.parseValue(config.value, config.type);

      // 存入缓存
      this.cache.set(key, parsedValue);
      this.cacheExpiry.set(key, Date.now() + this.cacheTimeout);

      return parsedValue;
    } catch (error) {
      logger.error('获取配置失败', { key, error });
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  /**
   * 获取多个配置值
   */
  async getConfigs<T = Record<string, any>>(keys: string[]): Promise<T> {
    try {
      const configs = await (prisma as any).systemConfig.findMany({
        where: { key: { in: keys } }
      });

      const result: any = {};
      for (const config of configs) {
        result[config.key] = this.parseValue(config.value, config.type);
      }

      return result as T;
    } catch (error) {
      logger.error('批量获取配置失败', { keys, error });
      return {} as T;
    }
  }

  /**
   * 获取指定分类的所有配置
   */
  async getConfigsByCategory(category: string): Promise<Record<string, any>> {
    try {
      const configs = await (prisma as any).systemConfig.findMany({
        where: { category }
      });

      const result: Record<string, any> = {};
      for (const config of configs) {
        result[config.key] = this.parseValue(config.value, config.type);
      }

      return result;
    } catch (error) {
      logger.error('获取分类配置失败', { category, error });
      return {};
    }
  }

  /**
   * 修改配置值
   */
  async updateConfig(
    key: string,
    value: any,
    options?: {
      description?: string;
      category?: string;
      type?: string;
      lastModifiedBy?: string;
    }
  ): Promise<void> {
    try {
      // 序列化值
      const serializedValue = this.serializeValue(value);

      // 更新数据库
      await (prisma as any).systemConfig.upsert({
        where: { key },
        update: {
          value: serializedValue,
          description: options?.description,
          category: options?.category,
          type: options?.type,
          lastModifiedBy: options?.lastModifiedBy,
          updatedAt: new Date()
        },
        create: {
          key,
          value: serializedValue,
          description: options?.description,
          category: options?.category,
          type: options?.type || 'STRING',
          lastModifiedBy: options?.lastModifiedBy
        }
      });

      // 清除缓存
      this.invalidateCache(key);

      logger.info('配置已更新', { key });
    } catch (error) {
      logger.error('更新配置失败', { key, error });
      throw error;
    }
  }

  /**
   * 批量更新配置
   */
  async updateConfigs(
    configs: Record<string, any>,
    options?: {
      category?: string;
      lastModifiedBy?: string;
    }
  ): Promise<void> {
    try {
      for (const [key, value] of Object.entries(configs)) {
        await this.updateConfig(key, value, options);
      }
    } catch (error) {
      logger.error('批量更新配置失败', { configs, error });
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(key: string): Promise<void> {
    try {
      await (prisma as any).systemConfig.delete({
        where: { key }
      });

      // 清除缓存
      this.invalidateCache(key);

      logger.info('配置已删除', { key });
    } catch (error) {
      logger.error('删除配置失败', { key, error });
      throw error;
    }
  }

  /**
   * 清除指定的缓存
   */
  private invalidateCache(key: string): void {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  /**
   * 清除所有缓存
   */
  public clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
    logger.info('配置缓存已清除');
  }

  /**
   * 解析配置值
   */
  private parseValue(value: string, type: string): any {
    try {
      switch (type) {
        case 'JSON':
          return JSON.parse(value);
        case 'ARRAY':
          return JSON.parse(value);
        case 'NUMBER':
          return parseFloat(value);
        case 'BOOLEAN':
          return value.toLowerCase() === 'true';
        default:
          return value;
      }
    } catch (error) {
      logger.error('解析配置值失败', { value, type, error });
      return value;
    }
  }

  /**
   * 序列化配置值
   */
  private serializeValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  // ========== 管理员API方法 ==========

  /**
   * 获取所有配置（分页）
   */
  async getAllConfigs(options: {
    page: number;
    perPage: number;
    category?: string;
    key?: string;
    search?: string;
  }): Promise<{
    configs: any[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const { page, perPage, category, key, search } = options;
      const skip = (page - 1) * perPage;

      const whereCondition: any = {};

      if (category) {
        whereCondition.category = category;
      }

      if (key) {
        whereCondition.key = { contains: key };
      }

      if (search) {
        whereCondition.OR = [
          { key: { contains: search } },
          { description: { contains: search } },
          { category: { contains: search } }
        ];
      }

      const [configs, total] = await Promise.all([
        (prisma as any).systemConfig.findMany({
          where: whereCondition,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: perPage,
          select: {
            id: true,
            key: true,
            value: true,
            description: true,
            category: true,
            type: true,
            createdAt: true,
            updatedAt: true,
            lastModifiedBy: true
          }
        }),
        (prisma as any).systemConfig.count({ where: whereCondition })
      ]);

      // 解析配置值
      const parsedConfigs = configs.map(config => ({
        ...config,
        value: this.parseValue(config.value, config.type)
      }));

      return {
        configs: parsedConfigs,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };
    } catch (error) {
      logger.error('获取所有配置失败', { options, error });
      throw error;
    }
  }

  /**
   * 获取单个配置详情
   */
  async getConfigDetail(key: string, retryCount: number = 0): Promise<any> {
    try {
      const config = await (prisma as any).systemConfig.findUnique({
        where: { key },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          category: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          lastModifiedBy: true
        }
      });

      if (!config) {
        return null;
      }

      return {
        ...config,
        value: this.parseValue(config.value, config.type)
      };
    } catch (error: any) {
      // 特殊处理初始化检查错误，避免在开发环境显示过多错误
      if (key === 'init_check') {
        // 静默处理，不输出日志
        throw error;
      }

      logger.error('获取配置详情失败', { key, error, retryCount });

      // 数据库连接错误，最多重试2次
      if (error.message?.includes('Unknown authentication plugin') || error.message?.includes('connect')) {
        if (retryCount < 2) {
          logger.info(`尝试重新连接数据库 (${retryCount + 1}/2)`);
          // 等待1秒后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.getConfigDetail(key, retryCount + 1);
        }
      }
      
      // 添加更友好的错误信息
      const errorMessage = error.message?.includes('Unknown authentication plugin') 
        ? '数据库认证插件不兼容，请检查DATABASE_URL中的authPlugin参数配置' 
        : `获取配置详情失败: ${error.message}`;
      
      const customError = new Error(errorMessage);
      (customError as any).originalError = error;
      throw customError;
    }
  }

  /**
   * 创建新配置
   */
  async createConfig(params: {
    key: string;
    value: any;
    category: string;
    description?: string;
    dataType?: string;
        createdBy: string;
  }): Promise<any> {
    try {
      const { key, value, category, description, dataType = 'string', createdBy } = params;

      const serializedValue = this.serializeValue(value);

      const newConfig = await (prisma as any).systemConfig.create({
        data: {
          key,
          value: serializedValue,
          description,
          category,
          type: dataType.toUpperCase(),
                    lastModifiedBy: createdBy,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          category: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          lastModifiedBy: true
        }
      });

      // 清除缓存
      this.invalidateCache(key);

      return {
        ...newConfig,
        value: this.parseValue(newConfig.value, newConfig.type)
      };
    } catch (error) {
      logger.error('创建配置失败', { params, error });
      throw error;
    }
  }

  /**
   * 更新配置（扩展版本，支持原因和操作记录）
   */
  async updateConfig(key: string, value: any, options?: {
    description?: string;
    reason?: string;
    lastModifiedBy?: string;
  }): Promise<any> {
    try {
      const oldConfig = await this.getConfigDetail(key);

      // 序列化值
      const serializedValue = this.serializeValue(value);

      // 更新数据库
      const updatedConfig = await (prisma as any).systemConfig.update({
        where: { key },
        data: {
          value: serializedValue,
          description: options?.description,
          lastModifiedBy: options?.lastModifiedBy,
          updatedAt: new Date()
        },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          category: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          lastModifiedBy: true
        }
      });

      // 记录配置变更历史（如果有历史表）
      if (oldConfig && options?.reason) {
        try {
          await this.recordConfigChange({
            configKey: key,
            oldValue: oldConfig.value,
            newValue: value,
            reason: options.reason,
            modifiedBy: options.lastModifiedBy
          });
        } catch (historyError) {
          logger.warn('记录配置变更历史失败', { key, error: historyError });
        }
      }

      // 清除缓存
      this.invalidateCache(key);

      return {
        ...updatedConfig,
        value: this.parseValue(updatedConfig.value, updatedConfig.type)
      };
    } catch (error) {
      logger.error('更新配置失败', { key, error });
      throw error;
    }
  }

  /**
   * 删除配置（扩展版本）
   */
  async deleteConfig(key: string, deletedBy: string): Promise<void> {
    try {
      await (prisma as any).systemConfig.delete({
        where: { key }
      });

      // 清除缓存
      this.invalidateCache(key);

      logger.info('配置已删除', { key, deletedBy });
    } catch (error) {
      logger.error('删除配置失败', { key, error });
      throw error;
    }
  }

  /**
   * 获取配置分类列表
   */
  async getCategories(): Promise<string[]> {
    try {
      const result = await (prisma as any).systemConfig.findMany({
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' }
      });

      return result.map(item => item.category).filter(Boolean);
    } catch (error) {
      logger.error('获取配置分类失败', { error });
      throw error;
    }
  }

  /**
   * 批量更新配置
   */
  async batchUpdateConfigs(configs: Array<{ key: string; value: any }>, options: {
    lastModifiedBy?: string;
    reason?: string;
  }): Promise<{
    success: Array<{ key: string; newValue: any }>;
    failure: Array<{ key: string; error: string }>;
  }> {
    const result = {
      success: [] as Array<{ key: string; newValue: any }>,
      failure: [] as Array<{ key: string; error: string }>
    };

    for (const config of configs) {
      try {
        await this.updateConfig(config.key, config.value, {
          reason: options.reason,
          lastModifiedBy: options.lastModifiedBy
        });
        result.success.push({ key: config.key, newValue: config.value });
      } catch (error) {
        result.failure.push({
          key: config.key,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    return result;
  }

  /**
   * 获取配置修改历史
   */
  async getConfigHistory(key: string, options: {
    page: number;
    perPage: number;
  }): Promise<any> {
    try {
      // 这里假设有配置变更历史表，如果没有则返回配置的基本信息
      const config = await this.getConfigDetail(key);

      if (!config) {
        return {
          history: [],
          pagination: {
            page: options.page,
            perPage: options.perPage,
            total: 0,
            totalPages: 0
          }
        };
      }

      // 临时返回当前配置信息作为"历史"
      return {
        history: [{
          id: config.id,
          key: config.key,
          oldValue: config.value,
          newValue: config.value,
          reason: '配置当前状态',
          modifiedBy: config.lastModifiedBy,
          modifiedAt: config.updatedAt
        }],
        pagination: {
          page: options.page,
          perPage: options.perPage,
          total: 1,
          totalPages: 1
        }
      };
    } catch (error) {
      logger.error('获取配置历史失败', { key, error });
      throw error;
    }
  }

  /**
   * 导出配置
   */
  async exportConfigs(options: {
    category?: string;
    format: 'json' | 'csv';
  }): Promise<string> {
    try {
      const configs = await this.getAllConfigs({
        page: 1,
        perPage: 1000,
        category: options.category
      });

      if (options.format === 'json') {
        return JSON.stringify(configs.configs, null, 2);
      } else if (options.format === 'csv') {
        const headers = ['key', 'value', 'description', 'category', 'type', 'updatedAt'];
        const csvRows = [headers.join(',')];

        for (const config of configs.configs) {
          const row = [
            config.key,
            JSON.stringify(config.value),
            config.description || '',
            config.category,
            config.type,
            config.updatedAt.toISOString()
          ];
          csvRows.push(row.map(cell => `"${cell}"`).join(','));
        }

        return csvRows.join('\n');
      }

      throw new Error('不支持的导出格式');
    } catch (error) {
      logger.error('导出配置失败', { options, error });
      throw error;
    }
  }

  /**
   * 导入配置
   */
  async importConfigs(configs: Array<any>, options: {
    overwrite?: boolean;
    userId: string;
  }): Promise<{
    success: Array<{ key: string }>;
    failure: Array<{ key: string; error: string }>;
  }> {
    const result = {
      success: [] as Array<{ key: string }>,
      failure: [] as Array<{ key: string; error: string }>
    };

    for (const config of configs) {
      try {
        const existingConfig = await this.getConfigDetail(config.key);

        if (existingConfig && !options.overwrite) {
          result.failure.push({
            key: config.key,
            error: '配置已存在且不允许覆盖'
          });
          continue;
        }

        if (existingConfig) {
          await this.updateConfig(config.key, config.value, {
            description: config.description,
            lastModifiedBy: options.userId
          });
        } else {
          await this.createConfig({
            key: config.key,
            value: config.value,
            category: config.category,
            description: config.description,
            dataType: config.type || 'string',
                        createdBy: options.userId
          });
        }

        result.success.push({ key: config.key });
      } catch (error) {
        result.failure.push({
          key: config.key,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    return result;
  }

  /**
   * 记录配置变更历史（私有方法）
   */
  private async recordConfigChange(params: {
    configKey: string;
    oldValue: any;
    newValue: any;
    reason: string;
    modifiedBy: string;
  }): Promise<void> {
    try {
      // 这里可以插入到配置变更历史表
      // 如果没有历史表，可以考虑记录到日志文件或专门的日志表
      logger.info('配置变更记录', params);
    } catch (error) {
      logger.warn('记录配置变更历史失败', { params, error });
    }
  }
}

// 导出单例
export const configService = ConfigService.getInstance();
