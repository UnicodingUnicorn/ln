import options from '../options';

import Vue from 'vue';
import Resource from 'vue-resource';

import toastr from 'toastr'

Vue.use(Resource);

export default{
  getChannels(token, cb){
    Vue.http.get(options.MESSAGES_URL + '/channels', {
      headers : {'Authorization' : 'Bearer ' + token}
    }).then(
      res => {
        cb(res.body);
      }, res => {
        toastr.error(res.body.message);
      }
    );
  }
}
