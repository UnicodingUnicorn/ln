import options from '../options';

import Vue from 'vue';
import Resource from 'vue-resource';

Vue.use(Resource);

export default{
  getChannels(token, cb, err_cb){
    Vue.http.get(options.MESSAGES_URL + '/channels', {
      headers : {'Authorization' : 'Bearer ' + token}
    }).then(
      res => {
        cb(res.body);
      }, res => {
        console.log(res);
        console.log(res.body);
        cb([]);
      }
    );
  }
}
