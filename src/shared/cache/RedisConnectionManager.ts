/**
 * Redis连接管理器
 * 负责Redis连接的创建、管理和重连
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  connectTimeout?: number;
  commandTimeout?: number;
  retryAttempts?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: 4 | 6;
}

export class RedisConnectionManager {
  private static instance: RedisConnectionManager;
  private client: Redis | null = null;
  private config: RedisConfig;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  private constructor() {
    // 从环境变量读取Redis配置
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4
    };
  }

  static getInstance(): RedisConnectionManager {
    if (!RedisConnectionManager.instance) {
      RedisConnectionManager.instance = new RedisConnectionManager();
    }
    return RedisConnectionManager.instance;
  }

  /**
   * 获取Redis客户端
   */
  async getClient(): Promise<Redis> {
    if (!this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error('无法连接到Redis服务器');
    }

    return this.client;
  }

  /**
   * 连接到Redis服务器
   */
  private async connect(): Promise<void> {
    if (this.isConnecting) {
      // 等待连接完成
      await new Promise(resolve => {
        const checkConnection = () => {
          if (!this.isConnecting) {
            resolve(null);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
      return;
    }

    this.isConnecting = true;

    try {
      // 检查是否启用Redis
      if (process.env.NODE_ENV === 'production' && process.env.REDIS_ENABLED === 'false') {
        logger.info('Redis已禁用，使用内存缓存');
        this.isConnecting = false;
        return;
      }

      // 创建Redis客户端
      this.client = new Redis({
        ...this.config,
        // 连接事件处理
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        lazyConnect: this.config.lazyConnect,
        keepAlive: this.config.keepAlive,
        family: this.config.family,

        // 重连策略
        retryStrategy: (times) => {
          if (times >= this.maxReconnectAttempts) {
            logger.error('Redis重连次数超过限制');
            return null; // 停止重连
          }

          const delay = Math.min(times * 2000, 30000);
          logger.warn(`Redis重连尝试 ${times}/${this.maxReconnectAttempts}，延迟${delay}ms`);
          return delay;
        }
      });

      // 事件监听
      this.client.on('connect', () => {
        logger.info('Redis连接成功');
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('Redis客户端已准备就绪');
        this.isConnecting = false;
      });

      this.client.on('error', (error) => {
        logger.error('Redis连接错误:', error);
      });

      this.client.on('close', () => {
        logger.warn('Redis连接已关闭');
        this.isConnecting = false;
      });

      this.client.on('reconnecting', (attempt) => {
        logger.info(`Redis重连中... 第${attempt}次尝试`);
        this.reconnectAttempts = attempt;
      });

      // 测试连接
      await this.client.connect();
      await this.client.ping();

      logger.info('Redis初始化完成');
    } catch (error) {
      logger.error('Redis连接失败:', error);
      this.client = null;

      if (process.env.NODE_ENV === 'production') {
        // 生产环境降级到内存缓存
        logger.warn('生产环境Redis不可用，将使用内存缓存替代方案');
      }
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 断开Redis连接
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis连接已断开');
    }
  }

  /**
   * 检查Redis健康状态
   */
  async healthCheck(): Promise<{ connected: boolean; latency?: number; error?: string }> {
    try {
      if (!this.client) {
        return { connected: false, error: '客户端未初始化' };
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return { connected: true, latency };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取Redis信息
   */
  async getInfo(): Promise<any> {
    try {
      if (!this.client) {
        return null;
      }

      const info = await this.client.info();
      const serverInfo = await this.client.info('server');
      const memoryInfo = await this.client.info('memory');
      const statsInfo = await this.client.info('stats');
      const dbInfo = await this.client.info('keyspace');

      return {
        raw: info,
        server: this.parseRedisInfo(serverInfo),
        memory: this.parseRedisInfo(memoryInfo),
        stats: this.parseRedisInfo(statsInfo),
        database: this.parseRedisInfo(dbInfo)
      };
    } catch (error) {
      logger.error('获取Redis信息失败:', error);
      return null;
    }
  }

  /**
   * 解析Redis INFO命令的输出
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const lines = info.split('\r\n');
    const result: Record<string, any> = {};

    for (const line of lines) {
      if (line.startsWith('#') || !line.includes(':')) {
        continue;
      }

      const [key, value] = line.split(':');
      if (key && value) {
        // 尝试转换为数字
        const numValue = Number(value);
        result[key] = isNaN(numValue) ? value : numValue;
      }
    }

    return result;
  }

  /**
   * 获取配置
   */
  getConfig(): RedisConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RedisConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 如果已经有连接，需要重新连接
    if (this.client) {
      this.disconnect();
      this.connect();
    }
  }

  /**
   * 检查是否使用内存缓存
   */
  isUsingMemoryCache(): boolean {
    return !this.client || process.env.REDIS_ENABLED === 'false';
  }
}

// 导出单例
export const redisConnectionManager = RedisConnectionManager.getInstance();