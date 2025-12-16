import { Request, Response } from 'express';
import { success, error } from '../utils/response';

// 模拟商品数据
const mockProducts = [
  {
    _id: '1',
    name: '智能手机 Pro Max',
    price: 4999.00,
    images: ['https://via.placeholder.com/300x300?text=Phone'],
    category: '电子产品',
    sales: 2580,
    views: 15200,
    rating: 4.8,
    tags: ['热卖', '新品']
  },
  {
    _id: '2',
    name: '蓝牙耳机 AirPods',
    price: 899.00,
    images: ['https://via.placeholder.com/300x300?text=AirPods'],
    category: '数码配件',
    sales: 3200,
    views: 18500,
    rating: 4.9,
    tags: ['热卖', '爆款']
  },
  {
    _id: '3',
    name: '运动鞋 Air Max',
    price: 699.00,
    images: ['https://via.placeholder.com/300x300?text=Shoes'],
    category: '运动装备',
    sales: 1850,
    views: 9800,
    rating: 4.7,
    tags: ['折扣', '热卖']
  },
  {
    _id: '4',
    name: '智能手表 Watch 5',
    price: 1999.00,
    images: ['https://via.placeholder.com/300x300?text=Watch'],
    category: '电子产品',
    sales: 1200,
    views: 7600,
    rating: 4.6,
    tags: ['新品']
  },
  {
    _id: '5',
    name: '护肤套装',
    price: 299.00,
    images: ['https://via.placeholder.com/300x300?text=Skincare'],
    category: '美妆护肤',
    sales: 3500,
    views: 21000,
    rating: 4.8,
    tags: ['热卖', '折扣']
  }
];

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  category: string;
  sales: number;
  views: number;
  rating?: number;
  tags?: string[];
}

// 获取推荐商品
export const getRecommendations = async (req: Request, res: Response) => {
  try {
    console.log('📡 获取推荐商品请求');

    // 返回模拟数据
    const shuffled = [...mockProducts].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 6);

    console.log(`✅ 返回 ${selected.length} 个推荐商品`);

    return success(res, {
      message: '为你推荐',
      products: selected,
      total: selected.length,
      type: 'recommendations'
    });

  } catch (err) {
    console.error('❌ 获取推荐商品失败:', err);
    return error(res, '获取推荐商品失败', 500);
  }
};

// 获取热门商品
export const getHotProducts = async (req: Request, res: Response) => {
  try {
    console.log('📡 获取热门商品请求');

    // 返回模拟数据，按销量排序
    const hotProducts = [...mockProducts].sort((a, b) => b.sales - a.sales);

    return success(res, {
      message: '热门商品',
      products: hotProducts,
      total: hotProducts.length
    });

  } catch (err) {
    console.error('❌ 获取热门商品失败:', err);
    return error(res, '获取热门商品失败', 500);
  }
};

// 导出控制器
export const productsController = {
  getRecommendations,
  getHotProducts
};