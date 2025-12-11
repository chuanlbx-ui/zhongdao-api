import { get, post, put } from './index';

// 获取订单列表
export const getOrders = (params) => {
    return get('/orders', params);
};

// 创建订单
export const createOrder = (data) => {
    return post('/orders', data);
};

// 获取订单详情
export const getOrderDetail = (id) => {
    return get(`/orders/${id}`);
};

// 取消订单
export const cancelOrder = (id) => {
    return put(`/orders/${id}/cancel`);
};

// 确认收货
export const confirmOrder = (id) => {
    return put(`/orders/${id}/confirm`);
};
