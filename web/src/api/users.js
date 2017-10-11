import Vue from 'vue';
import Resource from 'vue-resource';

import toastr from 'toastr';

import options from '../options';

Vue.use(Resource);

export default{
  get_user(user_id, cb){
    Vue.http.get(options.ACCOUNTS_URL + '/user/' + user_id, {
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  get_users(gc, token, cb){
    Vue.http.get(options.ACCOUNTS_URL + '/users/' + gc, {
      headers : {'Authorization' : 'Bearer ' + token},
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body.users);
      }, function(res){
        toastr.error(res.body.message);
    });
  }
}
