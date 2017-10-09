import messages from '../../api/messages'
import * as types from '../mutation-types'

import async from 'async'
import Vue from 'vue'

import options from '../../options'

const state = {
  messages : {},
  num_messages : {}
}

const getters = {
  messages : state => state.messages,
  num_messages : state => state.num_messages
}

const actions = {
  add_message({commit, state}, message){
    return new Promise((resolve, reject) => {
      commit(types.ADD_MESSAGE, message);
      resolve();
    });
  },
  init_messages({commit, state}, data){
    return new Promise((resolve, reject) => {
      async.each(data.channels, function(gc, cb){
        async.each(gc.channels, function(channel, cb2){
          messages.get_messages({group : gc.group, channel : channel}, data.token, function(m){
            m.forEach(function(message){
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
        messages.get_messages_offset(data.gc, message_length, data.token, function(m){
          for(var i = m.length - 1; i >= 0; i--)
            commit(types.PREPEND_MESSAGE, {message : m[i], gc : data.gc.group + '+' + data.gc.channel});
          resolve();
        });
      }else{
        resolve();
      }
    });
  }
}

const mutations = {
  [types.ADD_MESSAGE](state, data){
    if(state.messages[data.gc]){
      state.num_messages[data.gc] += 1;
      var new_dt = new Date(data.message.datetime);
      var group = state.messages[data.gc];
      if(group[group.length - 1].date == messages.render_date(new_dt)){
        var currentGroup = group[group.length - 1];
        var lastMessage = currentGroup.messages[currentGroup.messages.length - 1];
        if(lastMessage.user != data.message.user){
          currentGroup.messages.push({
            user : data.message.user,
            datetime : data.message.datetime,
            type : data.message.type,
            messages : [data.message.message]
          });
        }else{
          if(lastMessage.type != data.message.type){
            currentGroup.messages.push({
              user : data.message.user,
              datetime : data.message.datetime,
              type : data.message.type,
              messages : [data.message.message]
            });
          }else{
            var old_dt = new Date(lastMessage.datetime);
            if(messages.render_time(old_dt) == messages.render_time(new_dt)){
              lastMessage.messages.push(data.message.message);
            }else{
              currentGroup.messages.push({
                user : data.message.user,
                datetime : data.message.datetime,
                type : data.message.type,
                messages : [data.message.message]
              });
            }
          }
        }
      }else{
        state.messages[data.gc].push({
          date : messages.render_date(new Date(data.message.datetime)),
          messages : [{
            user : data.message.user,
            datetime : data.message.datetime,
            type : data.message.type,
            messages : [data.message.message]
          }]
        });
      }
    }else{
      Vue.set(state.num_messages, data.gc, 1);
      Vue.set(state.messages, data.gc, [{
        date : messages.render_date(new Date(data.message.datetime)),
        messages : [{
          user : data.message.user,
          datetime : data.message.datetime,
          type : data.message.type,
          messages : [data.message.message]
        }]
      }]);
    }
  },
  [types.PREPEND_MESSAGE](state, data){
    if(state.messages[data.gc]){
      state.num_messages[data.gc] += 1;
      var new_dt = new Date(data.message.datetime);
      var group = state.messages[data.gc];
      if(group[0].date == messages.render_date(new_dt)){
        var currentGroup = group[0];
        var lastMessage = currentGroup.messages[0];
        if(lastMessage.user != data.message.user){
          currentGroup.messages.unshift({
            user : data.message.user,
            datetime : data.message.datetime,
            type : data.message.type,
            messages : [data.message.message]
          });
        }else{
          if(lastMessage.type != data.message.type){
            currentGroup.messages.unshift({
              user : data.message.user,
              datetime : data.message.datetime,
              type : data.message.type,
              messages : [data.message.message]
            });
          }else{
            var old_dt = new Date(lastMessage.datetime);
            if(messages.render_time(old_dt) == messages.render_time(new_dt)){
              lastMessage.messages.unshift(data.message.message);
            }else{
              currentGroup.messages.unshift({
                user : data.message.user,
                datetime : data.message.datetime,
                type : data.message.type,
                messages : [data.message.message]
              });
            }
          }
        }
      }else{
        state.messages[data.gc].unshift({
          date : messages.render_date(new Date(data.message.datetime)),
          messages : [{
            user : data.message.user,
            datetime : data.message.datetime,
            type : data.message.type,
            messages : [data.message.message]
          }]
        });
      }
    }else{
      Vue.set(state.num_messages, data.gc, 1);
      Vue.set(state.messages, data.gc, [{
        date : messages.render_date(new Date(data.message.datetime)),
        messages : [{
          user : data.message.user,
          datetime : data.message.datetime,
          type : data.message.type,
          messages : [data.message.message]
        }]
      }]);
    }
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
