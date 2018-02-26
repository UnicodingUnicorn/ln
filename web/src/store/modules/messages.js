import messages from '../../api/messages'
import * as types from '../mutation-types'

import async from 'async'
import Vue from 'vue'

import options from '../../options'

const state = {
  messages : {},
  num_messages : {},
  last_pos : {}
}

const getters = {
  messages : state => state.messages,
  num_messages : state => state.num_messages,
  last_pos : state => state.last_pos
}

const actions = {
  add_message({commit, state}, message){
    return new Promise((resolve, reject) => {
      commit(types.ADD_MESSAGE, message);
      resolve();
    });
  },
  clear_messages({commit, state}){
    return new Promise((resolve) => {
      commit(types.CLEAR_MESSAGES);
      resolve();
    });
  },
  init_messages({commit, state}, data){
    return new Promise((resolve, reject) => {
      async.each(data.channels, function(gc, cb){
        async.each(gc.channels, function(channel, cb2){
          messages.get_messages({group : gc.group, channel : channel}, data.token, function(data){
            commit(types.INIT_POS, {gc : gc.group + '+' + channel, pos : data.last_pos});
            data.messages.forEach(function(message){
              commit(types.ADD_MESSAGE, {message : message, gc : gc.group + '+' + channel});
            });
            cb2();
          });
        }, function(err){
          err ? cb(err) : cb();
        });
      }, function(err){
        resolve();
      });
    });
  },
  load_messages({commit, state}, data){
    return new Promise((resolve, reject) => {
      var message_length = state.num_messages[data.gc.group + '+' + data.gc.channel];
      if(message_length >= options.HISTORY_COUNT){
        messages.get_messages_offset(data.gc, message_length, data.token, function(data){
          for(var i = data.messages.length - 1; i >= 0; i--)
            commit(types.PREPEND_MESSAGE, {message : data.messages[i], gc : data.gc.group + '+' + data.gc.channel});
          resolve();
        });
      }else{
        resolve();
      }
    });
  },
  init_pms({commit, state}, data){
    return new Promise((resolve, reject) => {
      async.each(data.channels, function(user, cb){
        messages.get_pms(user, data.token, function(res){
          res.messages.forEach(function(message){
            commit(types.ADD_MESSAGE, {message : message, gc : 'pm' + '+' + user});
          });
          cb();
        });
      }, function(err){
        resolve();
      });
    });
  },
  load_pms({commit, state}, data){
    return new Promise((resolve, reject) => {
      var message_length = state.num_messages['pm' + '+' + data.user];
      if(message_length >= options.HISTORY_COUNT){
        messages.get_pms_offset(data.user, message_length, data.token, function(res){
          for(var i = res.messages.length - 1; i >= 0; i--)
            commit(types.PREPEND_MESSAGE, {message : res.messages[i], gc : 'pm' + '+' + data.user});
          resolve();
        });
      }else{
        resolve();
      }
    });
  },
  update_pos({commit, state}, data){
    commit(types.UPDATE_POS, {gc : data.group + '+' + data.channel});
  },
  update_pos_specific({commit, state}, data){
    commit(types.UPDATE_POS_SPECIFIC, {
      gc : data.group + '+' + data.channel,
      pos : data.pos
    });
  }
}

const mutations = {
  [types.ADD_MESSAGE](state, data){
    if(state.messages[data.gc]){
      state.num_messages[data.gc] += 1;
      var group = state.messages[data.gc];
      if(messages.render_date(group[group.length - 1].datetime) == messages.render_date(+data.message.datetime)){
        var currentGroup = group[group.length - 1];
        var lastMessage = currentGroup.messages[currentGroup.messages.length - 1];
        if(lastMessage.user != data.message.user){
          currentGroup.messages.push({
            user : data.message.user,
            datetime : +data.message.datetime,
            type : data.message.type,
            messages : [data.message.message]
          });
        }else{
          if(lastMessage.type != data.message.type){
            currentGroup.messages.push({
              user : data.message.user,
              datetime : +data.message.datetime,
              type : data.message.type,
              messages : [data.message.message]
            });
          }else{
            if(messages.render_time(lastMessage.datetime) == messages.render_time(+data.message.datetime)){
              lastMessage.messages.push(data.message.message);
            }else{
              currentGroup.messages.push({
                user : data.message.user,
                datetime : +data.message.datetime,
                type : data.message.type,
                messages : [data.message.message]
              });
            }
          }
        }
      }else{
        state.messages[data.gc].push({
          datetime : +data.message.datetime,
          messages : [{
            user : data.message.user,
            datetime : +data.message.datetime,
            type : data.message.type,
            messages : [data.message.message]
          }]
        });
      }
    }else{
      Vue.set(state.num_messages, data.gc, 1);
      Vue.set(state.messages, data.gc, [{
        datetime : +data.message.datetime,
        messages : [{
          user : data.message.user,
          datetime : +data.message.datetime,
          type : data.message.type,
          messages : [data.message.message]
        }]
      }]);
    }
  },
  [types.PREPEND_MESSAGE](state, data){
    if(state.messages[data.gc]){
      state.num_messages[data.gc] += 1;
      var group = state.messages[data.gc];
      if(messages.render_date(group[0].datetime) == messages.render_date(+data.message.datetime)){
        var currentGroup = group[0];
        var lastMessage = currentGroup.messages[0];
        if(lastMessage.user != data.message.user){
          currentGroup.messages.unshift({
            user : data.message.user,
            datetime : +data.message.datetime,
            type : data.message.type,
            messages : [data.message.message]
          });
        }else{
          if(lastMessage.type != data.message.type){
            currentGroup.messages.unshift({
              user : data.message.user,
              datetime : +data.message.datetime,
              type : data.message.type,
              messages : [data.message.message]
            });
          }else{
            var old_dt = new Date(lastMessage.datetime);
            if(messages.render_time(old_dt) == messages.render_time(+data.message.datetime)){
              lastMessage.messages.unshift(data.message.message);
            }else{
              currentGroup.messages.unshift({
                user : data.message.user,
                datetime : +data.message.datetime,
                type : data.message.type,
                messages : [data.message.message]
              });
            }
          }
        }
      }else{
        state.messages[data.gc].unshift({
          datetime : +data.message.datetime,
          messages : [{
            user : data.message.user,
            datetime : +data.message.datetime,
            type : data.message.type,
            messages : [data.message.message]
          }]
        });
      }
    }else{
      Vue.set(state.num_messages, data.gc, 1);
      Vue.set(state.messages, data.gc, [{
        datetime : +data.message.datetime,
        messages : [{
          user : data.message.user,
          datetime : +data.message.datetime,
          type : data.message.type,
          messages : [data.message.message]
        }]
      }]);
    }
  },
  [types.CLEAR_MESSAGES](state){
    state.messages = {};
  },
  [types.INIT_POS](state, data){
    if(!state.last_pos[data.gc])
      state.last_pos[data.gc] = +data.pos;
  },
  [types.UPDATE_POS](state, data){
    state.last_pos[data.gc] = Date.now();
  },
  [types.UPDATE_POS_SPECIFIC](state, data){
    state.last_pos[data.gc] = data.pos;
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
