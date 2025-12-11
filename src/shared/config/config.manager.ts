/**
 * 统一配置管理器
 * 提供配置的加载、验证、更新和监听功能
 */

import { EventEmitter } from 'events';
import { z, ZodSchema } from 'zod';
import { logger } from '../utils/logger';
import { AppError, ErrorFactory } from '../errors';

// 配置值类型
export type ConfigValue = string | number | boolean | object | null;

// 配置更新事件
export interface ConfigUpdateEvent {
  key: string;
  oldValue: ConfigValue;
  newValue: ConfigValue;
  updatedBy: string;
  updatedAt: Date;
}

// 配置验证规则
export interface ConfigValidationRule {
  required?: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  schema?: ZodSchema;
  transform?: (value: any) => any;
  validate?: (value: any) => boolean | string;
}

// 配置元数据
export interface ConfigMetadata {
  key: string;
  description: string;
  defaultValue: ConfigValue;
  validation?: ConfigValidationRule;
  category: string;
  sensitive: boolean;
  readonly: boolean;
  requiresRestart: boolean;
  lastUpdated?: Date;
  updatedBy?: string;
}

export class ConfigManager extends EventEmitter {
  private configs = new Map<string, ConfigValue>();
  private metadata = new Map<string, ConfigMetadata>();
  private watchers = new Map<string, Set<(value: ConfigValue) => void>>();

  constructor() {
    super();
    this.setupDefaultConfigs();
  }

  /**
   * 注册配置项
   */
  register(metadata: ConfigMetadata): void {
    this.metadata.set(metadata.key, metadata);

    // 设置默认值
    if (!this.configs.has(metadata.key)) {
      this.configs.set(metadata.key, metadata.defaultValue);
    }

    logger.debug('注册配置项', {
      key: metadata.key,
      category: metadata.category,
      defaultValue: metadata.defaultValue
    });
  }

  /**
   * 批量注册配置项
   */
  registerBatch(metadataList: ConfigMetadata[]): void {
    metadataList.forEach(metadata => this.register(metadata));
  }

  /**
   * 获取配置值
   */
  get<T = ConfigValue>(key: string, defaultValue?: T): T {
    const value = this.configs.get(key);
    if (value === undefined || value === null) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw ErrorFactory.notFound(`配置项 ${key}`);
    }

    const metadata = this.metadata.get(key);
    if (metadata?.validation) {
      return this.validateAndTransform(key, value, metadata.validation) as T;
    }

    return value as T;
  }

  /**
   * 获取配置值（带类型转换）
   */
  getString(key: string, defaultValue?: string): string {
    const value = this.get<string>(key, defaultValue);
    return String(value);
  }

  getNumber(key: string, defaultValue?: number): number {
    const value = this.get<number>(key, defaultValue);
    const num = Number(value);
    if (isNaN(num)) {
      throw ErrorFactory.validationError(`配置项 ${key} 不是有效的数字`);
    }
    return num;
  }

  getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = this.get<boolean>(key, defaultValue);
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return Boolean(value);
  }

  getObject<T = any>(key: string, defaultValue?: T): T {
    const value = this.get<T>(key, defaultValue);
    if (typeof value === 'object' && value !== null) {
      return value;
    }
    try {
      return JSON.parse(String(value));
    } catch {
      throw ErrorFactory.validationError(`配置项 ${key} 不是有效的JSON对象`);
    }
  }

  /**
   * 设置配置值
   */
  async set(
    key: string,
    value: ConfigValue,
    options: {
      updatedBy?: string;
      skipValidation?: boolean;
      persist?: boolean;
    } = {}
  ): Promise<void> {
    const { updatedBy = 'system', skipValidation = false, persist = true } = options;

    // 检查是否为只读配置
    const metadata = this.metadata.get(key);
    if (metadata?.readonly) {
      throw ErrorFactory.forbidden(`配置项 ${key} 为只读`);
    }

    const oldValue = this.configs.get(key);

    // 验证值
    if (!skipValidation && metadata?.validation) {
      this.validateAndTransform(key, value, metadata.validation);
    }

    // 更新值
    this.configs.set(key, value);

    // 更新元数据
    if (metadata) {
      metadata.lastUpdated = new Date();
      metadata.updatedBy = updatedBy;
    }

    // 持久化（如果需要）
    if (persist) {
      await this.persistConfig(key, value);
    }

    // 触发事件
    this.emit('config:updated', {
      key,
      oldValue,
      newValue: value,
      updatedBy,
      updatedAt: new Date()
    } as ConfigUpdateEvent);

    // 通知监听器
    const watchers = this.watchers.get(key);
    if (watchers) {
      watchers.forEach(callback => callback(value));
    }

    logger.info('更新配置项', {
      key,
      oldValue,
      newValue: value,
      updatedBy
    });
  }

  /**
   * 批量设置配置
   */
  async setBatch(
    configs: Record<string, ConfigValue>,
    options: {
      updatedBy?: string;
      skipValidation?: boolean;
      persist?: boolean;
    } = {}
  ): Promise<void> {
    const { updatedBy = 'system', skipValidation = false, persist = true } = options;

    for (const [key, value] of Object.entries(configs)) {
      await this.set(key, value, {
        updatedBy,
        skipValidation,
        persist: false // 批量设置时最后统一持久化
      });
    }

    if (persist) {
      await this.persistAllConfigs();
    }
  }

  /**
   * 监听配置变化
   */
  watch(key: string, callback: (value: ConfigValue) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }

    this.watchers.get(key)!.add(callback);

    // 返回取消监听的函数
    return () => {
      const watchers = this.watchers.get(key);
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) {
          this.watchers.delete(key);
        }
      }
    };
  }

  /**
   * 获取配置元数据
   */
  getMetadata(key: string): ConfigMetadata | undefined {
    return this.metadata.get(key);
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(category?: string): Record<string, ConfigValue> {
    const configs: Record<string, ConfigValue> = {};

    for (const [key, value] of this.configs.entries()) {
      const metadata = this.metadata.get(key);
      if (!category || metadata?.category === category) {
        // 敏感信息脱敏
        if (metadata?.sensitive) {
          configs[key] = '***';
        } else {
          configs[key] = value;
        }
      }
    }

    return configs;
  }

  /**
   * 重置配置到默认值
   */
  async reset(key: string, options: { updatedBy?: string } = {}): Promise<void> {
    const metadata = this.metadata.get(key);
    if (!metadata) {
      throw ErrorFactory.notFound(`配置项 ${key} 未注册`);
    }

    await this.set(key, metadata.defaultValue, {
      updatedBy: options.updatedBy
    });
  }

  /**
   * 验证所有配置
   */
  validateAll(): Array<{ key: string; error: string }> {
    const errors: Array<{ key: string; error: string }> = [];

    for (const [key, value] of this.configs.entries()) {
      const metadata = this.metadata.get(key);
      if (metadata?.validation) {
        try {
          this.validateAndTransform(key, value, metadata.validation);
        } catch (error) {
          errors.push({
            key,
            error: error instanceof Error ? error.message : '验证失败'
          });
        }
      }
    }

    return errors;
  }

  /**
   * 导出配置
   */
  export(category?: string): Record<string, any> {
    const configs: Record<string, any> = {};

    for (const [key, metadata] of this.metadata.entries()) {
      if (!category || metadata.category === category) {
        configs[key] = {
          value: this.configs.get(key),
          description: metadata.description,
          category: metadata.category,
          sensitive: metadata.sensitive,
          readonly: metadata.readonly,
          lastUpdated: metadata.lastUpdated,
          updatedBy: metadata.updatedBy
        };
      }
    }

    return configs;
  }

  /**
   * 导入配置
   */
  async import(
    configs: Record<string, any>,
    options: {
      updatedBy?: string;
      skipValidation?: boolean;
      overwrite?: boolean;
    } = {}
  ): Promise<void> {
    const { updatedBy = 'system', skipValidation = false, overwrite = false } = options;

    for (const [key, data] of Object.entries(configs)) {
      const value = typeof data === 'object' && data.value !== undefined ? data.value : data;

      if (overwrite || !this.configs.has(key)) {
        await this.set(key, value, {
          updatedBy,
          skipValidation,
          persist: false
        });
      }
    }

    await this.persistAllConfigs();
  }

  /**
   * 验证和转换配置值
   */
  private validateAndTransform(
    key: string,
    value: any,
    rule: ConfigValidationRule
  ): ConfigValue {
    // 检查必填
    if (rule.required && (value === undefined || value === null || value === '')) {
      throw ErrorFactory.validationError(`配置项 ${key} 为必填项`);
    }

    // 如果值为空且非必填，跳过验证
    if (!rule.required && (value === undefined || value === null || value === '')) {
      return value;
    }

    // 使用Zod schema验证
    if (rule.schema) {
      const result = rule.schema.safeParse(value);
      if (!result.success) {
        throw ErrorFactory.validationError(
          `配置项 ${key} 验证失败: ${result.error.message}`
        );
      }
      return result.data;
    }

    // 类型验证
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw ErrorFactory.validationError(`配置项 ${key} 必须为字符串`);
        }
        if (rule.min && value.length < rule.min) {
          throw ErrorFactory.validationError(
            `配置项 ${key} 长度不能小于 ${rule.min}`
          );
        }
        if (rule.max && value.length > rule.max) {
          throw ErrorFactory.validationError(
            `配置项 ${key} 长度不能大于 ${rule.max}`
          );
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          throw ErrorFactory.validationError(
            `配置项 ${key} 格式不正确`
          );
        }
        break;

      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw ErrorFactory.validationError(`配置项 ${key} 必须为数字`);
        }
        if (rule.min !== undefined && num < rule.min) {
          throw ErrorFactory.validationError(
            `配置项 ${key} 不能小于 ${rule.min}`
          );
        }
        if (rule.max !== undefined && num > rule.max) {
          throw ErrorFactory.validationError(
            `配置项 ${key} 不能大于 ${rule.max}`
          );
        }
        return num;

      case 'boolean':
        if (typeof value !== 'boolean') {
          const bool = ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
          if (!bool && !['false', '0', 'no', 'off'].includes(String(value).toLowerCase())) {
            throw ErrorFactory.validationError(`配置项 ${key} 必须为布尔值`);
          }
          return bool;
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw ErrorFactory.validationError(`配置项 ${key} 必须为对象`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          throw ErrorFactory.validationError(`配置项 ${key} 必须为数组`);
        }
        break;
    }

    // 枚举验证
    if (rule.enum && !rule.enum.includes(value)) {
      throw ErrorFactory.validationError(
        `配置项 ${key} 必须为以下值之一: ${rule.enum.join(', ')}`
      );
    }

    // 自定义验证
    if (rule.validate) {
      const result = rule.validate(value);
      if (result === false) {
        throw ErrorFactory.validationError(`配置项 ${key} 验证失败`);
      }
      if (typeof result === 'string') {
        throw ErrorFactory.validationError(result);
      }
    }

    // 转换
    if (rule.transform) {
      return rule.transform(value);
    }

    return value;
  }

  /**
   * 持久化单个配置
   */
  private async persistConfig(key: string, value: ConfigValue): Promise<void> {
    // 这里可以实现持久化到数据库或文件
    // 例如调用 SystemConfigService
    logger.debug('持久化配置', { key });
  }

  /**
   * 持久化所有配置
   */
  private async persistAllConfigs(): Promise<void> {
    // 批量持久化
    logger.debug('批量持久化配置');
  }

  /**
   * 设置默认配置
   */
  private setupDefaultConfigs(): void {
    // 这里注册系统默认配置
    // 实际项目中应该从配置文件或数据库加载
  }
}

// 创建全局配置管理器实例
export const configManager = new ConfigManager();