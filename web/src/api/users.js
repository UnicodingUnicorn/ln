import Vue from 'vue';
import Resource from 'vue-resource';

import toastr from 'toastr';

import options from '../options';

Vue.use(Resource);

export default{
  get_userinfo(token, cb){
    Vue.http.get(options.OPENID_URL + '/userinfo', {
      headers : {Authorization : 'Bearer ' + token},
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body);
      }, function(res){
        toastr.error(res.body.error_description);
    });
  },
  get_user(user_id, cb){
    Vue.http.get(options.ACCOUNTS_URL + '/user?id=' + user_id, {
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body.user);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  get_users(gc, token, cb){
    Vue.http.get(options.ACCOUNTS_URL + '/users?channel=' + gc.channel + "&group=" + gc.group, {
      headers : {'Authorization' : 'Bearer ' + token},
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body.users);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  update_user(user_data, token, cb){
    Vue.http.post(options.ACCOUNTS_URL + '/user', user_data, {
      headers : {'Authorization' : 'Bearer ' + token},
      responseType : 'json'
    }).then(
      (res) => {
        cb();
      }, (res) => {
        toastr.error(res.body.message);
    });
  },
  search_name(name, cb){
    Vue.http.get(options.ACCOUNTS_URL + '/user?name=' + encodeURIComponent(name), {
      responseType : 'json'
    }).then(
      res => {
        cb(res.body.ids);
      }, res => {
        toastr.error(res.body.message);
    });
  },
  get_usernames(cb){
    Vue.http.get(options.ACCOUNTS_URL + '/usernames', {
      responseType : 'json'
    }).then(
      res => {
        cb(res.body.usernames);
      }, res => {
        toastr.error(res.body.message);
    });
  },
  add_to_channel(userid, gc, token, cb){
    Vue.http.post(options.ACCOUNTS_URL + '/channel', {
      user : userid,
      group : gc.group,
      channel : gc.channel
    }, {
      headers : {'Authorization' : 'Bearer ' + token},
      responseType : 'json'
    }).then(
      res => {
        cb();
      }, res => {
        toastr.error(res.body.message ? res.body.message : res.body);
    });
  }
}
