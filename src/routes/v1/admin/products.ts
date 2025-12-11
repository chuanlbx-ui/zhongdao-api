import { Router, Request, Response } from 'express';
import { prisma } from '../../../shared/database/client';
import { createSuccessResponse, createErrorResponse, ErrorCode, createPaginatedResponse } from '../../../shared/types/response';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { authenticate } from '../../../shared/middleware/auth';
import { logger } from '../../../shared/utils/logger';

const router = Router();

/**
 * 获取商品列表
 */
router.get('/',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 10, 100);
      const skip = (page - 1) * perPage;

      const [products, total] = await Promise.all([
        prisma.products.findMany({
          skip,
          take: perPage,
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            },
            specs: {
              select: {
                id: true,
                specName: true,
                price: true,
                stock: true,
                status: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.products.count()
      ]);

      res.json(createPaginatedResponse(
        products,
        total,
        page,
        perPage,
        '获取商品列表成功'
      ));
    } catch (error) {
      logger.error('获取商品列表失败', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取商品列表失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取商品详情
 */
router.get('/:id',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const product = await prisma.products.findUnique({
        where: { id: req.params.id },
        include: {
          category: true,
          specs: true,
          tags: {
            include: {
              tag: true
            }
          }
        }
      });

      if (!product) {
        return res.status(404).json(createErrorResponse(
          ErrorCode.NOT_FOUND,
          '商品不存在'
        ));
      }

      res.json(createSuccessResponse(product, '获取商品详情成功'));
    } catch (error) {
      logger.error('获取商品详情失败', { error, productId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取商品详情失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 创建商品
 */
router.post('/',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { name, description, categoryId, basePrice, images, status } = req.body;

      const product = await prisma.products.create({
        data: {
          name,
          description,
          categoryId,
          basePrice,
          images,
          status: status || 'ACTIVE'
        },
        include: {
          category: true
        }
      });

      res.json(createSuccessResponse(product, '创建商品成功'));
    } catch (error) {
      logger.error('创建商品失败', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '创建商品失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 更新商品
 */
router.put('/:id',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { name, description, categoryId, basePrice, images, status } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (basePrice !== undefined) updateData.basePrice = basePrice;
      if (images !== undefined) updateData.images = images;
      if (status !== undefined) updateData.status = status;

      const updated = await prisma.products.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          category: true
        }
      });

      res.json(createSuccessResponse(updated, '更新商品成功'));
    } catch (error) {
      logger.error('更新商品失败', { error, productId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '更新商品失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 删除商品
 */
router.delete('/:id',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      await prisma.products.delete({
        where: { id: req.params.id }
      });

      res.json(createSuccessResponse(null, '删除商品成功'));
    } catch (error) {
      logger.error('删除商品失败', { error, productId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '删除商品失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;
