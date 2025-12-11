import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { Prisma } from '@prisma/client';

const router = Router();

// 获取库存预警列表
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
    query('alertType')
      .optional()
      .isIn(['LOW_STOCK', 'OUT_OF_STOCK', 'EXCESS_STOCK', 'EXPIRED', 'EXPIRING_SOON', 'MIN_STOCK_VIOLATION'])
      .withMessage('预警类型无效'),
    query('isRead')
      .optional()
      .isBoolean()
      .withMessage('已读状态必须是布尔值'),
    query('isResolved')
      .optional()
      .isBoolean()
      .withMessage('解决状态必须是布尔值'),
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
      alertType,
      isRead,
      isResolved,
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

    // 权限控制
    if (req.user?.level === 'NORMAL' || req.user?.level === 'VIP') {
      where.userId = req.user.id;
    } else if (req.user?.level === 'STAR_1' || req.user?.level === 'STAR_2' || req.user?.level === 'STAR_3') {
      // 店长可以查看自己团队的库存预警
      where.user = {
        parentId: req.user.id
      };
    }
    // 管理员及以上可以查看所有预警

    if (productId) {
      where.productsId = productId as string;
    }

    if (specId) {
      where.specsId = specId as string;
    }

    if (warehouseType) {
      where.warehouseType = warehouseType as string;
    }

    if (alertType) {
      where.alertType = alertType as string;
    }

    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    if (isResolved !== undefined) {
      where.isResolved = isResolved === 'true';
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

    const [alerts, total] = await Promise.all([
      prisma.inventoryAlertss.findMany({
        where,
        select: {
          id: true,
          alertType: true,
          currentQuantity: true,
          threshold: true,
          warehouseType: true,
          isRead: true,
          isResolved: true,
          resolvedAt: true,
          resolveNote: true,
          notificationSent: true,
          lastNotifiedAt: true,
          createdAt: true,
          updatedAt: true,
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
              shopType: true
            }
          },
          resolver: {
            select: {
              id: true,
              nickname: true,
              phone: true,
              level: true
            }
          }
        },
        orderBy: [
          { isResolved: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: perPageNum
      }),
      prisma.inventoryAlertss.count({ where })
    ]);

    // 解析图片JSON
    const formattedAlerts = alerts.map(alert => ({
      ...alert,
      product: alert.products ? {
        ...alert.products,
        images: alert.products.images ? JSON.parse(alert.products.images) : []
      } : alert.products,
      spec: alert.specs ? {
        ...alert.specs,
        images: alert.specs.images ? JSON.parse(alert.specs.images) : []
      } : alert.specs
    }));

    res.json(createSuccessResponse({
      alerts: formattedAlerts,
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
        alertType,
        isRead,
        isResolved,
        startDate,
        endDate
      }
    }, '获取库存预警列表成功'));
  })
);

// 获取库存预警详情
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const alert = await prisma.inventoryAlertss.findUnique({
      where: { id },
      select: {
        id: true,
        alertType: true,
        currentQuantity: true,
        threshold: true,
        warehouseType: true,
        isRead: true,
        isResolved: true,
        resolvedAt: true,
        resolveNote: true,
        notificationSent: true,
        lastNotifiedAt: true,
        createdAt: true,
        updatedAt: true,
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
            description: true,
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
        resolver: {
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

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: '库存预警不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 权限检查
    if (req.user?.level === 'NORMAL' || req.user?.level === 'VIP') {
      if (alert.user.id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权查看此库存预警',
            timestamp: new Date().toISOString()
          }
        });
      }
    } else if (req.user?.level === 'STAR_1' || req.user?.level === 'STAR_2' || req.user?.level === 'STAR_3') {
      if (alert.user.parentId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权查看此库存预警',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // 解析图片JSON
    if (alert.products.images) {
      (alert.products as any).images = JSON.parse(alert.products.images);
    }
    if (alert.specs.images) {
      (alert.specs as any).images = JSON.parse(alert.specs.images);
    }

    res.json(createSuccessResponse(alert, '获取库存预警详情成功'));
  })
);

// 标记预警为已读
router.put('/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const alert = await prisma.inventoryAlertss.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        isRead: true,
        user: {
          select: {
            id: true,
            parentId: true,
            level: true
          }
        }
      }
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: '库存预警不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 权限检查
    if (req.user?.level === 'NORMAL' || req.user?.level === 'VIP') {
      if (alert.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权操作此库存预警',
            timestamp: new Date().toISOString()
          }
        });
      }
    } else if (req.user?.level === 'STAR_1' || req.user?.level === 'STAR_2' || req.user?.level === 'STAR_3') {
      if (alert.user.parentId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权操作此库存预警',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    if (alert.isRead) {
      return res.json(createSuccessResponse(alert, '预警已经是已读状态'));
    }

    const updatedAlert = await prisma.inventoryAlertss.update({
      where: { id },
      data: { isRead: true },
      select: {
        id: true,
        isRead: true,
        updatedAt: true
      }
    });

    res.json(createSuccessResponse(updatedAlert, '标记预警为已读成功'));
  })
);

// 解决库存预警
router.put('/:id/resolve',
  authenticate,
  [
    body('resolveNote')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('解决备注长度必须在1-500字符之间')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { resolveNote } = req.body;

    const alert = await prisma.inventoryAlertss.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        isResolved: true,
        user: {
          select: {
            id: true,
            parentId: true,
            level: true
          }
        }
      }
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: '库存预警不存在',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 权限检查 - 只有店长及以上才能解决预警
    if (!['STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'].includes(req.user?.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要三星店长以上权限才能解决库存预警',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (req.user?.level === 'STAR_3') {
      if (alert.user.parentId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权操作此库存预警',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    if (alert.isResolved) {
      return res.json(createSuccessResponse(alert, '预警已经解决'));
    }

    const updatedAlert = await prisma.inventoryAlertss.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user.id,
        resolveNote
      },
      select: {
        id: true,
        isResolved: true,
        resolvedAt: true,
        resolveNote: true,
        updatedAt: true,
        resolver: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            level: true
          }
        }
      }
    });

    res.json(createSuccessResponse(updatedAlert, '解决库存预警成功'));
  })
);

// 检查库存预警（系统自动调用）
router.post('/check',
  authenticate,
  [
    body('productId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('商品ID格式不正确'),
    body('specId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('规格ID格式不正确'),
    body('warehouseType')
      .optional()
      .isIn(['CLOUD', 'LOCAL'])
      .withMessage('仓库类型必须是CLOUD或LOCAL'),
    body('userId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('用户ID格式不正确')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { productId, specId, warehouseType, userId } = req.body;

    // 只有管理员及以上才能触发预警检查
    if (!['STAR_4', 'STAR_5', 'DIRECTOR'].includes(req.user?.level)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要四星店长以上权限才能触发库存预警检查',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 构建查询条件
    const where: any = {};

    if (productId) {
      where.productsId = productId;
    }

    if (specId) {
      where.specsId = specId;
    }

    if (warehouseType) {
      where.warehouseType = warehouseType;
    }

    if (userId) {
      where.userId = userId;
    }

    // 获取库存项目
    const inventoryItems = await prisma.inventoryItems.findMany({
      where,
      include: {
        products: {
          select: {
            id: true,
            name: true,
            minStock: true,
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
            price: true
          }
        },
        user: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            level: true
          }
        }
      }
    });

    const alerts = [];

    for (const item of inventoryItems) {
      // 检查库存不足预警
      if (item.quantity <= item.minStock) {
        const existingAlert = await prisma.inventoryAlertss.findFirst({
          where: {
            userId: item.userId,
            productId: item.productsId,
            specId: item.specsId,
            warehouseType: item.warehouseType,
            alertType: 'LOW_STOCK',
            isResolved: false
          }
        });

        if (!existingAlert) {
          const newAlert = await prisma.inventoryAlertss.create({
            data: {
              userId: item.userId,
              productId: item.productsId,
              specId: item.specsId,
              warehouseType: item.warehouseType,
              alertType: 'LOW_STOCK',
              currentQuantity: item.quantity,
              threshold: item.minStock
            },
            select: {
              id: true,
              alertType: true,
              currentQuantity: true,
              threshold: true,
              warehouseType: true,
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
                  code: true
                }
              },
              specs: {
                select: {
                  id: true,
                  name: true,
                  sku: true
                }
              }
            }
          });

          alerts.push(newAlert);
        }
      }

      // 检查缺货预警
      if (item.quantity === 0) {
        const existingAlert = await prisma.inventoryAlertss.findFirst({
          where: {
            userId: item.userId,
            productId: item.productsId,
            specId: item.specsId,
            warehouseType: item.warehouseType,
            alertType: 'OUT_OF_STOCK',
            isResolved: false
          }
        });

        if (!existingAlert) {
          const newAlert = await prisma.inventoryAlertss.create({
            data: {
              userId: item.userId,
              productId: item.productsId,
              specId: item.specsId,
              warehouseType: item.warehouseType,
              alertType: 'OUT_OF_STOCK',
              currentQuantity: item.quantity,
              threshold: 0
            },
            select: {
              id: true,
              alertType: true,
              currentQuantity: true,
              threshold: true,
              warehouseType: true,
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
                  code: true
                }
              },
              specs: {
                select: {
                  id: true,
                  name: true,
                  sku: true
                }
              }
            }
          });

          alerts.push(newAlert);
        }
      }
    }

    res.json(createSuccessResponse({
      checkedItems: inventoryItems.length,
      newAlerts: alerts.length,
      alerts
    }, '库存预警检查完成'));
  })
);

// 获取库存预警统计信息
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
      totalAlerts,
      unreadAlerts,
      unresolvedAlerts,
      alertTypeStats,
      warehouseStats,
      trendStats
    ] = await Promise.all([
      // 总预警数
      prisma.inventoryAlertss.count({ where }),

      // 未读预警数
      prisma.inventoryAlertss.count({
        where: { ...where, isRead: false }
      }),

      // 未解决预警数
      prisma.inventoryAlertss.count({
        where: { ...where, isResolved: false }
      }),

      // 按预警类型统计
      prisma.inventoryAlertss.groupBy({
        by: ['alertType'],
        where,
        _count: { id: true }
      }),

      // 按仓库类型统计
      prisma.inventoryAlertss.groupBy({
        by: ['warehouseType'],
        where,
        _count: { id: true }
      }),

      // 趋势统计（最近30天）
      prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN is_resolved = 0 THEN 1 ELSE 0 END) as unresolved,
          SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
        FROM inventory_alerts
        WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        ${warehouseType ? 'AND warehouse_type = ' + warehouseType : ''}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `
    ]);

    res.json(createSuccessResponse({
      summary: {
        totalAlerts,
        unreadAlerts,
        unresolvedAlerts,
        readRate: totalAlerts > 0 ? ((totalAlerts - unreadAlerts) / totalAlerts * 100).toFixed(2) : '0.00',
        resolvedRate: totalAlerts > 0 ? ((totalAlerts - unresolvedAlerts) / totalAlerts * 100).toFixed(2) : '0.00'
      },
      alertTypeStats: alertTypeStats.map(stat => ({
        alertType: stat.alertType,
        count: stat._count.id
      })),
      warehouseStats: warehouseStats.map(stat => ({
        warehouseType: stat.warehouseType,
        count: stat._count.id
      })),
      trendStats: trendStats
    }, '获取库存预警统计信息成功'));
  })
);

export default router;