import { logger } from '../utils/logger';

/**
 * 抽象工厂接口
 */
export interface AbstractFactory<T> {
  create(type: string, ...args: any[]): T;
  register(type: string, creator: Creator<T>): void;
  unregister(type: string): void;
  getRegisteredTypes(): string[];
}

/**
 * 创建器函数类型
 */
export type Creator<T> = (...args: any[]) => T;

/**
 * 通用工厂实现
 */
export class GenericFactory<T> implements AbstractFactory<T> {
  private creators: Map<string, Creator<T>> = new Map();

  create(type: string, ...args: any[]): T {
    const creator = this.creators.get(type);
    if (!creator) {
      throw new Error(`未注册的类型: ${type}`);
    }
    return creator(...args);
  }

  register(type: string, creator: Creator<T>): void {
    if (this.creators.has(type)) {
      logger.warn(`覆盖已注册的类型: ${type}`);
    }
    this.creators.set(type, creator);
    logger.debug(`注册类型: ${type}`);
  }

  unregister(type: string): void {
    if (this.creators.delete(type)) {
      logger.debug(`注销类型: ${type}`);
    }
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.creators.keys());
  }
}

/**
 * 订单工厂 - 创建不同类型的订单
 */
export class OrderFactory {
  private static instance: OrderFactory;
  private factory: GenericFactory<any>;

  private constructor() {
    this.factory = new GenericFactory();
    this.registerDefaultOrderTypes();
  }

  static getInstance(): OrderFactory {
    if (!OrderFactory.instance) {
      OrderFactory.instance = new OrderFactory();
    }
    return OrderFactory.instance;
  }

  createOrder(type: string, data: any): any {
    return this.factory.create(type, data);
  }

  registerOrderType(type: string, creator: Creator<any>): void {
    this.factory.register(type, creator);
  }

  private registerDefaultOrderTypes(): void {
    // 零售订单
    this.factory.register('RETAIL', (data) => ({
      type: 'RETAIL',
      status: 'PENDING',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // 采购订单
    this.factory.register('PURCHASE', (data) => ({
      type: 'PURCHASE',
      status: 'PENDING',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // 团队订单
    this.factory.register('TEAM', (data) => ({
      type: 'TEAM',
      status: 'PENDING',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // 换货订单
    this.factory.register('EXCHANGE', (data) => ({
      type: 'EXCHANGE',
      status: 'PENDING',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }
}

/**
 * 支付工厂 - 创建不同类型的支付处理器
 */
export class PaymentProcessorFactory {
  private static instance: PaymentProcessorFactory;
  private factory: GenericFactory<any>;

  private constructor() {
    this.factory = new GenericFactory();
    this.registerDefaultPaymentProcessors();
  }

  static getInstance(): PaymentProcessorFactory {
    if (!PaymentProcessorFactory.instance) {
      PaymentProcessorFactory.instance = new PaymentProcessorFactory();
    }
    return PaymentProcessorInstance.instance;
  }

  createProcessor(type: string, config?: any): any {
    return this.factory.create(type, config);
  }

  registerProcessor(type: string, creator: Creator<any>): void {
    this.factory.register(type, creator);
  }

  private registerDefaultPaymentProcessors(): void {
    // 微信支付处理器
    this.factory.register('WECHAT', (config) => ({
      type: 'WECHAT',
      process: async (amount: number) => {
        logger.info('处理微信支付', { amount });
        return { success: true, transactionId: `wx_${Date.now()}` };
      },
      refund: async (transactionId: string, amount: number) => {
        logger.info('处理微信退款', { transactionId, amount });
        return { success: true, refundId: `refund_${Date.now()}` };
      },
      ...config
    }));

    // 支付宝处理器
    this.factory.register('ALIPAY', (config) => ({
      type: 'ALIPAY',
      process: async (amount: number) => {
        logger.info('处理支付宝支付', { amount });
        return { success: true, transactionId: `alipay_${Date.now()}` };
      },
      refund: async (transactionId: string, amount: number) => {
        logger.info('处理支付宝退款', { transactionId, amount });
        return { success: true, refundId: `refund_${Date.now()}` };
      },
      ...config
    }));

    // 积分支付处理器
    this.factory.register('POINTS', (config) => ({
      type: 'POINTS',
      process: async (amount: number, userId: string) => {
        logger.info('处理积分支付', { amount, userId });
        return { success: true, transactionId: `points_${Date.now()}` };
      },
      refund: async (transactionId: string, amount: number, userId: string) => {
        logger.info('处理积分退款', { transactionId, amount, userId });
        return { success: true, refundId: `refund_${Date.now()}` };
      },
      ...config
    }));
  }
}

/**
 * 佣金计算器工厂 - 创建不同类型的佣金计算器
 */
export class CommissionCalculatorFactory {
  private static instance: CommissionCalculatorFactory;
  private factory: GenericFactory<any>;

  private constructor() {
    this.factory = new GenericFactory();
    this.registerDefaultCalculators();
  }

  static getInstance(): CommissionCalculatorFactory {
    if (!CommissionCalculatorFactory.instance) {
      CommissionCalculatorFactory.instance = new CommissionCalculatorFactory();
    }
    return CommissionCalculatorFactory.instance;
  }

  createCalculator(type: string, config?: any): any {
    return this.factory.create(type, config);
  }

  registerCalculator(type: string, creator: Creator<any>): void {
    this.factory.register(type, creator);
  }

  private registerDefaultCalculators(): void {
    // 简单佣金计算器
    this.factory.register('SIMPLE', (config) => ({
      type: 'SIMPLE',
      calculate: async (orderAmount: number, rate: number) => {
        return orderAmount * rate;
      },
      ...config
    }));

    // 多级佣金计算器
    this.factory.register('MULTI_LEVEL', (config) => ({
      type: 'MULTI_LEVEL',
      calculate: async (orderAmount: number, level: number, rates: number[]) => {
        if (level <= 0 || level > rates.length) return 0;
        return orderAmount * rates[level - 1];
      },
      ...config
    }));

    // 动态佣金计算器
    this.factory.register('DYNAMIC', (config) => ({
      type: 'DYNAMIC',
      calculate: async (params: any, rules: any[]) => {
        // 根据动态规则计算佣金
        let totalCommission = 0;
        for (const rule of rules) {
          if (this.matchesCondition(params, rule.condition)) {
            totalCommission += this.applyRule(params, rule);
          }
        }
        return totalCommission;
      },
      matchesCondition: (params: any, condition: any) => {
        // 简化实现
        return true;
      },
      applyRule: (params: any, rule: any) => {
        // 简化实现
        return params.orderAmount * rule.rate;
      },
      ...config
    }));
  }
}

/**
 * 抽象产品族工厂
 */
export abstract class AbstractProductFactory {
  abstract createProduct(): Product;
  abstract createService(): Service;
}

/**
 * 产品接口
 */
export interface Product {
  operation(): string;
}

/**
 * 服务接口
 */
export interface Service {
  operation(): string;
}

/**
 * 云店产品族工厂
 */
export class CloudShopFactory extends AbstractProductFactory {
  createProduct(): Product {
    return new CloudShopProduct();
  }

  createService(): Service {
    return new CloudShopService();
  }
}

/**
 * 五通店产品族工厂
 */
export class WutongShopFactory extends AbstractProductFactory {
  createProduct(): Product {
    return new WutongShopProduct();
  }

  createService(): Service {
    return new WutongShopService();
  }
}

/**
 * 云店产品
 */
class CloudShopProduct implements Product {
  operation(): string {
    return '云店产品操作';
  }
}

/**
 * 云店服务
 */
class CloudShopService implements Service {
  operation(): string {
    return '云店服务操作';
  }
}

/**
 * 五通店产品
 */
class WutongShopProduct implements Product {
  operation(): string {
    return '五通店产品操作';
  }
}

/**
 * 五通店服务
 */
class WutongShopService implements Service {
  operation(): string {
    return '五通店服务操作';
  }
}

/**
 * 服务定位器 - 管理服务实例
 */
export class ServiceLocator {
  private static instance: ServiceLocator;
  private services: Map<string, any> = new Map();
  private factories: Map<string, AbstractFactory<any>> = new Map();

  private constructor() {}

  static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }

  registerService(name: string, service: any): void {
    this.services.set(name, service);
  }

  getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`服务未注册: ${name}`);
    }
    return service;
  }

  registerFactory(name: string, factory: AbstractFactory<any>): void {
    this.factories.set(name, factory);
  }

  getFactory<T>(name: string): AbstractFactory<T> {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`工厂未注册: ${name}`);
    }
    return factory as AbstractFactory<T>;
  }

  create<T>(factoryName: string, type: string, ...args: any[]): T {
    const factory = this.getFactory<T>(factoryName);
    return factory.create(type, ...args);
  }
}

// 创建全局服务定位器实例
export const serviceLocator = ServiceLocator.getInstance();

// 注册默认工厂
serviceLocator.registerFactory('order', OrderFactory.getInstance());
serviceLocator.registerFactory('payment', PaymentProcessorFactory.getInstance());
serviceLocator.registerFactory('commission', CommissionCalculatorFactory.getInstance());

/**
 * 建造者模式 - 构建复杂对象
 */
export class OrderBuilder {
  private order: any = {};

  setBuyer(buyerId: string): OrderBuilder {
    this.order.buyerId = buyerId;
    return this;
  }

  setSeller(sellerId: string): OrderBuilder {
    this.order.sellerId = sellerId;
    return this;
  }

  setItems(items: any[]): OrderBuilder {
    this.order.items = items;
    return this;
  }

  setAmount(amount: number): OrderBuilder {
    this.order.amount = amount;
    return this;
  }

  setShipping(address: any): OrderBuilder {
    this.order.shippingAddress = address;
    return this;
  }

  setPayment(method: string): OrderBuilder {
    this.order.paymentMethod = method;
    return this;
  }

  build(): any {
    if (!this.order.buyerId) {
      throw new Error('买方ID不能为空');
    }
    if (!this.order.items || this.order.items.length === 0) {
      throw new Error('订单项不能为空');
    }

    return {
      ...this.order,
      orderNo: this.generateOrderNo(),
      status: 'PENDING',
      createdAt: new Date()
    };
  }

  private generateOrderNo(): string {
    return `ORD${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  }
}

/**
 * 使用示例
 */
export function factoryPatternExample(): void {
  // 1. 使用订单工厂
  const orderFactory = OrderFactory.getInstance();
  const retailOrder = orderFactory.createOrder('RETAIL', {
    buyerId: 'user_001',
    items: [{ productId: 'prod_001', quantity: 2 }]
  });

  // 2. 使用服务定位器
  const paymentProcessor = serviceLocator.create('payment', 'WECHAT', {
    appId: 'wx_app_id'
  });

  // 3. 使用建造者模式
  const order = new OrderBuilder()
    .setBuyer('user_001')
    .setSeller('seller_001')
    .setItems([{ productId: 'prod_001', quantity: 2 }])
    .setAmount(100)
    .build();

  logger.info('工厂模式示例完成', {
    retailOrder,
    paymentProcessor,
    order
  });
}

// 修复PaymentProcessorFactory中的错误
const PaymentProcessorInstance = PaymentProcessorFactory;