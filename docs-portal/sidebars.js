const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: '快速开始',
      collapsed: false,
      items: [
        'getting-started',
        'installation',
        'configuration',
        'development-workflow',
      ],
    },
    {
      type: 'category',
      label: '架构设计',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'architecture/overview',
          label: '系统概述',
        },
        {
          type: 'category',
          label: '架构图',
          collapsed: true,
          items: [
            'architecture/c4-context',
            'architecture/c4-containers',
            'architecture/c4-components',
          ],
        },
        {
          type: 'category',
          label: '业务流程',
          collapsed: true,
          items: [
            'business-flows/user-registration',
            'business-flows/order-purchase',
            'business-flows/commission-calculation',
            'business-flows/inventory-management',
          ],
        },
        'architecture/database-schema',
        'architecture/security',
        'architecture/performance',
      ],
    },
    {
      type: 'category',
      label: '开发指南',
      collapsed: false,
      items: [
        'guides/authentication',
        'guides/error-handling',
        'guides/testing',
        'guides/deployment',
        'guides/monitoring',
        'guides/best-practices',
      ],
    },
    {
      type: 'category',
      label: 'API文档',
      collapsed: false,
      items: [
        {
          type: 'html',
          value: '<div class="api-docs-embed"></div>',
          label: 'API参考',
        },
        'api/authentication',
        'api/users',
        'api/products',
        'api/orders',
        'api/payments',
        'api/points',
        'api/shops',
        'api/inventory',
        'api/teams',
        'api/commission',
        'api/admin',
      ],
    },
    {
      type: 'category',
      label: '架构决策记录',
      collapsed: true,
      items: [
        'adr/README',
        'adr/0001-use-prisma',
        'adr/0002-jwt-auth',
        'adr/0003-user-hierarchy',
        'adr/0004-dual-shop-system',
        'adr/0005-dual-warehouse',
      ],
    },
  ],
};

module.exports = sidebars;