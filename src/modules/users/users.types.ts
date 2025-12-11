export interface Users {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUsersInput {
  // 待补充具体字段
}

export interface UpdateUsersInput {
  // 待补充具体字段
}

export interface UsersQuery {
  page?: number;
  limit?: number;
  // 待补充查询字段
}
