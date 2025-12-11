import { logger } from '../utils/logger';

/**
 * 组件接口
 */
export interface Component {
  operation(): string;
}

/**
 * 具体组件
 */
export class ConcreteComponent implements Component {
  operation(): string {
    return 'ConcreteComponent';
  }
}

/**
 * 装饰器基类
 */
export abstract class BaseDecorator implements Component {
  protected component: Component;

  constructor(component: Component) {
    this.component = component;
  }

  operation(): string {
    return this.component.operation();
  }
}

/**
 * 具体装饰器A
 */
export class ConcreteDecoratorA extends BaseDecorator {
  operation(): string {
    return `ConcreteDecoratorA(${super.operation()})`;
  }
}

/**
 * 具体装饰器B
 */
export class ConcreteDecoratorB extends BaseDecorator {
  operation(): string {
    return `ConcreteDecoratorB(${super.operation()})`;
  }
}

/**
 * 服务装饰器接口
 */
export interface ServiceDecorator {
  wrap(service: any): any;
}

/**
 * 缓存装饰器
 */
export class CacheDecorator implements ServiceDecorator {
  private cache: Map<string, any> = new Map();
  private ttl: number;

  constructor(ttl: number = 300000) { // 默认5分钟
    this.ttl = ttl;
  }

  wrap(service: any): any {
    const self = this;

    return new Proxy(service, {
      get(target: any, propKey: string | symbol) {
        const originalMethod = target[propKey];

        if (typeof originalMethod === 'function' && propKey !== 'constructor') {
          return async function (...args: any[]) {
            const cacheKey = `${target.constructor.name}:${String(propKey)}:${JSON.stringify(args)}`;

            // 检查缓存
            const cached = self.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < self.ttl) {
              logger.debug('缓存命中', { cacheKey });
              return cached.value;
            }

            // 执行原方法
            const result = await originalMethod.apply(target, args);

            // 缓存结果
            self.cache.set(cacheKey, {
              value: result,
              timestamp: Date.now()
            });

            logger.debug('缓存设置', { cacheKey });
            return result;
          };
        }

        return originalMethod;
      }
    });
  }

  clear(): void {
    this.cache.clear();
    logger.info('缓存已清理');
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * 日志装饰器
 */
export class LoggingDecorator implements ServiceDecorator {
  private logger: any;

  constructor(logger?: any) {
    this.logger = logger || console;
  }

  wrap(service: any): any {
    const self = this;

    return new Proxy(service, {
      get(target: any, propKey: string | symbol) {
        const originalMethod = target[propKey];

        if (typeof originalMethod === 'function' && propKey !== 'constructor') {
          return async function (...args: any[]) {
            const methodName = `${target.constructor.name}.${String(propKey)}`;
            const start = Date.now();

            self.logger.info(`调用方法: ${methodName}`, {
              args: args.map(arg => typeof arg === 'object' ? '[Object]' : arg)
            });

            try {
              const result = await originalMethod.apply(target, args);
              const duration = Date.now() - start;

              self.logger.info(`方法执行成功: ${methodName}`, {
                duration: `${duration}ms`
              });

              return result;
            } catch (error) {
              const duration = Date.now() - start;

              self.logger.error(`方法执行失败: ${methodName}`, {
                error: error instanceof Error ? error.message : '未知错误',
                duration: `${duration}ms`,
                stack: error instanceof Error ? error.stack : undefined
              });

              throw error;
            }
          };
        }

        return originalMethod;
      }
    });
  }
}

/**
 * 重试装饰器
 */
export class RetryDecorator implements ServiceDecorator {
  private maxRetries: number;
  private delay: number;

  constructor(maxRetries: number = 3, delay: number = 1000) {
    this.maxRetries = maxRetries;
    this.delay = delay;
  }

  wrap(service: any): any {
    const self = this;

    return new Proxy(service, {
      get(target: any, propKey: string | symbol) {
        const originalMethod = target[propKey];

        if (typeof originalMethod === 'function' && propKey !== 'constructor') {
          return async function (...args: any[]) {
            const methodName = `${target.constructor.name}.${String(propKey)}`;
            let lastError: Error | undefined;

            for (let attempt = 1; attempt <= self.maxRetries; attempt++) {
              try {
                return await originalMethod.apply(target, args);
              } catch (error) {
                lastError = error instanceof Error ? error : new Error('未知错误');

                if (attempt === self.maxRetries) {
                  logger.error(`方法重试失败: ${methodName}`, {
                    attempts: attempt,
                    error: lastError.message
                  });
                  throw lastError;
                }

                logger.warn(`方法执行失败，准备重试: ${methodName}`, {
                  attempt,
                  error: lastError.message
                });

                await self.sleep(self.delay * attempt); // 指数退避
              }
            }

            throw lastError;
          };
        }

        return originalMethod;
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 验证装饰器
 */
export class ValidationDecorator implements ServiceDecorator {
  private schemas: Map<string, any>;

  constructor() {
    this.schemas = new Map();
  }

  addSchema(methodName: string, schema: any): void {
    this.schemas.set(methodName, schema);
  }

  wrap(service: any): any {
    const self = this;

    return new Proxy(service, {
      get(target: any, propKey: string | symbol) {
        const originalMethod = target[propKey];

        if (typeof originalMethod === 'function' && propKey !== 'constructor') {
          return function (...args: any[]) {
            const methodName = String(propKey);
            const schema = self.schemas.get(methodName);

            if (schema) {
              // 执行验证
              const validationResult = self.validate(args, schema);
              if (!validationResult.valid) {
                throw new Error(`参数验证失败: ${validationResult.errors.join(', ')}`);
              }
            }

            return originalMethod.apply(target, args);
          };
        }

        return originalMethod;
      }
    });
  }

  private validate(args: any[], schema: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 简化的验证逻辑
    if (schema.required) {
      for (const field of schema.required) {
        if (args[field] === undefined || args[field] === null) {
          errors.push(`必填字段缺失: ${field}`);
        }
      }
    }

    if (schema.types) {
      for (const [field, type] of Object.entries(schema.types)) {
        const value = args[field];
        if (value !== undefined && typeof value !== type) {
          errors.push(`字段类型错误: ${field} 应为 ${type}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * 性能监控装饰器
 */
export class PerformanceMonitorDecorator implements ServiceDecorator {
  private metrics: Map<string, { count: number; totalTime: number; minTime: number; maxTime: number }> = new Map();

  wrap(service: any): any {
    const self = this;

    return new Proxy(service, {
      get(target: any, propKey: string | symbol) {
        const originalMethod = target[propKey];

        if (typeof originalMethod === 'function' && propKey !== 'constructor') {
          return async function (...args: any[]) {
            const methodName = `${target.constructor.name}.${String(propKey)}`;
            const start = Date.now();

            try {
              const result = await originalMethod.apply(target, args);
              const duration = Date.now() - start;

              self.recordMetric(methodName, duration);

              return result;
            } catch (error) {
              const duration = Date.now() - start;
              self.recordMetric(methodName, duration);
              throw error;
            }
          };
        }

        return originalMethod;
      }
    });
  }

  private recordMetric(methodName: string, duration: number): void {
    const existing = this.metrics.get(methodName) || {
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0
    };

    existing.count++;
    existing.totalTime += duration;
    existing.minTime = Math.min(existing.minTime, duration);
    existing.maxTime = Math.max(existing.maxTime, duration);

    this.metrics.set(methodName, existing);

    // 记录慢查询
    if (duration > 1000) {
      logger.warn(`检测到慢方法: ${methodName}`, {
        duration: `${duration}ms`,
        avgDuration: `${(existing.totalTime / existing.count).toFixed(2)}ms`
      });
    }
  }

  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [method, metric] of this.metrics.entries()) {
      result[method] = {
        count: metric.count,
        totalTime: metric.totalTime,
        averageTime: (metric.totalTime / metric.count).toFixed(2),
        minTime: metric.minTime,
        maxTime: metric.maxTime
      };
    }

    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

/**
 * 装饰器链 - 允许组合多个装饰器
 */
export class DecoratorChain {
  private decorators: ServiceDecorator[] = [];

  addDecorator(decorator: ServiceDecorator): DecoratorChain {
    this.decorators.push(decorator);
    return this;
  }

  wrap(service: any): any {
    return this.decorators.reduce((acc, decorator) => decorator.wrap(acc), service);
  }
}

/**
 * 服务增强器 - 提供便捷的装饰方法
 */
export class ServiceEnhancer {
  private service: any;

  constructor(service: any) {
    this.service = service;
  }

  withCache(ttl?: number): ServiceEnhancer {
    this.service = new CacheDecorator(ttl).wrap(this.service);
    return this;
  }

  withLogging(logger?: any): ServiceEnhancer {
    this.service = new LoggingDecorator(logger).wrap(this.service);
    return this;
  }

  withRetry(maxRetries?: number, delay?: number): ServiceEnhancer {
    this.service = new RetryDecorator(maxRetries, delay).wrap(this.service);
    return this;
  }

  withValidation(schemas?: Record<string, any>): ServiceEnhancer {
    const decorator = new ValidationDecorator();
    if (schemas) {
      for (const [method, schema] of Object.entries(schemas)) {
        decorator.addSchema(method, schema);
      }
    }
    this.service = decorator.wrap(this.service);
    return this;
  }

  withPerformanceMonitoring(): ServiceEnhancer {
    this.service = new PerformanceMonitorDecorator().wrap(this.service);
    return this;
  }

  build(): any {
    return this.service;
  }
}

/**
 * 创建增强服务
 */
export function enhanceService(service: any): ServiceEnhancer {
  return new ServiceEnhancer(service);
}

/**
 * 使用示例
 */
export function decoratorPatternExample(): void {
  // 1. 基础装饰器使用
  const component = new ConcreteComponent();
  let decorator = new ConcreteDecoratorA(component);
  decorator = new ConcreteDecoratorB(decorator);
  console.log(decorator.operation()); // Output: ConcreteDecoratorB(ConcreteDecoratorA(ConcreteComponent))

  // 2. 服务装饰器使用
  class UserService {
    async getUser(id: string): Promise<any> {
      // 模拟数据库查询
      await new Promise(resolve => setTimeout(resolve, 100));
      return { id, name: `User ${id}` };
    }

    async createUser(data: any): Promise<any> {
      // 模拟创建用户
      await new Promise(resolve => setTimeout(resolve, 50));
      return { id: `user_${Date.now()}`, ...data };
    }
  }

  // 使用装饰器链
  const decoratorChain = new DecoratorChain()
    .addDecorator(new CacheDecorator())
    .addDecorator(new LoggingDecorator())
    .addDecorator(new RetryDecorator(3));

  const enhancedUserService = decoratorChain.wrap(new UserService());

  // 3. 使用服务增强器
  const orderService = new OrderService(); // 假设存在
  const enhancedOrderService = enhanceService(orderService)
    .withCache(60000)
    .withLogging()
    .withRetry(2)
    .withPerformanceMonitoring()
    .build();

  logger.info('装饰器模式示例完成');
}

// 示例订单服务
class OrderService {
  async createOrder(data: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { id: `order_${Date.now()}`, ...data };
  }

  async getOrder(id: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { id, status: 'ACTIVE' };
  }
}