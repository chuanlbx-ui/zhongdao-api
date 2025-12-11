export interface Points {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePointsInput {
  // 待补充具体字段
}

export interface UpdatePointsInput {
  // 待补充具体字段
}

export interface PointsQuery {
  page?: number;
  limit?: number;
  // 待补充查询字段
}
