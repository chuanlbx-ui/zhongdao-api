import { Router } from 'express';
import {
  productCacheMiddleware,
  invalidateCacheMiddleware,
  invalidateTagsMiddleware,
  hotDataCacheMiddleware,
  cacheStatsRoute,
  clearCacheRoute,
  warmupCacheRoute
} from '../../../shared/middleware/cache';
import { cacheManager } from '../../../shared/cache/CacheManager';
import { ProductCacheService } from '../../../modules/products/cache';
import { logger } from '../../../shared/utils/logger';

const productCacheService = new ProductCacheService();
const router = Router();

// 缓存管理路由
router.get('/cache/stats', cacheStatsRoute());
router.post('/cache/clear', clearCacheRoute());
router.post('/cache/warmup', warmupCacheRoute());

// 获取商品分类树（长期缓存）
router.get('/categories/tree',
  productCacheMiddleware({
    ttl: 3600, // 1小时
    tags: ['product-categories'],
    keyPrefix: 'product:categories:tree'
  }),
  async (req, res, next) => {
    // 这里应该调用实际的产品分类服务
    res.json({
      success: true,
      data: {
        categories: []
      }
    });
  }
);

// 获取热门商品（热点数据缓存）
router.get('/hot',
  hotDataCacheMiddleware({
    ttl: 1800, // 30分钟
    keyPrefix: 'product:hot'
  }),
  async (req, res, next) => {
    // 获取热门商品列表
    res.json({
      success: true,
      data: {
        products: []
      }
    });
  }
);

// 获取商品列表（带缓存）
router.get('/items',
  productCacheMiddleware({
    ttl: 600, // 10分钟
    tags: ['product-list'],
    keyGenerator: (req) => {
      const { page = 1, perPage = 20, categoryId, status, search, isFeatured } = req.query;
      const key = `product:list:${page}:${perPage}`;
      if (categoryId) key += `:cat:${categoryId}`;
      if (status) key += `:status:${status}`;
      if (search) key += `:search:${search}`;
      if (isFeatured) key += `:featured:${isFeatured}`;
      return key;
    },
    skipCache: (req) => {
      // 不缓存第2页之后的请求
      const page = parseInt(req.query.page as string) || 1;
      return page > 1;
    }
  }),
  async (req, res, next) => {
    // 这里应该调用实际的产品服务
    // 为了演示，我们返回模拟数据
    const { page = 1, perPage = 20 } = req.query;

    const cacheKey = `product:list:${page}:${perPage}`;
    const cached = await cacheManager.get(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // 模拟数据库查询
    const mockData = {
      products: [],
      pagination: {
        page: parseInt(page as string),
        perPage: parseInt(perPage as string),
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    };

    // 缓存结果
    await cacheManager.set(cacheKey, mockData, {
      ttl: 600,
      tags: ['product-list']
    });

    res.json({
      success: true,
      data: mockData
    });
  }
);

// 获取商品详情（带缓存）
router.get('/items/:id',
  productCacheMiddleware({
    ttl: 1800, // 30分钟
    tags: ['product-detail'],
    keyGenerator: (req) => `product:detail:${req.params.id}`
  }),
  async (req, res, next) => {
    const { id } = req.params;

    // 尝试从缓存服务获取
    const cachedProduct = await productCacheService.getProductDetail(id);
    if (cachedProduct) {
      return res.json({
        success: true,
        data: cachedProduct
      });
    }

    // 模拟数据库查询
    res.json({
      success: true,
      data: null
    });
  }
);

// 按分类获取商品（带缓存）
router.get('/category/:categoryId',
  productCacheMiddleware({
    ttl: 900, // 15分钟
    tags: ['product-category'],
    keyGenerator: (req) => {
      const { categoryId } = req.params;
      const { page = 1, perPage = 20, sort } = req.query;
      let key = `product:category:${categoryId}:${page}:${perPage}`;
      if (sort) key += `:sort:${sort}`;
      return key;
    }
  }),
  async (req, res, next) => {
    const { categoryId } = req.params;
    const { page = 1, perPage = 20, sort } = req.query;

    // 尝试从缓存获取分类商品
    const cacheKey = `product:category:${categoryId}:${page}:${perPage}:sort:${sort || 'default'}`;
    const cached = await cacheManager.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: cached
      });
    }

    // 模拟查询
    const mockData = {
      categoryId,
      products: [],
      pagination: {
        page: parseInt(page as string),
        perPage: parseInt(perPage as string),
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    };

    // 缓存结果
    await cacheManager.set(cacheKey, mockData, {
      ttl: 900,
      tags: ['product-category', `category:${categoryId}`]
    });

    res.json({
      success: true,
      data: mockData
    });
  }
);

// 获取搜索结果（带缓存）
router.get('/search',
  productCacheMiddleware({
    ttl: 300, // 5分钟
    tags: ['product-search'],
    keyGenerator: (req) => {
      const { q, page = 1, perPage = 20, categoryId, priceRange } = req.query;
      let key = `product:search:${q}:${page}:${perPage}`;
      if (categoryId) key += `:cat:${categoryId}`;
      if (priceRange) key += `:price:${priceRange}`;
      return key;
    }
  }),
  async (req, res, next) => {
    const { q, page = 1, perPage = 20, categoryId, priceRange } = req.query;

    // 搜索结果缓存时间较短
    const cacheKey = `product:search:${q}:${page}:${perPage}:cat:${categoryId || 'all'}:price:${priceRange || 'all'}`;
    const cached = await cacheManager.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: cached
      });
    }

    // 模拟搜索
    const mockData = {
      query: q,
      products: [],
      pagination: {
        page: parseInt(page as string),
        perPage: parseInt(perPage as string),
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    };

    // 缓存搜索结果
    await cacheManager.set(cacheKey, mockData, {
      ttl: 300,
      tags: ['product-search']
    });

    res.json({
      success: true,
      data: mockData
    });
  }
);

// 获取商品推荐（带缓存）
router.get('/recommendations/:userId',
  productCacheMiddleware({
    ttl: 1800, // 30分钟
    tags: ['product-recommend'],
    keyGenerator: (req) => `product:recommend:${req.params.userId}`
  }),
  async (req, res, next) => {
    const { userId } = req.params;

    // 尝试从缓存获取推荐
    const cached = await productCacheService.getUserRecommendations(userId);
    if (cached) {
      return res.json({
        success: true,
        data: cached
      });
    }

    // 模拟推荐算法
    const mockData = {
      userId,
      recommendations: [],
      reason: 'Based on your purchase history'
    };

    // 缓存推荐结果
    await productCacheService.setUserRecommendations(userId, mockData);

    res.json({
      success: true,
      data: mockData
    });
  }
);

// 获取商品价格（带缓存）
router.get('/items/:id/price',
  productCacheMiddleware({
    ttl: 60, // 1分钟
    tags: ['product-price'],
    keyGenerator: (req) => `product:price:${req.params.id}`
  }),
  async (req, res, next) => {
    const { id } = req.params;
    const { userLevel } = req.query;

    // 价格缓存时间很短，因为可能经常变动
    const cacheKey = `product:price:${id}:level:${userLevel || 'normal'}`;
    const cached = await cacheManager.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: cached
      });
    }

    // 模拟价格计算
    const mockData = {
      productId: id,
      basePrice: 0,
      userLevelPrice: 0,
      discount: 0
    };

    // 缓存价格
    await cacheManager.set(cacheKey, mockData, {
      ttl: 60,
      tags: ['product-price', `product:${id}`]
    });

    res.json({
      success: true,
      data: mockData
    });
  }
);

// 获取商品库存（带缓存）
router.get('/items/:id/stock',
  productCacheMiddleware({
    ttl: 30, // 30秒
    tags: ['product-stock'],
    keyGenerator: (req) => `product:stock:${req.params.id}`
  }),
  async (req, res, next) => {
    const { id } = req.params;

    // 库存缓存时间非常短
    const cacheKey = `product:stock:${id}`;
    const cached = await cacheManager.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: cached
      });
    }

    // 模拟库存查询
    const mockData = {
      productId: id,
      totalStock: 0,
      availableStock: 0,
      warehouseStock: 0
    };

    // 缓存库存
    await cacheManager.set(cacheKey, mockData, {
      ttl: 30,
      tags: ['product-stock', `product:${id}`]
    });

    res.json({
      success: true,
      data: mockData
    });
  }
);

// 创建商品（清除相关缓存）
router.post('/items',
  invalidateTagsMiddleware(['product-list', 'product-categories', 'product-search']),
  async (req, res, next) => {
    // 创建商品逻辑
    res.json({
      success: true,
      message: '商品创建成功'
    });
  }
);

// 更新商品（清除相关缓存）
router.put('/items/:id',
  invalidateTagsMiddleware(['product-list', 'product-detail', 'product-categories']),
  async (req, res, next) => {
    const { id } = req.params;

    // 清除特定商品的所有缓存
    await cacheManager.delPattern(`product:*:${id}:*`);
    await cacheManager.invalidateTags([`product:${id}`]);

    res.json({
      success: true,
      message: '商品更新成功'
    });
  }
);

// 删除商品（清除相关缓存）
router.delete('/items/:id',
  invalidateTagsMiddleware(['product-list', 'product-detail', 'product-categories']),
  async (req, res, next) => {
    const { id } = req.params;

    // 清除所有相关缓存
    await cacheManager.delPattern(`product:*:*:*${id}*`);
    await cacheManager.invalidateTags([`product:${id}`]);

    res.json({
      success: true,
      message: '商品删除成功'
    });
  }
);

// 更新商品状态（清除相关缓存）
router.put('/items/:id/status',
  invalidateTagsMiddleware(['product-list', 'product-detail', 'product-search']),
  async (req, res, next) => {
    const { id } = req.params;

    // 清除商品状态相关缓存
    await cacheManager.delPattern(`product:status:*:${id}`);
    await cacheManager.invalidateTags([`product:${id}`]);

    res.json({
      success: true,
      message: '商品状态更新成功'
    });
  }
);

// 批量更新商品状态
router.post('/items/batch-status',
  invalidateTagsMiddleware(['product-list', 'product-search']),
  async (req, res, next) => {
    const { productIds, status } = req.body;

    // 批量清除缓存
    for (const id of productIds) {
      await cacheManager.invalidateTags([`product:${id}`]);
    }

    res.json({
      success: true,
      message: `批量更新了${productIds.length}个商品的状态`
    });
  }
);

// 预热商品缓存
router.post('/cache/warmup-products',
  async (req, res, next) => {
    const { productIds, categories } = req.body;

    try {
      const warmupResults = {
        products: 0,
        categories: 0,
        failed: 0
      };

      // 预热商品详情
      if (Array.isArray(productIds)) {
        for (const id of productIds) {
          try {
            // 这里应该调用实际的产品服务
            await productCacheService.getProductDetail(id);
            warmupResults.products++;
          } catch (error) {
            warmupResults.failed++;
          }
        }
      }

      // 预热分类商品
      if (Array.isArray(categories)) {
        for (const categoryId of categories) {
          try {
            // 这里应该调用分类服务
            warmupResults.categories++;
          } catch (error) {
            warmupResults.failed++;
          }
        }
      }

      res.json({
        success: true,
        data: warmupResults,
        message: '商品缓存预热完成'
      });
    } catch (error) {
      logger.error('预热商品缓存失败:', error);
      res.status(500).json({
        success: false,
        error: '预热失败'
      });
    }
  }
);

// 获取商品缓存统计
router.get('/cache/stats/products',
  async (req, res, next) => {
    try {
      // 获取产品缓存统计
      const productCacheStats = await productCacheService.getCacheStats();

      res.json({
        success: true,
        data: productCacheStats
      });
    } catch (error) {
      logger.error('获取产品缓存统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取统计失败'
      });
    }
  }
);

export default router;