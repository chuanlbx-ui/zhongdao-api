import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../../../shared/middleware/error';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { AdminRole, AdminStatus } from '@prisma/client';

const router = Router();

// 创建管理员种子数据（仅开发环境使用）
router.post('/seed-admin',
  // 临时禁用CSRF验证用于开发环境
  (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    // 生产环境的CSRF验证逻辑
    next();
  },
  asyncHandler(async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json(createErrorResponse(
          'FORBIDDEN',
          '此接口仅在开发环境可用'
        ));
      }

      const adminData = {
        username: 'admin',
        password: await bcrypt.hash('admin123456', 10),
        realName: '系统管理员',
        email: 'admin@zhongdao.com',
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE,
        permissions: {
          all: true,
          modules: ['users', 'products', 'orders', 'inventory', 'teams', 'payments', 'config']
        }
      };

      const existingAdmin = await prisma.admin.findUnique({
        where: { username: 'admin' }
      });

      let result;
      if (existingAdmin) {
        result = await prisma.admin.update({
          where: { username: 'admin' },
          data: {
            password: adminData.password,
            realName: adminData.realName,
            email: adminData.email,
            role: adminData.role,
            status: adminData.status,
            permissions: adminData.permissions,
            updatedAt: new Date()
          }
        });
      } else {
        result = await prisma.admin.create({
          data: adminData
        });
      }

      res.json(createSuccessResponse({
        admin: {
          id: result.id,
          username: result.username,
          realName: result.realName,
          email: result.email,
          role: result.role,
          status: result.status,
          createdAt: result.createdAt
        },
        message: '管理员账号创建/更新成功'
      }, '操作完成'));

    } catch (error) {
      console.error('创建管理员失败:', error);
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '操作失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;