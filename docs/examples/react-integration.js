/**
 * 中道商城 React 前端集成示例
 * 完整的 React 应用架构，包含状态管理、路由配置、组件封装等
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

import { AuthProvider } from './auth-flow';
import { errorHandler, setupGlobalErrorHandlers } from './error-handling';
import { LayoutProvider } from './contexts/LayoutContext';
import PageLoading from './components/PageLoading';
import ErrorBoundary from './components/ErrorBoundary';

// 设置 dayjs 中文
dayjs.locale('zh-cn');

// 创建 React Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5分钟
      cacheTime: 10 * 60 * 1000, // 10分钟
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 1
    }
  }
});

// 全局错误处理
setupGlobalErrorHandlers();

// 懒加载页面组件
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const UserProfile = lazy(() => import('./pages/User/Profile'));
const UserLevel = lazy(() => import('./pages/User/Level'));
const TeamManagement = lazy(() => import('./pages/Team/Management'));
const TeamStats = lazy(() => import('./pages/Team/Stats'));
const ProductList = lazy(() => import('./pages/Product/List'));
const ProductDetail = lazy(() => import('./pages/Product/Detail'));
const OrderList = lazy(() => import('./pages/Order/List'));
const OrderDetail = lazy(() => import('./pages/Order/Detail'));
const ShopDashboard = lazy(() => import('./pages/Shop/Dashboard'));
const ShopSettings = lazy(() => import('./pages/Shop/Settings'));
const PointsBalance = lazy(() => import('./pages/Points/Balance'));
const PointsTransactions = lazy(() => import('./pages/Points/Transactions'));
const CommissionStats = lazy(() => import('./pages/Commission/Stats'));
const CommissionWithdraw = lazy(() => import('./pages/Commission/Withdraw'));
const AdminLogin = lazy(() => import('./pages/Admin/Login'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Ant Design 主题配置
const theme = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    borderRadius: 6,
    wireframe: false
  },
  components: {
    Layout: {
      headerBg: '#fff',
      siderBg: '#fff'
    },
    Menu: {
      itemSelectedBg: '#e6f7ff',
      itemSelectedColor: '#1890ff'
    }
  }
};

// ========== 主应用组件 ==========

function App() {
  return (
    <ErrorBoundary>
      <ConfigProvider locale={zhCN} theme={theme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LayoutProvider>
              <Router>
                <AppRoutes />
              </Router>
            </LayoutProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

// ========== 路由配置 ==========

function AppRoutes() {
  const { isAuthenticated, user, isLoading } = useAuth();

  // 加载中
  if (isLoading) {
    return <PageLoading />;
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* 公开路由 */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? <Login /> : <Navigate to="/" replace />
          }
        />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* 用户路由 */}
        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        <Route
          path="/user/profile"
          element={<RequireAuth><UserProfile /></RequireAuth>}
        />
        <Route
          path="/user/level"
          element={<RequireAuth><UserLevel /></RequireAuth>}
        />

        {/* 团队路由 */}
        <Route
          path="/team"
          element={<RequireAuth><TeamManagement /></RequireAuth>}
        />
        <Route
          path="/team/stats"
          element={<RequireAuth><TeamStats /></RequireAuth>}
        />

        {/* 商品路由 */}
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />

        {/* 订单路由 */}
        <Route
          path="/orders"
          element={<RequireAuth><OrderList /></RequireAuth>}
        />
        <Route
          path="/orders/:id"
          element={<RequireAuth><OrderDetail /></RequireAuth>}
        />

        {/* 店铺路由 */}
        <Route
          path="/shop"
          element={
            <RequireAuth>
              <ShopDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/shop/settings"
          element={
            <RequireAuth permission="SHOP_MANAGE">
              <ShopSettings />
            </RequireAuth>
          }
        />

        {/* 通券路由 */}
        <Route
          path="/points"
          element={
            <RequireAuth>
              <PointsBalance />
            </RequireAuth>
          }
        />
        <Route
          path="/points/transactions"
          element={
            <RequireAuth>
              <PointsTransactions />
            </RequireAuth>
          }
        />

        {/* 佣金路由 */}
        <Route
          path="/commission"
          element={
            <RequireAuth>
              <CommissionStats />
            </RequireAuth>
          }
        />
        <Route
          path="/commission/withdraw"
          element={
            <RequireAuth>
              <CommissionWithdraw />
            </RequireAuth>
          }
        />

        {/* 管理员路由 */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth role="ADMIN">
              <AdminRoutes />
            </RequireAuth>
          }
        />

        {/* 404 页面 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

// 管理员路由组
function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AdminDashboard />} />
      {/* 其他管理员路由 */}
      <Route path="users" element={<AdminUserManagement />} />
      <Route path="shops" element={<AdminShopManagement />} />
      <Route path="orders" element={<AdminOrderManagement />} />
      <Route path="products" element={<AdminProductManagement />} />
    </Routes>
  );
}

// 路由守卫组件
function RequireAuth({ children, permission, role }) {
  const { isAuthenticated, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <NoPermission />;
  }

  if (role && !hasRole(role)) {
    return <NoPermission />;
  }

  return children;
}

// ========== 自定义 Hooks ==========

/**
 * API 请求 Hook
 */
export function useApi(apiFunc, dependencies = [], options = {}) {
  return useQuery({
    queryKey: [apiFunc.name, ...dependencies],
    queryFn: apiFunc,
    ...options
  });
}

/**
 * API 修改 Hook
 */
export function useApiMutation(apiFunc, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiFunc,
    onSuccess: () => {
      // 显示成功提示
      message.success('操作成功');

      // 刷新相关查询
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      // 错误已在 axios 客户端中处理
    },
    ...options
  });
}

/**
 * 分页 Hook
 */
export function usePagination(initialParams = {}) {
  const [params, setParams] = useState({
    page: 1,
    pageSize: 20,
    ...initialParams
  });

  const handleTableChange = (pagination, filters, sorter) => {
    setParams({
      ...params,
      page: pagination.current,
      pageSize: pagination.pageSize,
      ...filters,
      sorterField: sorter.field,
      sorterOrder: sorter.order
    });
  };

  const resetParams = () => {
    setParams({
      page: 1,
      pageSize: 20,
      ...initialParams
    });
  };

  return {
    params,
    setParams,
    handleTableChange,
    resetParams
  };
}

// ========== 通用组件示例 ==========

/**
 * 数据表格组件
 */
import { Table, Card, Space, Button, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

export function DataTable({
  title,
  columns,
  dataSource,
  loading,
  pagination,
  onCreate,
  onEdit,
  onDelete,
  actions,
  ...props
}) {
  const actionColumn = {
    title: '操作',
    key: 'action',
    fixed: 'right',
    width: 150,
    render: (_, record) => (
      <Space size="small">
        {onEdit && (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>
        )}
        {onDelete && (
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => onDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        )}
        {actions && actions(record)}
      </Space>
    )
  };

  const finalColumns = [...columns];
  if ((onEdit || onDelete || actions) && !finalColumns.some(col => col.key === 'action')) {
    finalColumns.push(actionColumn);
  }

  return (
    <Card
      title={
        <div className="flex justify-between items-center">
          <span>{title}</span>
          {onCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onCreate}
            >
              新增
            </Button>
          )}
        </div>
      }
    >
      <Table
        columns={finalColumns}
        dataSource={dataSource}
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          ...pagination
        }}
        scroll={{ x: 'max-content' }}
        {...props}
      />
    </Card>
  );
}

/**
 * 搜索表单组件
 */
import { Form, Input, Select, DatePicker, Button, Space, Row, Col } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;

export function SearchForm({
  fields,
  onSearch,
  onReset,
  loading = false
}) {
  const [form] = Form.useForm();

  const handleSearch = (values) => {
    onSearch(values);
  };

  const handleReset = () => {
    form.resetFields();
    onReset && onReset();
  };

  return (
    <Card className="mb-4">
      <Form
        form={form}
        onFinish={handleSearch}
        layout="vertical"
      >
        <Row gutter={16}>
          {fields.map((field, index) => (
            <Col key={index} {...field.colProps}>
              <Form.Item
                name={field.name}
                label={field.label}
                rules={field.rules}
              >
                {renderFormItem(field)}
              </Form.Item>
            </Col>
          ))}
        </Row>
        <Row>
          <Col>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SearchOutlined />}
              >
                搜索
              </Button>
              <Button
                onClick={handleReset}
                icon={<ReloadOutlined />}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}

function renderFormItem(field) {
  const { type, props } = field;

  switch (type) {
    case 'input':
      return <Input placeholder={`请输入${field.label}`} {...props} />;
    case 'select':
      return (
        <Select
          placeholder={`请选择${field.label}`}
          allowClear
          {...props}
        >
          {field.options?.map(option => (
            <Select.Option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </Select.Option>
          ))}
        </Select>
      );
    case 'dateRange':
      return <RangePicker style={{ width: '100%' }} {...props} />;
    case 'datePicker':
      return <DatePicker style={{ width: '100%' }} {...props} />;
    default:
      return <Input {...props} />;
  }
}

/**
 * 状态标签组件
 */
export function StatusTag({ status, statusMap }) {
  const config = statusMap[status] || {
    label: status,
    color: 'default'
  };

  return <Tag color={config.color}>{config.label}</Tag>;
}

// ========== 使用示例 ==========

/**
 * 用户管理页面示例
 */
export function UserManagement() {
  const [searchParams, setSearchParams] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // 获取用户列表
  const { data: userList, isLoading } = useApi(
    () => api.user.getUserList(searchParams),
    [searchParams]
  );

  // 删除用户
  const deleteUserMutation = useApiMutation(api.user.deleteUser, {
    onSuccess: () => {
      message.success('删除成功');
    }
  });

  // 搜索字段配置
  const searchFields = [
    {
      name: 'keyword',
      label: '关键词',
      type: 'input',
      colProps: { span: 6 }
    },
    {
      name: 'level',
      label: '等级',
      type: 'select',
      colProps: { span: 6 },
      options: [
        { label: '普通会员', value: 'NORMAL' },
        { label: 'VIP', value: 'VIP' },
        { label: '一星店长', value: 'STAR_1' },
        { label: '二星店长', value: 'STAR_2' },
        { label: '三星店长', value: 'STAR_3' },
        { label: '四星店长', value: 'STAR_4' },
        { label: '五星店长', value: 'STAR_5' },
        { label: '董事', value: 'DIRECTOR' }
      ]
    },
    {
      name: 'dateRange',
      label: '注册时间',
      type: 'dateRange',
      colProps: { span: 6 }
    }
  ];

  // 表格列配置
  const columns = [
    {
      title: '用户ID',
      dataIndex: 'id',
      key: 'id',
      width: 200
    },
    {
      title: '头像',
      dataIndex: 'avatarUrl',
      key: 'avatarUrl',
      width: 80,
      render: (url) => (
        <Avatar size={40} src={url} icon={<UserOutlined />} />
      )
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname'
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      render: (level) => {
        const levelMap = {
          'NORMAL': { label: '普通', color: 'default' },
          'VIP': { label: 'VIP', color: 'blue' },
          'STAR_1': { label: '一星', color: 'green' },
          'STAR_2': { label: '二星', color: 'cyan' },
          'STAR_3': { label: '三星', color: 'purple' },
          'STAR_4': { label: '四星', color: 'orange' },
          'STAR_5': { label: '五星', color: 'red' },
          'DIRECTOR': { label: '董事', color: 'magenta' }
        };
        return <StatusTag status={level} statusMap={levelMap} />;
      }
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active) => (
        <StatusTag
          status={active ? 'ACTIVE' : 'INACTIVE'}
          statusMap={{
            'ACTIVE': { label: '正常', color: 'success' },
            'INACTIVE': { label: '禁用', color: 'error' }
          }}
        />
      )
    }
  ];

  return (
    <div className="user-management">
      <SearchForm
        fields={searchFields}
        onSearch={setSearchParams}
      />

      <DataTable
        title="用户列表"
        columns={columns}
        dataSource={userList?.data?.list || []}
        loading={isLoading}
        pagination={{
          current: userList?.data?.page,
          pageSize: userList?.data?.pageSize,
          total: userList?.data?.total
        }}
        onEdit={(record) => {
          setEditingUser(record);
          setModalVisible(true);
        }}
        onDelete={(record) => {
          deleteUserMutation.mutate(record.id);
        }}
        rowKey="id"
      />

      <UserModal
        visible={modalVisible}
        user={editingUser}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
        }}
        onSuccess={() => {
          setModalVisible(false);
          setEditingUser(null);
          // 刷新列表
          queryClient.invalidateQueries(['getUserList']);
        }}
      />
    </div>
  );
}

// 导出主应用
export default App;