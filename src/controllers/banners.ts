import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { prisma } from '../shared/database/client';

// 获取Banner列表
export const getBanners = async (req: Request, res: Response) => {
  try {
    console.log('📡 获取Banner列表请求');

    // 从数据库获取活跃的Banner
    const banners = await prisma.banners.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        sortOrder: 'asc'
      },
      select: {
        id: true,
        title: true,
        image: true,
        link: true,
        alt: true,
        description: true,
        sortOrder: true
      }
    });

    console.log(`获取到 ${banners.length} 个Banner`);

    return success(res, {
      message: 'Banner列表获取成功',
      banners,
      total: banners.length
    });
  } catch (err) {
    console.error('❌ 获取Banner失败:', err);
    return error(res, '获取Banner失败', 500);
  }
};

// 获取活跃的Banner
export const getActiveBanners = async (req: Request, res: Response) => {
  try {
    console.log('📡 获取活跃Banner请求');

    // 从数据库获取活跃的Banner（简化版本）
    const banners = await prisma.banners.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        sortOrder: 'asc'
      },
      select: {
        id: true,
        title: true,
        image: true,
        link: true,
        isActive: true
      }
    });

    return success(res, {
      banners,
      total: banners.length
    });
  } catch (err) {
    console.error('❌ 获取活跃Banner失败:', err);
    return error(res, '获取活跃Banner失败', 500);
  }
};