import options from '../options';
import auth from './auth';

import Vue from 'vue';
import Resource from 'vue-resource';

import toastr from 'toastr'

Vue.use(Resource);

export default{
  getChannels(token, cb){
    Vue.http.get(auth.withAuth(token, options.MESSAGES_URL + '/channels'), {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)}
    }).then(
      res => {
        cb(res.body);
      }, res => {
        toastr.error(res.body.message);
      }
    );
  },
  postChannel(token, gc, cb){
    Vue.http.post(auth.withAuth(token, options.ACCOUNTS_URL + '/channel'), {
      group : gc.group,
      channel : gc.channel
    }, {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)}
    }).then(
      res => {
        cb(res.body);
      }, res => {
        toastr.error(res.body.message);
      }
    );
  },
  getPMS(token, cb){
    Vue.http.get(auth.withAuth(token, options.MESSAGES_URL + '/pms'), {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)}
    }).then(
      res => {
        cb(res.body);
      }, res => {
        toastr.error(res.body.message);
      }
    );
  }
}
