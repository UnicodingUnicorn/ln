<template>
  <div>
    <nav v-show="token != undefined">
      <div class="nav-wrapper cyan chat">
        <a href="#" data-activates="slide-out" class="button-collapse brand-logo left"><i class="material-icons">menu</i> {{group}}: {{channel}}</a>
        <ul class="left hide-on-med-and-down">
          <li><a>{{group}} : {{channel}}</a></li>
        </ul>
      </div>
    </nav>
    <ul v-show="token != undefined" id="slide-out" class="side-nav fixed">
      <div v-for="gc in channels">
        <li><a class="subheader">{{gc.group}}</a></li>
        <li v-for="channel in gc.channels">
          <a class="waves-effect" v-on:click="changeGC(gc.group, channel)">{{channel}}</a>
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
            <span class="title">{{users[m2.user].username}}</span>
            <p v-for="m3 in m2.messages">
              <span v-if="m2.type == 'm'">{{m3}}</span>
              <span v-else-if="m2.type == 'f'">
                <a v-bind:href="file_url(m2.user, m3.filename)" v-bind:download="m2.originalname"><b>{{m3.originalname}}</b></a><br />
                <img v-if="is_image(m3.originalname)" v-bind:src="file_url(m2.user, m3.filename)" v-bind:alt="m3.originalname" v-on:load="image_load(event)" class="materialboxed" width="90%" ><br />
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
    <div class="valign-wrapper center-align" v-show="token == undefined">
        <p>Redirecting to login... If you are not redirected, please go <a v-bind:href="redirect_uri">here.</a></p>
    </div>
  </div>
</template>
<script>
  import Cookies from 'js-cookie'
  import crypto from 'crypto'
  import socketCluster from 'socketcluster-client'
  import toastr from 'toastr'

  import Chat from "./Chat.vue"
  import Channels from "./Channels.vue"

  import options from "../options"
  import messagesAPI from "../api/messages"

  import {mapGetters} from 'vuex'

  var nonce = crypto.randomBytes(32).toString('base64').slice(0, 32).replace(/\+/g, '0').replace(/\//g, '0');
  var socket = null;

  var socket_options = {
    hostname : options.SOCKETCLUSTER_HOST,
    port : options.SOCKETCLUSTER_PORT
  };

  export default {
    components : {
      Chat,
      Channels
    },
    data : function(){
      return {
        group : '',
        channel : '',
        current_messages : [],
        redirect_uri : options.OPENID_URL + '/authorise?scope=openid+profile+email&client_id=' + options.CLIENT_ID + '&response_type=id_token&nonce=' + nonce + '&redirect_uri=' + encodeURIComponent(options.SELF_URL + '/#/')
      }
    },
    computed : {
      ...mapGetters({
        token : 'user_token',
        channels : 'channels',
        messages : 'messages',
        users : 'users'
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
      },
      logout : function(event){
        this.channels.forEach(function(gc){
          gc.channels.forEach(function(channel){
            socket.unsubscribe(gc.group + '+' + channel);
          });
        });
        socket.emit('logout', {}, function(){
          this.$store.dispatch('logout');
          this.$router.go(this.$router.currentRoute);
        }.bind(this));
      },
      render_time : messagesAPI.render_time,
      send : function(event){
        if(this.message != ""){
          socket.publish(this.group + '+' + this.channel, {message : this.message, type : 'm'}, function(err){
            err ? toastr.error(err) : this.message = "";
          }.bind(this));
        }
      },
      uploadfile : function(event){
        var formData = new FormData();
        formData.append('file', $('#file_upload')[0].files[0]);
        messagesAPI.send_file(formData, this.token, function(res){
          socket.publish(this.group + '+' + this.channel, {message : {filename : res.body.filename, originalname : res.body.originalname}, type : 'f'}, function(err){
            err ? toastr.error(err) : this.message = "";
          }.bind(this));
        }.bind(this));
      },
      init_channels : function(){
        this.$store.dispatch('refresh_channels', this.token).then(function(){
          this.$store.dispatch('init_messages', {channels : this.channels, token : this.token}).then(function(){
            $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
            $('#chatView').scrollTop = $('#chatView').scrollHeight;
          });
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
          this.channels.forEach(function(gc){
            gc.channels.forEach(function(channel){
              socket.subscribe(gc.group + '+' + channel, {waitForAuth : true}).watch(function(data){
                this.$store.dispatch('add_message', {message : data, gc : this.group + '+' + this.channel}).then(function(){
                  $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
                  $('#chatView').scrollTop = $('#chatView').scrollHeight;
                });
              }.bind(this));
            }.bind(this));
          }.bind(this));
        }.bind(this));
      },
      chat_scroll : function(event){
        if($('#chatView').scrollTop() == 0){
          console.log(this.at_max());
          this.$store.dispatch('load_messages', {gc : {group : this.group, channel : this.channel}, token : this.token});
        }
      },
      file_url : function(user, filename){
        return options.FILES_URL + '/file/' + user + '/' + filename;
      },
      at_max : function(){
        return this.current_messages.length / options.HISTORY_COUNT;
      },
      is_image : function(filename){
        var fileformat = filename.split('.')[filename.split('.').length - 1];
        return fileformat.match(/(jpeg)|(jpg)|(png)|(gif)/);
      },
      image_load : function(event){
        $('#chatView')[0].scrollTop = $('#chatView')[0].scrollHeight;
        $('#chatView').scrollTop = $('#chatView').scrollHeight;
        $('.materialboxed').materialbox();
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
        socket.on('connect', function (status) {
          if(status.isAuthenticated){
            this.init_channels();
          }else{
            socket.emit('login', {token : this.token, channel : this.group + '+' + this.channel}, function(err){
              if(err){
                this.$router.push('/');
                if(this.token)
                  toastr.error(err);
              }else{
                this.init_channels();
              }
            }.bind(this));
          }
        }.bind(this));
      }
      setTimeout(function(){
        if(!this.token)
          window.location.href = this.redirect_uri;
      }.bind(this), 1000);
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
    /*position : fixed;*/
    bottom : 0;
    width : 100%;
    /*background-color: #FFFFFF;*/
  }
</style>
