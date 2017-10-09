import channel_api from '../../api/channels'
import * as types from '../mutation-types'

import Cookies from 'js-cookie'

const state = {
  channels : []
}

const getters = {
  channels : state => state.channels
}

const actions = {
  refresh_channels({commit, state}, token){
    return new Promise((resolve, reject) => {
      channel_api.getChannels(token, function(ch){
        var raw_channels = {};
        ch.forEach(function(channel){
          var group = channel.split('+')[0];
          var channel = channel.split('+')[1];
          raw_channels[group] ? raw_channels[group].push(channel) : raw_channels[group] = [channel];
        });
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
  }
}

const mutations = {
  [types.REFRESH_CHANNELS](state, channels){
    state.channels = channels;
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
