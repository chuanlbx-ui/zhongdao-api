export interface Teams {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTeamsInput {
  // 待补充具体字段
}

export interface UpdateTeamsInput {
  // 待补充具体字段
}

export interface TeamsQuery {
  page?: number;
  limit?: number;
  // 待补充查询字段
}
