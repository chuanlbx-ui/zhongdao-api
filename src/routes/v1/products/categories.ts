import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';

const router = Router();

// 获取商品分类树（支持多级）
router.get('/tree',
  authenticate,
  asyncHandler(async (req, res) => {
    // 获取所有启用的分类
    const categories = await prisma.productCategory.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        parentId: true,
        level: true,
        sort: true,
        icon: true,
        description: true,
        createdAt: true
      },
      orderBy: [
        { level: 'asc' },
        { sort: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // 构建树形结构
    const buildTree = (items: any[], parentId: string | null = null): any[] => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          id: item.id,
          name: item.name,
          level: item.level,
          sort: item.sort,
          icon: item.icon,
          description: item.description,
          createdAt: item.createdAt,
          children: buildTree(items, item.id)
        }));
    };

    const tree = buildTree(categories);

    res.json(createSuccessResponse({
      categories: tree,
      total: categories.length
    }, '获取商品分类树成功'));
  })
);

// 获取商品分类列表（平铺）
router.get('/',
  authenticate,
  [
    query('level')
      .optional()
      .isInt({ min: 1, max: 3 })
      .withMessage('分类层级必须是1-3之间的整数'),
    query('parentId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('父分类ID格式不正确'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('perPage')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须是1-100之间的整数')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { level, parentId, page = 1, perPage = 50 } = req.query;

    // 分页参数
    const pageNum = parseInt(page as string);
    const perPageNum = parseInt(perPage as string);
    const skip = (pageNum - 1) * perPageNum;

    // 构建查询条件
    const where: any = {
      isActive: true
    };

    if (level) {
      where.level = parseInt(level as string);
    }

    if (parentId) {
      where.parentId = parentId as string;
    } else if (level && level !== '1') {
      // 如果指定了层级但不是第一级，则必须指定父分类
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: '查询非第一级分类时必须指定父分类ID',
          timestamp: new Date().toISOString()
        }
      });
    }

    const [categories, total] = await Promise.all([
      prisma.productCategory.findMany({
        where,
        select: {
          id: true,
          name: true,
          parentId: true,
          level: true,
          sort: true,
          icon: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          parent: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              children: true,
              products: true
            }
          }
        },
        orderBy: [
          { sort: 'asc' },
          { createdAt: 'asc' }
        ],
        skip,
        take: perPageNum
      }),
      prisma.productCategory.count({ where })
    ]);

    res.json(createSuccessResponse({
      categories: categories.map(category => ({
        ...category,
        childrenCount: category._count.children,
        productsCount: category._count.products,
        _count: undefined
      })),
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        total,
        totalPages: Math.ceil(total / perPageNum),
        hasNext: pageNum < Math.ceil(total / perPageNum),
        hasPrev: pageNum > 1
      }
    }));
  })
);

// 创建商品分类
router.post('/',
  authenticate,
  [
    body('name')
      .notEmpty()
      .withMessage('分类名称不能为空')
      .isLength({ min: 1, max: 50 })
      .withMessage('分类名称长度必须在1-50字符之间'),
    body('parentId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('父分类ID格式不正确'),
    body('level')
      .isInt({ min: 1, max: 3 })
      .withMessage('分类层级必须是1-3之间的整数'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须是非负整数'),
    body('icon')
      .optional()
      .isURL()
      .withMessage('图标URL格式不正确'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('描述长度不能超过200字符')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, parentId, level, sort = 0, icon, description } = req.body;

    // 检查权限（管理员权限）
    if (!req.user || !['director', 'star_5', 'star_4'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要管理员权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 验证层级和父分类的关系
    if (level > 1 && !parentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: '创建子分类必须指定父分类',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (parentId) {
      const parentCategory = await prisma.productCategory.findUnique({
        where: { id: parentId }
      });

      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PARENT_NOT_FOUND',
            message: '父分类不存在',
            timestamp: new Date().toISOString()
          }
        });
      }

      if (parentCategory.level !== level - 1) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LEVEL',
            message: '分类层级不正确',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 检查同级分类名称是否重复
    const existingCategory = await prisma.productCategory.findFirst({
      where: {
        name,
        parentId: parentId || null,
        isActive: true
      }
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CATEGORY_EXISTS',
          message: '同级分类名称已存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 创建分类
    const category = await prisma.productCategory.create({
      data: {
        name,
        parentId,
        level,
        sort,
        icon,
        description
      }
    });

    res.status(201).json(createSuccessResponse({
      category: {
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        level: category.level,
        sort: category.sort,
        icon: category.icon,
        description: category.description,
        isActive: category.isActive,
        createdAt: category.createdAt
      }
    }, '商品分类创建成功', 201));
  })
);

// 更新商品分类
router.put('/:id',
  authenticate,
  [
    body('name')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('分类名称长度必须在1-50字符之间'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须是非负整数'),
    body('icon')
      .optional()
      .isURL()
      .withMessage('图标URL格式不正确'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('描述长度不能超过200字符'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('状态必须是布尔值')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, sort, icon, description, isActive } = req.body;

    // 检查权限
    if (!req.user || !['director', 'star_5', 'star_4'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要管理员权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查分类是否存在
    const existingCategory = await prisma.productCategory.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: '商品分类不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 如果修改名称，检查同级是否重复
    if (name && name !== existingCategory.name) {
      const duplicateCategory = await prisma.productCategory.findFirst({
        where: {
          name,
          parentId: existingCategory.parentId,
          isActive: true,
          id: { not: id }
        }
      });

      if (duplicateCategory) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CATEGORY_EXISTS',
            message: '同级分类名称已存在',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 更新分类
    const updatedCategory = await prisma.productCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(sort !== undefined && { sort }),
        ...(icon !== undefined && { icon }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(createSuccessResponse({
      category: {
        id: updatedCategory.id,
        name: updatedCategory.name,
        parentId: updatedCategory.parentId,
        level: updatedCategory.level,
        sort: updatedCategory.sort,
        icon: updatedCategory.icon,
        description: updatedCategory.description,
        isActive: updatedCategory.isActive,
        createdAt: updatedCategory.createdAt,
        updatedAt: updatedCategory.updatedAt
      }
    }, '商品分类更新成功'));
  })
);

// 删除商品分类（软删除）
router.delete('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 检查权限
    if (!req.user || !['director', 'star_5'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要高级管理员权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查分类是否存在
    const category = await prisma.productCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: {
              where: { isActive: true }
            },
            products: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: '商品分类不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查是否有子分类
    if (category._count.children > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_CHILDREN',
          message: '该分类下还有子分类，无法删除',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查是否有商品
    if (category._count.products > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_PRODUCTS',
          message: '该分类下还有商品，无法删除',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 软删除（设置为不活跃）
    await prisma.productCategory.update({
      where: { id },
      data: { isActive: false }
    });

    res.json(createSuccessResponse(null, '商品分类删除成功'));
  })
);

export default router;