import user from '../../api/users'
import * as types from '../mutation-types'

import Cookies from 'js-cookie'

const state = {
  token : Cookies.get("token"),
  user_info : Cookies.get('user_info') ? JSON.parse(Cookies.get('user_info')) : {},
  err_message : ""
}

const getters = {
  user_token : state => state.token,
  user_info : state => state.user_info,
  err_message : state => state.err_message
}

const actions = {
  login({commit, state}, login_data){
    commit(types.LOGIN);
    Cookies.set("token", login_data.id_token, {expires : 1});
    commit(types.LOGIN_SUCCESS, login_data.id_token);
  },
  logout({commit, state}){
    Cookies.remove('token');
    Cookies.remove('gc');
    Cookies.remove('nonce');
    commit(types.LOGOUT);
  },
  get_userinfo({commit, state}, login_data){
    user.get_userinfo(login_data.access_token, function(userinfo){
      Cookies.set('user_info', JSON.stringify(userinfo), {expires : 1});
      commit(types.UPDATE_USERINFO, userinfo);
    });
  }
}

const mutations = {
  [types.LOGIN](state){
    state.token = "";
    state.err_message = "";
  },
  [types.LOGIN_SUCCESS](state, token){
    state.token = token;
  },
  [types.LOGOUT](state){
    state.token = "";
  },
  [types.UPDATE_USERINFO](state, user_info){
    state.user_info = user_info;
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
