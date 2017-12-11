<template>
  <div>
    <nav v-show="token != undefined">
      <div class="nav-wrapper cyan chat">
        <a href="#" data-activates="slide-out" class="button-collapse brand-logo left">
          <i class="material-icons">menu</i>
          <span v-show="group != 'pm'">{{group}}: {{channel}}</span>
          <span v-show="group == 'pm'">{{channel}}</span>
        </a>
        <ul class="left hide-on-med-and-down">
          <li v-show="group != 'pm'"><a>{{group}}: {{channel}}</a></li>
          <li v-show="group == 'pm'"><a>{{channel}}</a></li>
        </ul>
      </div>
    </nav>
    <ul v-show="token != undefined" id="slide-out" class="side-nav fixed">
      <li>
        <div class="user-view">
          <div class="background cyan"></div>
          <a>
            <img v-if="user_info.avatar" class="circle" v-bind:src="user_info.avatar">
            <img v-else="user_info.avatar" class="circle" v-bind:src="default_avatar">
          </a>
          <a><span class="white-text name">{{user_info.username}}</span></a>
          <a><span class="white-text email">{{user_info.name}}</span></a>
        </div>
      </li>
      <div v-for="gc in channels" v-if="gc.group != 'pm'">
        <li><a><a class="subheader">{{gc.group}}</a><i class="material-icons" style="cursor:pointer;" v-on:click="showaddchannel(gc.group)">add</i></a></li>
        <li v-for="channel in gc.channels">
          <a><a class="waves-effect" v-on:click="changeGC(gc.group, channel)">{{channel}}</a><i class="material-icons" style="cursor:pointer;" v-on:click="showadduser(gc.group, channel)">add</i></a>
        </li>
      </div>
      <div v-if="pms.length > 0">
        <li><a class="subheader">Direct Messages</a></li>
        <li v-for="channel in pms">
          <a class="waves-effect" v-on:click="changeGC('pm', channel)">{{channel}}</a>
        </li>
      </div>
      <li><div class="divider"></div></li>
      <li><a class="waves-effect" v-on:click="logout"><i class="material-icons">exit_to_app</i>Logout</a></li>
    </ul>
    <div v-show="token != undefined" class="chat">
      <div id="chatView" v-on:scroll="chat_scroll">
        <!-- <h6 v-show="at_max" class="center-align">You are at the top.</h6> -->
        <div class="row" v-if="!messages[group + '+' + channel]">
          <div class="col s4 offset-s4">
            <div class="card-panel white">
              <span class="cyan-text">There are no messages.</span>
            </div>
          </div>
        </div>
        <ul class="collection with-header" v-for="m in messages[group + '+' + channel]">
          <li class="collection-header"><h6 class="cyan-text">{{m.date}}</h6></li>
          <li v-for="m2 in m.messages" class="collection-item avatar" style="text-align:left;">
            <img v-if="user_info.avatar" class="circle" v-bind:src="user_info.avatar">
            <img v-else="user_info.avatar" class="circle" v-bind:src="default_avatar">
            <a v-if="user_info.sub != m2.user" v-on:click="open_pm" href='#'><span v-bind:id="m2.user" class="title">{{users[m2.user].username}}</span></a>
            <span v-else class="title"><b>{{users[m2.user].username}}</b></span>
            <p v-for="m3 in m2.messages">
              <span v-if="m2.type == 'm'">{{m3}}</span>
              <span v-else-if="m2.type == 'f'">
                <a v-bind:href="file_url(m2.user, m3.filename)" v-bind:download="m2.originalname"><b>{{m3.originalname}}</b></a><br />
                <img v-if="is_image(m3.originalname)" v-bind:src="file_url(m2.user, m3.filename)" v-bind:alt="m3.originalname" v-on:load="image_load()" class="materialboxed" width="90%" ><br />
              </span>
            </p>
            <span class="secondary-content">{{render_time(m2.datetime)}}</span>
          </li>
        </ul>
      </div>
      <div class="fixed-action-btn"><a class="btn-floating waves-effect waves-light right red modal-trigger" href="#attachment-modal"><i class="material-icons">attach_file</i></a></div>
      <form v-on:submit.prevent="send" class="entry">
        <div class="input-field">
          <input type="text" placeholder="Enter your message..." v-model="message">
        </div>
      </form>
      <div id="attachment-modal" class="modal">
        <form v-on:submit.prevent="uploadfile">
          <div class="modal-content">
            <h4>Upload file</h4>
            <div class="file-field input-field">
              <div class="btn cyan">
                <span>Choose...</span>
                <input id="file_upload" type="file">
              </div>
              <div class="file-path-wrapper">
                <input class="file-path validate" type="text">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <input type="submit" class="modal-close waves-effect waves-green btn-flat" value="Upload">
            <a class="modal-close waves-effect waves-red btn-flat">Close</a>
          </div>
        </form>
      </div>
    </div>
    <AddUser id="adduser-modal" class="modal" v-bind:group="add_group" v-bind:channel="add_channel" v-on:adduser="added_user"/>
    <AddChannel id="addchannel-modal" class="modal" v-bind:group="add_group" v-on:addchannel="added_channel" />
    <div class="valign-wrapper center-align" v-show="token == undefined">
        <p>Redirecting to login... If you are not redirected, please go <a v-bind:href="redirect_uri">here.</a></p>
    </div>
  </div>
</template>
<script>
  import async from 'async'
  import Cookies from 'js-cookie'
  import crypto from 'crypto'
  import socketCluster from 'socketcluster-client'
  import toastr from 'toastr'

  import options from "../options"
  import messagesAPI from "../api/messages"

  import {mapGetters} from 'vuex'

  import AddUser from './AddUser.vue'
  import AddChannel from './AddChannel.vue'

  var nonce = crypto.randomBytes(32).toString('base64').slice(0, 32).replace(/\+/g, '0').replace(/\//g, '0');
  var socket = null;

  var socket_options = {
    hostname : options.SOCKETCLUSTER_HOST,
    port : options.SOCKETCLUSTER_PORT
  };

  export default {
    components : { AddUser, AddChannel },
    data : function(){
      return {
        group : '',
        channel : '',
        message : '',
        add_group : '',
        add_channel : '',
        current_messages : [],
        redirect_uri : options.OPENID_URL + '/authorise?scope=openid+profile+email&client_id=' + options.CLIENT_ID + '&response_type=id_token&nonce=' + nonce + '&redirect_uri=' + encodeURIComponent(options.SELF_URL + '/#/'),
        default_avatar : options.FILES_URL + '/file/default/avatar.png'
      }
    },
    computed : {
      ...mapGetters({
        token : 'user_token',
        channels : 'channels',
        messages : 'messages',
        pms : 'pms',
        users : 'users',
        user_info : 'user_info'
      })
    },
    watch : {
      messages : function(newval){
        this.current_messages = this.messages[this.group + '+' + this.channel];
      }
    },
    methods : {
      changeGC : function(group, channel){
        this.group = group;
        this.channel = channel;
        Cookies.set('gc', {group : this.group, channel : this.channel});
        setTimeout(() => {
          $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
          $('#chatView').scrollTop = $('#chatView').scrollHeight;
        }, 10);
      },
      logout : function(event){
        this.channels.forEach((gc) => {
          gc.channels.forEach((channel) => {
            socket.unsubscribe('chat:' + gc.group + '+' + channel);
          });
        });
        socket.unsubscribe('pm:' + this.user_info.sub);
        socket.emit('logout', {}, () => {
          this.$store.dispatch('logout');
          this.$router.go(this.$router.currentRoute);
        });
      },
      render_time : messagesAPI.render_time,
      send : function(event){
        if(this.message != ""){ //Make sure one is not working with a blank message
          if(this.group == 'pm'){ //Sort out PMs
            this.$store.dispatch('add_message', { //Add to local store
              message : {
                message : this.message,
                type : 'm',
                datetime : new Date(),
                user : this.user_info.sub
              },
              gc : this.group + '+' + this.channel
            }).then(() => {
              $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
              $('#chatView').scrollTop = $('#chatView').scrollHeight;
            });
            socket.emit('pm', { //Update other guy
              sender : this.user_info.sub,
              recipient : this.channel,
              message : this.message,
              type : 'm'
            }, (err) => {
              err ? toastr.error(err) : this.message = "";
            });
          }else{
            //Publish message to channel
            socket.publish('chat:' + this.group + '+' + this.channel, {message : this.message, type : 'm'}, (err) => {
              err ? toastr.error(err) : this.message = "";
            });
          }
        }
      },
      uploadfile : function(event){
        var formData = new FormData();
        formData.append('file', $('#file_upload')[0].files[0]);
        messagesAPI.send_file(formData, this.token, (res) => {
          if(this.group == 'pm'){
            this.$store.dispatch('add_message', {
              message : {
                message : {filename : res.body.filename, originalname : res.body.originalname},
                type : 'f',
                datetime : new Date(),
                user : this.user_info.sub
              },
              gc : this.group + '+' + this.channel
            }).then(() => {
              $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
              $('#chatView').scrollTop = $('#chatView').scrollHeight;
            });
            socket.emit('pm', {
              sender : this.user_info.sub,
              recipient : this.channel,
              message : {filename : res.body.filename, originalname : res.body.originalname},
              type : 'f'
            }, (err) => {
              err ? toastr.error(err) : this.message = "";
            });
          }else{
            socket.publish('chat:' + this.group + '+' + this.channel, {message : {filename : res.body.filename, originalname : res.body.originalname}, type : 'f'}, (err) => {
              err ? toastr.error(err) : this.message = "";
            });
          }
        });
      },
      init_channels : function(){
        this.$store.dispatch('clear_messages').then(() => { //Clear any existing messages
          this.$store.dispatch('refresh_channels', this.token).then(() => { //Populate channel messages
            this.$store.dispatch('init_messages', {channels : this.channels, token : this.token}).then(() => {
              $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
              $('#chatView').scrollTop = $('#chatView').scrollHeight;
            });
            //Set the current group from cookie
            var gc = Cookies.get('gc');
            if(gc){
              var gc = JSON.parse(gc);
              this.group = gc.group;
              this.channel = gc.channel;
            }else{
              this.group = this.channels[0].group;
              this.channel = this.channels[0].channels[0];
              Cookies.set('gc', {group : this.group, channel : this.channel});
            }
            //Subscribe to message channels
            this.channels.forEach((gc) => {
              gc.channels.forEach((channel) => {
                socket.subscribe('chat:' + gc.group + '+' + channel, {waitForAuth : true}).watch((data) => {
                  this.$store.dispatch('add_message', {message : data, gc : data.channel.group + '+' + data.channel.channel}).then(() => {
                    $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
                    $('#chatView').scrollTop = $('#chatView').scrollHeight;
                  });
                });
              });
            });
          });
          this.$store.dispatch('refresh_pms', this.token).then(() => {
            this.$store.dispatch('init_pms', {channels : this.pms, token : this.token}).then(() => {
              $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
              $('#chatView').scrollTop = $('#chatView').scrollHeight;
            });
          });
          //Subscribe to PM channel
          socket.subscribe('pm:' + this.user_info.sub, {waitForAuth : true}).watch((data) => {
            if(!this.pms.includes(data.user))
              this.$store.dispatch('add_pm_channel', data.user);
            this.$store.dispatch('add_message', {message : data, gc : 'pm' + '+' + data.user}).then(() => {
              $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
              $('#chatView').scrollTop = $('#chatView').scrollHeight;
            });
          });
          //Subscribe to updates channel
          socket.subscribe('update:' + this.user_info.sub, {waitForAuth : true}).watch((data) => {
            if(data.action == 'refresh_channels'){ //Refresh channels
              console.log('Updating');
              this.channels.forEach((gc) => {
                gc.channels.forEach((channel) => {
                  socket.unsubscribe('chat:' + gc.group + '+' + channel);
                  socket.unwatch('chat:' + gc.group + '+' + channel);
                });
              });
              this.$store.dispatch('refresh_channels', this.token).then(() => {
                async.each(Object.keys(this.users), (userid, cb) => {
                  async.each(this.channels, (gc, cb1) => {
                    async.each(gc.channels, (channel, cb2) => {
                      socket.publish('update:' + userid, {action : "refresh_users", scope : {group : gc.group, channel : channel}}, cb2);
                    }, cb1);
                  }, cb);
                }, () => {});
                this.$store.dispatch('init_messages', {channels : this.channels, token : this.token}).then(() => {
                  $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
                  $('#chatView').scrollTop = $('#chatView').scrollHeight;
                });
                this.channels.forEach((gc) => {
                  gc.channels.forEach((channel) => {
                    socket.subscribe('chat:' + gc.group + '+' + channel, {waitForAuth : true}).watch((data) => {
                      this.$store.dispatch('add_message', {message : data, gc : data.channel.group + '+' + data.channel.channel}).then(() => {
                        $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
                        $('#chatView').scrollTop = $('#chatView').scrollHeight;
                      });
                    });
                  });
                });
              });
            }else if(data.action == 'refresh_users'){ //Refresh users
              console.log('Refreshing users');
              this.$store.dispatch('refresh_channel_users', {gc : data.scope, token : this.token});
            }
          });
        });
      },
      chat_scroll : function(){
        if($('#chatView').scrollTop() == 0){
          console.log(this.at_max());
          if(this.group == 'pm'){
            this.$store.dispatch('load_pms', {user : this.channel, token : this.token});
          }else{
            this.$store.dispatch('load_messages', {gc : {group : this.group, channel : this.channel}, token : this.token});
          }
        }
      },
      file_url : function(user, filename){
        return options.FILES_URL + '/file/' + user + '/' + filename;
      },
      at_max : function(){
        if(this.current_messages)
          return this.current_messages.length / options.HISTORY_COUNT;
        return false;
      },
      is_image : function(filename){
        var fileformat = filename.split('.')[filename.split('.').length - 1];
        return fileformat.match(/(jpeg)|(jpg)|(png)|(gif)/);
      },
      image_load : function(){
        $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
        $('#chatView').scrollTop = $('#chatView').scrollHeight;
        $('.materialboxed').materialbox();
      },
      open_pm : function(event){
        this.changeGC('pm', event.target.id);
        this.$store.dispatch('add_pm_channel', event.target.id);
      },
      showadduser : function(addgroup, addchannel){
        this.add_group = addgroup;
        this.add_channel = addchannel;
        $('#adduser-modal').modal('open');
      },
      added_user : function(added_users){
        async.each(added_users, (userid, cb) => {
          socket.publish('update:' + userid, {action : "refresh_channels"}, (err) => {
            if(err) console.log(err);
            cb();
          });
        }, () => {});
      },
      showaddchannel : function(addgroup){
        this.add_group = addgroup;
        $('#addchannel-modal').modal('open');
      },
      added_channel : function(added_users){
        async.each(added_users, (userid, cb) => {
          socket.publish('update:' + userid, {action : "refresh_channels"}, (err) => {
            if(err) console.log(err);
            cb();
          });
        }, () => {});
      }
    },
    mounted : function(){
      $(".button-collapse").sideNav({
        closeOnClick : true
      });
      $('.modal').modal();

      if(this.$route.query.id_token != undefined){
        if(this.token){
          this.$router.push('/');
        }else{
          if(Cookies.get('nonce') == this.$route.query.nonce){
            Cookies.remove('nonce');
            this.$store.dispatch('login', this.$route.query);
            this.$store.dispatch('get_userinfo', this.$route.query)
            this.$router.push('/');
          }else{
            toastr.error("Improper nonce, you may be under attack.");
            Cookies.remove('nonce');
            Cookies.set('nonce', nonce);
            this.$router.push('/');
          }
        }
      }else if(!Cookies.get('nonce')){
        Cookies.set('nonce', nonce);
      }
      if(this.token){
        socket = socketCluster.connect(socket_options);
        socket.on('connect', (status) => {
          if(status.isAuthenticated){
            this.init_channels();
          }else{
            socket.emit('login', {token : this.token, channel : this.group + '+' + this.channel}, (err) => {
              if(err){
                this.$router.push('/');
                if(this.token)
                  toastr.error(err);
              }else{
                this.init_channels();
              }
            });
          }
        });
      }
      setTimeout(() => {
        if(!this.token)
          window.location.href = this.redirect_uri;
      }, 1000);
    }
  }
</script>
<style>
  .chat {
    padding-left: 300px;
  }
  @media only screen and (max-width : 992px){
    .chat {
      padding-left: 0px;
    }
  }
  #chatView{
    overflow-y : auto;
    max-height: 75vh;
  }
  .entry{
    position : fixed;
    bottom : 0;
    width : 100%;
  }
</style>
