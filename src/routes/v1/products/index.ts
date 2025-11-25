import { Router } from 'express';
import categoryRoutes from './categories';
import tagRoutes from './tags';
import productRoutes from './products';
import specRoutes from './specs';

const router = Router();

// 商品分类相关路由
router.use('/categories', categoryRoutes);

// 商品标签相关路由
router.use('/tags', tagRoutes);

// 商品主表相关路由
router.use('/items', productRoutes);

// 商品规格相关路由
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