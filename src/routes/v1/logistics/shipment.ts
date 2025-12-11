import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../../../shared/types/response';
import {
  LogisticsStatus,
  DeliveryType,
  TrackSource,
  SyncStatus
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 获取发货列表
 */
export const getShipmentsController = async (
  req: Request,
  res: Response
) => {
  const {
    page = 1,
    perPage = 20,
    search,
    status,
    companyId,
    orderId,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const skip = (Number(page) - 1) * Number(perPage);
  const take = Number(perPage);

  // 构建查询条件
  const where: any = {};

  // 修复2：权限参数检查 - 支持多种级别格式，统一使用大写格式
  // 按用户权限过滤
  if (req.user?.level === 'NORMAL' || req.user?.level === 'VIP') {
    // 普通用户只能看到自己的订单的物流信息
    where.userId = req.user.id;
  } else {
    // 店长可以看到自己发货的记录
    where.userId = req.user.id;
  }

  if (search) {
    where.OR = [
      { shipmentNo: { contains: search as string } },
      { trackingNumber: { contains: search as string } },
      { receiverName: { contains: search as string } },
      { receiverPhone: { contains: search as string } }
    ];
  }

  if (status) {
    where.status = status as LogisticsStatus;
  }

  if (companyId) {
    where.companyId = companyId as string;
  }

  if (orderId) {
    where.orderId = orderId as string;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate as string);
    }
  }

  const [shipments, total] = await Promise.all([
    prisma.logisticsShipment.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy as string]: sortOrder as 'asc' | 'desc' },
      select: {
        id: true,
        shipmentNo: true,
        orderId: true,
        company: {
          select: {
            id: true,
            code: true,
            name: true,
            displayName: true
          }
        },
        trackingNumber: true,
        receiverName: true,
        receiverPhone: true,
        receiverAddress: true,
        status: true,
        lastStatus: true,
        lastLocation: true,
        isException: true,
        estimatedDelivery: true,
        actualDelivery: true,
        createdAt: true,
        shippedAt: true,
        completedAt: true
      }
    }),
    prisma.logisticsShipment.count({ where })
  ]);

  res.json(ApiResponse.success({
    items: shipments,
    total,
    page: Number(page),
    perPage: Number(perPage),
    totalPages: Math.ceil(total / Number(perPage))
  }));
};

/**
 * 根据ID获取发货详情
 */
export const getShipmentByIdController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  const shipment = await prisma.logisticsShipment.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          id: true,
          code: true,
          name: true,
          displayName: true,
          phone: true,
          website: true
        }
      },
      order: {
        select: {
          id: true,
          orderNo: true,
          totalAmount: true,
          finalAmount: true
        }
      },
      tracks: {
        orderBy: { time: 'desc' },
        select: {
          id: true,
          time: true,
          status: true,
          location: true,
          description: true,
          operator: true,
          source: true,
          createdAt: true
        }
      }
    }
  });

  if (!shipment) {
    return res.json(ApiResponse.error('发货记录不存在', 404));
  }

  // 权限检查
  if (shipment.userId !== req.user!.id && !['ADMIN'].includes(req.user!.level)) {
    return res.json(ApiResponse.error('无权访问此发货记录', 403));
  }

  res.json(ApiResponse.success(shipment));
};

/**
 * 创建发货记录
 */
export const createShipmentController = async (
  req: Request,
  res: Response
) => {
  const {
    orderId,
    companyId,
    trackingNumber,
    expressType,
    senderName,
    senderPhone,
    senderAddress,
    senderProvince,
    senderCity,
    senderDistrict,
    senderPostalCode,
    receiverName,
    receiverPhone,
    receiverAddress,
    receiverProvince,
    receiverCity,
    receiverDistrict,
    receiverPostalCode,
    packageCount = 1,
    packageWeight,
    packageVolume,
    packageDesc,
    goodsValue,
    deliveryType = DeliveryType.STANDARD,
    deliveryFee = 0,
    CODAmount,
    estimatedDelivery,
    remarks
  } = req.body;

  // 检查订单是否存在
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          phone: true
        }
      }
    }
  });

  if (!order) {
    return res.json(ApiResponse.error('订单不存在', 404));
  }

  // 检查物流公司是否存在
  const company = await prisma.logisticsCompany.findUnique({
    where: { id: companyId }
  });

  if (!company) {
    return res.json(ApiResponse.error('物流公司不存在', 404));
  }

  // 检查订单是否已有发货记录
  const existingShipment = await prisma.logisticsShipment.findUnique({
    where: { orderId }
  });

  if (existingShipment) {
    return res.json(ApiResponse.error('该订单已有发货记录'));
  }

  // 生成发货单号
  const shipmentNo = `SH${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // 计算预计送达时间
  const estimatedDeliveryTime = estimatedDelivery ||
    new Date(Date.now() + (deliveryType === DeliveryType.EXPRESS ?
      company.expressDelivery : company.normalDelivery) * 60 * 60 * 1000);

  const shipment = await prisma.logisticsShipment.create({
    data: {
      shipmentNo,
      orderId,
      userId: req.user!.id,
      companyId,
      trackingNumber,
      expressType,
      senderName: senderName || req.user!.nickname || '发件人',
      senderPhone: senderPhone || req.user!.phone,
      senderAddress,
      senderProvince,
      senderCity,
      senderDistrict,
      senderPostalCode,
      receiverName,
      receiverPhone,
      receiverAddress,
      receiverProvince,
      receiverCity,
      receiverDistrict,
      receiverPostalCode,
      packageCount,
      packageWeight,
      packageVolume,
      packageDesc,
      goodsValue,
      deliveryType,
      deliveryFee,
      CODAmount,
      estimatedDelivery: estimatedDeliveryTime,
      status: LogisticsStatus.CONFIRMED,
      remarks
    },
    include: {
      company: {
        select: {
          id: true,
          code: true,
          name: true,
          displayName: true
        }
      }
    }
  });

  // 更新订单状态
  await prisma.orders.update({
    where: { id: orderId },
    data: {
      status: 'SHIPPED',
      shippedAt: new Date()
    }
  });

  // 添加初始轨迹记录
  await prisma.logisticsTrack.create({
    data: {
      shipmentId: shipment.id,
      time: new Date(),
      status: '已揽收',
      location: senderCity || '发货地',
      description: `您的包裹已由${company.displayName}揽收，快递员：${senderName || '发件人'}`,
      operator: senderName,
      source: TrackSource.MANUAL
    }
  });

  res.json(ApiResponse.success(shipment, '发货记录创建成功'));
};

/**
 * 更新发货记录
 */
export const updateShipmentController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const updateData = req.body;

  // 检查发货记录是否存在
  const existingShipment = await prisma.logisticsShipment.findUnique({
    where: { id }
  });

  if (!existingShipment) {
    return res.json(ApiResponse.error('发货记录不存在', 404));
  }

  // 权限检查
  if (existingShipment.userId !== req.user!.id && !['ADMIN'].includes(req.user!.level)) {
    return res.json(ApiResponse.error('无权修改此发货记录', 403));
  }

  // 检查发货状态是否允许修改
  if (existingShipment.status === LogisticsStatus.DELIVERED ||
      existingShipment.status === LogisticsStatus.CANCELLED) {
    return res.json(ApiResponse.error('该发货状态不允许修改'));
  }

  const shipment = await prisma.logisticsShipment.update({
    where: { id },
    data: updateData,
    include: {
      company: {
        select: {
          id: true,
          code: true,
          name: true,
          displayName: true
        }
      }
    }
  });

  res.json(ApiResponse.success(shipment, '发货记录更新成功'));
};

/**
 * 删除发货记录
 */
export const deleteShipmentController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  // 检查发货记录是否存在
  const existingShipment = await prisma.logisticsShipment.findUnique({
    where: { id }
  });

  if (!existingShipment) {
    return res.json(ApiResponse.error('发货记录不存在', 404));
  }

  // 权限检查
  if (existingShipment.userId !== req.user!.id && !['ADMIN'].includes(req.user!.level)) {
    return res.json(ApiResponse.error('无权删除此发货记录', 403));
  }

  // 检查发货状态是否允许删除
  if (![LogisticsStatus.PENDING, LogisticsStatus.CONFIRMED].includes(existingShipment.status)) {
    return res.json(ApiResponse.error('该发货状态不允许删除'));
  }

  await prisma.logisticsShipment.delete({
    where: { id }
  });

  // 更新订单状态
  await prisma.orders.update({
    where: { id: existingShipment.orderId },
    data: {
      status: 'PAID',
      shippedAt: null
    }
  });

  res.json(ApiResponse.success(null, '发货记录删除成功'));
};

/**
 * 获取物流轨迹
 */
export const getTrackingController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  const shipment = await prisma.logisticsShipment.findUnique({
    where: { id },
    select: {
      id: true,
      shipmentNo: true,
      trackingNumber: true,
      status: true,
      userId: true,
      company: {
        select: {
          id: true,
          code: true,
          name: true,
          displayName: true,
          phone: true
        }
      }
    }
  });

  if (!shipment) {
    return res.json(ApiResponse.error('发货记录不存在', 404));
  }

  // 权限检查
  if (shipment.userId !== req.user!.id && !['ADMIN'].includes(req.user!.level)) {
    return res.json(ApiResponse.error('无权访问此物流轨迹', 403));
  }

  const tracks = await prisma.logisticsTrack.findMany({
    where: { shipmentId: id },
    orderBy: { time: 'desc' },
    select: {
      id: true,
      time: true,
      status: true,
      location: true,
      description: true,
      operator: true,
      operatorPhone: true,
      source: true,
      sourceCode: true,
      createdAt: true
    }
  });

  res.json(ApiResponse.success({
    shipment,
    tracks
  }));
};

/**
 * 添加物流轨迹
 */
export const addTrackingController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const {
    time,
    status,
    location,
    description,
    operator,
    operatorPhone,
    source = TrackSource.MANUAL,
    sourceCode
  } = req.body;

  // 检查发货记录是否存在
  const existingShipment = await prisma.logisticsShipment.findUnique({
    where: { id }
  });

  if (!existingShipment) {
    return res.json(ApiResponse.error('发货记录不存在', 404));
  }

  // 权限检查
  if (existingShipment.userId !== req.user!.id && !['ADMIN'].includes(req.user!.level)) {
    return res.json(ApiResponse.error('无权添加物流轨迹', 403));
  }

  const track = await prisma.logisticsTrack.create({
    data: {
      shipmentId: id,
      time: new Date(time),
      status,
      location,
      description,
      operator,
      operatorPhone,
      source,
      sourceCode
    }
  });

  // 更新发货记录的最新状态
  await prisma.logisticsShipment.update({
    where: { id },
    data: {
      lastStatus: status,
      lastLocation: location
    }
  });

  res.json(ApiResponse.success(track, '物流轨迹添加成功'));
};

/**
 * 同步物流轨迹（API自动获取）
 */
export const syncTrackingController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  // 检查发货记录是否存在
  const shipment = await prisma.logisticsShipment.findUnique({
    where: { id },
    include: {
      company: true
    }
  });

  if (!shipment) {
    return res.json(ApiResponse.error('发货记录不存在', 404));
  }

  // 权限检查
  if (shipment.userId !== req.user!.id && !['ADMIN'].includes(req.user!.level)) {
    return res.json(ApiResponse.error('无权同步物流轨迹', 403));
  }

  // 检查物流公司是否支持API同步
  if (!shipment.company.isApiEnabled || !shipment.company.apiProvider) {
    return res.json(ApiResponse.error('该物流公司不支持API同步'));
  }

  try {
    // TODO: 调用物流公司API获取轨迹信息
    // 这里需要根据不同的物流公司API实现具体的调用逻辑

    // 暂时返回成功提示
    await prisma.logisticsShipment.update({
      where: { id },
      data: {
        syncStatus: SyncStatus.SUCCESS,
        apiSyncedAt: new Date()
      }
    });

    res.json(ApiResponse.success(null, '物流轨迹同步成功'));

  } catch (error) {
    await prisma.logisticsShipment.update({
      where: { id },
      data: {
        syncStatus: SyncStatus.FAILED,
        apiSyncedAt: new Date()
      }
    });

    res.json(ApiResponse.error('物流轨迹同步失败：' + (error as Error).message));
  }
};