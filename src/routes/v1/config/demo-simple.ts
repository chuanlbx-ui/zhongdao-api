/**
 * 参数配置模块简化演示（无需CSRF的GET请求）
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../shared/middleware/error';
import { createSuccessResponse } from '../../../shared/types/response';
import { configService } from '../../../modules/config';

const router = Router();

/**
 * 简化演示：动态修改配置参数（GET请求，仅用于演示）
 * 注意：生产环境中应该使用POST + CSRF + 权限验证
 */
router.get('/demo-update-config/:key/:value', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { key, value } = req.params;

    // 将字符串值转换为适当的类型
    let parsedValue: any = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);

    // 获取当前值
    const oldValue = await configService.getConfig(key);

    // 更新配置
    await configService.updateConfig(key, parsedValue, {
      lastModifiedBy: 'demo_user'
    });

    // 验证更新
    const newValue = await configService.getConfig(key);

    const result = {
      key,
      oldValue,
      newValue,
      timestamp: new Date().toISOString(),
      message: `配置参数 ${key} 已从 ${oldValue} 更新为 ${newValue}`
    };

    res.json(createSuccessResponse(result, '配置参数动态更新演示（GET简化版）'));
  } catch (error) {
    res.status(500).json(createSuccessResponse({
      error: error instanceof Error ? error.message : '未知错误',
      message: '配置更新失败（这是演示环境，实际生产环境需要更严格的权限控制）'
    }, '配置更新失败'));
  }
}));

export default router;