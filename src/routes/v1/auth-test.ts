import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// 测试认证接口
router.post('/test',
  [
    body('token')
      .notEmpty()
      .withMessage('Token不能为空')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      res.json(createSuccessResponse(
        { message: '认证测试成功' },
        '测试接口正常工作'
      ));
    } catch (error) {
      logger.error('认证测试失败', {
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '测试失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

export default router;