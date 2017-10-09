import * as types from '../mutation-types'

import toastr from 'toastr'

const state = {
  errors : []
}

const getters = {
  errors : state => state.errors
}

const actions = {
  new_err({commit, state}, err){
    toastr.error(err);
    //COMMIT
  },
  new_info({commit, state}, info){
    toastr.warning(info);
  }
}

const mutations = {

}

export default {
  state,
  getters,
  actions,
  mutations
}
