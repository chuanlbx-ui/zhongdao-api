import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../../../shared/types/response';
import { LogisticsCompany, LogisticsScope, DeliveryType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 获取物流公司列表
 */
export const getLogisticsCompaniesController = async (
  req: Request,
  res: Response
) => {
  const {
    page = 1,
    perPage = 20,
    search,
    scope,
    isActive,
    sortBy = 'sort',
    sortOrder = 'asc'
  } = req.query;

  const skip = (Number(page) - 1) * Number(perPage);
  const take = Number(perPage);

  // 构建查询条件
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search as string } },
      { displayName: { contains: search as string } },
      { code: { contains: search as string } }
    ];
  }

  if (scope) {
    where.serviceScope = scope as LogisticsScope;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  // 查询物流公司列表
  const [companies, total] = await Promise.all([
    prisma.logisticsCompany.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy as string]: sortOrder as 'asc' | 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        logo: true,
        website: true,
        phone: true,
        serviceScope: true,
        deliveryTypes: true,
        normalDelivery: true,
        expressDelivery: true,
        isActive: true,
        sort: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.logisticsCompany.count({ where })
  ]);

  res.json(ApiResponse.success({
    items: companies,
    total,
    page: Number(page),
    perPage: Number(perPage),
    totalPages: Math.ceil(total / Number(perPage))
  }));
};

/**
 * 根据ID获取物流公司详情
 */
export const getLogisticsCompanyByIdController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  const company = await prisma.logisticsCompany.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      displayName: true,
      logo: true,
      website: true,
      phone: true,
      serviceScope: true,
      deliveryTypes: true,
      normalDelivery: true,
      expressDelivery: true,
      apiProvider: true,
      apiConfig: true,
      isApiEnabled: true,
      isActive: true,
      sort: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!company) {
    return res.json(ApiResponse.error('物流公司不存在', 404));
  }

  res.json(ApiResponse.success(company));
};

/**
 * 创建物流公司
 */
export const createLogisticsCompanyController = async (
  req: Request,
  res: Response
) => {
  const {
    code,
    name,
    displayName,
    logo,
    website,
    phone,
    serviceScope = LogisticsScope.NATIONAL,
    deliveryTypes = [DeliveryType.STANDARD],
    normalDelivery = 48,
    expressDelivery = 24,
    apiProvider,
    apiConfig,
    isApiEnabled = false,
    sort = 0
  } = req.body;

  // 检查代码是否已存在
  const existingCompany = await prisma.logisticsCompany.findUnique({
    where: { code }
  });

  if (existingCompany) {
    return res.json(ApiResponse.error('物流公司代码已存在'));
  }

  const company = await prisma.logisticsCompany.create({
    data: {
      code,
      name,
      displayName,
      logo,
      website,
      phone,
      serviceScope,
      deliveryTypes,
      normalDelivery,
      expressDelivery,
      apiProvider,
      apiConfig,
      isApiEnabled,
      sort
    }
  });

  res.json(ApiResponse.success(company, '物流公司创建成功'));
};

/**
 * 更新物流公司
 */
export const updateLogisticsCompanyController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const updateData = req.body;

  // 检查物流公司是否存在
  const existingCompany = await prisma.logisticsCompany.findUnique({
    where: { id }
  });

  if (!existingCompany) {
    return res.json(ApiResponse.error('物流公司不存在', 404));
  }

  // 如果更新代码，检查是否与其他公司冲突
  if (updateData.code && updateData.code !== existingCompany.code) {
    const codeExists = await prisma.logisticsCompany.findUnique({
      where: { code: updateData.code }
    });

    if (codeExists) {
      return res.json(ApiResponse.error('物流公司代码已存在'));
    }
  }

  const company = await prisma.logisticsCompany.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      code: true,
      name: true,
      displayName: true,
      logo: true,
      website: true,
      phone: true,
      serviceScope: true,
      deliveryTypes: true,
      normalDelivery: true,
      expressDelivery: true,
      apiProvider: true,
      apiConfig: true,
      isApiEnabled: true,
      isActive: true,
      sort: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json(ApiResponse.success(company, '物流公司更新成功'));
};

/**
 * 删除物流公司
 */
export const deleteLogisticsCompanyController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  // 检查物流公司是否存在
  const existingCompany = await prisma.logisticsCompany.findUnique({
    where: { id }
  });

  if (!existingCompany) {
    return res.json(ApiResponse.error('物流公司不存在', 404));
  }

  // 检查是否有正在使用的发货记录
  const activeShipments = await prisma.logisticsShipment.count({
    where: {
      companyId: id,
      status: {
        in: ['PENDING', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']
      }
    }
  });

  if (activeShipments > 0) {
    return res.json(ApiResponse.error(`该物流公司有 ${activeShipments} 个活跃的发货记录，无法删除`));
  }

  await prisma.logisticsCompany.delete({
    where: { id }
  });

  res.json(ApiResponse.success(null, '物流公司删除成功'));
};