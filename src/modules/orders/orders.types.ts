export interface Orders {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrdersInput {
  // 待补充具体字段
}

export interface UpdateOrdersInput {
  // 待补充具体字段
}

export interface OrdersQuery {
  page?: number;
  limit?: number;
  // 待补充查询字段
}
