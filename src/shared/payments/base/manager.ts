import { PaymentProvider, PaymentRequest, PaymentResponse, RefundRequest, RefundResponse, QueryResponse, NotifyData, ProviderType, PaymentMethod } from './provider';
import { logger } from '../../utils/logger';

/**
 * 支付管理器 - 统一支付接口入口
 */
export class PaymentManager {
  private providers: Map<ProviderType, PaymentProvider> = new Map();
  private methodProviderMap: Map<PaymentMethod, ProviderType> = new Map();

  constructor() {
    this.initMethodMapping();
  }

  /**
   * 注册支付提供商
   */
  registerProvider(type: ProviderType, provider: PaymentProvider): void {
    this.providers.set(type, provider);
    logger.info('支付提供商注册成功', {
      provider: type,
      methods: provider.getSupportedMethods()
    });
  }

  /**
   * 获取支付提供商
   */
  getProvider(type: ProviderType): PaymentProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * 根据支付方式获取提供商
   */
  getProviderByMethod(method: PaymentMethod): PaymentProvider | undefined {
    const providerType = this.methodProviderMap.get(method);
    return providerType ? this.providers.get(providerType) : undefined;
  }

  /**
   * 创建支付订单
   */
  async createPayment(method: PaymentMethod, request: PaymentRequest): Promise<PaymentResponse> {
    const provider = this.getProviderByMethod(method);
    if (!provider) {
      throw new Error(`不支持的支付方式: ${method}`);
    }

    try {
      logger.info('创建支付订单', {
        method,
        orderId: request.orderId,
        amount: request.amount
      });

      const response = await provider.createPayment({
        ...request,
        extra: {
          ...request.extra,
          paymentMethod: method
        }
      });

      logger.info('支付订单创建成功', {
        method,
        orderId: request.orderId,
        transactionId: response.transactionId,
        success: response.success
      });

      return response;
    } catch (error) {
      logger.error('创建支付订单失败', {
        method,
        orderId: request.orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 查询支付状态
   */
  async queryPayment(orderId: string): Promise<QueryResponse> {
    // 尝试从所有提供商查询支付状态
    const results: QueryResponse[] = [];

    for (const [type, provider] of this.providers) {
      try {
        const result = await provider.queryPayment(orderId);
        if (result.success) {
          results.push(result);
        }
      } catch (error) {
        logger.warn(`查询支付状态失败 - ${type}`, {
          orderId,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    if (results.length === 0) {
      return {
        success: false,
        message: '未找到支付记录'
      };
    }

    if (results.length > 1) {
      logger.warn('发现多个支付记录', {
        orderId,
        count: results.length
      });
    }

    return results[0];
  }

  /**
   * 申请退款
   */
  async createRefund(request: RefundRequest): Promise<RefundResponse> {
    // 先查询订单支付状态，确定使用哪个提供商
    const queryResult = await this.queryPayment(request.orderId);
    if (!queryResult.success || !queryResult.providerOrderId) {
      throw new Error('无法查询到支付订单信息');
    }

    // 根据查询结果确定提供商类型
    const provider = await this.findProviderByOrderId(request.orderId);
    if (!provider) {
      throw new Error('无法确定支付提供商');
    }

    try {
      logger.info('申请退款', {
        orderId: request.orderId,
        refundAmount: request.refundAmount
      });

      const response = await provider.createRefund(request);

      logger.info('退款申请成功', {
        orderId: request.orderId,
        refundId: response.refundId,
        success: response.success
      });

      return response;
    } catch (error) {
      logger.error('申请退款失败', {
        orderId: request.orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 验证支付回调
   */
  async verifyNotify(data: any, headers?: any): Promise<NotifyData> {
    // 尝试从所有提供商验证通知
    for (const [type, provider] of this.providers) {
      try {
        const result = await provider.verifyNotify(data, headers);
        if (result.orderId) {
          logger.info('支付回调验证成功', {
            provider: type,
            orderId: result.orderId,
            tradeStatus: result.tradeStatus
          });
          return { ...result, provider: type };
        }
      } catch (error) {
        logger.warn(`支付回调验证失败 - ${type}`, {
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    throw new Error('无法验证支付回调来源');
  }

  /**
   * 关闭支付订单
   */
  async closePayment(orderId: string): Promise<boolean> {
    const provider = await this.findProviderByOrderId(orderId);
    if (!provider) {
      logger.warn('无法确定支付提供商，尝试关闭所有相关订单', { orderId });

      // 尝试关闭所有提供商的订单
      let success = false;
      for (const [, p] of this.providers) {
        try {
          if (await p.closePayment(orderId)) {
            success = true;
          }
        } catch (error) {
          logger.warn('关闭订单失败', {
            orderId,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      }
      return success;
    }

    try {
      const result = await provider.closePayment(orderId);
      logger.info('关闭支付订单', {
        orderId,
        success: result
      });
      return result;
    } catch (error) {
      logger.error('关闭支付订单失败', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取支持的支付方式
   */
  getSupportedMethods(): PaymentMethod[] {
    const methods: PaymentMethod[] = [];

    for (const [, provider] of this.providers) {
      methods.push(...provider.getSupportedMethods());
    }

    return [...new Set(methods)]; // 去重
  }

  /**
   * 检查支付方式是否支持
   */
  isMethodSupported(method: PaymentMethod): boolean {
    return this.methodProviderMap.has(method) &&
           this.providers.has(this.methodProviderMap.get(method)!);
  }

  /**
   * 根据订单号查找提供商
   */
  private async findProviderByOrderId(orderId: string): Promise<PaymentProvider | undefined> {
    // 查询数据库确定订单的支付方式
    try {
      // 这里需要查询数据库获取订单信息
      // 暂时返回undefined，实现时需要从数据库查询
      return undefined;
    } catch (error) {
      logger.error('查询订单支付信息失败', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return undefined;
    }
  }

  /**
   * 初始化支付方式映射
   */
  private initMethodMapping(): void {
    // 微信支付方式
    this.methodProviderMap.set(PaymentMethod.WECHAT_JSAPI, ProviderType.WECHAT);
    this.methodProviderMap.set(PaymentMethod.WECHAT_NATIVE, ProviderType.WECHAT);
    this.methodProviderMap.set(PaymentMethod.WECHAT_APP, ProviderType.WECHAT);
    this.methodProviderMap.set(PaymentMethod.WECHAT_H5, ProviderType.WECHAT);

    // 支付宝支付方式
    this.methodProviderMap.set(PaymentMethod.ALIPAY_WEB, ProviderType.ALIPAY);
    this.methodProviderMap.set(PaymentMethod.ALIPAY_QR, ProviderType.ALIPAY);
    this.methodProviderMap.set(PaymentMethod.ALIPAY_APP, ProviderType.ALIPAY);
    this.methodProviderMap.set(PaymentMethod.ALIPAY_WAP, ProviderType.ALIPAY);

    // 积分支付
    this.methodProviderMap.set(PaymentMethod.POINTS, ProviderType.POINTS);

    // 混合支付
    this.methodProviderMap.set(PaymentMethod.MIXED, ProviderType.POINTS);
  }
}

// 导出单例实例
export const paymentManager = new PaymentManager();