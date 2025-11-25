import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';

const router = Router();

// 生成商品编码
const generateProductCode = async (): Promise<string> => {
  const prefix = 'A'; // 1位大写字母
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const code = prefix + random;

  // 检查是否重复
  const exists = await prisma.product.findUnique({
    where: { code }
  });

  if (exists) {
    return generateProductCode(); // 递归重试
  }

  return code;
};

// 生成SKU
const generateSKU = async (): Promise<string> => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sku = 'PRD';
  for (let i = 0; i < 9; i++) {
    sku += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // 检查是否重复
  const exists = await prisma.product.findUnique({
    where: { sku }
  });

  if (exists) {
    return generateSKU(); // 递归重试
  }

  return sku;
};

// 获取商品列表
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
    query('categoryId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('分类ID格式不正确'),
    query('status')
      .optional()
      .isIn(['active', 'inactive', 'presale', 'out_of_stock'])
      .withMessage('状态值不正确'),
    query('search')
      .optional()
      .isLength({ max: 100 })
      .withMessage('搜索关键词长度不能超过100字符'),
    query('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('推荐状态必须是布尔值')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { page = 1, perPage = 20, categoryId, status, search, isFeatured } = req.query;

    // 分页参数
    const pageNum = parseInt(page as string);
    const perPageNum = parseInt(perPage as string);
    const skip = (pageNum - 1) * perPageNum;

    // 构建查询条件
    const where: any = {};

    if (categoryId) {
      where.categoryId = categoryId as string;
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured === 'true';
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search as string
          }
        },
        {
          description: {
            contains: search as string
          }
        },
        {
          code: {
            contains: search as string
          }
        },
        {
          sku: {
            contains: search as string
          }
        }
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          code: true,
          sku: true,
          basePrice: true,
          totalStock: true,
          minStock: true,
          status: true,
          isFeatured: true,
          sort: true,
          images: true,
          videoUrl: true,
          scheduleOnAt: true,
          scheduleOffAt: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              name: true,
              level: true
            }
          },
          shop: {
            select: {
              id: true,
              shopName: true
            }
          },
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  color: true
                }
              }
            }
          },
          specs: {
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              stock: true,
              isActive: true
            }
          },
          _count: {
            select: {
              specs: true
            }
          }
        },
        orderBy: [
          { sort: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: perPageNum
      }),
      prisma.product.count({ where })
    ]);

    res.json(createSuccessResponse({
      products: products.map(product => ({
        ...product,
        tags: product.tags.map(pt => pt.tag),
        specsCount: product._count.specs,
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

// 获取商品详情
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        code: true,
        sku: true,
        basePrice: true,
        totalStock: true,
        minStock: true,
        status: true,
        isFeatured: true,
        sort: true,
        images: true,
        videoUrl: true,
        details: true,
        scheduleOnAt: true,
        scheduleOffAt: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            level: true,
            parent: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        shop: {
          select: {
            id: true,
            shopName: true,
            shopType: true
          }
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
                description: true
              }
            }
          }
        },
        specs: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            stock: true,
            minStock: true,
            images: true,
            isActive: true,
            sort: true,
            createdAt: true
          },
          orderBy: [
            { sort: 'asc' },
            { createdAt: 'asc' }
          ]
        },
        pricings: {
          select: {
            id: true,
            specId: true,
            userLevel: true,
            price: true
          },
          orderBy: [
            { specId: 'asc' },
            { userLevel: 'asc' }
          ]
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: '商品不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json(createSuccessResponse({
      product: {
        ...product,
        tags: product.tags.map(pt => pt.tag)
      }
    }, '获取商品详情成功'));
  })
);

// 创建商品
router.post('/',
  authenticate,
  [
    body('name')
      .notEmpty()
      .withMessage('商品名称不能为空')
      .isLength({ min: 1, max: 200 })
      .withMessage('商品名称长度必须在1-200字符之间'),
    body('description')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('商品描述长度不能超过2000字符'),
    body('categoryId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('分类ID不能为空'),
    body('basePrice')
      .isFloat({ min: 0 })
      .withMessage('基础价格必须是非负数'),
    body('totalStock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('库存数量必须是非负整数'),
    body('minStock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('最低库存必须是非负整数'),
    body('images')
      .optional()
      .isArray()
      .withMessage('商品图片必须是数组格式'),
    body('details')
      .optional()
      .isObject()
      .withMessage('商品详细信息必须是对象格式'),
    body('tagIds')
      .optional()
      .isArray()
      .withMessage('标签ID列表必须是数组格式'),
    body('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('推荐状态必须是布尔值'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须是非负整数'),
    body('scheduleOnAt')
      .optional()
      .isISO8601()
      .withMessage('定时上架时间格式不正确'),
    body('scheduleOffAt')
      .optional()
      .isISO8601()
      .withMessage('定时下架时间格式不正确')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      categoryId,
      basePrice,
      totalStock = 0,
      minStock = 10,
      images = [],
      details,
      tagIds = [],
      isFeatured = false,
      sort = 0,
      scheduleOnAt,
      scheduleOffAt
    } = req.body;

    // 检查权限
    if (!req.user || !['director', 'star_5', 'star_4', 'star_3'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要三星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查分类是否存在
    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: '商品分类不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 验证标签是否存在
    if (tagIds.length > 0) {
      const tagsCount = await prisma.productTag.count({
        where: {
          id: {
            in: tagIds
          }
        }
      });

      if (tagsCount !== tagIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TAGS_NOT_FOUND',
            message: '部分标签不存在',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 验证定时上下架时间
    if (scheduleOnAt && scheduleOffAt) {
      const onTime = new Date(scheduleOnAt);
      const offTime = new Date(scheduleOffAt);
      if (onTime >= offTime) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SCHEDULE',
            message: '定时上架时间必须早于定时下架时间',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 生成商品编码和SKU
    const [code, sku] = await Promise.all([
      generateProductCode(),
      generateSKU()
    ]);

    // 创建商品
    const product = await prisma.product.create({
      data: {
        name,
        description,
        categoryId,
        code,
        sku,
        basePrice,
        totalStock,
        minStock,
        images: JSON.stringify(images),
        details,
        isFeatured,
        sort,
        scheduleOnAt: scheduleOnAt ? new Date(scheduleOnAt) : null,
        scheduleOffAt: scheduleOffAt ? new Date(scheduleOffAt) : null,
        status: totalStock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'
      },
      select: {
        id: true,
        name: true,
        description: true,
        code: true,
        sku: true,
        basePrice: true,
        totalStock: true,
        minStock: true,
        status: true,
        isFeatured: true,
        sort: true,
        images: true,
        videoUrl: true,
        scheduleOnAt: true,
        scheduleOffAt: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            level: true
          }
        }
      }
    });

    // 关联标签
    if (tagIds.length > 0) {
      await prisma.productTagLink.createMany({
        data: tagIds.map((tagId: string) => ({
          productId: product.id,
          tagId
        }))
      });
    }

    res.status(201).json(createSuccessResponse({
      product: {
        ...product,
        images: JSON.parse(product.images)
      }
    }, '商品创建成功', 201));
  })
);

// 更新商品
router.put('/:id',
  authenticate,
  [
    body('name')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('商品名称长度必须在1-200字符之间'),
    body('description')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('商品描述长度不能超过2000字符'),
    body('categoryId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('分类ID格式不正确'),
    body('basePrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('基础价格必须是非负数'),
    body('totalStock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('库存数量必须是非负整数'),
    body('minStock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('最低库存必须是非负整数'),
    body('images')
      .optional()
      .isArray()
      .withMessage('商品图片必须是数组格式'),
    body('details')
      .optional()
      .isObject()
      .withMessage('商品详细信息必须是对象格式'),
    body('tagIds')
      .optional()
      .isArray()
      .withMessage('标签ID列表必须是数组格式'),
    body('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('推荐状态必须是布尔值'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须是非负整数'),
    body('scheduleOnAt')
      .optional()
      .isISO8601()
      .withMessage('定时上架时间格式不正确'),
    body('scheduleOffAt')
      .optional()
      .isISO8601()
      .withMessage('定时下架时间格式不正确')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // 检查权限
    if (!req.user || !['director', 'star_5', 'star_4', 'star_3'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要三星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查商品是否存在
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: '商品不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 验证分类
    if (updateData.categoryId) {
      const category = await prisma.productCategory.findUnique({
        where: { id: updateData.categoryId }
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: '商品分类不存在',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 验证标签
    if (updateData.tagIds && updateData.tagIds.length > 0) {
      const tagsCount = await prisma.productTag.count({
        where: {
          id: {
            in: updateData.tagIds
          }
        }
      });

      if (tagsCount !== updateData.tagIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TAGS_NOT_FOUND',
            message: '部分标签不存在',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 处理更新数据
    const { tagIds, ...productData } = updateData;
    const processedData: any = { ...productData };

    // 处理图片数据
    if (updateData.images !== undefined) {
      processedData.images = JSON.stringify(updateData.images);
    }

    // 处理时间数据
    if (updateData.scheduleOnAt) {
      processedData.scheduleOnAt = new Date(updateData.scheduleOnAt);
    }
    if (updateData.scheduleOffAt) {
      processedData.scheduleOffAt = new Date(updateData.scheduleOffAt);
    }

    // 验证定时上下架时间
    if (processedData.scheduleOnAt && processedData.scheduleOffAt) {
      if (processedData.scheduleOnAt >= processedData.scheduleOffAt) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SCHEDULE',
            message: '定时上架时间必须早于定时下架时间',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 更新商品
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: processedData,
      select: {
        id: true,
        name: true,
        description: true,
        code: true,
        sku: true,
        basePrice: true,
        totalStock: true,
        minStock: true,
        status: true,
        isFeatured: true,
        sort: true,
        images: true,
        videoUrl: true,
        scheduleOnAt: true,
        scheduleOffAt: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            level: true
          }
        }
      }
    });

    // 更新标签关联
    if (updateData.tagIds !== undefined) {
      // 删除原有标签关联
      await prisma.productTagLink.deleteMany({
        where: { productId: id }
      });

      // 创建新的标签关联
      if (updateData.tagIds.length > 0) {
        await prisma.productTagLink.createMany({
          data: updateData.tagIds.map((tagId: string) => ({
            productId: id,
            tagId
          }))
        });
      }
    }

    res.json(createSuccessResponse({
      product: {
        ...updatedProduct,
        images: JSON.parse(updatedProduct.images)
      }
    }, '商品更新成功'));
  })
);

// 更新商品状态
router.put('/:id/status',
  authenticate,
  [
    body('status')
      .isIn(['active', 'inactive', 'presale', 'out_of_stock'])
      .withMessage('状态值不正确')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // 检查权限
    if (!req.user || !['director', 'star_5', 'star_4', 'star_3'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要三星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查商品是否存在
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: '商品不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 更新状态
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { status: status.toUpperCase() },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true
      }
    });

    res.json(createSuccessResponse({
      product: updatedProduct
    }, `商品状态更新为${status}成功`));
  })
);

// 批量更新商品状态
router.post('/batch-status',
  authenticate,
  [
    body('productIds')
      .isArray({ min: 1, max: 100 })
      .withMessage('商品ID列表必须是1-100个元素的数组'),
    body('status')
      .isIn(['active', 'inactive', 'presale', 'out_of_stock'])
      .withMessage('状态值不正确')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { productIds, status } = req.body;

    // 检查权限
    if (!req.user || !['director', 'star_5', 'star_4'].includes(req.user.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要四星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 批量更新
    const result = await prisma.product.updateMany({
      where: {
        id: {
          in: productIds
        }
      },
      data: {
        status: status.toUpperCase()
      }
    });

    res.json(createSuccessResponse({
      updatedCount: result.count
    }, `成功更新 ${result.count} 个商品的状态为${status}`));
  })
);

// 删除商品
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
          message: '需要五星店长以上权限',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查商品是否存在
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            specs: true,
            orderItems: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: '商品不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查是否有关联数据
    if (product._count.specs > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_SPECS',
          message: '该商品下还有规格，请先删除规格',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (product._count.orderItems > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_ORDERS',
          message: '该商品有关联的订单，无法删除',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 删除商品（级联删除标签关联）
    await prisma.product.delete({
      where: { id }
    });

    res.json(createSuccessResponse(null, '商品删除成功'));
  })
);

export default router;