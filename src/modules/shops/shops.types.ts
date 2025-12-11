export interface Shops {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShopsInput {
  // 待补充具体字段
}

export interface UpdateShopsInput {
  // 待补充具体字段
}

export interface ShopsQuery {
  page?: number;
  limit?: number;
  // 待补充查询字段
}
