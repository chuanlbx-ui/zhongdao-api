/**
 * 系统配置管理服务
 * 用于管理所有系统参数（会员等级、折扣、佣金等）
 */

import { prisma } from '../../shared/database/client';
import { logger } from '../../shared/utils/logger';

// 配置类型定义
interface ConfigValue {
  [key: string]: any;
}

/**
 * 系统配置服务
 * 所有可变的业务参数都通过这个服务读取
 */
export class ConfigService {
  private static instance: ConfigService;

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
  async getConfig<T = ConfigValue>(key: string): Promise<T | null> {
    try {
      const config = await prisma.systemConfigs.findUnique({
        where: { key }
      });

      if (!config) {
        return null;
      }

      // 解析值
      let parsedValue: any = config.value;
      if (config.type === 'JSON' || config.type === 'ARRAY') {
        try {
          parsedValue = JSON.parse(config.value);
        } catch (e) {
          logger.warn('Failed to parse config value', { key, value: config.value });
        }
      } else if (config.type === 'NUMBER') {
        parsedValue = parseFloat(config.value);
      } else if (config.type === 'BOOLEAN') {
        parsedValue = config.value.toLowerCase() === 'true';
      }

      return parsedValue;
    } catch (error) {
      logger.error('获取配置失败', { key, error });
      return null;
    }
  }

  /**
   * 修改配置值
   */
  async updateConfig(key: string, value: any): Promise<void> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      await prisma.systemConfigs.upsert({
        where: { key },
        update: {
          value: serializedValue,
          updatedAt: new Date()
        },
        create: {
          key,
          value: serializedValue,
          type: typeof value === 'object' ? 'JSON' : 'STRING',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('配置已更新', { key });
    } catch (error) {
      logger.error('更新配置失败', { key, error });
      throw error;
    }
  }
}

// 导出单例
export const configService = ConfigService.getInstance();