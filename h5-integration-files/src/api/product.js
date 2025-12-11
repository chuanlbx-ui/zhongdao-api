import { get, post } from './index';

// 获取商品列表
export const getProducts = (params) => {
    return get('/products', params);
};

// 获取商品详情
export const getProductDetail = (id) => {
    return get(`/products/${id}`);
};

// 获取商品分类
export const getCategories = () => {
    return get('/products/categories');
};

// 获取商品标签
export const getTags = () => {
    return get('/products/tags');
};

// 搜索商品
export const searchProducts = (params) => {
    return get('/products/search', params);
};
