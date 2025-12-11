/**
 * 简单的依赖注入容器
 * 管理服务的注册、解析和生命周期
 */

export enum ServiceLifetime {
  Transient,   // 每次请求都创建新实例
  Singleton,   // 单例模式
  Scoped       // 作用域内单例
}

export interface ServiceDescriptor {
  factory: () => any;
  lifetime: ServiceLifetime;
  instance?: any;
}

export class DIContainer {
  private services = new Map<string, ServiceDescriptor>();
  private scopedInstances = new Map<string, any>();

  /**
   * 注册服务
   */
  register<T>(
    token: string,
    factory: () => T,
    lifetime: ServiceLifetime = ServiceLifetime.Transient
  ): void {
    this.services.set(token, {
      factory,
      lifetime
    });
  }

  /**
   * 注册单例服务
   */
  registerSingleton<T>(token: string, factory: () => T): void {
    this.register(token, factory, ServiceLifetime.Singleton);
  }

  /**
   * 注册作用域服务
   */
  registerScoped<T>(token: string, factory: () => T): void {
    this.register(token, factory, ServiceLifetime.Scoped);
  }

  /**
   * 注册实例
   */
  registerInstance<T>(token: string, instance: T): void {
    this.services.set(token, {
      factory: () => instance,
      lifetime: ServiceLifetime.Singleton,
      instance
    });
  }

  /**
   * 解析服务
   */
  resolve<T>(token: string): T {
    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`Service ${token} is not registered`);
    }

    switch (descriptor.lifetime) {
      case ServiceLifetime.Singleton:
        if (!descriptor.instance) {
          descriptor.instance = descriptor.factory();
        }
        return descriptor.instance;

      case ServiceLifetime.Scoped:
        if (!this.scopedInstances.has(token)) {
          this.scopedInstances.set(token, descriptor.factory());
        }
        return this.scopedInstances.get(token);

      case ServiceLifetime.Transient:
      default:
        return descriptor.factory();
    }
  }

  /**
   * 尝试解析服务（不抛出异常）
   */
  tryResolve<T>(token: string): T | null {
    try {
      return this.resolve<T>(token);
    } catch {
      return null;
    }
  }

  /**
   * 检查服务是否已注册
   */
  isRegistered(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * 清除作用域实例
   */
  clearScope(): void {
    this.scopedInstances.clear();
  }

  /**
   * 创建子容器
   */
  createChild(): DIContainer {
    const child = new DIContainer();

    // 复制父容器的服务注册
    this.services.forEach((descriptor, token) => {
      child.services.set(token, { ...descriptor });
    });

    return child;
  }

  /**
   * 装饰器：自动注册类
   */
  autowire(token?: string) {
    return (target: any) => {
      const serviceToken = token || target.name;
      this.registerSingleton(serviceToken, () => {
        // 获取构造函数参数的类型
        const paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];
        const dependencies = paramTypes.map((paramType: any) => {
          const dependencyToken = paramType.name || paramType;
          return this.resolve(dependencyToken);
        });

        return new target(...dependencies);
      });
      return target;
    };
  }

  /**
   * 装饰器：注入依赖
   */
  inject(token?: string) {
    return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
      const existingTokens = Reflect.getMetadata('inject-tokens', target) || [];
      const serviceToken = token || `param_${parameterIndex}`;
      existingTokens[parameterIndex] = serviceToken;
      Reflect.defineMetadata('inject-tokens', existingTokens, target);
    };
  }
}

// 创建全局容器实例
export const container = new DIContainer();

// 服务标识符常量
export const SERVICE_TOKENS = {
  // 数据库
  DATABASE: 'DATABASE',

  // 服务层
  USER_SERVICE: 'USER_SERVICE',
  COMMISSION_SERVICE: 'COMMISSION_SERVICE',
  SHOP_SERVICE: 'SHOP_SERVICE',
  PRODUCT_SERVICE: 'PRODUCT_SERVICE',
  ORDER_SERVICE: 'ORDER_SERVICE',
  PAYMENT_SERVICE: 'PAYMENT_SERVICE',
  INVENTORY_SERVICE: 'INVENTORY_SERVICE',
  TEAM_SERVICE: 'TEAM_SERVICE',
  NOTIFICATION_SERVICE: 'NOTIFICATION_SERVICE',
  POINTS_SERVICE: 'POINTS_SERVICE',

  // 仓储层
  USER_REPOSITORY: 'USER_REPOSITORY',
  COMMISSION_REPOSITORY: 'COMMISSION_REPOSITORY',
  SHOP_REPOSITORY: 'SHOP_REPOSITORY',
  PRODUCT_REPOSITORY: 'PRODUCT_REPOSITORY',
  ORDER_REPOSITORY: 'ORDER_REPOSITORY',

  // 外部服务
  WECHAT_SERVICE: 'WECHAT_SERVICE',
  ALIPAY_SERVICE: 'ALIPAY_SERVICE',
  SMS_SERVICE: 'SMS_SERVICE',
  EMAIL_SERVICE: 'EMAIL_SERVICE',

  // 工具服务
  LOGGER_SERVICE: 'LOGGER_SERVICE',
  CACHE_SERVICE: 'CACHE_SERVICE',
  EVENT_BUS: 'EVENT_BUS',
  AUDIT_LOGGER: 'AUDIT_LOGGER'
} as const;