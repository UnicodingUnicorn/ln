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
  }
}
