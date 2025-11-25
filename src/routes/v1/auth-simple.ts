import { Router, Request, Response } from 'express';

const router = Router();

// 简单的异步处理包装器
const asyncHandler = (fn: any) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 登录状态检查接口
router.get('/status',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'authenticated',
        message: '认证模块正常工作',
        timestamp: new Date().toISOString()
      },
      message: '认证服务正常'
    });
  })
);

// 微信小程序登录接口（简化版）
router.post('/wechat-login',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { code } = req.body;

      console.log('收到微信登录请求', {
        code: code ? code.substring(0, 10) + '...' : 'no code'
      });

      // 模拟登录成功
      const mockUser = {
        id: 'mock_user_id',
        openid: 'mock_openid_' + Date.now(),
        nickname: '测试用户',
        avatarUrl: '',
        level: 'NORMAL',
        role: 'USER',
        status: 'ACTIVE',
        isNewUser: true
      };

      const mockTokens = {
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        expiresIn: '7d'
      };

      res.json({
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens
        },
        message: '模拟登录成功（开发模式）'
      });
    } catch (error) {
      console.error('微信登录失败', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '登录处理失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 登出接口
router.post('/logout',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: { message: '登出成功' },
      message: '已成功登出'
    });
  })
);

// Token刷新接口
router.post('/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      console.log('收到Token刷新请求');

      const newTokens = {
        accessToken: 'new_mock_access_token_' + Date.now(),
        refreshToken: 'new_mock_refresh_token_' + Date.now(),
        expiresIn: '7d'
      };

      res.json({
        success: true,
        data: newTokens,
        message: 'Token刷新成功（模拟）'
      });
    } catch (error) {
      console.error('Token刷新失败', error);

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token刷新失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

export default router;