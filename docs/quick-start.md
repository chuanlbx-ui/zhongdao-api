# 中道商城 API 快速开始指南

## 🚀 5分钟快速接入

本指南将帮助您快速接入中道商城 API，实现基本的业务功能。

## 📋 前置要求

- Node.js >= 14.0.0
- npm 或 yarn
- 基础的 JavaScript/TypeScript 知识
- 了解 RESTful API 概念

## 🛠️ 步骤一：环境准备

### 1. 安装依赖

```bash
# 使用 npm
npm install axios antd dayjs

# 或使用 yarn
yarn add axios antd dayjs
```

### 2. 获取 API 密钥

联系管理员获取：
- API 基础URL（开发/测试/生产环境）
- 测试账号和密码

## 🔐 步骤二：实现用户认证

### 1. 微信小程序登录

```javascript
// login.js
import axios from 'axios';

const API_BASE_URL = 'https://api.zhongdao-mall.com/api/v1';

// 微信登录
async function wechatLogin(code, userInfo) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/wechat-login`, {
      code,
      userInfo
    });

    const { token, refreshToken, user } = response.data.data;

    // 存储 token
    wx.setStorageSync('token', token);
    wx.setStorageSync('refreshToken', refreshToken);

    return { success: true, user };
  } catch (error) {
    console.error('登录失败:', error);
    return { success: false, error: error.message };
  }
}

// 小程序登录示例
wx.login({
  success: async (res) => {
    // 获取用户信息
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: async (userRes) => {
        // 调用登录 API
        const result = await wechatLogin(res.code, userRes.userInfo);

        if (result.success) {
          wx.showToast({ title: '登录成功' });
          // 跳转到首页
          wx.switchTab({ url: '/pages/index/index' });
        } else {
          wx.showToast({
            title: result.error || '登录失败',
            icon: 'none'
          });
        }
      }
    });
  }
});
```

### 2. React 管理端登录

```jsx
// Login.jsx
import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from './contexts/AuthContext';
import axios from 'axios';

function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      const response = await axios.post('/api/v1/admin/auth/login', {
        username: values.username,
        password: values.password
      });

      const { token, user } = response.data.data;

      // 登录成功
      login(token, user);
      message.success('登录成功');

      // 跳转到管理后台
      window.location.href = '/admin/dashboard';
    } catch (error) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card title="管理员登录">
        <Form onFinish={handleSubmit}>
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default AdminLogin;
```

## 📊 步骤三：API 请求封装

```javascript
// api.js
import axios from 'axios';
import { message } from 'antd';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.zhongdao-mall.com/api/v1';

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

// 请求拦截器 - 添加认证头
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期，跳转登录
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (error.response?.data?.message) {
      message.error(error.response.data.message);
    } else {
      message.error('请求失败，请稍后重试');
    }
    return Promise.reject(error);
  }
);

// API 方法
export const userApi = {
  // 获取当前用户信息
  getCurrentUser: () => api.get('/users/me'),

  // 获取用户等级信息
  getLevelInfo: () => api.get('/users/level-info'),

  // 更新用户信息
  updateProfile: (data) => api.put('/users/me', data)
};

export const productApi = {
  // 获取商品列表
  getProducts: (params) => api.get('/products', { params }),

  // 获取商品详情
  getProduct: (id) => api.get(`/products/${id}`),

  // 搜索商品
  searchProducts: (keyword, params) =>
    api.get('/products', { params: { search: keyword, ...params } })
};

export const orderApi = {
  // 创建订单
  createOrder: (data) => api.post('/orders', data),

  // 获取订单列表
  getOrders: (params) => api.get('/orders', { params }),

  // 获取订单详情
  getOrder: (id) => api.get(`/orders/${id}`)
};

export const pointsApi = {
  // 获取通券余额
  getBalance: () => api.get('/points/balance'),

  // 通券转账
  transfer: (data) => api.post('/points/transfer', data),

  // 获取交易记录
  getTransactions: (params) => api.get('/points/transactions', { params })
};

export default api;
```

## 🏪 步骤四：实现核心功能

### 1. 商品列表展示

```jsx
// ProductList.jsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Image, Tag, Button, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { productApi } from './api';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 加载商品列表
  const loadProducts = async (search = '') => {
    setLoading(true);
    try {
      const response = await productApi.getProducts({
        search,
        page: 1,
        pageSize: 20
      });
      setProducts(response.data.items);
    } catch (error) {
      console.error('加载商品失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // 搜索商品
  const handleSearch = (value) => {
    setSearchText(value);
    loadProducts(value);
  };

  // 购买商品
  const handleBuy = (product) => {
    // 跳转到商品详情或创建订单
    window.location.href = `/product/${product.id}`;
  };

  return (
    <div className="product-list">
      <div className="search-bar mb-4">
        <Input.Search
          placeholder="搜索商品"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={handleSearch}
          enterButton={<SearchOutlined />}
          size="large"
        />
      </div>

      <Row gutter={[16, 16]}>
        {products.map((product) => (
          <Col key={product.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              cover={
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  height={200}
                  style={{ objectFit: 'cover' }}
                />
              }
              actions={[
                <Button type="primary" onClick={() => handleBuy(product)}>
                  立即购买
                </Button>
              ]}
            >
              <Card.Meta
                title={product.name}
                description={
                  <div>
                    <div className="price mb-2">
                      <span className="text-red-500 text-lg">
                        ¥{product.userPrice?.toFixed(2) || product.basePrice}
                      </span>
                      {product.basePrice !== product.userPrice && (
                        <span className="text-gray-400 line-through ml-2">
                          ¥{product.basePrice}
                        </span>
                      )}
                    </div>
                    <div className="tags">
                      {product.tags.map((tag) => (
                        <Tag key={tag} color="blue" size="small">
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default ProductList;
```

### 2. 订单创建

```jsx
// CreateOrder.jsx
import React, { useState } from 'react';
import { Card, Button, message, Radio, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import { orderApi, pointsApi } from './api';

function CreateOrder({ product }) {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('POINTS');
  const [pointsBalance, setPointsBalance] = useState(0);
  const navigate = useNavigate();

  // 获取通券余额
  const loadPointsBalance = async () => {
    try {
      const response = await pointsApi.getBalance();
      setPointsBalance(response.data.balance);
    } catch (error) {
      console.error('获取余额失败:', error);
    }
  };

  useState(() => {
    loadPointsBalance();
  }, []);

  // 创建订单
  const handleCreateOrder = async () => {
    setLoading(true);

    try {
      const response = await orderApi.createOrder({
        items: [{
          productId: product.id,
          specId: product.specs[0].id,
          quantity: 1
        }],
        paymentMethod
      });

      message.success('订单创建成功');

      // 跳转到订单详情
      navigate(`/order/${response.data.id}`);
    } catch (error) {
      message.error(error.response?.data?.message || '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  const userPrice = product.userPrice || product.basePrice;
  const canUsePoints = pointsBalance >= userPrice;

  return (
    <Card title="确认订单">
      <div className="product-info mb-4">
        <h3>{product.name}</h3>
        <p className="price text-lg">
          价格：<span className="text-red-500">¥{userPrice}</span>
        </p>
        <p>库存：{product.stock} 件</p>
      </div>

      <div className="payment-method mb-4">
        <h4>支付方式</h4>
        <Radio.Group
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <Radio value="POINTS" disabled={!canUsePoints}>
            通券支付 (余额：¥{pointsBalance.toFixed(2)})
            {!canUsePoints && (
              <span className="text-red-500 ml-2">余额不足</span>
            )}
          </Radio>
          <Radio value="WECHAT">微信支付</Radio>
          <Radio value="ALIPAY">支付宝</Radio>
        </Radio.Group>
      </div>

      <Button
        type="primary"
        size="large"
        block
        loading={loading}
        onClick={handleCreateOrder}
        disabled={paymentMethod === 'POINTS' && !canUsePoints}
      >
        {paymentMethod === 'POINTS' ? '通券支付' : '立即支付'}
      </Button>
    </Card>
  );
}

export default CreateOrder;
```

### 3. 团队管理

```jsx
// TeamManagement.jsx
import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Avatar, Statistic, Row, Col } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { userApi } from './api';

function TeamManagement() {
  const [teamData, setTeamData] = useState({
    directCount: 0,
    teamCount: 0,
    members: []
  });
  const [loading, setLoading] = useState(false);

  // 加载团队数据
  const loadTeamData = async () => {
    setLoading(true);
    try {
      const response = await userApi.getTeamStructure({
        level: 2,
        pageSize: 50
      });
      setTeamData(response.data);
    } catch (error) {
      console.error('加载团队数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '成员',
      key: 'member',
      render: (_, record) => (
        <div className="flex items-center">
          <Avatar
            src={record.avatarUrl}
            icon={<UserOutlined />}
            className="mr-2"
          />
          <div>
            <div>{record.nickname}</div>
            <div className="text-gray-400 text-sm">{record.level}</div>
          </div>
        </div>
      )
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      render: (level) => {
        const levelMap = {
          'NORMAL': { text: '普通', color: 'default' },
          'VIP': { text: 'VIP', color: 'blue' },
          'STAR_1': { text: '一星', color: 'green' },
          'STAR_2': { text: '二星', color: 'cyan' },
          'STAR_3': { text: '三星', color: 'purple' }
        };
        const config = levelMap[level] || { text: level, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '直推人数',
      dataIndex: 'directCount',
      key: 'directCount'
    },
    {
      title: '团队人数',
      dataIndex: 'teamCount',
      key: 'teamCount'
    },
    {
      title: '加入时间',
      dataIndex: 'joinDate',
      key: 'joinDate',
      render: (date) => date?.split('T')[0]
    }
  ];

  return (
    <div className="team-management">
      {/* 统计卡片 */}
      <Row gutter={16} className="mb-4">
        <Col span={8}>
          <Card>
            <Statistic
              title="直推人数"
              value={teamData.directCount}
              suffix="人"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="团队总人数"
              value={teamData.teamCount}
              suffix="人"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="团队业绩"
              value={125000}
              precision={2}
              prefix="¥"
            />
          </Card>
        </Col>
      </Row>

      {/* 成员列表 */}
      <Card title="团队成员">
        <Table
          columns={columns}
          dataSource={teamData.members}
          loading={loading}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}

export default TeamManagement;
```

## 🔧 步骤五：运行项目

### 1. 小程序端

```javascript
// app.js
App({
  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (token) {
      // 已登录，跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    } else {
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  }
});
```

### 2. React Web 端

```jsx
// App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from './contexts/AuthContext';

// 页面组件
import Login from './pages/Login';
import Home from './pages/Home';
import ProductList from './pages/ProductList';
import TeamManagement from './pages/TeamManagement';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/team" element={<TeamManagement />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
```

## ✅ 测试验证

### 1. 测试登录功能

```javascript
// 测试脚本
async function testLogin() {
  try {
    // 模拟微信登录
    const response = await fetch('/api/v1/auth/wechat-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 'test_code',
        userInfo: {
          nickname: '测试用户',
          avatarUrl: 'https://example.com/avatar.jpg'
        }
      })
    });

    const data = await response.json();
    console.log('登录结果:', data);

    if (data.success) {
      console.log('✅ 登录成功');
      console.log('Token:', data.data.token);
    } else {
      console.error('❌ 登录失败:', data.message);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);
  }
}

testLogin();
```

### 2. 测试 API 调用

```javascript
// 测试商品列表
async function testProducts() {
  try {
    const response = await fetch('/api/v1/products?page=1&pageSize=10', {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
    });

    const data = await response.json();
    console.log('商品列表:', data);

    if (data.success) {
      console.log('✅ 获取商品成功');
      console.log('商品数量:', data.data.items.length);
    } else {
      console.error('❌ 获取商品失败:', data.message);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);
  }
}
```

## 📚 下一步

现在您已经成功接入了中道商城 API！接下来您可以：

1. **查看完整文档**
   - [API 文档](http://localhost:3000/api-docs)
   - [业务文档](./API/)

2. **实现更多功能**
   - 订单管理
   - 通券转账
   - 佣金查询
   - 店铺管理

3. **优化用户体验**
   - 添加加载动画
   - 实现错误重试
   - 缓存常用数据

4. **部署上线**
   - 配置生产环境
   - 申请正式 API 密钥
   - 设置监控和日志

## ❓ 常见问题

<details>
<summary>如何处理 Token 过期？</summary>

系统会自动刷新 Token。如果刷新失败，会自动跳转到登录页面。

</details>

<details>
<summary>商品价格如何计算？</summary>

商品价格根据用户等级自动计算。不同等级享受不同的折扣比例。

</details>

<details>
<summary>如何测试支付功能？</summary>

测试环境可以使用通券支付，无需真实支付。生产环境需要接入微信支付或支付宝。

</details>

## 🆘 获取帮助

- 📧 技术支持邮箱：dev@zhongdao-mall.com
- 📞 客服电话：400-123-4567
- 💬 微信客服：zhongdao-service
- 📖 完整文档：https://docs.zhongdao-mall.com

---

🎉 **恭喜！您已成功接入中道商城 API！**