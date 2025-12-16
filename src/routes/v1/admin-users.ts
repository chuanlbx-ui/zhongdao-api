import { Router, Request, Response } from 'express';
const router = Router();

/**
 * 获取用户列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('📍 API /admin/users 被调用');

    // 简单返回一些测试数据
    const mockUsers = [
      { id: '1', nickname: '张三', phone: '13800138001', level: 'VIP', pointsBalance: 1000, createdAt: new Date() },
      { id: '2', nickname: '李四', phone: '13800138002', level: 'STAR_1', pointsBalance: 3200, createdAt: new Date() },
      { id: '3', nickname: '王五', phone: '13800138003', level: 'STAR_2', pointsBalance: 8500, createdAt: new Date() },
    ];

    res.json({
      success: true,
      data: {
        items: mockUsers,
        total: 3,
        page: 1,
        perPage: 20
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取用户列表失败'
      }
    });
  }
});

/**
 * 创建用户
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('📍 创建用户被调用:', req.body);

    const newUser = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('✅ 用户创建成功:', newUser);

    res.json({
      success: true,
      data: newUser,
      message: '用户创建成功'
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '创建用户失败'
      }
    });
  }
});

export default router;