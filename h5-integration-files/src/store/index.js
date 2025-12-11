import Vue from 'vue';
import Vuex from 'vuex';
import user from './modules/user';

Vue.use(Vuex);

export default new Vuex.Store({
    modules: {
        user
    },

    state: {
        loading: false,
        cart: []
    },

    mutations: {
        SET_LOADING(state, loading) {
            state.loading = loading;
        },

        ADD_TO_CART(state, item) {
            const existItem = state.cart.find(i => i.id === item.id);
            if (existItem) {
                existItem.quantity += item.quantity;
            } else {
                state.cart.push(item);
            }
        },

        REMOVE_FROM_CART(state, id) {
            state.cart = state.cart.filter(item => item.id !== id);
        },

        CLEAR_CART(state) {
            state.cart = [];
        }
    },

    getters: {
        cartCount: state => {
            return state.cart.reduce((count, item) => count + item.quantity, 0);
        },
        cartTotal: state => {
            return state.cart.reduce((total, item) => total + item.price * item.quantity, 0);
        }
    }
});
