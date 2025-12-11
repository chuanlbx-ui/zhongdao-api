import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../../../shared/types/response';
import {
  LogisticsStatus,
  DeliveryType,
  TrackSource,
  OrderStatus
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 批量发货
 */
export const batchShipController = async (
  req: Request,
  res: Response
) => {
  const {
    orderIds,
    companyId,
    defaultSenderInfo,
    defaultPackageInfo,
    deliveryType = DeliveryType.STANDARD
  } = req.body;

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res.json(ApiResponse.error('订单ID列表不能为空'));
  }

  if (!companyId) {
    return res.json(ApiResponse.error('物流公司ID不能为空'));
  }

  // 检查物流公司是否存在
  const company = await prisma.logisticsCompany.findUnique({
    where: { id: companyId }
  });

  if (!company) {
    return res.json(ApiResponse.error('物流公司不存在', 404));
  }

  // 查询订单信息
  const orders = await prisma.orders.findMany({
    where: {
      id: { in: orderIds },
      userId: req.user!.id, // 只能处理自己的订单
      status: 'PAID' // 只能处理已付款的订单
    },
    include: {
      user: {
        select: {
          nickname: true,
          phone: true
        }
      }
    }
  });

  if (orders.length === 0) {
    return res.json(ApiResponse.error('没有找到可发货的订单'));
  }

  const results = [];
  const errors = [];

  for (const order of orders) {
    try {
      // 检查订单是否已有发货记录
      const existingShipment = await prisma.logisticsShipment.findUnique({
        where: { orderId: order.id }
      });

      if (existingShipment) {
        errors.push({
          orderId: order.id,
          orderNo: order.orderNo,
          error: '订单已有发货记录'
        });
        continue;
      }

      // 生成发货单号和物流单号
      const shipmentNo = `SH${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const trackingNumber = `${company.code}${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // 计算预计送达时间
      const estimatedDelivery = new Date(Date.now() +
        (deliveryType === DeliveryType.EXPRESS ?
          company.expressDelivery : company.normalDelivery) * 60 * 60 * 1000);

      // 创建发货记录
      const shipment = await prisma.logisticsShipment.create({
        data: {
          shipmentNo,
          orderId: order.id,
          userId: req.user!.id,
          companyId,
          trackingNumber,
          // 发件人信息
          senderName: defaultSenderInfo?.name || req.user!.nickname || '发件人',
          senderPhone: defaultSenderInfo?.phone || req.user!.phone,
          senderAddress: defaultSenderInfo?.address,
          senderProvince: defaultSenderInfo?.province,
          senderCity: defaultSenderInfo?.city,
          senderDistrict: defaultSenderInfo?.district,
          senderPostalCode: defaultSenderInfo?.postalCode,
          // 收件人信息
          receiverName: order.receiverName,
          receiverPhone: order.receiverPhone,
          receiverAddress: order.receiverAddress,
          // 包裹信息
          packageCount: defaultPackageInfo?.count || 1,
          packageWeight: defaultPackageInfo?.weight,
          packageVolume: defaultPackageInfo?.volume,
          packageDesc: defaultPackageInfo?.description,
          goodsValue: order.finalAmount,
          deliveryType,
          estimatedDelivery,
          status: LogisticsStatus.CONFIRMED
        }
      });

      // 更新订单状态
      await prisma.orders.update({
        where: { id: order.id },
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
          location: defaultSenderInfo?.city || '发货地',
          description: `您的包裹已由${company.displayName}揽收`,
          operator: defaultSenderInfo?.name || req.user!.nickname,
          source: TrackSource.MANUAL
        }
      });

      results.push({
        orderId: order.id,
        orderNo: order.orderNo,
        shipmentNo: shipment.shipmentNo,
        trackingNumber: shipment.trackingNumber,
        status: 'success'
      });

    } catch (error) {
      errors.push({
        orderId: order.id,
        orderNo: order.orderNo,
        error: (error as Error).message
      });
    }
  }

  res.json(ApiResponse.success({
    total: orderIds.length,
    success: results.length,
    failed: errors.length,
    results,
    errors
  }, `批量发货完成，成功${results.length}个，失败${errors.length}个`));
};

/**
 * 部分发货/拆单发货
 */
export const partialShipController = async (
  req: Request,
  res: Response
) => {
  const {
    orderId,
    orderItemIds, // 需要发货的订单项ID列表
    companyId,
    trackingNumber,
    senderInfo,
    receiverInfo,
    packageInfo,
    deliveryType = DeliveryType.STANDARD,
    estimatedDelivery,
    remarks
  } = req.body;

  if (!orderId || !orderItemIds || !Array.isArray(orderItemIds) || orderItemIds.length === 0) {
    return res.json(ApiResponse.error('订单ID和订单项列表不能为空'));
  }

  if (!companyId) {
    return res.json(ApiResponse.error('物流公司ID不能为空'));
  }

  // 检查订单是否存在
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      orderItems: true
    }
  });

  if (!order) {
    return res.json(ApiResponse.error('订单不存在', 404));
  }

  // 权限检查
  if (order.userId !== req.user!.id) {
    return res.json(ApiResponse.error('无权操作此订单', 403));
  }

  // 检查订单状态
  if (order.status !== 'PAID') {
    return res.json(ApiResponse.error('订单状态不允许发货'));
  }

  // 检查订单项是否都属于该订单
  const validOrderItemIds = order.orderItems.map(item => item.id);
  const invalidOrderItemIds = orderItemIds.filter(id => !validOrderItemIds.includes(id));

  if (invalidOrderItemIds.length > 0) {
    return res.json(ApiResponse.error('部分订单项不属于该订单'));
  }

  // 检查物流公司是否存在
  const company = await prisma.logisticsCompany.findUnique({
    where: { id: companyId }
  });

  if (!company) {
    return res.json(ApiResponse.error('物流公司不存在', 404));
  }

  try {
    // 生成发货单号
    const shipmentNo = `SH${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // 计算预计送达时间
    const estimatedDeliveryTime = estimatedDelivery ||
      new Date(Date.now() + (deliveryType === DeliveryType.EXPRESS ?
        company.expressDelivery : company.normalDelivery) * 60 * 60 * 1000);

    // 计算发货商品的价值
    const shippedOrderItems = order.orderItems.filter(item => orderItemIds.includes(item.id));
    const goodsValue = shippedOrderItems.reduce((sum, item) => sum + item.totalAmount, 0);

    // 创建发货记录
    const shipment = await prisma.logisticsShipment.create({
      data: {
        shipmentNo,
        orderId,
        userId: req.user!.id,
        companyId,
        trackingNumber: trackingNumber || `${company.code}${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        // 发件人信息
        senderName: senderInfo?.name || req.user!.nickname || '发件人',
        senderPhone: senderInfo?.phone || req.user!.phone,
        senderAddress: senderInfo?.address,
        senderProvince: senderInfo?.province,
        senderCity: senderInfo?.city,
        senderDistrict: senderInfo?.district,
        senderPostalCode: senderInfo?.postalCode,
        // 收件人信息
        receiverName: receiverInfo?.name || order.receiverName,
        receiverPhone: receiverInfo?.phone || order.receiverPhone,
        receiverAddress: receiverInfo?.address || order.receiverAddress,
        receiverProvince: receiverInfo?.province,
        receiverCity: receiverInfo?.city,
        receiverDistrict: receiverInfo?.district,
        receiverPostalCode: receiverInfo?.postalCode,
        // 包裹信息
        packageCount: packageInfo?.count || 1,
        packageWeight: packageInfo?.weight,
        packageVolume: packageInfo?.volume,
        packageDesc: packageInfo?.description || `部分发货：${shippedOrderItems.map(item => item.productsName).join('、')}`,
        goodsValue,
        deliveryType,
        estimatedDelivery: estimatedDeliveryTime,
        status: LogisticsStatus.CONFIRMED,
        remarks
      }
    });

    // 更新订单状态（检查是否所有商品都已发货）
    const remainingItems = order.orderItems.filter(item => !orderItemIds.includes(item.id));

    if (remainingItems.length === 0) {
      // 全部商品已发货
      await prisma.orders.update({
        where: { id: orderId },
        data: {
          status: 'SHIPPED',
          shippedAt: new Date()
        }
      });
    } else {
      // 部分发货，更新为处理中状态
      await prisma.orders.update({
        where: { id: orderId },
        data: {
          status: 'PROCESSING'
        }
      });
    }

    // 添加初始轨迹记录
    await prisma.logisticsTrack.create({
      data: {
        shipmentId: shipment.id,
        time: new Date(),
        status: '已揽收',
        location: senderInfo?.city || '发货地',
        description: `您的包裹（部分发货）已由${company.displayName}揽收，包含：${shippedOrderItems.map(item => item.productsName).join('、')}`,
        operator: senderInfo?.name || req.user!.nickname,
        source: TrackSource.MANUAL
      }
    });

    res.json(ApiResponse.success({
      shipment: {
        id: shipment.id,
        shipmentNo: shipment.shipmentNo,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        estimatedDelivery: shipment.estimatedDelivery
      },
      shippedItems: shippedOrderItems.map(item => ({
        id: item.id,
        productName: item.productsName,
        quantity: item.quantity,
        totalAmount: item.totalAmount
      })),
      remainingItems: remainingItems.map(item => ({
        id: item.id,
        productName: item.productsName,
        quantity: item.quantity,
        totalAmount: item.totalAmount
      }))
    }, '部分发货成功'));

  } catch (error) {
    res.json(ApiResponse.error('部分发货失败：' + (error as Error).message));
  }
};

/**
 * 运费估算
 */
export const estimateShippingController = async (
  req: Request,
  res: Response
) => {
  const {
    companyId,
    senderProvince,
    senderCity,
    receiverProvince,
    receiverCity,
    packageInfo,
    deliveryType = DeliveryType.STANDARD,
    codAmount = 0
  } = req.body;

  if (!companyId || !senderProvince || !senderCity || !receiverProvince || !receiverCity) {
    return res.json(ApiResponse.error('发货地、收货地和物流公司信息不能为空'));
  }

  // 检查物流公司是否存在
  const company = await prisma.logisticsCompany.findUnique({
    where: { id: companyId }
  });

  if (!company) {
    return res.json(ApiResponse.error('物流公司不存在', 404));
  }

  try {
    // 基础运费计算逻辑
    let baseFee = 0;
    let weightFee = 0;
    let volumeFee = 0;
    let distanceFee = 0;
    let codFee = 0;

    // 距离判断（简化版，实际应该根据具体地区计算）
    const isSameCity = senderCity === receiverCity;
    const isSameProvince = senderProvince === receiverProvince && !isSameCity;
    const isCrossProvince = senderProvince !== receiverProvince;

    // 基础运费
    if (isSameCity) {
      baseFee = 8; // 同城
    } else if (isSameProvince) {
      baseFee = 12; // 同省
    } else {
      baseFee = 18; // 跨省
    }

    // 重量费用
    const weight = packageInfo?.weight || 1; // 默认1kg
    if (weight > 1) {
      weightFee = Math.ceil(weight - 1) * 2; // 超重部分每kg加2元
    }

    // 体积费用（如果有体积信息且体积重量大于实际重量）
    if (packageInfo?.volume) {
      const volumeWeight = packageInfo.volume / 5000; // 体积重量计算公式
      if (volumeWeight > weight) {
        volumeFee = Math.ceil(volumeWeight - weight) * 2;
      }
    }

    // 距离费用（偏远地区额外收费）
    const remoteAreas = ['新疆', '西藏', '内蒙古', '海南', '青海', '宁夏'];
    if (remoteAreas.includes(receiverProvince)) {
      distanceFee = 15;
    }

    // 货到付款费用
    if (codAmount > 0) {
      codFee = Math.max(3, codAmount * 0.01); // 最低3元，或1%
    }

    // 配送类型加价
    const deliveryTypeFee = deliveryType === DeliveryType.EXPRESS ? 5 : 0;
    const sameDayFee = deliveryType === DeliveryType.SAME_DAY ? 20 : 0;
    const nextDayFee = deliveryType === DeliveryType.NEXT_DAY ? 10 : 0;

    const totalFee = baseFee + weightFee + volumeFee + distanceFee + codFee +
                     deliveryTypeFee + sameDayFee + nextDayFee;

    // 预计送达时间
    let estimatedHours = company.normalDelivery;
    if (deliveryType === DeliveryType.EXPRESS) {
      estimatedHours = company.expressDelivery;
    } else if (deliveryType === DeliveryType.SAME_DAY) {
      estimatedHours = 6;
    } else if (deliveryType === DeliveryType.NEXT_DAY) {
      estimatedHours = 24;
    }

    const estimatedDelivery = new Date(Date.now() + estimatedHours * 60 * 60 * 1000);

    res.json(ApiResponse.success({
      companyId: company.id,
      companyName: company.displayName,
      deliveryType,
      feeDetails: {
        baseFee,
        weightFee,
        volumeFee,
        distanceFee,
        codFee,
        deliveryTypeFee,
        sameDayFee,
        nextDayFee
      },
      totalFee: Math.round(totalFee * 100) / 100, // 保留两位小数
      estimatedDelivery,
      estimatedHours
    }, '运费估算成功'));

  } catch (error) {
    res.json(ApiResponse.error('运费估算失败：' + (error as Error).message));
  }
};