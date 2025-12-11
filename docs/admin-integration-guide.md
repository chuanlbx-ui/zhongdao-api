# 中道商城管理后台集成指南

## 📊 目录

1. [项目概述](#项目概述)
2. [环境搭建](#环境搭建)
3. [权限系统](#权限系统)
4. [核心模块集成](#核心模块集成)
5. [数据可视化](#数据可视化)
6. [操作日志](#操作日志)
7. [文件管理](#文件管理)
8. [批量操作](#批量操作)
9. [系统配置](#系统配置)
10. [部署指南](#部署指南)
11. [常见问题](#常见问题)

## 项目概述

中道商城管理后台是基于Vue 3 + TypeScript + Element Plus构建的现代化管理系统，提供完整的商城管理功能，包括用户管理、商品管理、订单处理、财务统计、团队管理等。

### 技术栈
- **框架**: Vue 3 + TypeScript
- **UI库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **请求库**: Axios
- **图表**: ECharts
- **构建工具**: Vite

### 核心功能
- 用户层级管理（普通用户 → VIP → 1-5星级店长 → 总监）
- 商品管理和定价策略
- 订单处理和物流管理
- 佣金计算和结算
- 数据统计和分析
- 系统配置和权限管理

## 环境搭建

### 1. 项目初始化

```bash
# 克隆项目
git clone <repository-url>
cd zhongdao-admin

# 安装依赖
npm install

# 环境配置
cp .env.example .env.development
# 编辑 .env.development 配置环境变量

# 启动开发服务器
npm run dev
```

### 2. 环境配置

```env
# .env.development
# 基础配置
VITE_APP_TITLE=中道商城管理后台
VITE_APP_VERSION=1.0.0
VITE_APP_PORT=8080

# API配置
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_API_TIMEOUT=10000

# 上传配置
VITE_UPLOAD_URL=http://localhost:3000/api/v1/admin/upload
VITE_UPLOAD_MAX_SIZE=10485760

# WebSocket配置
VITE_WS_URL=ws://localhost:3000/ws

# 是否开启Mock
VITE_USE_MOCK=false
```

### 3. 项目结构

```
zhongdao-admin/
├── src/
│   ├── api/              # API接口
│   ├── assets/           # 静态资源
│   ├── components/       # 公共组件
│   ├── layouts/          # 布局组件
│   ├── router/           # 路由配置
│   ├── stores/           # 状态管理
│   ├── styles/           # 样式文件
│   ├── utils/            # 工具函数
│   ├── views/            # 页面组件
│   ├── types/            # TypeScript类型定义
│   └── main.ts           # 入口文件
├── public/               # 公共资源
├── vite.config.ts        # Vite配置
└── package.json
```

## 权限系统

### 1. 权限配置

```typescript
// src/stores/permission.ts
import { defineStore } from 'pinia'

interface Permission {
  id: string
  name: string
  code: string
  type: 'menu' | 'button' | 'api'
  parentId?: string
  path?: string
  icon?: string
  sort: number
}

interface Role {
  id: string
  name: string
  code: string
  permissions: Permission[]
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    permissions: [] as Permission[],
    roles: [] as Role[],
    userPermissions: [] as string[]
  }),

  getters: {
    // 获取菜单权限
    menuPermissions: (state) => {
      return state.permissions
        .filter(p => p.type === 'menu')
        .sort((a, b) => a.sort - b.sort)
    },

    // 检查是否有权限
    hasPermission: (state) => (code: string) => {
      return state.userPermissions.includes(code)
    }
  },

  actions: {
    // 加载用户权限
    async loadUserPermissions() {
      const response = await api.get('/admin/permissions')
      this.userPermissions = response.data.permissions
    },

    // 检查路由权限
    checkRoutePermission(route: any) {
      if (!route.meta?.permission) return true
      return this.hasPermission(route.meta.permission)
    }
  }
})
```

### 2. 路由守卫

```typescript
// src/router/guard.ts
import router from './index'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { ElMessage } from 'element-plus'

// 白名单
const whiteList = ['/login', '/403', '/404']

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()

  // 检查是否需要登录
  if (whiteList.includes(to.path)) {
    next()
    return
  }

  // 检查是否已登录
  if (!userStore.token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // 获取用户信息
  if (!userStore.userInfo) {
    try {
      await userStore.getUserInfo()
      await permissionStore.loadUserPermissions()
    } catch (error) {
      userStore.logout()
      next('/login')
      return
    }
  }

  // 检查权限
  if (to.meta?.permission && !permissionStore.hasPermission(to.meta.permission)) {
    ElMessage.error('权限不足')
    next('/403')
    return
  }

  next()
})
```

### 3. 权限指令

```typescript
// src/directives/permission.ts
import { usePermissionStore } from '@/stores/permission'

export default {
  mounted(el: HTMLElement, binding: any) {
    const { value } = binding
    const permissionStore = usePermissionStore()

    if (value && !permissionStore.hasPermission(value)) {
      el.style.display = 'none'
      // 或者直接移除元素
      // el.parentNode?.removeChild(el)
    }
  },

  updated(el: HTMLElement, binding: any) {
    const { value } = binding
    const permissionStore = usePermissionStore()

    if (value && !permissionStore.hasPermission(value)) {
      el.style.display = 'none'
    } else {
      el.style.display = ''
    }
  }
}
```

### 4. 权限组件

```vue
<!-- src/components/Permission/index.vue -->
<template>
  <slot v-if="hasPermission" />
  <span v-else-if="showTip" class="permission-tip">
    <el-tooltip content="权限不足" placement="top">
      <span><slot name="default" /></span>
    </el-tooltip>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePermissionStore } from '@/stores/permission'

interface Props {
  code: string | string[]
  mode?: 'hide' | 'tip' // 隐藏或提示
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'hide'
})

const permissionStore = usePermissionStore()

const hasPermission = computed(() => {
  if (Array.isArray(props.code)) {
    return props.code.some(code => permissionStore.hasPermission(code))
  }
  return permissionStore.hasPermission(props.code)
})

const showTip = computed(() => props.mode === 'tip' && !hasPermission.value)
</script>
```

## 核心模块集成

### 1. 用户管理

```vue
<!-- src/views/user/index.vue -->
<template>
  <div class="user-management">
    <!-- 搜索栏 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="用户ID">
          <el-input v-model="searchForm.userId" placeholder="请输入用户ID" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="searchForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="用户等级">
          <el-select v-model="searchForm.level" placeholder="请选择等级">
            <el-option label="普通用户" value="NORMAL" />
            <el-option label="VIP" value="VIP" />
            <el-option label="1星店长" value="STAR_1" />
            <el-option label="2星店长" value="STAR_2" />
            <el-option label="3星店长" value="STAR_3" />
            <el-option label="4星店长" value="STAR_4" />
            <el-option label="5星店长" value="STAR_5" />
            <el-option label="总监" value="DIRECTOR" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户列表</span>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新增用户
          </el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="tableData">
        <el-table-column prop="id" label="用户ID" width="100" />
        <el-table-column prop="phone" label="手机号" />
        <el-table-column prop="nickname" label="昵称" />
        <el-table-column prop="level" label="等级">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row.level)">
              {{ getLevelText(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="parentPhone" label="上级" />
        <el-table-column prop="teamCount" label="团队人数" width="100" />
        <el-table-column prop="totalCommission" label="累计佣金" width="120">
          <template #default="{ row }">
            ¥{{ formatMoney(row.totalCommission) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'danger'">
              {{ row.status === 'ACTIVE' ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="180" />
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="handleView(row)">查看</el-button>
            <el-button size="small" type="primary" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-dropdown>
              <el-button size="small">
                更多<el-icon class="el-icon--right"><arrow-down /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="handleAdjustLevel(row)">
                    调整等级
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleViewTeam(row)">
                    查看团队
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleViewCommission(row)">
                    佣金明细
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="row.status === 'ACTIVE'"
                    @click="handleDisable(row)"
                    divided
                  >
                    禁用账号
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-else
                    @click="handleEnable(row)"
                    divided
                  >
                    启用账号
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 用户详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerTitle"
      size="60%"
      destroy-on-close
    >
      <user-detail
        v-if="drawerVisible"
        :user-id="currentUserId"
        @close="drawerVisible = false"
        @refresh="loadTableData"
      />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowDown } from '@element-plus/icons-vue'
import { userApi } from '@/api/user'
import UserDetail from './components/UserDetail.vue'
import { formatMoney, getLevelType, getLevelText } from '@/utils'

// 响应式数据
const loading = ref(false)
const tableData = ref([])
const drawerVisible = ref(false)
const currentUserId = ref('')
const drawerTitle = ref('')

// 搜索表单
const searchForm = reactive({
  userId: '',
  phone: '',
  level: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 加载表格数据
const loadTableData = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      page: pagination.page,
      limit: pagination.limit
    }
    const response = await userApi.getList(params)
    tableData.value = response.data.list
    pagination.total = response.data.total
  } catch (error) {
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadTableData()
}

// 重置
const handleReset = () => {
  Object.assign(searchForm, {
    userId: '',
    phone: '',
    level: ''
  })
  handleSearch()
}

// 查看用户
const handleView = (row: any) => {
  currentUserId.value = row.id
  drawerTitle.value = `用户详情 - ${row.nickname || row.phone}`
  drawerVisible.value = true
}

// 编辑用户
const handleEdit = (row: any) => {
  currentUserId.value = row.id
  drawerTitle.value = `编辑用户 - ${row.nickname || row.phone}`
  drawerVisible.value = true
}

// 新增用户
const handleCreate = () => {
  currentUserId.value = ''
  drawerTitle.value = '新增用户'
  drawerVisible.value = true
}

// 调整等级
const handleAdjustLevel = async (row: any) => {
  try {
    const { value } = await ElMessageBox.prompt(
      '请选择新的用户等级',
      '调整等级',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputType: 'select',
        inputOptions: [
          { label: '普通用户', value: 'NORMAL' },
          { label: 'VIP', value: 'VIP' },
          { label: '1星店长', value: 'STAR_1' },
          { label: '2星店长', value: 'STAR_2' },
          { label: '3星店长', value: 'STAR_3' },
          { label: '4星店长', value: 'STAR_4' },
          { label: '5星店长', value: 'STAR_5' },
          { label: '总监', value: 'DIRECTOR' }
        ],
        inputValue: row.level
      }
    )

    await userApi.updateLevel(row.id, value)
    ElMessage.success('等级调整成功')
    loadTableData()
  } catch (error) {
    // 用户取消操作
  }
}

// 查看团队
const handleViewTeam = (row: any) => {
  // 跳转到团队页面
  router.push({
    path: '/team',
    query: { userId: row.id }
  })
}

// 查看佣金明细
const handleViewCommission = (row: any) => {
  // 跳转到佣金页面
  router.push({
    path: '/commission',
    query: { userId: row.id }
  })
}

// 禁用账号
const handleDisable = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要禁用该用户账号吗？', '提示', {
      type: 'warning'
    })

    await userApi.updateStatus(row.id, 'DISABLED')
    ElMessage.success('账号已禁用')
    loadTableData()
  } catch (error) {
    // 用户取消操作
  }
}

// 启用账号
const handleEnable = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要启用该用户账号吗？', '提示', {
      type: 'warning'
    })

    await userApi.updateStatus(row.id, 'ACTIVE')
    ElMessage.success('账号已启用')
    loadTableData()
  } catch (error) {
    // 用户取消操作
  }
}

// 分页事件
const handleSizeChange = (val: number) => {
  pagination.limit = val
  loadTableData()
}

const handleCurrentChange = (val: number) => {
  pagination.page = val
  loadTableData()
}

// 初始化
onMounted(() => {
  loadTableData()
})
</script>

<style lang="scss" scoped>
.user-management {
  .search-card {
    margin-bottom: 20px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
```

### 2. 商品管理

```vue
<!-- src/views/product/index.vue -->
<template>
  <div class="product-management">
    <!-- 分类管理 -->
    <el-card class="category-card">
      <template #header>
        <div class="card-header">
          <span>商品分类</span>
          <el-button size="small" @click="handleCategoryManage">
            管理分类
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeCategory" @tab-change="handleCategoryChange">
        <el-tab-pane label="全部" name="all" />
        <el-tab-pane
          v-for="cat in categories"
          :key="cat.id"
          :label="cat.name"
          :name="cat.id"
        />
      </el-tabs>
    </el-card>

    <!-- 商品列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>商品列表</span>
          <div>
            <el-button type="primary" @click="handleCreate">
              <el-icon><Plus /></el-icon>
              新增商品
            </el-button>
            <el-button @click="handleBatchImport">
              批量导入
            </el-button>
          </div>
        </div>
      </template>

      <!-- 搜索栏 -->
      <el-form :model="searchForm" inline class="search-form">
        <el-form-item label="商品名称">
          <el-input
            v-model="searchForm.name"
            placeholder="请输入商品名称"
            clearable
          />
        </el-form-item>
        <el-form-item label="商品编码">
          <el-input
            v-model="searchForm.sku"
            placeholder="请输入商品编码"
            clearable
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择">
            <el-option label="上架" value="ACTIVE" />
            <el-option label="下架" value="INACTIVE" />
            <el-option label="售罄" value="SOLD_OUT" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 批量操作 -->
      <div v-if="selectedRows.length > 0" class="batch-actions">
        <span>已选择 {{ selectedRows.length }} 项</span>
        <el-button size="small" @click="handleBatchOnSale">批量上架</el-button>
        <el-button size="small" @click="handleBatchOffSale">批量下架</el-button>
        <el-button size="small" type="danger" @click="handleBatchDelete">
          批量删除
        </el-button>
      </div>

      <!-- 数据表格 -->
      <el-table
        v-loading="loading"
        :data="tableData"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="image" label="图片" width="100">
          <template #default="{ row }">
            <el-image
              :src="row.images[0]"
              :preview-src-list="row.images"
              fit="cover"
              style="width: 60px; height: 60px"
            />
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="200" />
        <el-table-column prop="sku" label="商品编码" width="150" />
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column prop="price" label="价格" width="120">
          <template #default="{ row }">
            <div>原价: ¥{{ formatMoney(row.originalPrice) }}</div>
            <div v-if="row.discountPrice" class="discount-price">
              现价: ¥{{ formatMoney(row.discountPrice) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="100" />
        <el-table-column prop="sales" label="销量" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="handleView(row)">查看</el-button>
            <el-button size="small" type="primary" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-dropdown>
              <el-button size="small">
                更多<el-icon class="el-icon--right"><arrow-down /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-if="row.status === 'INACTIVE'"
                    @click="handleOnSale(row)"
                  >
                    上架
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-else
                    @click="handleOffSale(row)"
                  >
                    下架
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleViewInventory(row)">
                    库存管理
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleViewPricing(row)">
                    定价策略
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleCopy(row)" divided>
                    复制商品
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleDelete(row)" divided>
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 商品表单对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="80%"
      destroy-on-close
    >
      <product-form
        v-if="dialogVisible"
        :product-id="currentProductId"
        @close="dialogVisible = false"
        @refresh="loadTableData"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowDown } from '@element-plus/icons-vue'
import { productApi } from '@/api/product'
import ProductForm from './components/ProductForm.vue'
import { formatMoney, getStatusType, getStatusText } from '@/utils'

// 响应式数据
const loading = ref(false)
const tableData = ref([])
const categories = ref([])
const activeCategory = ref('all')
const dialogVisible = ref(false)
const currentProductId = ref('')
const dialogTitle = ref('')
const selectedRows = ref([])

// 搜索表单
const searchForm = reactive({
  name: '',
  sku: '',
  status: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 加载分类
const loadCategories = async () => {
  try {
    const response = await productApi.getCategories()
    categories.value = response.data
  } catch (error) {
    ElMessage.error('加载分类失败')
  }
}

// 加载表格数据
const loadTableData = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      categoryId: activeCategory.value === 'all' ? undefined : activeCategory.value,
      page: pagination.page,
      limit: pagination.limit
    }
    const response = await productApi.getList(params)
    tableData.value = response.data.list
    pagination.total = response.data.total
  } catch (error) {
    ElMessage.error('加载商品列表失败')
  } finally {
    loading.value = false
  }
}

// 分类切换
const handleCategoryChange = () => {
  pagination.page = 1
  loadTableData()
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadTableData()
}

// 重置
const handleReset = () => {
  Object.assign(searchForm, {
    name: '',
    sku: '',
    status: ''
  })
  handleSearch()
}

// 选择变更
const handleSelectionChange = (rows: any[]) => {
  selectedRows.value = rows
}

// 批量上架
const handleBatchOnSale = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要上架选中的 ${selectedRows.value.length} 个商品吗？`,
      '提示',
      { type: 'warning' }
    )

    const ids = selectedRows.value.map(row => row.id)
    await productApi.batchUpdateStatus(ids, 'ACTIVE')
    ElMessage.success('批量上架成功')
    loadTableData()
  } catch (error) {
    // 用户取消操作
  }
}

// 批量下架
const handleBatchOffSale = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要下架选中的 ${selectedRows.value.length} 个商品吗？`,
      '提示',
      { type: 'warning' }
    )

    const ids = selectedRows.value.map(row => row.id)
    await productApi.batchUpdateStatus(ids, 'INACTIVE')
    ElMessage.success('批量下架成功')
    loadTableData()
  } catch (error) {
    // 用户取消操作
  }
}

// 批量删除
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRows.value.length} 个商品吗？此操作不可恢复！`,
      '警告',
      { type: 'error' }
    )

    const ids = selectedRows.value.map(row => row.id)
    await productApi.batchDelete(ids)
    ElMessage.success('批量删除成功')
    loadTableData()
  } catch (error) {
    // 用户取消操作
  }
}

// 查看商品
const handleView = (row: any) => {
  currentProductId.value = row.id
  dialogTitle.value = '查看商品'
  dialogVisible.value = true
}

// 编辑商品
const handleEdit = (row: any) => {
  currentProductId.value = row.id
  dialogTitle.value = '编辑商品'
  dialogVisible.value = true
}

// 新增商品
const handleCreate = () => {
  currentProductId.value = ''
  dialogTitle.value = '新增商品'
  dialogVisible.value = true
}

// 上架商品
const handleOnSale = async (row: any) => {
  try {
    await productApi.updateStatus(row.id, 'ACTIVE')
    ElMessage.success('商品已上架')
    loadTableData()
  } catch (error) {
    ElMessage.error('上架失败')
  }
}

// 下架商品
const handleOffSale = async (row: any) => {
  try {
    await productApi.updateStatus(row.id, 'INACTIVE')
    ElMessage.success('商品已下架')
    loadTableData()
  } catch (error) {
    ElMessage.error('下架失败')
  }
}

// 删除商品
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该商品吗？此操作不可恢复！',
      '警告',
      { type: 'error' }
    )

    await productApi.delete(row.id)
    ElMessage.success('删除成功')
    loadTableData()
  } catch (error) {
    // 用户取消操作
  }
}

// 分页事件
const handleSizeChange = (val: number) => {
  pagination.limit = val
  loadTableData()
}

const handleCurrentChange = (val: number) => {
  pagination.page = val
  loadTableData()
}

// 初始化
onMounted(() => {
  loadCategories()
  loadTableData()
})
</script>

<style lang="scss" scoped>
.product-management {
  .category-card {
    margin-bottom: 20px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .search-form {
    margin-bottom: 20px;
  }

  .batch-actions {
    padding: 10px;
    background: #f5f7fa;
    margin-bottom: 20px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 10px;

    span {
      color: #909399;
      margin-right: 10px;
    }
  }

  .discount-price {
    color: #f56c6c;
    font-weight: bold;
  }

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
```

## 数据可视化

### 1. 仪表板

```vue
<!-- src/views/dashboard/index.vue -->
<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon users">
              <el-icon><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalUsers }}</div>
              <div class="stat-label">总用户数</div>
            </div>
          </div>
          <div class="stat-trend">
            <el-icon><TrendCharts /></el-icon>
            <span class="trend-value up">+12.5%</span>
            <span class="trend-label">较昨日</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon orders">
              <el-icon><ShoppingCart /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalOrders }}</div>
              <div class="stat-label">总订单数</div>
            </div>
          </div>
          <div class="stat-trend">
            <el-icon><TrendCharts /></el-icon>
            <span class="trend-value up">+8.3%</span>
            <span class="trend-label">较昨日</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon revenue">
              <el-icon><Money /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">¥{{ formatMoney(stats.totalRevenue) }}</div>
              <div class="stat-label">总收入</div>
            </div>
          </div>
          <div class="stat-trend">
            <el-icon><TrendCharts /></el-icon>
            <span class="trend-value up">+15.2%</span>
            <span class="trend-label">较昨日</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon commission">
              <el-icon><Wallet /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">¥{{ formatMoney(stats.totalCommission) }}</div>
              <div class="stat-label">总佣金</div>
            </div>
          </div>
          <div class="stat-trend">
            <el-icon><TrendCharts /></el-icon>
            <span class="trend-value up">+5.8%</span>
            <span class="trend-label">较昨日</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="charts-row">
      <!-- 销售趋势 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>销售趋势</span>
              <el-radio-group v-model="salesPeriod" size="small">
                <el-radio-button label="week">本周</el-radio-button>
                <el-radio-button label="month">本月</el-radio-button>
                <el-radio-button label="year">本年</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="salesChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>

      <!-- 用户等级分布 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>用户等级分布</span>
          </template>
          <div ref="userLevelChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <!-- 商品销量排行 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>商品销量排行</span>
              <el-button size="small" @click="refreshProductRanking">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </template>
          <div ref="productRankingRef" style="height: 300px"></div>
        </el-card>
      </el-col>

      <!-- 佣金分布 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>佣金分布</span>
          </template>
          <div ref="commissionChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最新动态 -->
    <el-row>
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>最新动态</span>
          </template>
          <el-table :data="recentActivities" style="width: 100%">
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="getActivityTypeColor(row.type)">
                  {{ getActivityTypeText(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="user" label="用户" width="150" />
            <el-table-column prop="amount" label="金额" width="120">
              <template #default="{ row }">
                <span v-if="row.amount">¥{{ formatMoney(row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="时间" width="180" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { User, ShoppingCart, Money, Wallet, TrendCharts, Refresh } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { dashboardApi } from '@/api/dashboard'
import { formatMoney } from '@/utils'

// 响应式数据
const salesPeriod = ref('month')
const salesChartRef = ref()
const userLevelChartRef = ref()
const productRankingRef = ref()
const commissionChartRef = ref()

// 统计数据
const stats = reactive({
  totalUsers: 0,
  totalOrders: 0,
  totalRevenue: 0,
  totalCommission: 0
})

// 最新动态
const recentActivities = ref([])

// 图表实例
let salesChart: echarts.ECharts | null = null
let userLevelChart: echarts.ECharts | null = null
let productRankingChart: echarts.ECharts | null = null
let commissionChart: echarts.ECharts | null = null

// 加载统计数据
const loadStats = async () => {
  try {
    const response = await dashboardApi.getStats()
    Object.assign(stats, response.data)
  } catch (error) {
    console.error('加载统计数据失败', error)
  }
}

// 加载销售趋势
const loadSalesTrend = async () => {
  try {
    const response = await dashboardApi.getSalesTrend(salesPeriod.value)
    const data = response.data

    if (!salesChart) {
      salesChart = echarts.init(salesChartRef.value)
    }

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['销售额', '订单数']
      },
      xAxis: {
        type: 'category',
        data: data.dates
      },
      yAxis: [
        {
          type: 'value',
          name: '销售额',
          axisLabel: {
            formatter: '¥{value}'
          }
        },
        {
          type: 'value',
          name: '订单数'
        }
      ],
      series: [
        {
          name: '销售额',
          type: 'line',
          data: data.revenue,
          smooth: true,
          itemStyle: {
            color: '#409EFF'
          }
        },
        {
          name: '订单数',
          type: 'bar',
          yAxisIndex: 1,
          data: data.orders,
          itemStyle: {
            color: '#67C23A'
          }
        }
      ]
    }

    salesChart.setOption(option)
  } catch (error) {
    console.error('加载销售趋势失败', error)
  }
}

// 加载用户等级分布
const loadUserLevelDistribution = async () => {
  try {
    const response = await dashboardApi.getUserLevelDistribution()
    const data = response.data

    if (!userLevelChart) {
      userLevelChart = echarts.init(userLevelChartRef.value)
    }

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center'
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          data: data
        }
      ]
    }

    userLevelChart.setOption(option)
  } catch (error) {
    console.error('加载用户等级分布失败', error)
  }
}

// 加载商品销量排行
const loadProductRanking = async () => {
  try {
    const response = await dashboardApi.getProductRanking()
    const data = response.data

    if (!productRankingChart) {
      productRankingChart = echarts.init(productRankingRef.value)
    }

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value'
      },
      yAxis: {
        type: 'category',
        data: data.map(item => item.name)
      },
      series: [
        {
          type: 'bar',
          data: data.map(item => ({
            value: item.sales,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#83bff6' },
                { offset: 0.5, color: '#188df0' },
                { offset: 1, color: '#188df0' }
              ])
            }
          }))
        }
      ]
    }

    productRankingChart.setOption(option)
  } catch (error) {
    console.error('加载商品销量排行失败', error)
  }
}

// 加载佣金分布
const loadCommissionDistribution = async () => {
  try {
    const response = await dashboardApi.getCommissionDistribution()
    const data = response.data

    if (!commissionChart) {
      commissionChart = echarts.init(commissionChartRef.value)
    }

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      radar: {
        indicator: data.map(item => ({
          name: item.level,
          max: 10000
        }))
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: data.map(item => item.amount),
              name: '佣金金额',
              areaStyle: {
                color: new echarts.graphic.RadialGradient(0.1, 0.6, 1, [
                  { color: 'rgba(128, 128, 255, 0.5)', offset: 0 },
                  { color: 'rgba(128, 128, 255, 0.1)', offset: 1 }
                ])
              }
            }
          ]
        }
      ]
    }

    commissionChart.setOption(option)
  } catch (error) {
    console.error('加载佣金分布失败', error)
  }
}

// 加载最新动态
const loadRecentActivities = async () => {
  try {
    const response = await dashboardApi.getRecentActivities()
    recentActivities.value = response.data
  } catch (error) {
    console.error('加载最新动态失败', error)
  }
}

// 刷新商品排行
const refreshProductRanking = () => {
  loadProductRanking()
}

// 获取活动类型颜色
const getActivityTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    ORDER: 'success',
    PAYMENT: 'primary',
    COMMISSION: 'warning',
    REGISTER: 'info'
  }
  return colorMap[type] || ''
}

// 获取活动类型文本
const getActivityTypeText = (type: string) => {
  const textMap: Record<string, string> = {
    ORDER: '订单',
    PAYMENT: '支付',
    COMMISSION: '佣金',
    REGISTER: '注册'
  }
  return textMap[type] || type
}

// 初始化图表
const initCharts = async () => {
  await nextTick()
  loadSalesTrend()
  loadUserLevelDistribution()
  loadProductRanking()
  loadCommissionDistribution()
}

// 周期切换监听
const unwatchPeriod = watch(salesPeriod, () => {
  loadSalesTrend()
})

// 窗口大小调整
const handleResize = () => {
  salesChart?.resize()
  userLevelChart?.resize()
  productRankingChart?.resize()
  commissionChart?.resize()
}

// 初始化
onMounted(() => {
  loadStats()
  initCharts()
  loadRecentActivities()
  window.addEventListener('resize', handleResize)
})

// 销毁
onBeforeUnmount(() => {
  unwatchPeriod()
  window.removeEventListener('resize', handleResize)
  salesChart?.dispose()
  userLevelChart?.dispose()
  productRankingChart?.dispose()
  commissionChart?.dispose()
})
</script>

<style lang="scss" scoped>
.dashboard {
  .stats-row {
    margin-bottom: 20px;
  }

  .charts-row {
    margin-bottom: 20px;
  }

  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      margin-bottom: 20px;

      .stat-icon {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 20px;

        .el-icon {
          font-size: 30px;
          color: #fff;
        }

        &.users {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        &.orders {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        &.revenue {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        &.commission {
          background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        }
      }

      .stat-info {
        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #303133;
        }

        .stat-label {
          font-size: 14px;
          color: #909399;
          margin-top: 5px;
        }
      }
    }

    .stat-trend {
      display: flex;
      align-items: center;
      padding-top: 20px;
      border-top: 1px solid #ebeef5;

      .el-icon {
        margin-right: 5px;
        font-size: 14px;
      }

      .trend-value {
        font-weight: bold;
        margin-right: 10px;

        &.up {
          color: #67c23a;
        }

        &.down {
          color: #f56c6c;
        }
      }

      .trend-label {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
```

## 操作日志

### 1. 日志记录

```typescript
// src/utils/logger.ts
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/admin'

interface LogData {
  module: string
  action: string
  description?: string
  data?: any
  userId?: string
}

export class AdminLogger {
  // 记录操作日志
  static async log(data: LogData) {
    try {
      await adminApi.log({
        ...data,
        timestamp: new Date(),
        ip: await this.getClientIP(),
        userAgent: navigator.userAgent
      })
    } catch (error) {
      console.error('记录操作日志失败', error)
    }
  }

  // 记录登录日志
  static async logLogin(userId: string, success: boolean, reason?: string) {
    await this.log({
      module: 'AUTH',
      action: 'LOGIN',
      description: success ? '登录成功' : `登录失败: ${reason}`,
      data: { success, reason },
      userId
    })
  }

  // 记录增删改操作
  static async logCRUD(module: string, action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, data?: any) {
    const actionMap = {
      CREATE: '新增',
      UPDATE: '修改',
      DELETE: '删除'
    }

    await this.log({
      module,
      action,
      description: `${actionMap[action]}ID: ${id}`,
      data: { id, ...data }
    })
  }

  // 记录批量操作
  static async logBatch(module: string, action: string, ids: string[], data?: any) {
    await this.log({
      module,
      action,
      description: `批量${action}，数量: ${ids.length}`,
      data: { ids, ...data }
    })
  }

  // 记录导出操作
  static async logExport(module: string, format: string, count: number) {
    await this.log({
      module,
      action: 'EXPORT',
      description: `导出${format}格式数据，条数: ${count}`,
      data: { format, count }
    })
  }

  // 获取客户端IP
  private static async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return 'unknown'
    }
  }
}
```

### 2. 日志查看

```vue
<!-- src/views/log/index.vue -->
<template>
  <div class="log-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>操作日志</span>
          <el-button type="primary" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出日志
          </el-button>
        </div>
      </template>

      <!-- 搜索栏 -->
      <el-form :model="searchForm" inline class="search-form">
        <el-form-item label="操作模块">
          <el-select v-model="searchForm.module" placeholder="请选择" clearable>
            <el-option label="用户管理" value="USER" />
            <el-option label="商品管理" value="PRODUCT" />
            <el-option label="订单管理" value="ORDER" />
            <el-option label="财务管理" value="FINANCE" />
            <el-option label="系统管理" value="SYSTEM" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="searchForm.action" placeholder="请选择" clearable>
            <el-option label="新增" value="CREATE" />
            <el-option label="修改" value="UPDATE" />
            <el-option label="删除" value="DELETE" />
            <el-option label="导出" value="EXPORT" />
            <el-option label="登录" value="LOGIN" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input
            v-model="searchForm.operator"
            placeholder="请输入操作人"
            clearable
          />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table v-loading="loading" :data="tableData">
        <el-table-column prop="module" label="模块" width="100">
          <template #default="{ row }">
            <el-tag :type="getModuleType(row.module)">
              {{ getModuleText(row.module) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="操作" width="100">
          <template #default="{ row }">
            <el-tag :type="getActionType(row.action)">
              {{ getActionText(row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="ip" label="IP地址" width="130" />
        <el-table-column prop="createdAt" label="操作时间" width="180" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="handleView(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="日志详情"
      width="50%"
      destroy-on-close
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="模块">
          {{ getModuleText(currentLog?.module) }}
        </el-descriptions-item>
        <el-descriptions-item label="操作">
          {{ getActionText(currentLog?.action) }}
        </el-descriptions-item>
        <el-descriptions-item label="描述">
          {{ currentLog?.description }}
        </el-descriptions-item>
        <el-descriptions-item label="操作人">
          {{ currentLog?.operator }}
        </el-descriptions-item>
        <el-descriptions-item label="IP地址">
          {{ currentLog?.ip }}
        </el-descriptions-item>
        <el-descriptions-item label="用户代理">
          {{ currentLog?.userAgent }}
        </el-descriptions-item>
        <el-descriptions-item label="操作时间">
          {{ currentLog?.createdAt }}
        </el-descriptions-item>
        <el-descriptions-item label="操作数据">
          <pre>{{ JSON.stringify(currentLog?.data, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { logApi } from '@/api/log'
import { getModuleType, getModuleText, getActionType, getActionText } from '@/utils'

// 响应式数据
const loading = ref(false)
const tableData = ref([])
const dateRange = ref([])
const detailVisible = ref(false)
const currentLog = ref<any>(null)

// 搜索表单
const searchForm = reactive({
  module: '',
  action: '',
  operator: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 加载数据
const loadTableData = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      startTime: dateRange.value?.[0],
      endTime: dateRange.value?.[1],
      page: pagination.page,
      limit: pagination.limit
    }
    const response = await logApi.getList(params)
    tableData.value = response.data.list
    pagination.total = response.data.total
  } catch (error) {
    console.error('加载日志列表失败', error)
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadTableData()
}

// 重置
const handleReset = () => {
  Object.assign(searchForm, {
    module: '',
    action: '',
    operator: ''
  })
  dateRange.value = []
  handleSearch()
}

// 查看详情
const handleView = (row: any) => {
  currentLog.value = row
  detailVisible.value = true
}

// 导出日志
const handleExport = async () => {
  try {
    const params = {
      ...searchForm,
      startTime: dateRange.value?.[0],
      endTime: dateRange.value?.[1]
    }
    const response = await logApi.export(params)

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `logs_${new Date().getTime()}.xlsx`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    // 记录导出日志
    AdminLogger.logExport('LOG', 'Excel', pagination.total)
  } catch (error) {
    console.error('导出失败', error)
  }
}

// 分页事件
const handleSizeChange = (val: number) => {
  pagination.limit = val
  loadTableData()
}

const handleCurrentChange = (val: number) => {
  pagination.page = val
  loadTableData()
}

// 初始化
onMounted(() => {
  loadTableData()
})
</script>

<style lang="scss" scoped>
.log-management {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .search-form {
    margin-bottom: 20px;
  }

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  pre {
    background: #f5f7fa;
    padding: 10px;
    border-radius: 4px;
    font-size: 12px;
    max-height: 300px;
    overflow-y: auto;
  }
}
</style>
```

## 部署指南

### 1. 构建配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'static',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
        assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
        manualChunks: {
          'element-plus': ['element-plus'],
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts': ['echarts']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

### 2. 部署脚本

```bash
#!/bin/bash
# scripts/deploy.sh

# 构建项目
echo "开始构建..."
npm run build

# 压缩静态资源
echo "压缩静态资源..."
gzip -r dist/static/

# 同步到服务器
echo "同步到服务器..."
rsync -avz --delete dist/ user@server:/var/www/zhongdao-admin/

# 更新nginx配置
echo "更新nginx配置..."
ssh user@server "sudo nginx -s reload"

echo "部署完成！"
```

### 3. Nginx配置

```nginx
# /etc/nginx/sites-available/zhongdao-admin
server {
    listen 80;
    server_name admin.zhongdao.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.zhongdao.com;

    # SSL证书
    ssl_certificate /etc/ssl/certs/zhongdao-admin.crt;
    ssl_certificate_key /etc/ssl/private/zhongdao-admin.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # 静态文件
    location / {
        root /var/www/zhongdao-admin;
        try_files $uri $uri/ /index.html;

        # 缓存配置
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 常见问题

### 1. 权限问题

**Q: 页面显示403错误？**
A: 检查以下几点：
- 确认用户是否已登录
- 检查用户是否有相应权限
- 确认路由配置是否正确

### 2. 数据加载问题

**Q: 表格数据不显示？**
A: 可能原因：
- API接口返回数据格式错误
- 分页参数设置错误
- 网络请求失败

### 3. 图表显示问题

**Q: ECharts图表不显示？**
A: 解决方案：
- 确保容器元素已渲染
- 检查数据格式是否正确
- 手动触发resize事件

## 技术支持

如有问题，请联系：
- 文档维护：文档AI
- 权限系统：用户系统AI
- 性能优化：性能优化AI
- 测试问题：测试AI

*最后更新时间：2025-12-10*