import Vue from 'vue';
import Resource from 'vue-resource';

import toastr from 'toastr';

import auth from './auth';
import options from '../options';

Vue.use(Resource);

export default{
  get_messages(gc, token, cb){
    Vue.http.get(auth.withAuth(token, options.MESSAGES_URL + '/messages/' + JSON.stringify(gc) + '/' + options.HISTORY_COUNT), {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)},
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  get_messages_offset(gc, offset, token, cb){
    Vue.http.get(auth.withAuth(token, options.MESSAGES_URL + '/messages/' + JSON.stringify(gc) + '/' + offset + '/' + options.HISTORY_COUNT), {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)},
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  get_pms(user, token, cb){
    Vue.http.get(auth.withAuth(token, options.MESSAGES_URL + '/pms/' + user + '/' + options.HISTORY_COUNT), {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)},
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  get_pms_offset(user, offset, token, cb){
    Vue.http.get(auth.withAuth(token, options.MESSAGES_URL + '/pms/' + user + '/' + offset + '/' + options.HISTORY_COUNT), {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)},
      responseType : 'json'
    }).then(
      function(res){
        cb(res.body);
      }, function(res){
        toastr.error(res.body.message);
    });
  },
  send_file(data, token, cb){
    Vue.http.post(auth.withAuth(token, options.FILES_URL + '/file'), data, {
      headers : {'Authorization' : 'Basic ' + btoa(options.CLIENT_ID + ':' + options.CLIENT_SECRET)}
    }).then(
      function(res){
        cb(res);
      }, function(res){
        toastr.error(res.body.message);
      }
    )
  },
  render_time(datetime){
    var dt = new Date(datetime);
    return (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ":" + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes());
  },
  render_date(datetime){
    var dt = new Date(datetime);
    return dt.getDay() + "/" + dt.getMonth() + "/" + dt.getFullYear();
  }
}
