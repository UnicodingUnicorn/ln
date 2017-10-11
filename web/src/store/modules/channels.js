import channel_api from '../../api/channels'
import user_api from '../../api/users'
import * as types from '../mutation-types'

import async from 'async'
import Cookies from 'js-cookie'

const state = {
  channels : [],
  users : []
}

const getters = {
  channels : state => state.channels,
  users : state => state.users
}

const actions = {
  refresh_channels({commit, state}, token){
    return new Promise((resolve, reject) => {
      channel_api.getChannels(token, function(ch){
        var raw_channels = {};
        async.eachSeries(ch, function(channel, cb){
          var group = channel.split('+')[0];
          var channel = channel.split('+')[1];
          raw_channels[group] ? raw_channels[group].push(channel) : raw_channels[group] = [channel];
          user_api.get_users(group + '+' + channel, token, function(users){
            commit(types.ADD_USERS, users);
            cb();
          });
        }, function(){
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
  }
}

const mutations = {
  [types.REFRESH_CHANNELS](state, channels){
    state.channels = channels;
  },
  [types.ADD_USERS](state, users){
    state.users = users;
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
