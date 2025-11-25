import { PurchaseService, PurchaseValidationResult } from '@/modules/purchase/purchase.service';
import { UserLevel } from '@/modules/user/level.service';
import { TeamService } from '@/modules/user/team.service';
import { prisma } from '@/shared/database/client';

// Mock dependencies
jest.mock('@/shared/database/client');
jest.mock('@/modules/user/team.service');
jest.mock('@/shared/utils/logger');

describe('PurchaseService - validatePurchasePermission', () => {
  let purchaseService: PurchaseService;
  let mockTeamService: jest.Mocked<TeamService>;
  let mockPrisma: jest.Mocked<typeof prisma>;

  // 测试数据
  const testUsers = {
    normalUser: {
      id: 'user-normal',
      level: UserLevel.NORMAL,
      status: 'ACTIVE',
      parentId: 'user-vip',
      teamPath: '/root/user-vip/user-normal'
    },
    vipUser: {
      id: 'user-vip',
      level: UserLevel.VIP,
      status: 'ACTIVE',
      parentId: 'user-star1',
      teamPath: '/root/user-star1/user-vip'
    },
    star1User: {
      id: 'user-star1',
      level: UserLevel.STAR_1,
      status: 'ACTIVE',
      parentId: 'user-star2',
      teamPath: '/root/user-star2/user-star1'
    },
    star2User: {
      id: 'user-star2',
      level: UserLevel.STAR_2,
      status: 'ACTIVE',
      parentId: 'user-star3',
      teamPath: '/root/user-star3/user-star2'
    },
    star3User: {
      id: 'user-star3',
      level: UserLevel.STAR_3,
      status: 'ACTIVE',
      parentId: null,
      teamPath: '/root/user-star3'
    },
    inactiveUser: {
      id: 'user-inactive',
      level: UserLevel.VIP,
      status: 'INACTIVE',
      parentId: 'user-star1',
      teamPath: '/root/user-star1/user-inactive'
    }
  };

  const testProduct = {
    id: 'product-1',
    status: 'ACTIVE',
    totalStock: 100,
    productSpecs: [
      { id: 'spec-1', stock: 50, price: 100, isActive: true },
      { id: 'spec-2', stock: 50, price: 150, isActive: true }
    ]
  };

  beforeEach(() => {
    purchaseService = new PurchaseService();
    mockTeamService = teamService as jest.Mocked<TeamService>;
    mockPrisma = prisma as jest.Mocked<typeof prisma>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default team service mock
    mockTeamService.validateTeamRelationship.mockResolvedValue({
      isValid: true,
      relationship: 'direct',
      distance: 1
    });

    // Setup default prisma mocks
    mockPrisma.user.findUnique = jest.fn();
    mockPrisma.product.findUnique = jest.fn();
  });

  describe('基础验证测试', () => {
    test('应该允许正常的低等级向高等级采购', async () => {
      // Arrange
      const mockBuyer = testUsers.normalUser;
      const mockSeller = testUsers.vipUser;

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer) // buyer
        .mockResolvedValueOnce(mockSeller); // seller

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(testProduct);

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.canPurchase).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    test('应该拒绝采购用户不存在的情况', async () => {
      // Arrange
      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // buyer 不存在
        .mockResolvedValueOnce(testUsers.vipUser); // seller

      // Act
      const result = await purchaseService.validatePurchasePermission(
        'nonexistent-buyer',
        testUsers.vipUser.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购用户不存在');
    });

    test('应该拒绝销售用户不存在的情况', async () => {
      // Arrange
      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(testUsers.normalUser) // buyer
        .mockResolvedValueOnce(null); // seller 不存在

      // Act
      const result = await purchaseService.validatePurchasePermission(
        testUsers.normalUser.id,
        'nonexistent-seller',
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('销售用户不存在');
    });

    test('应该拒绝账户状态异常的用户', async () => {
      // Arrange
      const mockBuyer = testUsers.normalUser;
      const mockSeller = testUsers.inactiveUser; // INACTIVE 状态

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockSeller);

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(testProduct);

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('销售用户账户状态异常');
    });
  });

  describe('等级关系验证测试', () => {
    test('应该拒绝高等级向低等级采购', async () => {
      // Arrange
      const mockBuyer = testUsers.star2User; // STAR_2
      const mockSeller = testUsers.vipUser; // VIP (更低等级)

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockSeller);

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(testProduct);

      mockTeamService.validateTeamRelationship.mockResolvedValue({
        isValid: true,
        relationship: 'direct',
        distance: 1
      });

      // Mock 上级查找（应该找不到更高级别的上级）
      (mockPrisma.user.findUnique as jest.Mock)
        .mockImplementation((query: any) => {
          if (query.where.id === mockSeller.id) {
            return Promise.resolve({
              ...mockSeller,
              parentId: testUsers.star1User.id
            });
          }
          if (query.where.id === testUsers.star1User.id) {
            return Promise.resolve({
              ...testUsers.star1User,
              parentId: null // 没有更高级别的上级
            });
          }
          return Promise.resolve(null);
        });

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons.some(reason =>
        reason.includes('采购方等级(STAR_2)高于或等于销售方等级(VIP)')
      )).toBe(true);
    });

    test('应该拒绝无团队关系的采购', async () => {
      // Arrange
      const mockBuyer = testUsers.normalUser;
      const mockSeller = testUsers.star1User;

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockSeller);

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(testProduct);

      mockTeamService.validateTeamRelationship.mockResolvedValue({
        isValid: false,
        relationship: 'none',
        distance: -1
      });

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购方与销售方无有效团队关系，必须在同一团队内才能进行采购');
    });
  });

  describe('平级上级特殊处理测试', () => {
    test('应该自动寻找更高级别的上级（平级情况）', async () => {
      // Arrange
      const mockBuyer = testUsers.vipUser; // VIP
      const mockSeller = testUsers.vipUser; // 同等级 VIP
      const mockHigherUpline = testUsers.star1User; // 更高级别 STAR_1

      (mockPrisma.user.findUnique as jest.Mock)
        .mockImplementation((query: any) => {
          if (query.select?.id && query.select?.level && query.select?.status) {
            // 主查询
            if (query.where.id === mockBuyer.id) {
              return Promise.resolve(mockBuyer);
            }
            if (query.where.id === mockSeller.id) {
              return Promise.resolve(mockSeller);
            }
          } else {
            // 上级查找查询
            if (query.where.id === mockSeller.id) {
              return Promise.resolve({
                parentId: mockHigherUpline.id
              });
            }
            if (query.where.id === mockHigherUpline.id) {
              return Promise.resolve(mockHigherUpline);
            }
          }
          return Promise.resolve(null);
        });

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(testProduct);

      mockTeamService.validateTeamRelationship.mockResolvedValue({
        isValid: true,
        relationship: 'direct',
        distance: 1
      });

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.canPurchase).toBe(true);
      expect(result.metadata?.levelComparison?.result).toBe('valid');
      expect(result.metadata?.levelComparison?.finalSellerLevel).toBe(UserLevel.STAR_1);
    });

    test('应该在没有更高级别上级时拒绝采购', async () => {
      // Arrange
      const mockBuyer = testUsers.star2User; // STAR_2
      const mockSeller = testUsers.star2User; // 同等级 STAR_2

      (mockPrisma.user.findUnique as jest.Mock)
        .mockImplementation((query: any) => {
          if (query.select?.id && query.select?.level && query.select?.status) {
            // 主查询
            if (query.where.id === mockBuyer.id) {
              return Promise.resolve(mockBuyer);
            }
            if (query.where.id === mockSeller.id) {
              return Promise.resolve(mockSeller);
            }
          } else {
            // 上级查找查询 - 没有更高级别的上级
            if (query.where.id === mockSeller.id) {
              return Promise.resolve({
                parentId: null // 没有上级
              });
            }
          }
          return Promise.resolve(null);
        });

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(testProduct);

      mockTeamService.validateTeamRelationship.mockResolvedValue({
        isValid: true,
        relationship: 'direct',
        distance: 1
      });

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons.some(reason =>
        reason.includes('未找到更高级别的上级')
      )).toBe(true);
    });
  });

  describe('产品和库存验证测试', () => {
    test('应该拒绝不存在的商品', async () => {
      // Arrange
      const mockBuyer = testUsers.normalUser;
      const mockSeller = testUsers.vipUser;

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockSeller);

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(null); // 商品不存在

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        'nonexistent-product',
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('商品不存在');
    });

    test('应该拒绝已下架的商品', async () => {
      // Arrange
      const mockBuyer = testUsers.normalUser;
      const mockSeller = testUsers.vipUser;
      const inactiveProduct = { ...testProduct, status: 'INACTIVE' };

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockSeller);

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(inactiveProduct);

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('商品已下架');
    });

    test('应该拒绝库存不足的采购', async () => {
      // Arrange
      const mockBuyer = testUsers.normalUser;
      const mockSeller = testUsers.vipUser;
      const lowStockProduct = {
        ...testProduct,
        totalStock: 5
      };

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockSeller);

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(lowStockProduct);

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10 // 需要10个，但只有5个库存
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons.some(reason =>
        reason.includes('库存不足')
      )).toBe(true);
    });

    test('应该拒绝没有可用规格的商品', async () => {
      // Arrange
      const mockBuyer = testUsers.normalUser;
      const mockSeller = testUsers.vipUser;
      const noSpecsProduct = {
        ...testProduct,
        productSpecs: [] // 没有规格
      };

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockSeller);

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(noSpecsProduct);

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('商品没有可用的规格');
    });
  });

  describe('错误处理测试', () => {
    test('应该处理数据库查询错误', async () => {
      // Arrange
      (mockPrisma.user.findUnique as jest.Mock)
        .mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await purchaseService.validatePurchasePermission(
        'buyer-id',
        'seller-id',
        'product-id',
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('验证过程中发生系统错误');
    });
  });

  describe('边界情况测试', () => {
    test('应该处理最高等级用户的采购请求', async () => {
      // Arrange - DIRECTOR (最高等级) 尝试采购
      const directorUser = {
        ...testUsers.star3User,
        level: UserLevel.DIRECTOR
      };

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(directorUser) // buyer (DIRECTOR)
        .mockResolvedValueOnce(testUsers.star3User); // seller (STAR_3)

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(testProduct);

      // Act
      const result = await purchaseService.validatePurchasePermission(
        directorUser.id,
        testUsers.star3User.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons.some(reason =>
        reason.includes('采购方等级高于或等于销售方等级')
      )).toBe(true);
    });

    test('应该处理复杂的多级团队关系', async () => {
      // Arrange
      const mockBuyer = testUsers.normalUser; // NORMAL
      const mockSeller = testUsers.star1User; // STAR_1

      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockSeller);

      (mockPrisma.product.findUnique as jest.Mock)
        .mockResolvedValue(testProduct);

      mockTeamService.validateTeamRelationship.mockResolvedValue({
        isValid: true,
        relationship: 'indirect',
        distance: 3 // 3级关系
      });

      // Act
      const result = await purchaseService.validatePurchasePermission(
        mockBuyer.id,
        mockSeller.id,
        testProduct.id,
        10
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.canPurchase).toBe(true);
      expect(result.metadata?.teamRelationship?.distance).toBe(3);
    });
  });
});