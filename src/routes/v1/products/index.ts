import { Router } from 'express';
import categoryRoutes from './categories';
import tagRoutes from './tags';
import productRoutes from './products';
import specRoutes from './specs';
import { getRecommendations, getHotProducts } from '../../../controllers/products';

const router = Router();

// 商品分类相关路由
router.use('/categories', categoryRoutes);

// 商品标签相关路由
router.use('/tags', tagRoutes);

// 推荐商品接口（不需要认证）
router.get('/recommendations', getRecommendations);

// 热门商品接口（不需要认证）
router.get('/hot', getHotProducts);

// 商品详情接口（简化版本，不需要认证）- 必须在所有需要认证的路由之前
router.get('/detail/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    console.log(`获取商品详情，ID: ${id}`);

    // 模拟商品数据库
    const mockProducts: Record<string, any> = {
      '1': {
        id: '1',
        name: '智能手机 Pro Max',
        description: '最新款智能手机，搭载强大的A17芯片，支持5G网络，拍照效果出色，电池续航持久。采用全面屏设计，支持Face ID面部识别。',
        basePrice: 4999,
        originalPrice: 5999,
        images: [
          'https://via.placeholder.com/400x400?text=Phone+1',
          'https://via.placeholder.com/400x400?text=Phone+2',
          'https://via.placeholder.com/400x400?text=Phone+3'
        ],
        stock: 100,
        sales: 2580,
        status: 'active',
        tags: ['热卖', '新品', '5G'],
        specs: [
          { id: '1', product_id: '1', name: '深空灰 128GB', price: 4999, stock: 50, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '2', product_id: '1', name: '银色 128GB', price: 4999, stock: 30, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '3', product_id: '1', name: '深空灰 256GB', price: 5799, stock: 20, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '4', product_id: '1', name: '银色 256GB', price: 5799, stock: 10, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ],
        category: '电子产品',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      '2': {
        id: '2',
        name: '蓝牙耳机 AirPods',
        description: '无线蓝牙耳机，音质出众，降噪效果显著。支持空间音频，续航时间长，是您音乐和通话的理想选择。',
        basePrice: 899,
        originalPrice: 1299,
        images: [
          'https://via.placeholder.com/400x400?text=AirPods+1',
          'https://via.placeholder.com/400x400?text=AirPods+2'
        ],
        stock: 150,
        sales: 3200,
        status: 'active',
        tags: ['热卖', '爆款', '降噪'],
        specs: [
          { id: '5', product_id: '2', name: '标准版', price: 899, stock: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '6', product_id: '2', name: 'Pro版', price: 1299, stock: 50, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ],
        category: '数码配件',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      '3': {
        id: '3',
        name: '运动鞋 Air Max',
        description: '舒适透气的运动鞋，采用先进缓震技术，适合各种运动场景。时尚外观设计，百搭各种服装风格。',
        basePrice: 699,
        originalPrice: 899,
        images: [
          'https://via.placeholder.com/400x400?text=Shoes+1',
          'https://via.placeholder.com/400x400?text=Shoes+2',
          'https://via.placeholder.com/400x400?text=Shoes+3'
        ],
        stock: 80,
        sales: 1850,
        status: 'active',
        tags: ['折扣', '热卖', '舒适'],
        specs: [
          { id: '7', product_id: '3', name: '黑色 40码', price: 699, stock: 20, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '8', product_id: '3', name: '黑色 42码', price: 699, stock: 20, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '9', product_id: '3', name: '白色 40码', price: 699, stock: 20, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '10', product_id: '3', name: '白色 42码', price: 699, stock: 20, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ],
        category: '运动装备',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };

    const product = mockProducts[id];

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: '商品不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      message: 'Success',
      data: product,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取商品详情失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取商品详情失败',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 商品列表接口（不需要认证的简化版本）
router.get('/list', async (req: any, res: any) => {
  try {
    const { page = 1, perPage = 10, category } = req.query;

    // 模拟商品数据
    const mockProducts = [
      {
        id: '1',
        name: '智能手机 Pro Max',
        basePrice: 4999,
        images: ['https://via.placeholder.com/300x300?text=Phone'],
        category: '电子产品',
        description: '最新款智能手机，性能卓越',
        sales: 2580,
        rating: 4.8,
        tags: ['热卖', '新品']
      },
      {
        id: '2',
        name: '蓝牙耳机 AirPods',
        basePrice: 899,
        images: ['https://via.placeholder.com/300x300?text=AirPods'],
        category: '数码配件',
        description: '无线蓝牙耳机，音质出众',
        sales: 3200,
        rating: 4.9,
        tags: ['热卖', '爆款']
      },
      {
        id: '3',
        name: '运动鞋 Air Max',
        basePrice: 699,
        images: ['https://via.placeholder.com/300x300?text=Shoes'],
        category: '运动装备',
        description: '舒适透气，时尚百搭',
        sales: 1850,
        rating: 4.7,
        tags: ['折扣', '热卖']
      }
    ];

    // 简单的分页处理
    const startIndex = (Number(page) - 1) * Number(perPage);
    const endIndex = startIndex + Number(perPage);
    const paginatedProducts = mockProducts.slice(startIndex, endIndex);

    res.json({
      success: true,
      message: 'Success',
      data: {
        items: paginatedProducts,
        pagination: {
          page: Number(page),
          perPage: Number(perPage),
          total: mockProducts.length,
          totalPages: Math.ceil(mockProducts.length / Number(perPage))
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取商品列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取商品列表失败',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 商品分类接口（简化版本，不需要认证）
router.get('/categories-simple', async (req: any, res: any) => {
  try {
    const mockCategories = [
      {
        id: '1',
        name: '电子产品',
        icon: '📱',
        count: 120
      },
      {
        id: '2',
        name: '数码配件',
        icon: '🎧',
        count: 85
      },
      {
        id: '3',
        name: '运动装备',
        icon: '👟',
        count: 63
      },
      {
        id: '4',
        name: '美妆护肤',
        icon: '💄',
        count: 96
      }
    ];

    res.json({
      success: true,
      message: 'Success',
      data: mockCategories,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取商品分类失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取商品分类失败',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 商品主表相关路由（需要认证）
router.use('/', productRoutes);

// 商品规格相关路由（需要认证）
router.use('/specs', specRoutes);

// API信息
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '商品管理模块 API',
      version: '1.0.0',
      endpoints: {
        categories: {
          'GET /products/categories/tree': '获取商品分类树',
          'GET /products/categories': '获取商品分类列表',
          'POST /products/categories': '创建商品分类',
          'PUT /products/categories/:id': '更新商品分类',
          'DELETE /products/categories/:id': '删除商品分类'
        },
        tags: {
          'GET /products/tags': '获取商品标签列表',
          'GET /products/tags/all': '获取所有商品标签（不分页）',
          'POST /products/tags': '创建商品标签',
          'PUT /products/tags/:id': '更新商品标签',
          'DELETE /products/tags/:id': '删除商品标签',
          'POST /products/tags/batch': '批量创建商品标签'
        },
        products: {
          'GET /products/items': '获取商品列表',
          'GET /products/items/:id': '获取商品详情',
          'POST /products/items': '创建商品',
          'PUT /products/items/:id': '更新商品',
          'DELETE /products/items/:id': '删除商品',
          'PUT /products/items/:id/status': '更新商品状态',
          'POST /products/items/batch-status': '批量更新商品状态'
        },
        specs: {
          'GET /products/specs': '获取商品规格列表',
          'GET /products/specs/:id': '获取规格详情',
          'POST /products/specs': '创建商品规格',
          'PUT /products/specs/:id': '更新商品规格',
          'PUT /products/specs/:id/status': '更新规格状态',
          'DELETE /products/specs/:id': '删除商品规格'
        }
      },
      timestamp: new Date().toISOString()
    }
  });
});

export default router;