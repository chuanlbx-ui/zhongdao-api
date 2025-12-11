import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';

const router = Router();

// 获取库存流水记录列表
router.get('/',
  authenticate,
  [
    query('productId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('商品ID格式不正确'),
    query('specId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('规格ID格式不正确'),
    query('warehouseType')
      .optional()
      .isIn(['CLOUD', 'LOCAL'])
      .withMessage('仓库类型必须是CLOUD或LOCAL'),
    query('operationType')
      .optional()
      .isIn(['MANUAL_IN', 'MANUAL_OUT', 'ORDER_OUT', 'PURCHASE_IN', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_IN', 'DAMAGE_OUT', 'INITIAL'])
      .withMessage('操作类型无效'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式不正确'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式不正确'),
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
    const {
      productId,
      specId,
      warehouseType,
      operationType,
      startDate,
      endDate,
      page = 1,
      perPage = 20
    } = req.query;

    // 分页参数
    const pageNum = parseInt(page as string);
    const perPageNum = parseInt(perPage as string);
    const skip = (pageNum - 1) * perPageNum;

    // 构建查询条件
    const where: any = {};

    // 如果是普通用户，只能查看自己的库存记录
    if (req.user?.level === 'NORMAL' || req.user?.level === 'VIP') {
      where.userId = req.user.id;
    } else if (req.user?.level === 'STAR_1' || req.user?.level === 'STAR_2' || req.user?.level === 'STAR_3') {
      // 店长可以查看自己团队的库存记录
      where.user = {
        parentId: req.user.id
      };
    }
    // 管理员及以上可以查看所有记录

    if (productId) {
      where.productsId = productId as string;
    }

    if (specId) {
      where.specsId = specId as string;
    }

    if (warehouseType) {
      where.warehouseType = warehouseType as string;
    }

    if (operationType) {
      where.operationType = operationType as string;
    }

    // 日期范围查询
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.inventoryLogssss.findMany({
        where,
        select: {
          id: true,
          operationType: true,
          quantity: true,
          quantityBefore: true,
          quantityAfter: true,
          warehouseType: true,
          relatedOrderId: true,
          relatedPurchaseId: true,
          adjustmentReason: true,
          operatorType: true,
          remarks: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              nickname: true,
              phone: true,
              level: true
            }
          },
          products: {
            select: {
              id: true,
              name: true,
              code: true,
              sku: true
            }
          },
          specs: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          },
          shop: {
            select: {
              id: true,
              shopName: true,
              shopType: true
            }
          },
          operator: {
            select: {
              id: true,
              nickname: true,
              phone: true,
              level: true
            }
          }
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' }
        ],
        skip,
        take: perPageNum
      }),
      prisma.inventoryLogssss.count({ where })
    ]);

    res.json(createSuccessResponse({
      logs,
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        total,
        totalPages: Math.ceil(total / perPageNum),
        hasNext: pageNum < Math.ceil(total / perPageNum),
        hasPrev: pageNum > 1
      },
      filters: {
        productId,
        specId,
        warehouseType,
        operationType,
        startDate,
        endDate
      }
    }, '获取库存流水记录成功'));
  })
);

// 获取库存流水记录详情
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const log = await prisma.inventoryLogssss.findUnique({
      where: { id },
      select: {
        id: true,
        operationType: true,
        quantity: true,
        quantityBefore: true,
        quantityAfter: true,
        warehouseType: true,
        relatedOrderId: true,
        relatedPurchaseId: true,
        adjustmentReason: true,
        operatorType: true,
        remarks: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            avatarUrl: true,
            level: true
          }
        },
        products: {
          select: {
            id: true,
            name: true,
            code: true,
            sku: true,
            images: true,
            category: {
              select: {
                id: true,
                name: true,
                level: true
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
            images: true
          }
        },
        shop: {
          select: {
            id: true,
            shopName: true,
            shopType: true,
            shopLevel: true
          }
        },
        operator: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            avatarUrl: true,
            level: true
          }
        }
      }
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOG_NOT_FOUND',
          message: '库存流水记录不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 权限检查
    if (req.user?.level === 'NORMAL' || req.user?.level === 'VIP') {
      if (log.user.id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权查看此库存流水记录',
            timestamp: new Date().toISOString()
          }
        });
      }
    } else if (req.user?.level === 'STAR_1' || req.user?.level === 'STAR_2' || req.user?.level === 'STAR_3') {
      if (log.user.parentId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权查看此库存流水记录',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 解析图片JSON
    if (log.products.images) {
      (log.products as any).images = JSON.parse(log.products.images);
    }
    if (log.specs.images) {
      (log.specs as any).images = JSON.parse(log.specs.images);
    }

    res.json(createSuccessResponse(log, '获取库存流水记录详情成功'));
  })
);

// 获取库存统计信息
router.get('/statistics/summary',
  authenticate,
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式不正确'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式不正确'),
    query('warehouseType')
      .optional()
      .isIn(['CLOUD', 'LOCAL'])
      .withMessage('仓库类型必须是CLOUD或LOCAL')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { startDate, endDate, warehouseType } = req.query;

    // 构建查询条件
    const where: any = {};

    // 权限控制
    if (req.user?.level === 'NORMAL' || req.user?.level === 'VIP') {
      where.userId = req.user.id;
    } else if (req.user?.level === 'STAR_1' || req.user?.level === 'STAR_2' || req.user?.level === 'STAR_3') {
      where.user = {
        parentId: req.user.id
      };
    }

    if (warehouseType) {
      where.warehouseType = warehouseType as string;
    }

    // 日期范围
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    // 统计查询
    const [
      totalRecords,
      inboundTotal,
      outboundTotal,
      operationStats,
      warehouseStats,
      dailyStats
    ] = await Promise.all([
      // 总记录数
      prisma.inventoryLogssss.count({ where }),

      // 总入库量
      prisma.inventoryLogssss.aggregate({
        where: { ...where, quantity: { gt: 0 } },
        _sum: { quantity: true }
      }),

      // 总出库量
      prisma.inventoryLogssss.aggregate({
        where: { ...where, quantity: { lt: 0 } },
        _sum: { quantity: true }
      }),

      // 按操作类型统计
      prisma.inventoryLogssss.groupBy({
        by: ['operationType'],
        where,
        _count: { id: true },
        _sum: { quantity: true }
      }),

      // 按仓库类型统计
      prisma.inventoryLogssss.groupBy({
        by: ['warehouseType'],
        where,
        _count: { id: true },
        _sum: { quantity: true }
      }),

      // 按日期统计（最近30天）
      prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as records,
          SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as inbound,
          SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as outbound
        FROM inventory_logs
        WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        ${warehouseType ? 'AND warehouse_type = ' + warehouseType : ''}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `
    ]);

    res.json(createSuccessResponse({
      summary: {
        totalRecords,
        inboundTotal: inboundTotal._sum.quantity || 0,
        outboundTotal: Math.abs(outboundTotal._sum.quantity || 0),
        netChange: (inboundTotal._sum.quantity || 0) + (outboundTotal._sum.quantity || 0)
      },
      operationStats: operationStats.map(stat => ({
        operationType: stat.operationType,
        count: stat._count.id,
        totalQuantity: Math.abs(stat._sum.quantity || 0)
      })),
      warehouseStats: warehouseStats.map(stat => ({
        warehouseType: stat.warehouseType,
        count: stat._count.id,
        totalQuantity: Math.abs(stat._sum.quantity || 0)
      })),
      dailyStats: dailyStats
    }, '获取库存统计信息成功'));
  })
);

export default router;