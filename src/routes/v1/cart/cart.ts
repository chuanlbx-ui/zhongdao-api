import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { createSuccessResponse } from '../../../shared/types/response';

const router = Router();

// 模拟购物车数据存储（实际项目中应使用数据库）
const cartStorage: Map<string, any[]> = new Map();

// 获取用户购物车
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  // 从存储中获取用户购物车
  let cartItems = cartStorage.get(userId) || [];

  // 如果购物车为空，返回一些示例数据
  if (cartItems.length === 0) {
    cartItems = [
      {
        id: '1',
        productId: '1',
        name: '智能手机 Pro Max',
        image: 'https://via.placeholder.com/80x80?text=Phone',
        spec: { id: '1', name: '深空灰 128GB', price: 4999 },
        quantity: 1,
        price: 4999,
        selected: true
      }
    ];
    cartStorage.set(userId, cartItems);
  }

  res.json(createSuccessResponse({
    items: cartItems,
    total: cartItems.length
  }, '获取购物车成功'));
}));

// 添加商品到购物车
router.post('/add', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  const { productId, name, image, spec, quantity = 1, price } = req.body;

  // 验证必填字段
  if (!productId || !name || !price) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: '缺少必要参数'
      }
    });
  }

  // 获取用户购物车
  let cartItems = cartStorage.get(userId) || [];

  // 检查商品是否已在购物车中
  const existingItemIndex = cartItems.findIndex(item =>
    item.productId === productId &&
    item.spec?.id === spec?.id
  );

  if (existingItemIndex >= 0) {
    // 如果已存在，增加数量
    cartItems[existingItemIndex].quantity += quantity;
  } else {
    // 添加新商品
    const newItem = {
      id: Date.now().toString(),
      productId,
      name,
      image: image || '/api/placeholder/80/80',
      spec: spec || { id: 'default', name: '默认规格', price },
      quantity,
      price,
      selected: true
    };
    cartItems.push(newItem);
  }

  // 保存到存储
  cartStorage.set(userId, cartItems);

  res.json(createSuccessResponse({
    items: cartItems,
    total: cartItems.length
  }, '添加到购物车成功'));
}));

// 更新购物车商品数量
router.put('/update/:itemId', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  if (quantity < 1) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_QUANTITY',
        message: '数量必须大于0'
      }
    });
  }

  const cartItems = cartStorage.get(userId) || [];
  const itemIndex = cartItems.findIndex(item => item.id === itemId);

  if (itemIndex < 0) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ITEM_NOT_FOUND',
        message: '商品不存在'
      }
    });
  }

  cartItems[itemIndex].quantity = quantity;
  cartStorage.set(userId, cartItems);

  res.json(createSuccessResponse(null, '更新数量成功'));
}));

// 删除购物车商品
router.delete('/remove/:itemId', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  const { itemId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  let cartItems = cartStorage.get(userId) || [];
  cartItems = cartItems.filter(item => item.id !== itemId);
  cartStorage.set(userId, cartItems);

  res.json(createSuccessResponse({
    items: cartItems,
    total: cartItems.length
  }, '删除商品成功'));
}));

// 清空购物车
router.delete('/clear', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  cartStorage.set(userId, []);

  res.json(createSuccessResponse(null, '清空购物车成功'));
}));

// 选择/取消选择商品
router.put('/select/:itemId', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  const { itemId } = req.params;
  const { selected } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  const cartItems = cartStorage.get(userId) || [];
  const itemIndex = cartItems.findIndex(item => item.id === itemId);

  if (itemIndex < 0) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ITEM_NOT_FOUND',
        message: '商品不存在'
      }
    });
  }

  cartItems[itemIndex].selected = selected;
  cartStorage.set(userId, cartItems);

  res.json(createSuccessResponse(null, selected ? '选择商品成功' : '取消选择成功'));
}));

// 全选/取消全选
router.put('/select-all', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  const { selected } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  const cartItems = cartStorage.get(userId) || [];
  cartItems.forEach(item => {
    item.selected = selected;
  });
  cartStorage.set(userId, cartItems);

  res.json(createSuccessResponse(null, selected ? '全选成功' : '取消全选成功'));
}));

export default router;