import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../../../shared/types/response';
import {
  NotificationCategory,
  NotificationPriority
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 获取通知模板列表
 */
export const getNotificationTemplatesController = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      perPage = 20,
      category,
      isActive,
      isSystem,
      search
    } = req.query;

    // 构建查询条件
    const where: any = {};

    if (category) where.category = category as NotificationCategory;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (isSystem !== undefined) where.isSystem = isSystem === 'true';

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
        { title: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // 查询模板列表
    const [templates, total] = await Promise.all([
      prisma.notificationsTemplate.findMany({
        where,
        orderBy: [
          { isSystem: 'desc' },
          { category: 'asc' },
          { createdAt: 'desc' }
        ],
        skip: (Number(page) - 1) * Number(perPage),
        take: Number(perPage),
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          title: true,
          variables: true,
          enabledChannels: true,
          defaultChannels: true,
          isSystem: true,
          isActive: true,
          priority: true,
          dailyLimit: true,
          rateLimit: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.notificationsTemplate.count({ where })
    ]);

    // 转换数据格式
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      code: template.code,
      name: template.name,
      category: template.category,
      title: template.title,
      variables: template.variables ? JSON.parse(template.variables) : {},
      enabledChannels: JSON.parse(template.enabledChannels),
      defaultChannels: JSON.parse(template.defaultChannels),
      isSystem: template.isSystem,
      isActive: template.isActive,
      priority: template.priority,
      dailyLimit: template.dailyLimit,
      rateLimit: template.rateLimit,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        templates: formattedTemplates,
        pagination: {
          page: Number(page),
          perPage: Number(perPage),
          total,
          totalPages: Math.ceil(total / Number(perPage))
        }
      },
      message: '获取通知模板列表成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取通知模板列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取通知模板列表失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 获取通知模板详情
 */
export const getNotificationTemplateByIdController = async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;

    const template = await prisma.notificationsTemplate.findUnique({
      where: { id: templateId },
      include: {
        _count: {
          select: {
            notifications: true
          }
        }
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: '通知模板不存在'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 转换数据格式
    const formattedTemplate = {
      id: template.id,
      code: template.code,
      name: template.name,
      category: template.category,
      title: template.title,
      content: template.content,
      variables: template.variables ? JSON.parse(template.variables) : {},
      enabledChannels: JSON.parse(template.enabledChannels),
      defaultChannels: JSON.parse(template.defaultChannels),
      isSystem: template.isSystem,
      isActive: template.isActive,
      priority: template.priority,
      dailyLimit: template.dailyLimit,
      rateLimit: template.rateLimit,
      usageCount: template._count.notifications,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    };

    const response: ApiResponse = {
      success: true,
      data: { template: formattedTemplate },
      message: '获取通知模板详情成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取通知模板详情失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取通知模板详情失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 创建通知模板
 */
export const createNotificationTemplateController = async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      category,
      title,
      content,
      variables,
      enabledChannels,
      defaultChannels,
      isSystem = false,
      isActive = true,
      priority = 'NORMAL',
      dailyLimit,
      rateLimit
    } = req.body;

    // 验证必要参数
    if (!code || !name || !category || !title || !content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: '模板代码、名称、分类、标题和内容不能为空'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 检查模板代码是否已存在
    const existingTemplate = await prisma.notificationsTemplate.findUnique({
      where: { code }
    });

    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'TEMPLATE_CODE_EXISTS',
          message: '模板代码已存在'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 创建模板
    const template = await prisma.notificationsTemplate.create({
      data: {
        code,
        name,
        category: category as NotificationCategory,
        title,
        content,
        variables: JSON.stringify(variables || {}),
        enabledChannels: JSON.stringify(enabledChannels || ['IN_APP']),
        defaultChannels: JSON.stringify(defaultChannels || ['IN_APP']),
        isSystem,
        isActive,
        priority: priority as NotificationPriority,
        dailyLimit,
        rateLimit
      }
    });

    const response: ApiResponse = {
      success: true,
      data: {
        template: {
          id: template.id,
          code: template.code,
          name: template.name,
          category: template.category,
          title: template.title,
          content: template.content,
          variables: template.variables ? JSON.parse(template.variables) : {},
          enabledChannels: JSON.parse(template.enabledChannels),
          defaultChannels: JSON.parse(template.defaultChannels),
          isSystem: template.isSystem,
          isActive: template.isActive,
          priority: template.priority,
          dailyLimit: template.dailyLimit,
          rateLimit: template.rateLimit,
          createdAt: template.createdAt
        }
      },
      message: '通知模板创建成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('创建通知模板失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '创建通知模板失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 更新通知模板
 */
export const updateNotificationTemplateController = async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const updateData = req.body;

    // 检查模板是否存在
    const existingTemplate = await prisma.notificationsTemplate.findUnique({
      where: { id: templateId }
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: '通知模板不存在'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 如果更新代码，检查是否与其他模板冲突
    if (updateData.code && updateData.code !== existingTemplate.code) {
      const codeConflict = await prisma.notificationsTemplate.findUnique({
        where: { code: updateData.code }
      });

      if (codeConflict) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'TEMPLATE_CODE_EXISTS',
            message: '模板代码已存在'
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // 处理JSON字段
    const processedData: any = { ...updateData };
    if (updateData.variables) {
      processedData.variables = JSON.stringify(updateData.variables);
    }
    if (updateData.enabledChannels) {
      processedData.enabledChannels = JSON.stringify(updateData.enabledChannels);
    }
    if (updateData.defaultChannels) {
      processedData.defaultChannels = JSON.stringify(updateData.defaultChannels);
    }

    // 更新模板
    const template = await prisma.notificationsTemplate.update({
      where: { id: templateId },
      data: processedData
    });

    const response: ApiResponse = {
      success: true,
      data: {
        template: {
          id: template.id,
          code: template.code,
          name: template.name,
          category: template.category,
          title: template.title,
          content: template.content,
          variables: template.variables ? JSON.parse(template.variables) : {},
          enabledChannels: JSON.parse(template.enabledChannels),
          defaultChannels: JSON.parse(template.defaultChannels),
          isSystem: template.isSystem,
          isActive: template.isActive,
          priority: template.priority,
          dailyLimit: template.dailyLimit,
          rateLimit: template.rateLimit,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt
        }
      },
      message: '通知模板更新成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('更新通知模板失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新通知模板失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 删除通知模板
 */
export const deleteNotificationTemplateController = async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;

    // 检查模板是否存在
    const existingTemplate = await prisma.notificationsTemplate.findUnique({
      where: { id: templateId }
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: '通知模板不存在'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 检查是否为系统模板
    if (existingTemplate.isSystem) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CANNOT_DELETE_SYSTEM_TEMPLATE',
          message: '系统模板不能删除'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 检查模板是否被使用
    const usageCount = await prisma.notifications.count({
      where: { templateId }
    });

    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'TEMPLATE_IN_USE',
          message: `模板已被使用 ${usageCount} 次，不能删除`
        },
        timestamp: new Date().toISOString()
      });
    }

    // 删除模板
    await prisma.notificationsTemplate.delete({
      where: { id: templateId }
    });

    const response: ApiResponse = {
      success: true,
      data: null,
      message: '通知模板删除成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('删除通知模板失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除通知模板失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};