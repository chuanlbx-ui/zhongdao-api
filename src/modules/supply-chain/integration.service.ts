/**
 * 供应链集成服务
 * 整合路径优化系统与现有业务服务，提供完整的采购解决方案
 * 包括采购权限验证、订单创建、佣金分配等功能
 */

import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { supplyChainOptimizer } from './index';
import { purchaseService, CreatePurchaseParams } from '../purchase/purchase.service';
import { userLevelService } from '../user/level.service';
import { teamService } from '../user/team.service';
import {
  ProcurementPath,
  PathValidationResult,
  OptimizationResult,
  SupplyChainError,
  SupplyChainErrorType
} from './types';

/**
 * 集成采购参数
 */
export interface IntegratedPurchaseParams {
  buyerId: string;
  productId: string;
  quantity: number;
  preferredSellerId?: string; // 偏好供应商ID
  optimizationStrategy?: string;
  customWeights?: any;
  skipOptimization?: boolean; // 跳过路径优化，直接使用偏好供应商
}

/**
 * 集成采购结果
 */
export interface IntegratedPurchaseResult {
  success: boolean;
  path?: ProcurementPath;
  validation?: PathValidationResult;
  order?: any;
  error?: string;
  message: string;
  metadata?: {
    optimizationTime: number;
    validationTime: number;
    totalTime: number;
    alternativePaths?: number;
  };
}

/**
 * 供应链集成服务
 * 提供路径优化与采购业务的无缝集成
 */
export class SupplyChainIntegrationService {
  /**
   * 智能采购 - 自动寻找最优路径并创建采购订单
   * @param params 采购参数
   * @returns 采购结果
   */
  async intelligentPurchase(params: IntegratedPurchaseParams): Promise<IntegratedPurchaseResult> {
    const startTime = Date.now();
    let path: ProcurementPath | null = null;
    let validation: PathValidationResult | null = null;
    let optimizationTime = 0;
    let validationTime = 0;

    try {
      logger.info('开始智能采购流程', {
        buyerId: params.buyerId,
        productId: params.productId,
        quantity: params.quantity,
        preferredSellerId: params.preferredSellerId
      });

      // 1. 路径优化
      if (!params.skipOptimization) {
        const optimizationStart = Date.now();

        if (params.preferredSellerId) {
          // 使用偏好供应商，但仍需验证路径有效性
          path = await this.findPathWithPreferredSeller(params);
        } else {
          // 完全自动优化
          path = await supplyChainOptimizer.findOptimalPath(
            params.buyerId,
            params.productId,
            params.quantity,
            {
              strategy: params.optimizationStrategy as any,
              weights: params.customWeights,
              useCache: true
            }
          );
        }

        optimizationTime = Date.now() - optimizationStart;

        if (!path) {
          return {
            success: false,
            error: '未找到有效的采购路径',
            message: '智能采购失败：无法找到合适的供应路径',
            metadata: {
              optimizationTime,
              validationTime: 0,
              totalTime: Date.now() - startTime
            }
          };
        }
      } else if (params.preferredSellerId) {
        // 跳过优化，使用偏好供应商创建基本路径
        path = await this.createBasicPath(params.buyerId, params.preferredSellerId, params.productId, params.quantity);
      }

      if (!path) {
        throw new SupplyChainError(
          SupplyChainErrorType.PATH_NOT_FOUND,
          '无法创建采购路径'
        );
      }

      // 2. 路径验证
      const validationStart = Date.now();
      validation = await supplyChainOptimizer.validatePath(path);
      validationTime = Date.now() - validationStart;

      if (!validation.isValid) {
        return {
          success: false,
          path,
          validation,
          error: '采购路径验证失败',
          message: `验证失败：${validation.reasons.join('; ')}`,
          metadata: {
            optimizationTime,
            validationTime,
            totalTime: Date.now() - startTime
          }
        };
      }

      // 3. 检查采购权限（使用现有的采购服务）
      const supplierNode = path.path[path.path.length - 1];
      const permissionCheck = await purchaseService.validatePurchasePermission(
        params.buyerId,
        supplierNode.userId,
        params.productId,
        params.quantity
      );

      if (!permissionCheck.canPurchase) {
        return {
          success: false,
          path,
          validation,
          error: '采购权限不足',
          message: `权限验证失败：${permissionCheck.reasons.join('; ')}`,
          metadata: {
            optimizationTime,
            validationTime,
            totalTime: Date.now() - startTime
          }
        };
      }

      // 4. 创建采购订单
      const orderResult = await this.createPurchaseOrder(path, params);

      const totalTime = Date.now() - startTime;

      logger.info('智能采购完成', {
        buyerId: params.buyerId,
        productId: params.productId,
        quantity: params.quantity,
        pathId: path.id,
        pathLength: path.path.length,
        totalPrice: path.totalPrice,
        orderCreated: !!orderResult.order,
        optimizationTime,
        validationTime,
        totalTime
      });

      return {
        success: true,
        path,
        validation,
        order: orderResult.order,
        message: '智能采购成功',
        metadata: {
          optimizationTime,
          validationTime,
          totalTime
        }
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;

      logger.error('智能采购失败', {
        buyerId: params.buyerId,
        productId: params.productId,
        quantity: params.quantity,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
        totalTime
      });

      return {
        success: false,
        path,
        validation,
        error: error instanceof Error ? error.message : '采购失败',
        message: '智能采购过程中发生错误',
        metadata: {
          optimizationTime,
          validationTime,
          totalTime
        }
      };
    }
  }

  /**
   * 批量智能采购
   * @param requests 批量采购请求
   * @returns 批量采购结果
   */
  async batchIntelligentPurchase(
    requests: IntegratedPurchaseParams[]
  ): Promise<IntegratedPurchaseResult[]> {
    logger.info(`开始批量智能采购，请求数量: ${requests.length}`);

    const results: IntegratedPurchaseResult[] = [];
    const batchSize = 10; // 每批处理10个请求

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromises = batch.map(request => this.intelligentPurchase(request));

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              error: result.reason instanceof Error ? result.reason.message : '批量处理失败',
              message: '批量智能采购中的单个请求失败',
              metadata: {
                optimizationTime: 0,
                validationTime: 0,
                totalTime: 0
              }
            });
          }
        }

      } catch (error) {
        logger.error('批量智能采购失败', {
          batchSize: batch.length,
          error: error instanceof Error ? error.message : '未知错误'
        });

        // 为失败的批次创建错误结果
        for (const request of batch) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : '批量处理失败',
            message: '智能采购失败',
            metadata: {
              optimizationTime: 0,
              validationTime: 0,
              totalTime: 0
            }
          });
        }
      }

      // 避免系统过载
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const successCount = results.filter(r => r.success).length;

    logger.info('批量智能采购完成', {
      totalRequests: requests.length,
      successCount,
      failureCount: requests.length - successCount
    });

    return results;
  }

  /**
   * 获取采购建议
   * @param buyerId 采购方ID
   * @param productId 商品ID
   * @param quantity 采购数量
   * @param maxSuggestions 最大建议数量
   * @returns 采购建议列表
   */
  async getPurchaseSuggestions(
    buyerId: string,
    productId: string,
    quantity: number,
    maxSuggestions: number = 5
  ): Promise<{
    suggestions: Array<{
      path: ProcurementPath;
      validation: PathValidationResult;
      recommendation: string;
      score: number;
    }>;
    metadata: {
      totalPathsFound: number;
      validPaths: number;
      analysisTime: number;
    };
  }> {
    const startTime = Date.now();

    try {
      logger.debug('获取采购建议', {
        buyerId,
        productId,
        quantity,
        maxSuggestions
      });

      // 1. 获取多个优化路径
      const optimizationResult = await supplyChainOptimizer.findMultiplePaths(
        buyerId,
        productId,
        quantity,
        {
          maxPaths: maxSuggestions * 2, // 获取更多路径用于筛选
          strategy: 'BALANCED'
        }
      );

      // 2. 验证所有路径
      const suggestions: Array<{
        path: ProcurementPath;
        validation: PathValidationResult;
        recommendation: string;
        score: number;
      }> = [];

      for (const path of optimizationResult.ParetoFront.slice(0, maxSuggestions * 2)) {
        try {
          const validation = await supplyChainOptimizer.validatePath(path);

          if (validation.isValid) {
            const recommendation = this.generateRecommendation(path, validation);
            const score = this.calculateRecommendationScore(path, validation);

            suggestions.push({
              path,
              validation,
              recommendation,
              score
            });
          }
        } catch (error) {
          // 忽略单个路径验证错误
          continue;
        }

        if (suggestions.length >= maxSuggestions) break;
      }

      // 3. 按评分排序
      suggestions.sort((a, b) => b.score - a.score);

      const analysisTime = Date.now() - startTime;

      logger.debug('采购建议生成完成', {
        buyerId,
        productId,
        quantity,
        suggestionsCount: suggestions.length,
        analysisTime
      });

      return {
        suggestions: suggestions.slice(0, maxSuggestions),
        metadata: {
          totalPathsFound: optimizationResult.paths.length,
          validPaths: suggestions.length,
          analysisTime
        }
      };

    } catch (error) {
      logger.error('获取采购建议失败', {
        buyerId,
        productId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });

      throw new SupplyChainError(
        SupplyChainErrorType.OPTIMIZATION_FAILED,
        '获取采购建议失败',
        { buyerId, productId, quantity, error }
      );
    }
  }

  /**
   * 模拟采购影响
   * @param buyerId 采购方ID
   * @param productId 商品ID
   * @param quantity 采购数量
   * @returns 采购影响分析
   */
  async simulatePurchaseImpact(
    buyerId: string,
    productId: string,
    quantity: number
  ): Promise<{
    path: ProcurementPath;
    impact: {
      onBuyer: {
        totalCost: number;
        estimatedProfit: number;
        stockLevel: number;
      };
      onPath: Array<{
        userId: string;
        commission: number;
        newSalesVolume: number;
      }>;
      onSystem: {
        networkEfficiency: number;
        priceCompetitiveness: number;
        inventoryHealth: number;
      };
    };
    confidence: number;
  }> {
    try {
      // 1. 获取最优路径
      const path = await supplyChainOptimizer.findOptimalPath(buyerId, productId, quantity);
      if (!path) {
        throw new SupplyChainError(
          SupplyChainErrorType.PATH_NOT_FOUND,
          '无法找到采购路径进行模拟'
        );
      }

      // 2. 计算对采购方的影响
      const buyerImpact = {
        totalCost: path.totalPrice,
        estimatedProfit: this.calculateEstimatedProfit(path),
        stockLevel: quantity // 假设采购数量就是库存水平
      };

      // 3. 计算对路径中各方的影响
      const pathImpact: Array<{
        userId: string;
        commission: number;
        newSalesVolume: number;
      }> = [];

      for (let i = 0; i < path.path.length - 1; i++) {
        const node = path.path[i];
        const commissionRate = node.metadata.commissionRate || 0.05; // 默认5%佣金
        const commission = path.totalPrice * commissionRate;

        pathImpact.push({
          userId: node.userId,
          commission,
          newSalesVolume: path.totalPrice
        });
      }

      // 4. 计算对系统的影响
      const systemImpact = {
        networkEfficiency: this.calculateNetworkEfficiency(path),
        priceCompetitiveness: path.priceScore,
        inventoryHealth: path.inventoryScore
      };

      // 5. 计算整体置信度
      const confidence = this.calculateSimulationConfidence(path);

      return {
        path,
        impact: {
          onBuyer: buyerImpact,
          onPath: pathImpact,
          onSystem: systemImpact
        },
        confidence
      };

    } catch (error) {
      logger.error('采购影响模拟失败', {
        buyerId,
        productId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });

      throw new SupplyChainError(
        SupplyChainErrorType.OPTIMIZATION_FAILED,
        '采购影响模拟失败',
        { buyerId, productId, quantity, error }
      );
    }
  }

  // 私有辅助方法

  /**
   * 使用偏好供应商查找路径
   */
  private async findPathWithPreferredSeller(params: IntegratedPurchaseParams): Promise<ProcurementPath | null> {
    try {
      // 首先验证偏好供应商的有效性
      const permissionCheck = await purchaseService.validatePurchasePermission(
        params.buyerId,
        params.preferredSellerId!,
        params.productId,
        params.quantity
      );

      if (!permissionCheck.canPurchase) {
        logger.debug('偏好供应商验证失败，回退到自动优化', {
          buyerId: params.buyerId,
          preferredSellerId: params.preferredSellerId,
          reasons: permissionCheck.reasons
        });

        // 回退到自动优化
        return await supplyChainOptimizer.findOptimalPath(
          params.buyerId,
          params.productId,
          params.quantity
        );
      }

      // 创建包含偏好供应商的路径
      return await this.createBasicPath(
        params.buyerId,
        params.preferredSellerId!,
        params.productId,
        params.quantity
      );

    } catch (error) {
      logger.debug('偏好供应商处理失败，回退到自动优化', {
        buyerId: params.buyerId,
        preferredSellerId: params.preferredSellerId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      // 回退到自动优化
      return await supplyChainOptimizer.findOptimalPath(
        params.buyerId,
        params.productId,
        params.quantity
      );
    }
  }

  /**
   * 创建基本路径
   */
  private async createBasicPath(
    buyerId: string,
    sellerId: string,
    productId: string,
    quantity: number
  ): Promise<ProcurementPath> {
    // 获取买卖双方信息
    const [buyer, seller] = await Promise.all([
      prisma.user.findUnique({ where: { id: buyerId } }),
      prisma.user.findUnique({ where: { id: sellerId } })
    ]);

    if (!buyer || !seller) {
      throw new SupplyChainError(
        SupplyChainErrorType.INVALID_NODE,
        '买卖双方信息不完整'
      );
    }

    // 获取价格和库存信息
    const [priceInfo, stockInfo] = await Promise.all([
      this.getPriceInfo(sellerId, productId),
      this.getStockInfo(sellerId, productId)
    ]);

    const totalPrice = priceInfo.price * quantity;
    const estimatedDeliveryTime = 24; // 假设24小时送达

    return {
      id: `basic_path_${Date.now()}`,
      buyerId,
      productId,
      quantity,
      path: [
        {
          userId: buyerId,
          level: buyer.level as any,
          role: 'buyer',
          price: 0,
          availableStock: 0,
          distance: 0,
          metadata: {
            responseTime: 0,
            reliability: 1.0,
            commissionRate: 0
          }
        },
        {
          userId: sellerId,
          level: seller.level as any,
          role: 'supplier',
          price: priceInfo.price,
          availableStock: stockInfo.stock,
          distance: 1,
          metadata: {
            responseTime: 100,
            reliability: 0.95,
            commissionRate: 0.05
          }
        }
      ],
      totalPrice,
      totalLength: 1,
      availableStock: stockInfo.stock,
      estimatedDeliveryTime,
      priceScore: 0.8,
      inventoryScore: stockInfo.stock >= quantity ? 1.0 : 0.5,
      lengthScore: 1.0,
      reliabilityScore: 0.95,
      overallScore: 0.85,
      metadata: {
        calculatedAt: new Date(),
        algorithm: 'basic_path',
        weights: { price: 0.4, inventory: 0.3, length: 0.2, reliability: 0.1, speed: 0 },
        searchDepth: 1,
        alternativePaths: 0
      }
    };
  }

  /**
   * 获取价格信息
   */
  private async getPriceInfo(userId: string, productId: string): Promise<{ price: number }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      const pricing = await prisma.productPricing.findFirst({
        where: {
          productId,
          userLevel: user?.level as any
        }
      });

      return {
        price: pricing?.price || 1000 // 默认价格
      };
    } catch (error) {
      logger.error('获取价格信息失败', { userId, productId });
      return { price: 1000 };
    }
  }

  /**
   * 获取库存信息
   */
  private async getStockInfo(userId: string, productId: string): Promise<{ stock: number }> {
    try {
      const stock = await prisma.inventoryStock.findFirst({
        where: {
          productId,
          userId
        }
      });

      return {
        stock: stock?.quantity || 0
      };
    } catch (error) {
      logger.error('获取库存信息失败', { userId, productId });
      return { stock: 0 };
    }
  }

  /**
   * 创建采购订单
   */
  private async createPurchaseOrder(
    path: ProcurementPath,
    params: IntegratedPurchaseParams
  ): Promise<{ success: boolean; order?: any; error?: string; message: string }> {
    try {
      const supplierNode = path.path[path.path.length - 1];

      const createParams: CreatePurchaseParams = {
        buyerId: params.buyerId,
        sellerId: supplierNode.userId,
        productId: params.productId,
        skuId: '', // 需要根据实际情况获取SKU ID
        quantity: params.quantity
      };

      const orderResult = await purchaseService.createPurchaseOrder(createParams);

      if (orderResult.success && orderResult.order) {
        // 将路径信息存储到订单元数据中
        await prisma.purchaseOrder.update({
          where: { id: orderResult.order.id },
          data: {
            purchasePath: JSON.stringify(path),
            metadata: {
              ...orderResult.order.metadata,
              optimizedPath: {
                pathId: path.id,
                totalPrice: path.totalPrice,
                overallScore: path.overallScore,
                pathLength: path.totalLength,
                algorithm: path.metadata.algorithm
              }
            }
          }
        });
      }

      return orderResult;

    } catch (error) {
      logger.error('创建采购订单失败', {
        pathId: path.id,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '订单创建失败',
        message: '创建采购订单失败'
      };
    }
  }

  /**
   * 生成推荐说明
   */
  private generateRecommendation(path: ProcurementPath, validation: PathValidationResult): string {
    const reasons: string[] = [];

    if (path.priceScore > 0.8) {
      reasons.push('价格优势明显');
    }
    if (path.inventoryScore > 0.8) {
      reasons.push('库存充足');
    }
    if (path.lengthScore > 0.8) {
      reasons.push('供应链路径短');
    }
    if (path.reliabilityScore > 0.8) {
      reasons.push('供应商可靠性高');
    }

    if (reasons.length === 0) {
      return '综合评估该路径较为适合';
    }

    return `推荐理由：${reasons.join('；')}`;
  }

  /**
   * 计算推荐评分
   */
  private calculateRecommendationScore(path: ProcurementPath, validation: PathValidationResult): number {
    let score = path.overallScore;

    // 根据验证结果调整评分
    if (validation.warnings.length > 0) {
      score *= 0.9; // 有警告时降低评分
    }

    return score;
  }

  /**
   * 计算预估利润
   */
  private calculateEstimatedProfit(path: ProcurementPath): number {
    // 简化计算：假设15%的利润率
    return path.totalPrice * 0.15;
  }

  /**
   * 计算网络效率
   */
  private calculateNetworkEfficiency(path: ProcurementPath): number {
    // 基于路径长度和可靠性计算
    return (path.lengthScore + path.reliabilityScore) / 2;
  }

  /**
   * 计算模拟置信度
   */
  private calculateSimulationConfidence(path: ProcurementPath): number {
    // 基于路径评分和数据完整性计算
    return Math.min(path.overallScore * 1.1, 1.0); // 稍微提高置信度
  }
}

// 导出单例实例
export const supplyChainIntegrationService = new SupplyChainIntegrationService();