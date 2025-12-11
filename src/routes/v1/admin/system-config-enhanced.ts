import { Router, Request, Response } from 'express';
import { PrismaClient, systemConfigs_type } from '@prisma/client';
import { authenticate, requirePermission } from '../../../shared/middleware/auth';
import { AuditService, AuditLogType, AuditLogLevel } from '../../../shared/services/admin/audit.service';
import { logger } from '../../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { body, query, param, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// 所有系统配置路由都需要认证
router.use(authenticate);

/**
 * 获取系统配置列表
 * GET /api/v1/admin/system-config-enhanced
 */
router.get('/',
  requirePermission('system:config'),
  [
    query('category').optional().isString(),
    query('type').optional().isIn(Object.values(systemConfigs_type)),
    query('isSystem').optional().isBoolean().toBoolean(),
    query('keyword').optional().isString(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const {
        category,
        type,
        isSystem,
        keyword,
        page = 1,
        limit = 50
      } = req.query as any;

      // 构建查询条件
      const where: any = {};

      if (category) where.category = category;
      if (type) where.type = type;
      if (isSystem !== undefined) where.isSystem = isSystem;

      if (keyword) {
        where.OR = [
          { key: { contains: keyword } },
          { description: { contains: keyword } }
        ];
      }

      // 查询系统配置
      const [total, configs] = await Promise.all([
        prisma.systemConfigs.count({ where }),
        prisma.systemConfigs.findMany({
          where,
          select: {
            id: true,
            key: true,
            value: true,
            description: true,
            category: true,
            type: true,
            lastModifiedBy: true,
            createdAt: true,
            updatedAt: true,
            isEditable: true,
            isSystem: true,
          },
          orderBy: { category: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        })
      ]);

      // 解析value值
      const formattedConfigs = configs.map(config => {
        let parsedValue;
        try {
          switch (config.type) {
            case 'JSON':
            case 'ARRAY':
              parsedValue = JSON.parse(config.value);
              break;
            case 'NUMBER':
              parsedValue = Number(config.value);
              break;
            case 'BOOLEAN':
              parsedValue = config.value === 'true';
              break;
            default:
              parsedValue = config.value;
          }
        } catch {
          parsedValue = config.value;
        }

        return {
          ...config,
          value: parsedValue,
        };
      });

      // 获取配置分类统计
      const categoryStats = await prisma.systemConfigs.groupBy({
        by: ['category'],
        _count: { id: true }
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'system',
        action: 'view_system_configs',
        description: '查看系统配置列表',
        details: { page, limit, total, filters: { category, type, isSystem, keyword } },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          configs: formattedConfigs,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          },
          categoryStats: categoryStats.map(stat => ({
            category: stat.category,
            count: stat._count.id
          }))
        })
      );
    } catch (error) {
      logger.error('获取系统配置列表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取系统配置列表失败'
        )
      );
    }
  }
);

/**
 * 获取系统配置详情
 * GET /api/v1/admin/system-config-enhanced/:key
 */
router.get('/:key',
  requirePermission('system:config'),
  [
    param('key').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { key } = req.params;

      // 获取配置详情
      const config = await prisma.systemConfigs.findUnique({
        where: { key },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          category: true,
          type: true,
          lastModifiedBy: true,
          createdAt: true,
          updatedAt: true,
          isEditable: true,
          isSystem: true,
        }
      });

      if (!config) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '系统配置不存在'
          )
        );
      }

      // 解析value值
      let parsedValue;
      try {
        switch (config.type) {
          case 'JSON':
          case 'ARRAY':
            parsedValue = JSON.parse(config.value);
            break;
          case 'NUMBER':
            parsedValue = Number(config.value);
            break;
          case 'BOOLEAN':
            parsedValue = config.value === 'true';
            break;
          default:
            parsedValue = config.value;
        }
      } catch {
        parsedValue = config.value;
      }

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'system',
        action: 'view_system_config',
        targetId: config.id,
        targetType: 'system_config',
        description: `查看系统配置：${key}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          config: {
            ...config,
            value: parsedValue,
          }
        })
      );
    } catch (error) {
      logger.error('获取系统配置详情失败', {
        error: error instanceof Error ? error.message : '未知错误',
        key: req.params.key,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取系统配置详情失败'
        )
      );
    }
  }
);

/**
 * 更新系统配置
 * PUT /api/v1/admin/system-config-enhanced/:key
 */
router.put('/:key',
  requirePermission('system:config'),
  [
    param('key').isString().notEmpty(),
    body('value').notEmpty(),
    body('remark').optional().isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { key } = req.params;
      const { value, remark } = req.body;

      // 检查配置是否存在且可编辑
      const existingConfig = await prisma.systemConfigs.findUnique({
        where: { key },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          category: true,
          type: true,
          isEditable: true,
          isSystem: true,
        }
      });

      if (!existingConfig) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '系统配置不存在'
          )
        );
      }

      if (!existingConfig.isEditable) {
        return res.status(403).json(
          createErrorResponse(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            '该配置不可编辑'
          )
        );
      }

      // 验证并格式化value
      let formattedValue: string;
      try {
        switch (existingConfig.type) {
          case 'JSON':
          case 'ARRAY':
            // 验证是否为有效的JSON
            formattedValue = typeof value === 'string' ? value : JSON.stringify(value);
            JSON.parse(formattedValue);
            break;
          case 'NUMBER':
            const numValue = Number(value);
            if (isNaN(numValue)) {
              throw new Error('必须是有效的数字');
            }
            formattedValue = numValue.toString();
            break;
          case 'BOOLEAN':
            if (typeof value === 'boolean') {
              formattedValue = value.toString();
            } else if (typeof value === 'string') {
              if (!['true', 'false'].includes(value.toLowerCase())) {
                throw new Error('必须是 true 或 false');
              }
              formattedValue = value.toLowerCase();
            } else {
              throw new Error('必须是布尔值');
            }
            break;
          default:
            formattedValue = String(value);
        }
      } catch (error) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            `值格式错误：${error instanceof Error ? error.message : '未知错误'}`
          )
        );
      }

      // 更新配置
      const updatedConfig = await prisma.systemConfigs.update({
        where: { key },
        data: {
          value: formattedValue,
          lastModifiedBy: req.user!.id,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          category: true,
          type: true,
          lastModifiedBy: true,
          updatedAt: true,
        }
      });

      // 记录变更历史
      await prisma.configChangeHistory.create({
        data: {
          id: `config_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          configId: updatedConfig.id,
          configKey: key,
          oldValue: existingConfig.value,
          newValue: formattedValue,
          changedBy: req.user!.id,
          changeReason: remark || '管理员更新配置',
          createdAt: new Date(),
        }
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.SYSTEM_CONFIG,
        level: existingConfig.isSystem ? AuditLogLevel.CRITICAL : AuditLogLevel.WARNING,
        module: 'system',
        action: 'update_system_config',
        targetId: updatedConfig.id,
        targetType: 'system_config',
        description: `更新系统配置：${key}`,
        details: {
          category: existingConfig.category,
          oldValue: existingConfig.value,
          newValue: formattedValue,
          remark,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          config: updatedConfig,
          message: '系统配置更新成功'
        })
      );
    } catch (error) {
      logger.error('更新系统配置失败', {
        error: error instanceof Error ? error.message : '未知错误',
        key: req.params.key,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '更新系统配置失败'
        )
      );
    }
  }
);

/**
 * 批量更新系统配置
 * PUT /api/v1/admin/system-config-enhanced/batch
 */
router.put('/batch',
  requirePermission('system:config'),
  [
    body('configs').isArray({ min: 1 }),
    body('configs.*.key').isString().notEmpty(),
    body('configs.*.value').notEmpty(),
    body('remark').optional().isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { configs, remark } = req.body;

      // 检查所有配置是否存在且可编辑
      const existingConfigs = await prisma.systemConfigs.findMany({
        where: {
          key: { in: configs.map((c: any) => c.key) },
          isEditable: true,
        },
        select: {
          id: true,
          key: true,
          value: true,
          type: true,
          category: true,
          isSystem: true,
        }
      });

      if (existingConfigs.length !== configs.length) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '部分配置不存在或不可编辑'
          )
        );
      }

      // 批量更新配置
      const updatePromises = configs.map(async (configUpdate: any) => {
        const existingConfig = existingConfigs.find(c => c.key === configUpdate.key);
        if (!existingConfig) return null;

        // 验证并格式化value
        let formattedValue: string;
        try {
          switch (existingConfig.type) {
            case 'JSON':
            case 'ARRAY':
              formattedValue = typeof configUpdate.value === 'string'
                ? configUpdate.value
                : JSON.stringify(configUpdate.value);
              JSON.parse(formattedValue);
              break;
            case 'NUMBER':
              const numValue = Number(configUpdate.value);
              if (isNaN(numValue)) throw new Error('必须是有效的数字');
              formattedValue = numValue.toString();
              break;
            case 'BOOLEAN':
              if (typeof configUpdate.value === 'boolean') {
                formattedValue = configUpdate.value.toString();
              } else if (typeof configUpdate.value === 'string') {
                if (!['true', 'false'].includes(configUpdate.value.toLowerCase())) {
                  throw new Error('必须是 true 或 false');
                }
                formattedValue = configUpdate.value.toLowerCase();
              } else {
                throw new Error('必须是布尔值');
              }
              break;
            default:
              formattedValue = String(configUpdate.value);
          }
        } catch (error) {
          throw new Error(`配置 ${configUpdate.key} 的值格式错误`);
        }

        // 更新配置
        const updated = await prisma.systemConfigs.update({
          where: { key: configUpdate.key },
          data: {
            value: formattedValue,
            lastModifiedBy: req.user!.id,
            updatedAt: new Date(),
          },
        });

        // 记录变更历史
        await prisma.configChangeHistory.create({
          data: {
            id: `config_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            configId: existingConfig.id,
            configKey: configUpdate.key,
            oldValue: existingConfig.value,
            newValue: formattedValue,
            changedBy: req.user!.id,
            changeReason: remark || '批量更新配置',
            createdAt: new Date(),
          }
        });

        return updated;
      });

      const results = await Promise.all(updatePromises);

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.BULK_OPERATION,
        level: AuditLogLevel.WARNING,
        module: 'system',
        action: 'batch_update_system_configs',
        description: `批量更新${results.length}个系统配置`,
        details: {
          configKeys: configs.map((c: any) => c.key),
          count: results.length,
          remark,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          message: '批量更新系统配置成功',
          updatedCount: results.length,
        })
      );
    } catch (error) {
      logger.error('批量更新系统配置失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '批量更新系统配置失败'
        )
      );
    }
  }
);

/**
 * 创建系统配置
 * POST /api/v1/admin/system-config-enhanced
 */
router.post('/',
  requirePermission('system:config'),
  [
    body('key').isString().notEmpty().matches(/^[a-zA-Z][a-zA-Z0-9_.]*$/),
    body('value').notEmpty(),
    body('description').isString().isLength({ min: 1, max: 500 }),
    body('category').isString().isLength({ min: 1, max: 50 }),
    body('type').isIn(Object.values(systemConfigs_type)),
    body('isSystem').optional().isBoolean(),
    body('isEditable').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const {
        key,
        value,
        description,
        category,
        type,
        isSystem = false,
        isEditable = true
      } = req.body;

      // 检查配置是否已存在
      const existingConfig = await prisma.systemConfigs.findUnique({
        where: { key }
      });

      if (existingConfig) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '配置键已存在'
          )
        );
      }

      // 验证并格式化value
      let formattedValue: string;
      try {
        switch (type) {
          case 'JSON':
          case 'ARRAY':
            formattedValue = typeof value === 'string' ? value : JSON.stringify(value);
            JSON.parse(formattedValue);
            break;
          case 'NUMBER':
            const numValue = Number(value);
            if (isNaN(numValue)) throw new Error('必须是有效的数字');
            formattedValue = numValue.toString();
            break;
          case 'BOOLEAN':
            if (typeof value === 'boolean') {
              formattedValue = value.toString();
            } else if (typeof value === 'string') {
              if (!['true', 'false'].includes(value.toLowerCase())) {
                throw new Error('必须是 true 或 false');
              }
              formattedValue = value.toLowerCase();
            } else {
              throw new Error('必须是布尔值');
            }
            break;
          default:
            formattedValue = String(value);
        }
      } catch (error) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            `值格式错误：${error instanceof Error ? error.message : '未知错误'}`
          )
        );
      }

      // 创建配置
      const newConfig = await prisma.systemConfigs.create({
        data: {
          key,
          value: formattedValue,
          description,
          category,
          type,
          isSystem,
          isEditable,
          lastModifiedBy: req.user!.id,
        },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          category: true,
          type: true,
          isSystem: true,
          isEditable: true,
          createdAt: true,
        }
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.CREATE,
        level: isSystem ? AuditLogLevel.CRITICAL : AuditLogLevel.WARNING,
        module: 'system',
        action: 'create_system_config',
        targetId: newConfig.id,
        targetType: 'system_config',
        description: `创建系统配置：${key}`,
        details: {
          category,
          type,
          value: formattedValue,
          isSystem,
          isEditable,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          config: newConfig,
          message: '系统配置创建成功'
        })
      );
    } catch (error) {
      logger.error('创建系统配置失败', {
        error: error instanceof Error ? error.message : '未知错误',
        key: req.body.key,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '创建系统配置失败'
        )
      );
    }
  }
);

/**
 * 获取配置变更历史
 * GET /api/v1/admin/system-config-enhanced/:key/history
 */
router.get('/:key/history',
  requirePermission('system:config'),
  [
    param('key').isString().notEmpty(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { key } = req.params;
      const { page = 1, limit = 20 } = req.query as any;

      // 检查配置是否存在
      const config = await prisma.systemConfigs.findUnique({
        where: { key },
        select: { id: true, key: true, description: true }
      });

      if (!config) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '系统配置不存在'
          )
        );
      }

      // 查询变更历史
      const [total, history] = await Promise.all([
        prisma.configChangeHistory.count({
          where: { configKey: key }
        }),
        prisma.configChangeHistory.findMany({
          where: { configKey: key },
          select: {
            id: true,
            oldValue: true,
            newValue: true,
            changedBy: true,
            changeReason: true,
            createdAt: true,
            admins: {
              select: {
                id: true,
                username: true,
                realName: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        })
      ]);

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.VIEW,
        level: AuditLogLevel.INFO,
        module: 'system',
        action: 'view_config_history',
        targetId: config.id,
        targetType: 'system_config',
        description: `查看配置变更历史：${key}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          config,
          history,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        })
      );
    } catch (error) {
      logger.error('获取配置变更历史失败', {
        error: error instanceof Error ? error.message : '未知错误',
        key: req.params.key,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '获取配置变更历史失败'
        )
      );
    }
  }
);

/**
 * 导出系统配置
 * GET /api/v1/admin/system-config-enhanced/export
 */
router.get('/export',
  requirePermission('system:config'),
  [
    query('category').optional().isString(),
    query('format').optional().isIn(['json', 'yaml']),
    query('includeSystem').optional().isBoolean().toBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const {
        category,
        format = 'json',
        includeSystem = false
      } = req.query as any;

      // 构建查询条件
      const where: any = {};
      if (category) where.category = category;
      if (!includeSystem) where.isSystem = false;

      // 获取配置
      const configs = await prisma.systemConfigs.findMany({
        where,
        select: {
          key: true,
          value: true,
          description: true,
          category: true,
          type: true,
        },
        orderBy: { category: 'asc' }
      });

      // 格式化配置
      const formattedConfigs: any = {};
      configs.forEach(config => {
        try {
          switch (config.type) {
            case 'JSON':
            case 'ARRAY':
              formattedConfigs[config.key] = JSON.parse(config.value);
              break;
            case 'NUMBER':
              formattedConfigs[config.key] = Number(config.value);
              break;
            case 'BOOLEAN':
              formattedConfigs[config.key] = config.value === 'true';
              break;
            default:
              formattedConfigs[config.key] = config.value;
          }
        } catch {
          formattedConfigs[config.key] = config.value;
        }
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.EXPORT,
        level: AuditLogLevel.WARNING,
        module: 'system',
        action: 'export_system_configs',
        description: `导出系统配置，格式：${format}`,
        details: { category, format, includeSystem, count: configs.length },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // 根据格式返回
      if (format === 'yaml') {
        // TODO: 使用yaml库转换
        res.json(
          createErrorResponse(
            ErrorCode.NOT_IMPLEMENTED,
            'YAML导出功能待实现'
          )
        );
      } else {
        res.json(
          createSuccessResponse({
            configs: formattedConfigs,
            exportedAt: new Date().toISOString(),
            count: configs.length,
          })
        );
      }
    } catch (error) {
      logger.error('导出系统配置失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '导出系统配置失败'
        )
      );
    }
  }
);

/**
 * 重置系统配置为默认值
 * POST /api/v1/admin/system-config-enhanced/:key/reset
 */
router.post('/:key/reset',
  requirePermission('system:config'),
  [
    param('key').isString().notEmpty(),
    body('reason').isString().isLength({ min: 1, max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '参数验证失败',
            errors.array()
          )
        );
      }

      const { key } = req.params;
      const { reason } = req.body;

      // 检查配置是否存在
      const config = await prisma.systemConfigs.findUnique({
        where: { key },
        select: {
          id: true,
          key: true,
          value: true,
          type: true,
          category: true,
          isSystem: true,
        }
      });

      if (!config) {
        return res.status(404).json(
          createErrorResponse(
            ErrorCode.NOT_FOUND,
            '系统配置不存在'
          )
        );
      }

      // 获取默认值（这里可以从预设的默认配置中获取）
      const defaultValue = getDefaultConfigValue(key);
      if (defaultValue === undefined) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '该配置没有默认值'
          )
        );
      }

      // 格式化默认值
      let formattedValue: string;
      try {
        switch (config.type) {
          case 'JSON':
          case 'ARRAY':
            formattedValue = typeof defaultValue === 'string'
              ? defaultValue
              : JSON.stringify(defaultValue);
            JSON.parse(formattedValue);
            break;
          default:
            formattedValue = String(defaultValue);
        }
      } catch (error) {
        return res.status(400).json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            '默认值格式错误'
          )
        );
      }

      // 更新配置
      const updatedConfig = await prisma.systemConfigs.update({
        where: { key },
        data: {
          value: formattedValue,
          lastModifiedBy: req.user!.id,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          key: true,
          value: true,
          updatedAt: true,
        }
      });

      // 记录变更历史
      await prisma.configChangeHistory.create({
        data: {
          id: `config_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          configId: config.id,
          configKey: key,
          oldValue: config.value,
          newValue: formattedValue,
          changedBy: req.user!.id,
          changeReason: `重置为默认值 - ${reason}`,
          createdAt: new Date(),
        }
      });

      // 记录审计日志
      await AuditService.log({
        adminId: req.user!.id,
        adminName: req.user!.nickname || req.user!.username,
        type: AuditLogType.SYSTEM_CONFIG,
        level: AuditLogLevel.CRITICAL,
        module: 'system',
        action: 'reset_system_config',
        targetId: config.id,
        targetType: 'system_config',
        description: `重置系统配置为默认值：${key}`,
        details: {
          oldValue: config.value,
          newValue: formattedValue,
          reason,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(
        createSuccessResponse({
          config: updatedConfig,
          message: '系统配置已重置为默认值'
        })
      );
    } catch (error) {
      logger.error('重置系统配置失败', {
        error: error instanceof Error ? error.message : '未知错误',
        key: req.params.key,
        adminId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '重置系统配置失败'
        )
      );
    }
  }
);

// 获取配置默认值的函数
function getDefaultConfigValue(key: string): any {
  const defaultConfigs: Record<string, any> = {
    // 用户级别配置
    'user.level.vip_threshold': 10,
    'user.level.star1_threshold': 50,
    'user.level.star2_threshold': 200,
    'user.level.star3_threshold': 500,
    'user.level.star4_threshold': 1000,
    'user.level.star5_threshold': 2000,
    'user.level.director_threshold': 5000,

    // 佣金配置
    'commission.rate.direct': 0.1,
    'commission.rate.indirect': 0.05,
    'commission.rate.team': 0.02,

    // 提现配置
    'withdraw.min_amount': 100,
    'withdraw.max_amount': 50000,
    'withdraw.fee_rate': 0.005,

    // 系统配置
    'system.maintenance_mode': false,
    'system.allow_registration': true,
    'system.default_user_level': 'NORMAL',

    // 积分配置
    'points.purchase_rate': 1,
    'points.refund_rate': 1,
    'points.expiry_days': 365,
  };

  return defaultConfigs[key];
}

export default router;