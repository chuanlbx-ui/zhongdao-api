/**
 * 产品缓存服务
 * 提供产品相关数据的缓存管理
 */

import { cacheManager } from '../../../shared/cache/CacheManager';
import { logger } from '../../../shared/utils/logger';
import {
  CachedProduct,
  ProductListItem,
  ProductSearchResult,
  ProductCategory,
  ProductPrice,
  ProductStock,
  ProductRecommendation,
  ProductRating,
  ProductHotData,
  ProductCacheStats
} from './product.cache.types';

export class ProductCacheService {
  private readonly KEY_PREFIX = 'product';

  // 产品详情缓存
  async getProductDetail(productId: string): Promise<CachedProduct | null> {
    const key = `${this.KEY_PREFIX}:detail:${productId}`;
    return await cacheManager.get<CachedProduct>(key);
  }

  async setProductDetail(productId: string, data: CachedProduct): Promise<void> {
    const key = `${this.KEY_PREFIX}:detail:${productId}`;
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['product-detail', `product:${productId}`]
    });
  }

  async invalidateProductDetail(productId: string): Promise<void> {
    await cacheManager.invalidateTags(['product-detail', `product:${productId}`]);
  }

  // 产品列表缓存
  async getProductList(params: {
    page: number;
    perPage: number;
    categoryId?: string;
    status?: string;
    search?: string;
    isFeatured?: boolean;
  }): Promise<ProductListItem[] | null> {
    const key = this.generateProductListKey(params);
    return await cacheManager.get<ProductListItem[]>(key);
  }

  async setProductList(params: {
    page: number;
    perPage: number;
    categoryId?: string;
    status?: string;
    search?: string;
    isFeatured?: boolean;
  }, data: ProductListItem[]): Promise<void> {
    const key = this.generateProductListKey(params);
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['product-list']
    });
  }

  private generateProductListKey(params: any): string {
    const { page, perPage, categoryId, status, search, isFeatured } = params;
    let key = `${this.KEY_PREFIX}:list:${page}:${perPage}`;
    if (categoryId) key += `:cat:${categoryId}`;
    if (status) key += `:status:${status}`;
    if (search) key += `:search:${search}`;
    if (isFeatured !== undefined) key += `:featured:${isFeatured}`;
    return key;
  }

  // 分类产品缓存
  async getCategoryProducts(categoryId: string, params: {
    page: number;
    perPage: number;
    sort?: string;
  }): Promise<ProductListItem[] | null> {
    const key = `${this.KEY_PREFIX}:category:${categoryId}:${params.page}:${params.perPage}:sort:${params.sort || 'default'}`;
    return await cacheManager.get<ProductListItem[]>(key);
  }

  async setCategoryProducts(categoryId: string, params: {
    page: number;
    perPage: number;
    sort?: string;
  }, data: ProductListItem[]): Promise<void> {
    const key = `${this.KEY_PREFIX}:category:${categoryId}:${params.page}:${params.perPage}:sort:${params.sort || 'default'}`;
    await cacheManager.set(key, data, {
      ttl: 900, // 15分钟
      tags: ['product-category', `category:${categoryId}`]
    });
  }

  async invalidateCategoryProducts(categoryId: string): Promise<void> {
    await cacheManager.invalidateTags(['product-category', `category:${categoryId}`]);
  }

  // 搜索结果缓存
  async getSearchResults(query: string, params: {
    page: number;
    perPage: number;
    categoryId?: string;
    priceRange?: string;
  }): Promise<ProductSearchResult | null> {
    const key = this.generateSearchKey(query, params);
    return await cacheManager.get<ProductSearchResult>(key);
  }

  async setSearchResults(query: string, params: {
    page: number;
    perPage: number;
    categoryId?: string;
    priceRange?: string;
  }, data: ProductSearchResult): Promise<void> {
    const key = this.generateSearchKey(query, params);
    await cacheManager.set(key, data, {
      ttl: 300, // 5分钟
      tags: ['product-search']
    });
  }

  private generateSearchKey(query: string, params: any): string {
    const { page, perPage, categoryId, priceRange } = params;
    let key = `${this.KEY_PREFIX}:search:${query}:${page}:${perPage}`;
    if (categoryId) key += `:cat:${categoryId}`;
    if (priceRange) key += `:price:${priceRange}`;
    return key;
  }

  // 分类树缓存
  async getCategoryTree(): Promise<ProductCategory[] | null> {
    const key = `${this.KEY_PREFIX}:categories:tree`;
    return await cacheManager.get<ProductCategory[]>(key);
  }

  async setCategoryTree(data: ProductCategory[]): Promise<void> {
    const key = `${this.KEY_PREFIX}:categories:tree`;
    await cacheManager.set(key, data, {
      ttl: 3600, // 1小时
      tags: ['product-categories']
    });
  }

  async invalidateCategoryTree(): Promise<void> {
    await cacheManager.invalidateTags(['product-categories']);
  }

  // 用户推荐缓存
  async getUserRecommendations(userId: string): Promise<ProductRecommendation | null> {
    const key = `${this.KEY_PREFIX}:recommend:${userId}`;
    return await cacheManager.get<ProductRecommendation>(key);
  }

  async setUserRecommendations(userId: string, data: ProductRecommendation): Promise<void> {
    const key = `${this.KEY_PREFIX}:recommend:${userId}`;
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['product-recommend', `user:${userId}`]
    });
  }

  async invalidateUserRecommendations(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['product-recommend', `user:${userId}`]);
  }

  // 产品价格缓存（短TTL）
  async getProductPrice(productId: string, userLevel?: string): Promise<ProductPrice | null> {
    const key = `${this.KEY_PREFIX}:price:${productId}:level:${userLevel || 'normal'}`;
    return await cacheManager.get<ProductPrice>(key);
  }

  async setProductPrice(productId: string, data: ProductPrice, userLevel?: string): Promise<void> {
    const key = `${this.KEY_PREFIX}:price:${productId}:level:${userLevel || 'normal'}`;
    await cacheManager.set(key, data, {
      ttl: 60, // 1分钟
      tags: ['product-price', `product:${productId}`]
    });
  }

  async invalidateProductPrice(productId: string): Promise<void> {
    await cacheManager.invalidateTags(['product-price', `product:${productId}`]);
  }

  // 产品库存缓存（极短TTL）
  async getProductStock(productId: string): Promise<ProductStock | null> {
    const key = `${this.KEY_PREFIX}:stock:${productId}`;
    return await cacheManager.get<ProductStock>(key);
  }

  async setProductStock(productId: string, data: ProductStock): Promise<void> {
    const key = `${this.KEY_PREFIX}:stock:${productId}`;
    await cacheManager.set(key, data, {
      ttl: 30, // 30秒
      tags: ['product-stock', `product:${productId}`]
    });
  }

  async invalidateProductStock(productId: string): Promise<void> {
    await cacheManager.invalidateTags(['product-stock', `product:${productId}`]);
  }

  // 产品评分缓存
  async getProductRating(productId: string): Promise<ProductRating | null> {
    const key = `${this.KEY_PREFIX}:rating:${productId}`;
    return await cacheManager.get<ProductRating>(key);
  }

  async setProductRating(productId: string, data: ProductRating): Promise<void> {
    const key = `${this.KEY_PREFIX}:rating:${productId}`;
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['product-rating', `product:${productId}`]
    });
  }

  async invalidateProductRating(productId: string): Promise<void> {
    await cacheManager.invalidateTags(['product-rating', `product:${productId}`]);
  }

  // 热门产品缓存
  async getHotProducts(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<ProductHotData | null> {
    const key = `${this.KEY_PREFIX}:hot:${period}`;
    return await cacheManager.get<ProductHotData>(key);
  }

  async setHotProducts(period: 'hour' | 'day' | 'week' | 'month' = 'day', data: ProductHotData): Promise<void> {
    const key = `${this.KEY_PREFIX}:hot:${period}`;
    const ttl = period === 'hour' ? 3600 : period === 'day' ? 7200 : 86400;
    await cacheManager.set(key, data, {
      ttl,
      tags: ['product-hot']
    });
  }

  async invalidateHotProducts(): Promise<void> {
    await cacheManager.invalidateTags(['product-hot']);
  }

  // 产品浏览历史缓存
  async getViewHistory(userId?: string, sessionId?: string): Promise<Array<{
    productId: string;
    viewedAt: Date;
  }> | null> {
    const key = userId
      ? `${this.KEY_PREFIX}:history:user:${userId}`
      : `${this.KEY_PREFIX}:history:session:${sessionId}`;
    return await cacheManager.get<Array<{ productId: string; viewedAt: Date }>>(key);
  }

  async addViewHistory(productId: string, userId?: string, sessionId?: string): Promise<void> {
    const key = userId
      ? `${this.KEY_PREFIX}:history:user:${userId}`
      : `${this.KEY_PREFIX}:history:session:${sessionId}`;

    const history = await this.getViewHistory(userId, sessionId) || [];
    history.unshift({ productId, viewedAt: new Date() });

    // 只保留最近50条记录
    const trimmedHistory = history.slice(0, 50);

    await cacheManager.set(key, trimmedHistory, {
      ttl: 86400, // 24小时
      tags: ['product-history', userId ? `user:${userId}` : `session:${sessionId}`]
    });
  }

  // 批量获取产品详情
  async getProductDetails(productIds: string[]): Promise<Map<string, CachedProduct | null>> {
    const keys = productIds.map(id => `${this.KEY_PREFIX}:detail:${id}`);
    const values = await cacheManager.mget<CachedProduct>(keys);

    const result = new Map<string, CachedProduct | null>();
    productIds.forEach((id, index) => {
      result.set(id, values[index]);
    });

    return result;
  }

  // 批量设置产品详情
  async setProductDetails(products: Array<{ id: string; data: CachedProduct }>): Promise<void> {
    const items = products.map(product => ({
      key: `${this.KEY_PREFIX}:detail:${product.id}`,
      value: product.data,
      options: {
        ttl: 1800,
        tags: ['product-detail', `product:${product.id}`]
      }
    }));

    await cacheManager.mset(items);
  }

  // 清除产品所有缓存
  async invalidateAllProductCache(productId: string): Promise<void> {
    await cacheManager.invalidateTags([`product:${productId}`]);
  }

  // 预热产品缓存
  async warmupProductCache(productId: string): Promise<void> {
    // 这里应该调用产品服务获取所有相关数据并缓存
    logger.info(`预热产品缓存: ${productId}`);
  }

  // 批量预热产品缓存
  async warmupProductCaches(productIds: string[]): Promise<void> {
    const promises = productIds.map(id => this.warmupProductCache(id));
    await Promise.all(promises);
  }

  // 获取缓存统计
  async getCacheStats(): Promise<ProductCacheStats> {
    const stats = await cacheManager.getStats();

    // 获取各类型缓存数量
    const productDetailKeys = await cacheManager.keys(`${this.KEY_PREFIX}:detail:*`);
    const productListKeys = await cacheManager.keys(`${this.KEY_PREFIX}:list:*`);
    const categoryKeys = await cacheManager.keys(`${this.KEY_PREFIX}:categories:*`);
    const searchKeys = await cacheManager.keys(`${this.KEY_PREFIX}:search:*`);
    const recommendKeys = await cacheManager.keys(`${this.KEY_PREFIX}:recommend:*`);
    const priceKeys = await cacheManager.keys(`${this.KEY_PREFIX}:price:*`);
    const stockKeys = await cacheManager.keys(`${this.KEY_PREFIX}:stock:*`);

    return {
      totalCached: productDetailKeys.length + productListKeys.length +
                  categoryKeys.length + searchKeys.length + recommendKeys.length +
                  priceKeys.length + stockKeys.length,
      byType: {
        productDetail: productDetailKeys.length,
        productList: productListKeys.length,
        categoryTree: categoryKeys.length,
        searchResults: searchKeys.length,
        recommendations: recommendKeys.length,
        prices: priceKeys.length,
        stocks: stockKeys.length
      },
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsage || 0,
      lastUpdate: new Date()
    };
  }

  // 清理过期产品缓存
  async cleanupExpiredProductCache(): Promise<number> {
    const keys = await cacheManager.keys(`${this.KEY_PREFIX}:*`);
    let cleanedCount = 0;

    for (const key of keys) {
      const ttl = await cacheManager.ttl(key);
      if (ttl === -2) { // 已过期
        await cacheManager.del(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理了${cleanedCount}个过期的产品缓存`);
    }

    return cleanedCount;
  }

  // 获取产品相关性缓存（用于推荐）
  async getProductRelated(productId: string): Promise<string[] | null> {
    const key = `${this.KEY_PREFIX}:related:${productId}`;
    return await cacheManager.get<string[]>(key);
  }

  async setProductRelated(productId: string, relatedProductIds: string[]): Promise<void> {
    const key = `${this.KEY_PREFIX}:related:${productId}`;
    await cacheManager.set(key, relatedProductIds, {
      ttl: 3600, // 1小时
      tags: ['product-related', `product:${productId}`]
    });
  }

  async invalidateProductRelated(productId: string): Promise<void> {
    await cacheManager.invalidateTags(['product-related', `product:${productId}`]);
  }
}