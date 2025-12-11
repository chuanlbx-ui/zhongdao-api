import Vue from 'vue';
import VueRouter from 'vue-router';
import { isLoggedIn } from '@/utils/auth';

Vue.use(VueRouter);

const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '首页' }
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue'),
        meta: { title: '登录', guest: true }
    },
    {
        path: '/products',
        name: 'Products',
        component: () => import('@/views/Products.vue'),
        meta: { title: '商品列表' }
    },
    {
        path: '/product/:id',
        name: 'ProductDetail',
        component: () => import('@/views/ProductDetail.vue'),
        meta: { title: '商品详情' }
    },
    {
        path: '/orders',
        name: 'Orders',
        component: () => import('@/views/Orders.vue'),
        meta: { title: '我的订单', requiresAuth: true }
    },
    {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', requiresAuth: true }
    },
    {
        path: '/points',
        name: 'Points',
        component: () => import('@/views/Points.vue'),
        meta: { title: '我的积分', requiresAuth: true }
    }
];

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes
});

// 路由守卫
router.beforeEach((to, from, next) => {
    // 设置页面标题
    if (to.meta.title) {
        document.title = to.meta.title + ' - 中道商城';
    }

    // 检查登录状态
    if (to.meta.requiresAuth && !isLoggedIn()) {
        next({
            path: '/login',
            query: { redirect: to.fullPath }
        });
    } else if (to.meta.guest && isLoggedIn()) {
        next('/');
    } else {
        next();
    }
});

export default router;
