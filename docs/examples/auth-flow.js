/**
 * 中道商城认证流程示例
 * 完整的微信小程序登录 + React 管理端认证流程
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { api } from './axios-client';
import { errorHandler } from './error-handling';

// ========== 认证上下文和状态管理 ==========

// 认证状态
const initialState = {
  // 用户信息
  user: null,
  isAuthenticated: false,
  isLoading: true,

  // Token 信息
  token: null,
  refreshToken: null,
  tokenExpiresAt: null,

  // 权限信息
  permissions: [],
  role: null,

  // 登录状态
  loginMethod: null, // 'wechat', 'phone', 'admin'
  rememberMe: false,

  // 错误信息
  error: null
};

// Action 类型
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  UPDATE_USER: 'UPDATE_USER',
  REFRESH_TOKEN_SUCCESS: 'REFRESH_TOKEN_SUCCESS',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        permissions: action.payload.permissions || [],
        role: action.payload.role,
        loginMethod: action.payload.loginMethod,
        rememberMe: action.payload.rememberMe,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_FAILED:
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
        refreshToken: null,
        permissions: [],
        role: null,
        error: action.payload
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false
      };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };

    case AUTH_ACTIONS.REFRESH_TOKEN_SUCCESS:
      return {
        ...state,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
}

// 创建认证上下文
const AuthContext = createContext();

// 认证 Provider
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 初始化认证状态
  useEffect(() => {
    initializeAuth();
  }, []);

  // 初始化认证
  const initializeAuth = async () => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

      // 获取存储的 token
      const token = localStorage.getItem('zhongdao_token') ||
                   sessionStorage.getItem('zhongdao_token');

      if (!token) {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        return;
      }

      // 验证 token 并获取用户信息
      const response = await api.auth.getCurrentUser();

      if (response.data.success) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user: response.data.data,
            token: token,
            refreshToken: localStorage.getItem('zhongdao_refresh_token') ||
                         sessionStorage.getItem('zhongdao_refresh_token'),
            permissions: response.data.data.permissions || [],
            role: response.data.data.role,
            loginMethod: 'stored'
          }
        });
      } else {
        throw new Error('Token validation failed');
      }
    } catch (error) {
      // Token 无效，清除存储
      clearStoredTokens();
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILED, payload: null });
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // 微信登录
  const wechatLogin = async (code, userInfo, rememberMe = false) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

      const response = await api.auth.wechatLogin(code, userInfo);

      if (response.data.success) {
        const { token, refreshToken, user } = response.data.data;

        // 存储 token
        if (rememberMe) {
          localStorage.setItem('zhongdao_token', token);
          localStorage.setItem('zhongdao_refresh_token', refreshToken);
          localStorage.setItem('rememberMe', 'true');
        } else {
          sessionStorage.setItem('zhongdao_token', token);
          sessionStorage.setItem('zhongdao_refresh_token', refreshToken);
        }

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user,
            token,
            refreshToken,
            permissions: user.permissions || [],
            role: user.role,
            loginMethod: 'wechat',
            rememberMe
          }
        });

        // 登录成功回调
        if (response.data.data.isNewUser) {
          // 新用户引导
          showNewUserGuide();
        }

        if (response.data.data.needPhoneAuth) {
          // 需要绑定手机号
          return { needPhoneAuth: true };
        }

        return { success: true };
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorInfo = errorHandler.handle(error, {
        context: { action: 'wechatLogin' }
      });

      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILED,
        payload: errorInfo.userMessage
      });

      return { success: false, error: errorInfo };
    }
  };

  // 手机号登录
  const phoneLogin = async (phone, smsCode, rememberMe = false) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

      const response = await api.auth.phoneLogin(phone, smsCode);

      if (response.data.success) {
        const { token, refreshToken, user } = response.data.data;

        // 存储 token
        if (rememberMe) {
          localStorage.setItem('zhongdao_token', token);
          localStorage.setItem('zhongdao_refresh_token', refreshToken);
          localStorage.setItem('rememberMe', 'true');
        } else {
          sessionStorage.setItem('zhongdao_token', token);
          sessionStorage.setItem('zhongdao_refresh_token', refreshToken);
        }

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user,
            token,
            refreshToken,
            permissions: user.permissions || [],
            role: user.role,
            loginMethod: 'phone',
            rememberMe
          }
        });

        return { success: true };
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorInfo = errorHandler.handle(error, {
        context: { action: 'phoneLogin' }
      });

      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILED,
        payload: errorInfo.userMessage
      });

      return { success: false, error: errorInfo };
    }
  };

  // 管理员登录
  const adminLogin = async (username, password, rememberMe = false) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

      const response = await api.auth.adminLogin(username, password);

      if (response.data.success) {
        const { token, refreshToken, user } = response.data.data;

        // 存储 token
        if (rememberMe) {
          localStorage.setItem('zhongdao_token', token);
          localStorage.setItem('zhongdao_refresh_token', refreshToken);
          localStorage.setItem('rememberMe', 'true');
        } else {
          sessionStorage.setItem('zhongdao_token', token);
          sessionStorage.setItem('zhongdao_refresh_token', refreshToken);
        }

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user,
            token,
            refreshToken,
            permissions: user.permissions || [],
            role: 'ADMIN',
            loginMethod: 'admin',
            rememberMe
          }
        });

        return { success: true };
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorInfo = errorHandler.handle(error, {
        context: { action: 'adminLogin' }
      });

      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILED,
        payload: errorInfo.userMessage
      });

      return { success: false, error: errorInfo };
    }
  };

  // 登出
  const logout = async () => {
    try {
      // 调用登出 API
      await api.auth.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // 清除本地存储
      clearStoredTokens();

      // 更新状态
      dispatch({ type: AUTH_ACTIONS.LOGOUT });

      // 跳转到登录页
      if (state.loginMethod === 'admin') {
        window.location.href = '/admin/login';
      } else {
        window.location.href = '/login';
      }
    }
  };

  // 更新用户信息
  const updateUser = async (userData) => {
    try {
      const response = await api.user.updateUserInfo(userData);

      if (response.data.success) {
        dispatch({
          type: AUTH_ACTIONS.UPDATE_USER,
          payload: response.data.data
        });
        return { success: true };
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorInfo = errorHandler.handle(error);
      return { success: false, error: errorInfo };
    }
  };

  // 检查权限
  const hasPermission = (permission) => {
    if (!state.isAuthenticated || !state.permissions) {
      return false;
    }
    return state.permissions.includes(permission) || state.role === 'ADMIN';
  };

  // 检查角色
  const hasRole = (role) => {
    if (!state.isAuthenticated) {
      return false;
    }
    return state.role === role || state.role === 'ADMIN';
  };

  // 清除存储的 token
  const clearStoredTokens = () => {
    localStorage.removeItem('zhongdao_token');
    localStorage.removeItem('zhongdao_refresh_token');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('zhongdao_token');
    sessionStorage.removeItem('zhongdao_refresh_token');
  };

  // 显示新用户引导
  const showNewUserGuide = () => {
    // 实现新用户引导逻辑
    console.log('Show new user guide');
  };

  const value = {
    // 状态
    ...state,

    // 方法
    wechatLogin,
    phoneLogin,
    adminLogin,
    logout,
    updateUser,
    hasPermission,
    hasRole,

    // 清除错误
    clearError: () => dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR })
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 使用认证上下文的 Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ========== 微信小程序登录示例 ==========

/**
 * 微信小程序登录流程
 */
export function WeChatMiniProgramLogin() {
  // 获取微信授权码
  const getWeChatCode = () => {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            resolve(res.code);
          } else {
            reject(new Error('获取微信授权码失败'));
          }
        },
        fail: reject
      });
    });
  };

  // 获取用户信息
  const getUserProfile = () => {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: (res) => {
          resolve(res.userInfo);
        },
        fail: reject
      });
    });
  };

  // 执行登录
  const performLogin = async (rememberMe = false) => {
    try {
      wx.showLoading({ title: '登录中...' });

      // 获取授权码
      const code = await getWeChatCode();

      // 获取用户信息
      const userInfo = await getUserProfile();

      // 调用登录 API
      const response = await fetch(`${API_BASE_URL}/auth/wechat-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, userInfo })
      });

      const data = await response.json();

      if (data.success) {
        // 存储 token
        wx.setStorageSync('token', data.data.token);
        wx.setStorageSync('refreshToken', data.data.refreshToken);

        // 登录成功
        wx.hideLoading();
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });

        // 检查是否需要绑定手机号
        if (data.data.needPhoneAuth) {
          wx.navigateTo({
            url: '/pages/bind-phone/bind-phone'
          });
        } else {
          // 跳转到首页
          wx.switchTab({
            url: '/pages/index/index'
          });
        }

        return data;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none'
      });
      throw error;
    }
  };

  return { performLogin };
}

// ========== React 管理端登录组件示例 ==========

/**
 * 管理员登录组件
 */
import { Form, Input, Button, Checkbox, Card, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

export function AdminLoginForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      const result = await adminLogin(
        values.username,
        values.password,
        values.rememberMe
      );

      if (result.success) {
        // 登录成功，跳转到管理后台首页
        navigate('/admin/dashboard');
      }
    } catch (error) {
      // 错误已在 AuthProvider 中处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <Card title="管理员登录" className="login-card">
        <Form
          form={form}
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Form.Item name="rememberMe" valuePropName="checked" noStyle>
              <Checkbox>记住我</Checkbox>
            </Form.Item>
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

        <div className="login-tips">
          <Alert
            message="安全提示"
            description="请使用管理员账号登录，普通用户请使用小程序端"
            type="info"
            showIcon
          />
        </div>
      </Card>
    </div>
  );
}

// ========== 路由守卫示例 ==========

/**
 * 受保护的路由组件
 */
export function ProtectedRoute({ children, requiredPermission, requiredRole }) {
  const { isAuthenticated, isLoading, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  // 加载中
  if (isLoading) {
    return <PageLoading />;
  }

  // 未认证
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 权限检查
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <NoPermission message="您没有访问此页面的权限" />;
  }

  // 角色检查
  if (requiredRole && !hasRole(requiredRole)) {
    return <NoPermission message="您的角色无法访问此页面" />;
  }

  return children;
}

/**
 * 权限检查组件
 */
export function PermissionGuard({ permission, role, children, fallback = null }) {
  const { hasPermission, hasRole } = useAuth();

  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  if (role && !hasRole(role)) {
    return fallback;
  }

  return children;
}

// 使用示例：
/*
// 路由配置
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  />
  <Route
    path="/admin/users"
    element={
      <ProtectedRoute requiredRole="ADMIN">
        <UserManagement />
      </ProtectedRoute>
    }
  />
  <Route
    path="/shop/settings"
    element={
      <ProtectedRoute requiredPermission="SHOP_MANAGE">
        <ShopSettings />
      </ProtectedRoute>
    }
  />
</Routes>

// 权限控制按钮
<PermissionGuard permission="USER_DELETE">
  <Button danger onClick={handleDelete}>
    删除用户
  </Button>
</PermissionGuard>
*/

// ========== 导出 ==========

export {
  AUTH_ACTIONS,
  AuthContext
};

export default {
  AuthProvider,
  useAuth,
  WeChatMiniProgramLogin,
  ProtectedRoute,
  PermissionGuard
};