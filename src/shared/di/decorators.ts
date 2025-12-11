/**
 * 依赖注入装饰器
 * 提供装饰器来简化依赖注入的使用
 */

import 'reflect-metadata';
import { container, SERVICE_TOKENS } from './container';

// 服务装饰器 - 标记一个类为可注入的服务
export function Service(token?: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const serviceToken = token || constructor.name;

    // 注册到容器
    container.registerSingleton(serviceToken, () => {
      const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];
      const dependencies = paramTypes.map((paramType: any, index: number) => {
        // 尝试获取注入标记
        const injectTokens = Reflect.getMetadata('inject-tokens', constructor) || [];
        const injectToken = injectTokens[index];

        if (injectToken) {
          return container.resolve(injectToken);
        }

        // 使用参数类型作为服务标识
        const dependencyToken = paramType.name || SERVICE_TOKENS[paramType.name] || paramType;
        return container.resolve(dependencyToken);
      });

      return new constructor(...dependencies);
    });

    return constructor;
  };
}

// 注入装饰器 - 标记构造函数参数需要注入
export function Inject(token?: string) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata('inject-tokens', target) || [];
    existingTokens[parameterIndex] = token || `param_${parameterIndex}`;
    Reflect.defineMetadata('inject-tokens', existingTokens, target);
  };
}

// 自动装配装饰器 - 自动注入属性
export function Autowire(token?: string) {
  return function (target: any, propertyKey: string) {
    const serviceToken = token || propertyKey;

    Object.defineProperty(target, propertyKey, {
      get() {
        return container.resolve(serviceToken);
      },
      configurable: true
    });
  };
}

// 可选注入装饰器 - 可选的依赖注入
export function Optional(token?: string) {
  return function (target: any, propertyKey: string) {
    const serviceToken = token || propertyKey;

    Object.defineProperty(target, propertyKey, {
      get() {
        return container.tryResolve(serviceToken);
      },
      configurable: true
    });
  };
}

// 作用域装饰器 - 标记服务为作用域内单例
export function Scoped(token?: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const serviceToken = token || constructor.name;

    container.registerScoped(serviceToken, () => {
      const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];
      const dependencies = paramTypes.map((paramType: any, index: number) => {
        const injectTokens = Reflect.getMetadata('inject-tokens', constructor) || [];
        const injectToken = injectTokens[index];

        if (injectToken) {
          return container.resolve(injectToken);
        }

        const dependencyToken = paramType.name || SERVICE_TOKENS[paramType.name] || paramType;
        return container.resolve(dependencyToken);
      });

      return new constructor(...dependencies);
    });

    return constructor;
  };
}

// 瞬时装饰器 - 标记服务为每次创建新实例
export function Transient(token?: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const serviceToken = token || constructor.name;

    container.register(serviceToken, () => {
      const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];
      const dependencies = paramTypes.map((paramType: any, index: number) => {
        const injectTokens = Reflect.getMetadata('inject-tokens', constructor) || [];
        const injectToken = injectTokens[index];

        if (injectToken) {
          return container.resolve(injectToken);
        }

        const dependencyToken = paramType.name || SERVICE_TOKENS[paramType.name] || paramType;
        return container.resolve(dependencyToken);
      });

      return new constructor(...dependencies);
    }, container.ServiceLifetime.Transient);

    return constructor;
  };
}