//import user from '../../api/user'
import * as types from '../mutation-types'

import Cookies from 'js-cookie'

const state = {
  //token : Cookies.get('token') != undefined ? Cookies.get('token') : "",
  token : Cookies.get("token"),
  err_message : ""
}

const getters = {
  user_token : state => state.token,
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
    Cookies.remove('nonce');
    commit(types.LOGOUT);
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
  [types.LOGIN_FAILURE](state, message){
    state.err_message = message;
  },
  [types.LOGOUT](state){
    state.token = "";
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
