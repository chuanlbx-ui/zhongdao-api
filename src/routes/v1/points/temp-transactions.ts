import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';

const router = Router();

// 临时简化版交易记录API
router.get('/simple', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 10, 100);

    // 使用最简单的查询，避免任何可能的阻塞
    const result = {
      success: true,
      data: {
        transactions: [],
        pagination: {
          currentPage: page,
          perPage: perPage,
          total: 0,
          totalPages: 0
        }
      },
      message: '临时简化版本 - 交易记录功能维护中'
    };

    res.json(result);
  } catch (error) {
    console.error('临时交易记录API错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

export default router;