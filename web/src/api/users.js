import Vue from 'vue';
import Resource from 'vue-resource';

import toastr from 'toastr';

import auth from "./auth";
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
    Vue.http.get(options.ACCOUNTS_URL + '/user/' + user_id, {
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body.user);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  get_users(gc, token, cb){
    Vue.http.get(auth.withAuth(token, options.ACCOUNTS_URL + '/users/' + JSON.stringify(gc)), {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)},
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body.users);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  search_name(name, cb){
    Vue.http.get(options.ACCOUNTS_URL + '/user/by_name/' + encodeURIComponent(name), {
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
    Vue.http.post(auth.withAuth(token, options.ACCOUNTS_URL + '/channel/adduser'), {
      user : userid,
      group : gc.group,
      channel : gc.channel
    }, {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)},
      responseType : 'json'
    }).then(
      res => {
        cb();
      }, res => {
        toastr.error(res.body.message ? res.body.message : res.body);
    });
  }
}
