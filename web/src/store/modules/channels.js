import channel_api from '../../api/channels'
import user_api from '../../api/users'
import * as types from '../mutation-types'

import async from 'async'
import Cookies from 'js-cookie'

const state = {
  channels : [],
  users : {},
  pms : []
}

const getters = {
  channels : state => state.channels,
  users : state => state.users,
  pms : state => state.pms
}

const actions = {
  refresh_channels({commit, state}, token){
    return new Promise((resolve, reject) => {
      commit(types.CLEAR_CHANNELS);
      channel_api.getChannels(token, (ch) => {
        var raw_channels = [];
        async.eachSeries(ch, (channel, cb) => {
          raw_channels[channel.group] ? raw_channels[channel.group].push(channel.channel) : raw_channels[channel.group] = [channel.channel];
          user_api.get_users(channel, token, function(users){
            Object.keys(users).forEach(function(user_id){
              commit(types.ADD_USER, {id : user_id, user : users[user_id]});
            });
            cb();
          });
        }, () => {
          var channels = [];
          for(var group in raw_channels){
            channels.push({
              group : group,
              channels : raw_channels[group]
            });
          }
          commit(types.REFRESH_CHANNELS, channels);
          resolve();
        });
      });
    });
  },
  refresh_channel_users({commit, state}, {gc, token}){
    return new Promise((resolve) => {
      user_api.get_users(gc, token, (users) => {
        Object.keys(users).forEach((user_id) => {
          commit(types.ADD_USER, {id : user_id, user : users[user_id]});
        });
        resolve();
      });
    });
  },
  add_pm_channel({commit, state}, channel){
    commit(types.ADD_PM_CHANNEL, channel);
  },
  refresh_pms({commit, state}, token){
    return new Promise((resolve, reject) => {
      channel_api.getPMS(token, function(pms){
        async.eachSeries(pms.pms, function(pm, cb){
          user_api.get_user(pm, function(user){
            commit(types.ADD_USER, pm, user);
            commit(types.ADD_PM_CHANNEL, pm);
            cb();
          });
        }, function(){
          resolve();
        });
      });
    });
  },
  refresh_user({commit, state}, userid){
    return new Promise((resolve) => {
      user_api.get_user(userid, (user) => {
        commit(types.ADD_USER, {
          id : userid,
          user : user
        });
        resolve();
      });
    });
  },
  update_position({commit, state}, data){
    return new Promise((resolve) => {
      channel_api.updateTimestamp(data.token, data.gc, resolve);
    });
  }
}

const mutations = {
  [types.REFRESH_CHANNELS](state, channels){
    state.channels = channels;
  },
  [types.ADD_USER](state, user){
    state.users[user.id] = user.user;
  },
  [types.ADD_USERS](state, users){
    state.users = users;
  },
  [types.ADD_PM_CHANNEL](state, channel){
    if(!state.pms.includes(channel))
      state.pms.push(channel);
  },
  [types.CLEAR_CHANNELS](state){
    state.channels = [];
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
