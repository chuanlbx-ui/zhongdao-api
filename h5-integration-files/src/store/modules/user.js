import { getUserInfo, setUserInfo, removeUserInfo } from '@/utils/auth';

const state = {
    userInfo: getUserInfo() || null,
    token: localStorage.getItem('token') || null
};

const mutations = {
    SET_USER_INFO(state, userInfo) {
        state.userInfo = userInfo;
        setUserInfo(userInfo);
    },

    SET_TOKEN(state, token) {
        state.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    },

    CLEAR_USER(state) {
        state.userInfo = null;
        state.token = null;
        removeUserInfo();
        localStorage.removeItem('token');
    }
};

const actions = {
    // 登录
    async login({ commit }, credentials) {
        // 这里调用登录API
        // const { token, user } = await login(credentials);
        // commit('SET_TOKEN', token);
        // commit('SET_USER_INFO', user);
    },

    // 退出登录
    logout({ commit }) {
        commit('CLEAR_USER');
    },

    // 更新用户信息
    updateUserInfo({ commit }, userInfo) {
        commit('SET_USER_INFO', userInfo);
    }
};

const getters = {
    isLoggedIn: state => !!state.token,
    userLevel: state => state.userInfo?.level || 'NORMAL',
    userRole: state => state.userInfo?.role || 'USER'
};

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
};
