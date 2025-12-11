import { Request } from 'express';

// 仓库类型
export enum WarehouseType {
  PLATFORM = 'PLATFORM',    // 平台总仓
  CLOUD = 'CLOUD',          // 店长云仓
  LOCAL = 'LOCAL'           // 店长本地仓
}

// 库存操作类型
export enum InventoryOperationType {
  MANUAL_IN = 'MANUAL_IN',           // 手动入库
  MANUAL_OUT = 'MANUAL_OUT',         // 手动出库
  ORDER_OUT = 'ORDER_OUT',           // 订单出库
  PURCHASE_IN = 'PURCHASE_IN',       // 采购入库
  TRANSFER_IN = 'TRANSFER_IN',       // 调拨入库
  TRANSFER_OUT = 'TRANSFER_OUT',     // 调拨出库
  RETURN_IN = 'RETURN_IN',           // 退货入库
  DAMAGE_OUT = 'DAMAGE_OUT',         // 报损出库
  INITIAL = 'INITIAL'                // 初始库存
}

// 操作人员类型
export enum OperatorType {
  SYSTEM = 'SYSTEM',       // 系统操作
  ADMIN = 'ADMIN',         // 管理员操作
  USER = 'USER',          // 用户操作
  AUTO = 'AUTO'           // 自动操作
}

// 库存调整类型
export enum AdjustmentType {
  MANUAL_IN = 'MANUAL_IN',         // 手动入库
  MANUAL_OUT = 'MANUAL_OUT',       // 手动出库
  TRANSFER = 'TRANSFER',           // 库存调拨
  DAMAGE = 'DAMAGE'               // 库存报损
}

// 库存预警级别
export enum AlertLevel {
  LOW = 'LOW',           // 低库存
  CRITICAL = 'CRITICAL',  // 严重不足
  OUT_OF_STOCK = 'OUT_OF_STOCK'  // 缺货
}

// 库存预警状态
export enum AlertStatus {
  ACTIVE = 'ACTIVE',       // 活跃
  RESOLVED = 'RESOLVED',   // 已解决
  IGNORED = 'IGNORED'      // 已忽略
}

// 基础库存信息接口
export interface InventoryStock {
  id: string;
  productId: string;
  specId: string;
  warehouseType: WarehouseType;
  userId?: string;        // 所属用户ID（云仓和本地仓需要）
  shopId?: string;        // 所属店铺ID
  quantity: number;       // 当前库存数量
  reservedQuantity: number; // 预留库存数量
  availableQuantity: number; // 可用库存数量
  batchNumber?: string;   // 批次号
  expiryDate?: Date;      // 过期日期
  location?: string;      // 库位
  createdAt: Date;
  updatedAt: Date;
}

// 库存流水记录接口
export interface InventoryLog {
  id: string;
  operationType: InventoryOperationType;
  quantity: number;             // 变化数量（正数为入库，负数为出库）
  quantityBefore: number;       // 操作前库存
  quantityAfter: number;        // 操作后库存
  warehouseType: WarehouseType;
  userId?: string;              // 所属用户ID
  shopId?: string;              // 所属店铺ID
  productId: string;
  specId: string;
  batchNumber?: string;
  relatedOrderId?: string;      // 关联订单ID
  relatedPurchaseId?: string;   // 关联采购ID
  adjustmentReason?: string;    // 调整原因
  operatorType: OperatorType;   // 操作人类型
  operatorId?: string;          // 操作人ID
  remarks?: string;             // 备注
  createdAt: Date;
}

// 库存预警接口
export interface InventoryAlert {
  id: string;
  productId: string;
  specId: string;
  warehouseType: WarehouseType;
  userId?: string;
  shopId?: string;
  currentStock: number;         // 当前库存
  alertLevel: AlertLevel;       // 预警级别
  threshold: number;            // 预警阈值
  status: AlertStatus;          // 预警状态
  isRead: boolean;              // 是否已读
  resolvedAt?: Date;            // 解决时间
  resolvedBy?: string;          // 解决人ID
  resolveReason?: string;       // 解决原因
  createdAt: Date;
  updatedAt: Date;
}

// 库存调整参数接口
export interface ManualInParams {
  productId: string;
  specId: string;
  warehouseType: WarehouseType;
  userId?: string;
  shopId?: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: Date;
  location?: string;
  reason: string;
  remarks?: string;
}

export interface ManualOutParams {
  productId: string;
  specId: string;
  warehouseType: WarehouseType;
  userId?: string;
  shopId?: string;
  quantity: number;
  reason: string;
  remarks?: string;
}

export interface TransferParams {
  productId: string;
  specId: string;
  fromWarehouse: WarehouseType;
  toWarehouse: WarehouseType;
  fromUserId?: string;
  toUserId?: string;
  fromShopId?: string;
  toShopId?: string;
  quantity: number;
  reason: string;
  remarks?: string;
}

export interface DamageParams {
  productId: string;
  specId: string;
  warehouseType: WarehouseType;
  userId?: string;
  shopId?: string;
  quantity: number;
  batchNumber?: string;
  reason: string;
  remarks?: string;
}

// 库存调整结果接口
export interface InventoryAdjustmentResult {
  success: boolean;
  logId: string;
  beforeQuantity: number;
  afterQuantity: number;
  message: string;
}

// 库存统计信息接口
export interface InventoryStatistics {
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  warehouseStats: {
    warehouseType: WarehouseType;
    totalQuantity: number;
    totalValue: number;
    productCount: number;
  }[];
  operationStats: {
    operationType: InventoryOperationType;
    count: number;
    totalQuantity: number;
  }[];
  alertStats: {
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    criticalAlerts: number;
  };
  recentLogs: InventoryLog[];
}

// 库存流水查询参数
export interface InventoryLogQuery {
  productId?: string;
  specId?: string;
  warehouseType?: WarehouseType;
  operationType?: InventoryOperationType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
}

// 库存查询参数
export interface InventoryQuery {
  productId?: string;
  specId?: string;
  warehouseType?: WarehouseType;
  userId?: string;
  shopId?: string;
  batchNumber?: string;
  lowStock?: boolean;
  page?: number;
  perPage?: number;
}

// 库存预警查询参数
export interface AlertQuery {
  productId?: string;
  specId?: string;
  warehouseType?: WarehouseType;
  userId?: string;
  shopId?: string;
  alertLevel?: AlertLevel;
  status?: AlertStatus;
  isRead?: boolean;
  page?: number;
  perPage?: number;
}

// 采购入库参数（店长向上级采购）
export interface PurchaseInParams {
  fromUserId: string;      // 上级用户ID
  toUserId: string;        // 采购用户ID
  productId: string;
  specId: string;
  quantity: number;
  unitPrice: number;       // 采购单价
  totalAmount: number;     // 总金额
  relatedOrderId?: string;
}

// 销售出库参数（店长从云仓到本地仓）
export interface OrderOutParams {
  userId: string;          // 店长用户ID
  shopId: string;          // 店铺ID
  productId: string;
  specId: string;
  quantity: number;
  deliveryAddress?: string; // 发货地址
  relatedOrderId?: string;
}

// 扩展Request接口
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    level: string;
    shopId?: string;
    parentId?: string;
  };
}

// 库存操作参数接口
export interface StockOperationParams {
  productId: string;
  specId: string;
  quantity: number;
  batchNumber?: string;
  location?: string;
  expiryDate?: Date;
  operatorId?: string;
  operatorType: OperatorType;
  operationType: InventoryOperationType;
  reason?: string;
  remarks?: string;
}

// 批次管理接口
export interface BatchInfo {
  batchNumber: string;
  productId: string;
  specId: string;
  quantity: number;
  availableQuantity: number;
  manufacturingDate?: Date;
  expiryDate?: Date;
  location?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'USED_UP';
}

// 库存预警触发事件接口
export interface AlertTriggerEvent {
  productId: string;
  specId: string;
  warehouseType: WarehouseType;
  userId?: string;
  shopId?: string;
  currentStock: number;
  threshold: number;
  alertLevel: AlertLevel;
}

// 库存同步事件接口
export interface StockSyncEvent {
  productId: string;
  specId: string;
  warehouseType: WarehouseType;
  userId?: string;
  shopId?: string;
  batchNumber?: string;
  quantityBefore: number;
  quantityAfter: number;
  operationType: InventoryOperationType;
}

// 库存服务通用响应接口
export interface InventoryServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}