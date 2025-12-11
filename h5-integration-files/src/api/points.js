import { get, post } from './index';

// 获取积分余额
export const getPointsBalance = () => {
    return get('/points/balance');
};

// 获取积分统计
export const getPointsStatistics = () => {
    return get('/points/statistics');
};

// 获取积分交易记录
export const getPointsTransactions = (params) => {
    return get('/points/transactions', params);
};

// 积分转账
export const transferPoints = (data) => {
    return post('/points/transfer', data);
};

// 积分充值
export const rechargePoints = (data) => {
    return post('/points/recharge', data);
};
