import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';

const router = Router();

// 生成规格SKU
const generateSpecSKU = async (): Promise<string> => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sku = 'SPC';
  for (let i = 0; i < 9; i++) {
    sku += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // 检查是否重复
  const exists = await prisma.productSpec.findUnique({
    where: { sku }
  });

  if (exists) {
    return generateSpecSKU(); // 递归重试
  }

  return sku;
};

// 获取商品规格列表
router.get('/',
  authenticate,
  [
    query('productId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('商品ID不能为空'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('perPage')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须是1-100之间的整数'),
    query('isActive')
      .optional()
      .isBoolean()
      .withMessage('状态必须是布尔值')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { productId, page = 1, perPage = 20, isActive } = req.query;

    // 分页参数
    const pageNum = parseInt(page as string);
    const perPageNum = parseInt(perPage as string);
    const skip = (pageNum - 1) * perPageNum;

    // 检查商品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId as string },
      select: {
        id: true,
        name: true,
        code: true
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

    // 构建查询条件
    const where: any = {
      productId: productId as string
    };

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [specs, total] = await Promise.all([
      prisma.productSpec.findMany({
        where,
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
          createdAt: true,
          updatedAt: true,
          product: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          pricings: {
            select: {
              id: true,
              userLevel: true,
              price: true
            },
            orderBy: {
              userLevel: 'asc'
            }
          },
          _count: {
            select: {
              orderItems: true
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
      prisma.productSpec.count({ where })
    ]);

    res.json(createSuccessResponse({
      product,
      specs: specs.map(spec => ({
        ...spec,
        images: spec.images ? JSON.parse(spec.images) : [],
        orderItemsCount: spec._count.orderItems,
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

// 获取规格详情
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const spec = await prisma.productSpec.findUnique({
      where: { id },
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
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            category: {
              select: {
                id: true,
                name: true,
                level: true
              }
            }
          }
        },
        pricings: {
          select: {
            id: true,
            userLevel: true,
            price: true
          },
          orderBy: {
            userLevel: 'asc'
          }
        },
        _count: {
          select: {
            orderItems: true
          }
        }
      }
    });

    if (!spec) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SPEC_NOT_FOUND',
          message: '商品规格不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json(createSuccessResponse({
      spec: {
        ...spec,
        images: spec.images ? JSON.parse(spec.images) : [],
        orderItemsCount: spec._count.orderItems,
        _count: undefined
      }
    }, '获取规格详情成功'));
  })
);

// 创建商品规格
router.post('/',
  authenticate,
  [
    body('productId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('商品ID不能为空'),
    body('name')
      .notEmpty()
      .withMessage('规格名称不能为空')
      .isLength({ min: 1, max: 100 })
      .withMessage('规格名称长度必须在1-100字符之间'),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('规格价格必须是非负数'),
    body('stock')
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
      .withMessage('规格图片必须是数组格式'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('启用状态必须是布尔值'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须是非负整数'),
    body('pricings')
      .optional()
      .isArray()
      .withMessage('价格配置必须是数组格式')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const {
      productId,
      name,
      price,
      stock = 0,
      minStock = 10,
      images = [],
      isActive = true,
      sort = 0,
      pricings = []
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

    // 检查商品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: '商品不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查规格名称是否重复
    const existingSpec = await prisma.productSpec.findFirst({
      where: {
        productId,
        name,
        isActive: true
      }
    });

    if (existingSpec) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SPEC_EXISTS',
          message: '该商品下已存在同名规格',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 验证价格配置
    if (pricings.length > 0) {
      for (const pricing of pricings) {
        if (!pricing.userLevel || !pricing.price) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PRICING',
              message: '价格配置必须包含用户等级和价格',
              timestamp: new Date().toISOString()
            }
          });
        }

        if (pricing.price < 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PRICE',
              message: '价格必须是非负数',
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    }

    // 生成SKU
    const sku = await generateSpecSKU();

    // 创建规格
    const spec = await prisma.productSpec.create({
      data: {
        productId,
        name,
        sku,
        price,
        stock,
        minStock,
        images: images.length > 0 ? JSON.stringify(images) : null,
        isActive,
        sort
      },
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
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    // 创建价格配置
    if (pricings.length > 0) {
      await prisma.productPricing.createMany({
        data: pricings.map((pricing: any) => ({
          productId,
          specId: spec.id,
          userLevel: pricing.userLevel.toUpperCase(),
          price: pricing.price
        }))
      });
    }

    // 更新商品总库存
    const totalStock = await prisma.productSpec.aggregate({
      where: {
        productId,
        isActive: true
      },
      _sum: {
        stock: true
      }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        totalStock: totalStock._sum.stock || 0,
        status: (totalStock._sum.stock || 0) > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'
      }
    });

    res.status(201).json(createSuccessResponse({
      spec: {
        ...spec,
        images: spec.images ? JSON.parse(spec.images) : []
      }
    }, '商品规格创建成功', 201));
  })
);

// 更新商品规格
router.put('/:id',
  authenticate,
  [
    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('规格名称长度必须在1-100字符之间'),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('规格价格必须是非负数'),
    body('stock')
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
      .withMessage('规格图片必须是数组格式'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('启用状态必须是布尔值'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须是非负整数'),
    body('pricings')
      .optional()
      .isArray()
      .withMessage('价格配置必须是数组格式')
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

    // 检查规格是否存在
    const existingSpec = await prisma.productSpec.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true
          }
        }
      }
    });

    if (!existingSpec) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SPEC_NOT_FOUND',
          message: '商品规格不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查名称重复
    if (updateData.name && updateData.name !== existingSpec.name) {
      const duplicateSpec = await prisma.productSpec.findFirst({
        where: {
          productId: existingSpec.productId,
          name: updateData.name,
          isActive: true,
          id: { not: id }
        }
      });

      if (duplicateSpec) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'SPEC_EXISTS',
            message: '该商品下已存在同名规格',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 处理更新数据
    const { pricings, ...specData } = updateData;
    const processedData: any = { ...specData };

    // 处理图片数据
    if (updateData.images !== undefined) {
      processedData.images = updateData.images.length > 0 ?
        JSON.stringify(updateData.images) : null;
    }

    // 更新规格
    const updatedSpec = await prisma.productSpec.update({
      where: { id },
      data: processedData,
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
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    // 更新价格配置
    if (pricings !== undefined) {
      // 删除原有价格配置
      await prisma.productPricing.deleteMany({
        where: { specId: id }
      });

      // 创建新的价格配置
      if (pricings.length > 0) {
        for (const pricing of pricings) {
          if (!pricing.userLevel || !pricing.price) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_PRICING',
                message: '价格配置必须包含用户等级和价格',
                timestamp: new Date().toISOString()
              }
            });
          }

          if (pricing.price < 0) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_PRICE',
                message: '价格必须是非负数',
                timestamp: new Date().toISOString()
              }
            });
          }
        }

        await prisma.productPricing.createMany({
          data: pricings.map((pricing: any) => ({
            productId: existingSpec.productId,
            specId: id,
            userLevel: pricing.userLevel.toUpperCase(),
            price: pricing.price
          }))
        });
      }
    }

    // 更新商品总库存
    const totalStock = await prisma.productSpec.aggregate({
      where: {
        productId: existingSpec.productId,
        isActive: true
      },
      _sum: {
        stock: true
      }
    });

    await prisma.product.update({
      where: { id: existingSpec.productId },
      data: {
        totalStock: totalStock._sum.stock || 0,
        status: (totalStock._sum.stock || 0) > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'
      }
    });

    res.json(createSuccessResponse({
      spec: {
        ...updatedSpec,
        images: updatedSpec.images ? JSON.parse(updatedSpec.images) : []
      }
    }, '商品规格更新成功'));
  })
);

// 更新规格状态
router.put('/:id/status',
  authenticate,
  [
    body('isActive')
      .isBoolean()
      .withMessage('启用状态必须是布尔值')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

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

    // 检查规格是否存在
    const spec = await prisma.productSpec.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true
          }
        }
      }
    });

    if (!spec) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SPEC_NOT_FOUND',
          message: '商品规格不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 更新状态
    const updatedSpec = await prisma.productSpec.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true
      }
    });

    // 更新商品总库存
    const totalStock = await prisma.productSpec.aggregate({
      where: {
        productId: spec.productId,
        isActive: true
      },
      _sum: {
        stock: true
      }
    });

    await prisma.product.update({
      where: { id: spec.productId },
      data: {
        totalStock: totalStock._sum.stock || 0,
        status: (totalStock._sum.stock || 0) > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'
      }
    });

    res.json(createSuccessResponse({
      spec: updatedSpec
    }, `规格状态更新为${isActive ? '启用' : '禁用'}成功`));
  })
);

// 删除商品规格
router.delete('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

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

    // 检查规格是否存在
    const spec = await prisma.productSpec.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true
          }
        }
      }
    });

    if (!spec) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SPEC_NOT_FOUND',
          message: '商品规格不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 检查是否有关联的订单项
    if (spec._count.orderItems > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_ORDERS',
          message: '该规格有关联的订单，无法删除',
          timestamp: new Date().toISOString()
        }
      });
    }

    const productId = spec.productId;

    // 删除规格（级联删除价格配置）
    await prisma.productSpec.delete({
      where: { id }
    });

    // 更新商品总库存
    const totalStock = await prisma.productSpec.aggregate({
      where: {
        productId,
        isActive: true
      },
      _sum: {
        stock: true
      }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        totalStock: totalStock._sum.stock || 0,
        status: (totalStock._sum.stock || 0) > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'
      }
    });

    res.json(createSuccessResponse(null, '商品规格删除成功'));
  })
);

export default router;