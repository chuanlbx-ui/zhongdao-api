import { Router, Request, Response } from 'express';
import path from 'path';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// 监控页面路由
router.get('/page', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../../public/monitoring.html'));
});

// 简单的监控数据 API（模拟数据）
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // 模拟监控数据
    const mockData = {
      success: true,
      data: {
        summary: {
          system: {
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            disk: Math.random() * 100
          },
          performance: {
            requests: Math.floor(Math.random() * 1000),
            errors: Math.floor(Math.random() * 50),
            avgResponseTime: Math.floor(Math.random() * 200)
          },
          business: {
            activeUsers: Math.floor(Math.random() * 10000),
            orders: Math.floor(Math.random() * 1000),
            revenue: Math.floor(Math.random() * 100000)
          },
          alerts: {
            critical: Math.floor(Math.random() * 5),
            high: Math.floor(Math.random() * 10),
            medium: Math.floor(Math.random() * 20),
            low: Math.floor(Math.random() * 30)
          }
        },
        charts: {
          requests: {
            labels: ['5分钟前', '4分钟前', '3分钟前', '2分钟前', '1分钟前'],
            datasets: [{
              label: '请求数',
              data: Array.from({ length: 5 }, () => Math.floor(Math.random() * 100))
            }]
          }
        },
        timestamp: new Date().toISOString()
      }
    };

    res.json(mockData);
  } catch (error) {
    logger.error('获取监控数据失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取监控数据失败'
      }
    });
  }
});

export default router;