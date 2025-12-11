import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * 事件总线 - 实现观察者模式
 * 用于系统内各模块之间的解耦通信
 */

export interface EventData {
  [key: string]: any;
}

export interface EventHandler {
  (data: EventData): Promise<void> | void;
}

export interface EventHandlerMetadata {
  handler: EventHandler;
  priority: number;
  once?: boolean;
  module: string;
}

export class EventBus extends EventEmitter {
  private handlers: Map<string, EventHandlerMetadata[]> = new Map();
  private metrics = {
    totalEvents: 0,
    totalHandlers: 0,
    errors: 0,
    maxEventQueue: 1000
  };

  /**
   * 注册事件处理器
   */
  on(
    event: string,
    handler: EventHandler,
    options: {
      priority?: number;
      once?: boolean;
      module?: string;
    } = {}
  ): this {
    const metadata: EventHandlerMetadata = {
      handler,
      priority: options.priority || 0,
      once: options.once || false,
      module: options.module || 'unknown'
    };

    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }

    const handlers = this.handlers.get(event)!;
    handlers.push(metadata);

    // 按优先级排序（高优先级先执行）
    handlers.sort((a, b) => b.priority - a.priority);

    this.metrics.totalHandlers++;

    logger.debug('事件处理器注册成功', {
      event,
      module: metadata.module,
      priority: metadata.priority,
      handlersCount: handlers.length
    });

    return this;
  }

  /**
   * 注册一次性事件处理器
   */
  once(event: string, handler: EventHandler, options?: { priority?: number; module?: string }): this {
    return this.on(event, handler, { ...options, once: true });
  }

  /**
   * 移除事件处理器
   */
  off(event: string, handler?: EventHandler): this {
    if (!handler) {
      // 移除所有处理器
      this.handlers.delete(event);
      this.removeAllListeners(event);
    } else {
      const handlers = this.handlers.get(event);
      if (handlers) {
        const index = handlers.findIndex(h => h.handler === handler);
        if (index !== -1) {
          handlers.splice(index, 1);
          this.metrics.totalHandlers--;
        }
      }
    }

    return this;
  }

  /**
   * 发送事件
   */
  async emit(event: string, data: EventData = {}): Promise<boolean> {
    this.metrics.totalEvents++;

    try {
      logger.debug('发送事件', {
        event,
        dataKeys: Object.keys(data),
        handlersCount: this.handlers.get(event)?.length || 0
      });

      // 使用父类的emit方法触发事件
      const emitted = super.emit(event, data);

      // 如果有处理器，等待异步处理完成
      const handlers = this.handlers.get(event) || [];
      if (handlers.length > 0) {
        // 并行执行所有处理器
        const promises = handlers.map(async (metadata) => {
          try {
            await metadata.handler(data);

            // 如果是一次性处理器，移除它
            if (metadata.once) {
              this.off(event, metadata.handler);
            }
          } catch (error) {
            this.metrics.errors++;
            logger.error('事件处理器执行失败', {
              event,
              module: metadata.module,
              error: error instanceof Error ? error.message : '未知错误',
              stack: error instanceof Error ? error.stack : undefined
            });
            // 继续执行其他处理器，不中断整个事件流程
          }
        });

        await Promise.all(promises);
      }

      return emitted;
    } catch (error) {
      this.metrics.errors++;
      logger.error('发送事件失败', {
        event,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 发送错误事件
   */
  emitError(error: Error, context?: any): void {
    this.emit('system.error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 获取事件处理器列表
   */
  getHandlers(event: string): EventHandlerMetadata[] {
    return this.handlers.get(event) || [];
  }

  /**
   * 获取所有事件
   */
  getAllEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 获取指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      registeredEvents: this.handlers.size,
      handlersByEvent: Array.from(this.handlers.entries()).map(([event, handlers]) => ({
        event,
        count: handlers.length
      }))
    };
  }

  /**
   * 清理所有处理器
   */
  clear(): void {
    this.handlers.clear();
    this.removeAllListeners();
    this.metrics.totalHandlers = 0;
    logger.info('事件总线已清理');
  }

  /**
   * 创建事件命名空间
   */
  namespace(namespace: string): {
    emit: (event: string, data?: EventData) => Promise<boolean>;
    on: (event: string, handler: EventHandler, options?: any) => void;
    off: (event: string, handler?: EventHandler) => void;
  } {
    return {
      emit: (event: string, data: EventData = {}) => {
        return this.emit(`${namespace}:${event}`, data);
      },
      on: (event: string, handler: EventHandler, options?: any) => {
        return this.on(`${namespace}:${event}`, handler, {
          ...options,
          module: `${namespace}.${options.module || 'unknown'}`
        });
      },
      off: (event: string, handler?: EventHandler) => {
        return this.off(`${namespace}:${event}`, handler);
      }
    };
  }

  /**
   * 批量注册处理器
   */
  registerHandlers(handlers: Record<string, EventHandler>, options?: { module?: string }): void {
    for (const [event, handler] of Object.entries(handlers)) {
      this.on(event, handler, options);
    }
  }

  /**
   * 事件中间件
   */
  use(middleware: (event: string, data: EventData, next: () => void) => void): void {
    const originalEmit = this.emit.bind(this);

    this.emit = async (event: string, data: EventData = {}) => {
      let called = false;
      const next = () => {
        if (!called) {
          called = true;
          return originalEmit(event, data);
        }
      };

      try {
        await middleware(event, data, next);
        // 如果中间件没有调用next，手动调用
        if (!called) {
          await next();
        }
      } catch (error) {
        logger.error('事件中间件执行失败', {
          event,
          error: error instanceof Error ? error.message : '未知错误'
        });
        // 即使中间件失败，也要继续发送事件
        await next();
      }

      return true;
    };
  }
}

// 创建全局事件总线实例
export const eventBus = new EventBus();

// 设置最大监听器数量
eventBus.setMaxListeners(100);

// 注册错误处理
eventBus.on('system.error', async (data) => {
  logger.error('系统错误事件', data);
});

// 添加性能监控中间件
eventBus.use(async (event, data, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  // 如果事件处理时间过长，记录警告
  if (duration > 1000) {
    logger.warn('事件处理耗时过长', {
      event,
      duration,
      dataKeys: Object.keys(data)
    });
  }
});

// 添加日志中间件
eventBus.use(async (event, data, next) => {
  // 只记录重要事件
  const importantEvents = [
    'commission.calculated',
    'commission.paid',
    'order.completed',
    'user.level_upgraded',
    'system.error'
  ];

  if (importantEvents.includes(event)) {
    logger.info('重要事件', {
      event,
      dataKeys: Object.keys(data),
      timestamp: new Date().toISOString()
    });
  }

  await next();
});