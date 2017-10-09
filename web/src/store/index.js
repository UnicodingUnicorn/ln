import Vue from 'vue'
import Vuex from 'vuex'

import * as actions from "./actions"
import * as getters from "./getters"

import user from "./modules/user"
import channels from "./modules/channels"
//import errors from "./modules/errors"
import messages from "./modules/messages"

Vue.use(Vuex)

export default new Vuex.Store({
  actions,
  getters,
  modules : {
    user,
    channels,
    //errors,
    messages
  }
});
