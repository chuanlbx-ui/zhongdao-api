/**
 * 参数配置管理 API (管理员专用)
 * 提供完整的参数管理功能，包括增删改查、历史记录、批量操作等
 */

import { Router, Request, Response } from 'express';
import { body, query, param } from 'express-validator';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { authenticate, requireMinLevel, requireRole } from '../../../shared/middleware/auth';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { configService } from '../../../modules/config';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// 测试路由
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Admin config routes are working!',
    timestamp: new Date().toISOString()
  });
});

// 所有配置管理接口都需要管理员权限
router.use(authenticate);
router.use(requireMinLevel('director'));

/**
 * 获取所有配置（分页）
 */
router.get('/configs',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    query('category').optional().isString().withMessage('分类必须是字符串'),
    query('key').optional().isString().withMessage('键名必须是字符串'),
    query('search').optional().isString().withMessage('搜索关键词必须是字符串')
  ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        perPage = 20,
        category,
        key,
        search
      } = req.query as any;

      const result = await configService.getAllConfigs({
        page: parseInt(page),
        perPage: parseInt(perPage),
        category,
        key,
        search
      });

      res.json(createSuccessResponse(result, '获取配置列表成功'));
    } catch (error) {
      logger.error('获取配置列表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取配置列表失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取单个配置详情
 */
router.get('/configs/:key',
  [
    param('key').notEmpty().withMessage('配置键名不能为空')
  ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { key } = req.params;

      const config = await configService.getConfigDetail(key);

      if (!config) {
        return res.status(404).json(createErrorResponse(
          'CONFIG_NOT_FOUND',
          '配置不存在',
          undefined,
          404
        ));
      }

      res.json(createSuccessResponse(config, '获取配置详情成功'));
    } catch (error) {
      logger.error('获取配置详情失败', {
        key: req.params.key,
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取配置详情失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 创建新配置
 */
router.post('/configs',
  [
    body('key').notEmpty().withMessage('配置键名不能为空')
      .matches(/^[a-z][a-z0-9_]*$/i).withMessage('键名格式不正确，应以字母开头，只能包含字母、数字和下划线'),
    body('value').notEmpty().withMessage('配置值不能为空'),
    body('category').notEmpty().withMessage('配置分类不能为空'),
    body('description').optional().isString().withMessage('描述必须是字符串'),
    body('dataType').optional().isIn(['string', 'number', 'boolean', 'json']).withMessage('数据类型不正确'),
      ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const {
        key,
        value,
        category,
        description,
        dataType = 'string'
      } = req.body;

      // 检查配置是否已存在
      const existingConfig = await configService.getConfig(key);
      if (existingConfig !== null) {
        return res.status(409).json(createErrorResponse(
          'CONFIG_EXISTS',
          '配置已存在',
          undefined,
          409
        ));
      }

      // 转换值的数据类型
      let convertedValue = value;
      try {
        if (dataType === 'number') {
          convertedValue = parseFloat(value);
        } else if (dataType === 'boolean') {
          convertedValue = value === 'true' || value === true;
        } else if (dataType === 'json') {
          convertedValue = typeof value === 'string' ? JSON.parse(value) : value;
        }
      } catch (parseError) {
        return res.status(400).json(createErrorResponse(
          'INVALID_VALUE',
          '配置值格式不正确',
          error instanceof Error ? error.message : '值转换失败'
        ));
      }

      const newConfig = await configService.createConfig({
        key,
        value: convertedValue,
        category,
        description,
        dataType,
        createdBy: req.user!.id
      });

      logger.info('管理员创建配置', {
        key,
        category,
        value: convertedValue,
        userId: req.user!.id
      });

      res.status(201).json(createSuccessResponse(newConfig, '创建配置成功'));
    } catch (error) {
      logger.error('创建配置失败', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '创建配置失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 更新配置
 */
router.put('/configs/:key',
  [
    param('key').notEmpty().withMessage('配置键名不能为空'),
    body('value').notEmpty().withMessage('配置值不能为空'),
    body('description').optional().isString().withMessage('描述必须是字符串'),
    body('reason').optional().isString().withMessage('修改原因必须是字符串')
  ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { value, description, reason } = req.body;

      // 检查配置是否存在
      const existingConfig = await configService.getConfigDetail(key);
      if (!existingConfig) {
        return res.status(404).json(createErrorResponse(
          'CONFIG_NOT_FOUND',
          '配置不存在',
          undefined,
          404
        ));
      }

      // 获取配置的数据类型
      const dataType = existingConfig.dataType || 'string';
      let convertedValue = value;

      try {
        if (dataType === 'number') {
          convertedValue = parseFloat(value);
        } else if (dataType === 'boolean') {
          convertedValue = value === 'true' || value === true;
        } else if (dataType === 'json') {
          convertedValue = typeof value === 'string' ? JSON.parse(value) : value;
        }
      } catch (parseError) {
        return res.status(400).json(createErrorResponse(
          'INVALID_VALUE',
          '配置值格式不正确',
          error instanceof Error ? error.message : '值转换失败'
        ));
      }

      const updatedConfig = await configService.updateConfig(key, convertedValue, {
        description: description || existingConfig.description,
        lastModifiedBy: req.user!.id,
        reason
      });

      logger.info('管理员更新配置', {
        key,
        oldValue: existingConfig.value,
        newValue: convertedValue,
        reason,
        userId: req.user!.id
      });

      res.json(createSuccessResponse(updatedConfig, '更新配置成功'));
    } catch (error) {
      logger.error('更新配置失败', {
        key: req.params.key,
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '更新配置失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 删除配置
 */
router.delete('/configs/:key',
  [
    param('key').notEmpty().withMessage('配置键名不能为空')
  ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { key } = req.params;

      // 检查配置是否存在
      const existingConfig = await configService.getConfigDetail(key);
      if (!existingConfig) {
        return res.status(404).json(createErrorResponse(
          'CONFIG_NOT_FOUND',
          '配置不存在',
          undefined,
          404
        ));
      }

      await configService.deleteConfig(key, req.user!.id);

      logger.info('管理员删除配置', {
        key,
        deletedValue: existingConfig.value,
        userId: req.user!.id
      });

      res.json(createSuccessResponse(null, '删除配置成功'));
    } catch (error) {
      logger.error('删除配置失败', {
        key: req.params.key,
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '删除配置失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取配置分类列表
 */
router.get('/categories',
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const categories = await configService.getCategories();

      res.json(createSuccessResponse(categories, '获取配置分类成功'));
    } catch (error) {
      logger.error('获取配置分类失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取配置分类失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 批量更新配置
 */
router.post('/configs/batch',
  [
    body('configs').isArray().withMessage('配置列表必须是数组'),
    body('configs.*.key').notEmpty().withMessage('配置键名不能为空'),
    body('configs.*.value').notEmpty().withMessage('配置值不能为空')
  ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { configs, reason } = req.body;

      const results = await configService.batchUpdateConfigs(configs, {
        lastModifiedBy: req.user!.id,
        reason
      });

      logger.info('管理员批量更新配置', {
        configCount: configs.length,
        successCount: results.success.length,
        failureCount: results.failure.length,
        reason,
        userId: req.user!.id
      });

      res.json(createSuccessResponse(results, '批量更新配置完成'));
    } catch (error) {
      logger.error('批量更新配置失败', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '批量更新配置失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取配置修改历史
 */
router.get('/configs/:key/history',
  [
    param('key').notEmpty().withMessage('配置键名不能为空'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('perPage').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量必须在1-50之间')
  ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { page = 1, perPage = 20 } = req.query as any;

      const history = await configService.getConfigHistory(key, {
        page: parseInt(page),
        perPage: parseInt(perPage)
      });

      res.json(createSuccessResponse(history, '获取配置历史成功'));
    } catch (error) {
      logger.error('获取配置历史失败', {
        key: req.params.key,
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取配置历史失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 导出配置
 */
router.get('/configs/export',
  [
    query('category').optional().isString().withMessage('分类必须是字符串'),
    query('format').optional().isIn(['json', 'csv']).withMessage('格式必须是json或csv')
  ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { category, format = 'json' } = req.query as any;

      const exportData = await configService.exportConfigs({
        category,
        format
      });

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="configs.json"');
        res.send(exportData);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="configs.csv"');
        res.send(exportData);
      }

      logger.info('管理员导出配置', {
        category,
        format,
        userId: req.user!.id
      });
    } catch (error) {
      logger.error('导出配置失败', {
        query: req.query,
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '导出配置失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 导入配置
 */
router.post('/configs/import',
  [
    body('configs').isArray().withMessage('配置数据必须是数组'),
    body('overwrite').optional().isBoolean().withMessage('覆盖标志必须是布尔值')
  ],
  validate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { configs, overwrite = false } = req.body;

      const result = await configService.importConfigs(configs, {
        overwrite,
        userId: req.user!.id
      });

      logger.info('管理员导入配置', {
        configCount: configs.length,
        successCount: result.success.length,
        failureCount: result.failure.length,
        overwrite,
        userId: req.user!.id
      });

      res.json(createSuccessResponse(result, '导入配置完成'));
    } catch (error) {
      logger.error('导入配置失败', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '导入配置失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;