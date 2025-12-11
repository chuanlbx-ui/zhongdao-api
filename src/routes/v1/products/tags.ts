import { Router } from 'express';
import * as expressValidator from 'express-validator';
const { body, query  } = expressValidator;
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';

const router = Router();

// 获取商品标签列表
router.get('/',
  authenticate,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('perPage')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须是1-100之间的整数'),
    query('search')
      .optional()
      .isLength({ max: 50 })
      .withMessage('搜索关键词长度不能超过50字符')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { page = 1, perPage = 20, search } = req.query;

    // 分页参数
    const pageNum = parseInt(page as string);
    const perPageNum = parseInt(perPage as string);
    const skip = (pageNum - 1) * perPageNum;

    // 构建查询条件
    const whereCondition: any = {};
    if (search) {
      whereCondition.OR = [
        {
          name: {
            contains: search as string,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search as string,
            mode: 'insensitive'
          }
        }
      ];
    }

    // 使用Prisma ORM查询
    const [tags, total] = await Promise.all([
      prisma.productTags.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          color: true,
          description: true,
          sort: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [
          { sort: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: perPageNum
      }),
      prisma.productTags.count({ where: whereCondition })
    ]);

    res.json(createSuccessResponse({
      tags: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        sort: tag.sort,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt
      })),
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        total,
        totalPages: total > 0 ? Math.ceil(total / perPageNum) : 0,
        hasNext: pageNum * perPageNum < total,
        hasPrev: pageNum > 1
      }
    }));
  })
);

// 获取所有商品标签（不分页，用于选择器）
router.get('/all',
  authenticate,
  asyncHandler(async (req, res) => {
    const tags = await prisma.productTags.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        sort: true
      },
      orderBy: [
        { sort: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json(createSuccessResponse({
      tags
    }, '获取所有商品标签成功'));
  })
);

// 创建商品标签
router.post('/',
  authenticate,
  [
    body('name')
      .notEmpty()
      .withMessage('标签名称不能为空')
      .isLength({ min: 1, max: 20 })
      .withMessage('标签名称长度必须在1-20字符之间'),
    body('color')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('颜色格式不正确，请使用十六进制格式（如：#FF0000）'),
    body('description')
      .optional()
      .isLength({ max: 100 })
      .withMessage('描述长度不能超过100字符'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须是非负整数')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, color, description, sort = 0 } = req.body;

    // 检查权限
    if (!req.user || !['DIRECTOR', 'STAR_5', 'STAR_4', 'STAR_3'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要三星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查标签名称是否重复
    const existingTag = await prisma.productTags.findUnique({
      where: { name }
    });

    if (existingTag) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'TAG_EXISTS',
          message: '标签名称已存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 创建标签
    const tag = await prisma.productTags.create({
      data: {
        name,
        color,
        description,
        sort
      }
    });

    res.status(201).json(createSuccessResponse({
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        sort: tag.sort,
        createdAt: tag.createdAt
      }
    }, '商品标签创建成功', 201));
  })
);

// 更新商品标签
router.put('/:id',
  authenticate,
  [
    body('name')
      .optional()
      .isLength({ min: 1, max: 20 })
      .withMessage('标签名称长度必须在1-20字符之间'),
    body('color')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('颜色格式不正确，请使用十六进制格式（如：#FF0000）'),
    body('description')
      .optional()
      .isLength({ max: 100 })
      .withMessage('描述长度不能超过100字符'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须是非负整数')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, color, description, sort } = req.body;

    // 检查权限
    if (!req.user || !['DIRECTOR', 'STAR_5', 'STAR_4', 'STAR_3'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要三星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查标签是否存在
    const existingTag = await prisma.productTags.findUnique({
      where: { id }
    });

    if (!existingTag) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TAG_NOT_FOUND',
          message: '商品标签不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 如果修改名称，检查是否重复
    if (name && name !== existingTag.name) {
      const duplicateTag = await prisma.productTags.findUnique({
        where: { name }
      });

      if (duplicateTag) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'TAG_EXISTS',
            message: '标签名称已存在',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 更新标签
    const updatedTag = await prisma.productTags.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color }),
        ...(description !== undefined && { description }),
        ...(sort !== undefined && { sort })
      }
    });

    res.json(createSuccessResponse({
      tag: {
        id: updatedTag.id,
        name: updatedTag.name,
        color: updatedTag.color,
        description: updatedTag.description,
        sort: updatedTag.sort,
        createdAt: updatedTag.createdAt,
        updatedAt: updatedTag.updatedAt
      }
    }, '商品标签更新成功'));
  })
);

// 删除商品标签
router.delete('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 检查权限
    if (!req.user || !['DIRECTOR', 'STAR_5', 'STAR_4'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要四星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查标签是否存在
    const tag = await prisma.productTags.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TAG_NOT_FOUND',
          message: '商品标签不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查是否有关联的商品
    if (tag._count.products > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_PRODUCTS',
          message: `该标签下还有 ${tag._count.products} 个商品，无法删除`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 删除标签
    await prisma.productTags.delete({
      where: { id }
    });

    res.json(createSuccessResponse(null, '商品标签删除成功'));
  })
);

// 批量创建商品标签
router.post('/batch',
  authenticate,
  [
    body('tags')
      .isArray({ min: 1, max: 20 })
      .withMessage('标签数量必须是1-20个'),
    body('tags.*.name')
      .notEmpty()
      .isLength({ min: 1, max: 20 })
      .withMessage('标签名称长度必须在1-20字符之间'),
    body('tags.*.color')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('颜色格式不正确'),
    body('tags.*.description')
      .optional()
      .isLength({ max: 100 })
      .withMessage('描述长度不能超过100字符')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { tags } = req.body;

    // 检查权限
    if (!req.user || !['DIRECTOR', 'STAR_5', 'STAR_4'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要四星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 提取所有标签名称
    const tagNames = tags.map((tag: any) => tag.name);

    // 检查已存在的标签
    const existingTags = await prisma.productTags.findMany({
      where: {
        name: {
          in: tagNames
        }
      },
      select: {
        name: true
      }
    });

    if (existingTags.length > 0) {
      const existingNames = existingTags.map(tag => tag.name);
      return res.status(409).json({
        success: false,
        error: {
          code: 'TAGS_EXIST',
          message: `以下标签名称已存在：${existingNames.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 批量创建标签
    const createdTags = await Promise.all(
      tags.map((tag: any) =>
        prisma.productTags.create({
          data: {
            name: tag.name,
            color: tag.color || null,
            description: tag.description || null,
            sort: tag.sort || 0
          }
        })
      )
    );

    res.status(201).json(createSuccessResponse({
      tags: createdTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        sort: tag.sort,
        createdAt: tag.createdAt
      }))
    }, `成功创建 ${createdTags.length} 个商品标签`, 201));
  })
);

export default router;