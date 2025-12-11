import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InventoryService {
  async findAll(params: any = {}) {
    try {
      const { page = 1, limit = 10, ...filters } = params;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.inventoryItems.findMany({
          where: filters,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.inventoryItems.count({ where: filters })
      ]);

      return {
        data,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async findById(id: string) {
    return await prisma.inventoryItems.findUnique({
      where: { id }
    });
  }

  async create(data: any) {
    return await prisma.inventoryItems.create({
      data
    });
  }

  async update(id: string, data: any) {
    return await prisma.inventoryItems.update({
      where: { id },
      data
    });
  }

  async delete(id: string) {
    return await prisma.inventoryItems.delete({
      where: { id }
    });
  }
}

export const inventoryService = new InventoryService();
