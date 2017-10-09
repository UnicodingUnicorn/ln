<template>
  <div>
    <!-- <h5>{{group}}: {{channel}}</h5> -->
    <div id="chatView">
      <ul class="collection">
        <li v-for="m in messages" class="collection-item avatar" style="text-align:left;">
          <span class="title">{{m.user}}</span>
          <p v-for="m2 in m.messages">{{m2}}</p>
          <span class="secondary-content">{{renderTime(m.datetime)}}</span>
        </li>
      </ul>
    </div>
    <form v-on:submit.prevent="send" class="entry">
      <input type="text" placeholder="Enter your message..." v-model="message">
    </form>
  </div>
</template>
<script>
  import {mapGetters} from 'vuex'
  import socketCluster from 'socketcluster-client'
  import toastr from 'toastr';

  import options from '../options'

  var messages_url = options.MESSAGES_URL;
  var socket = null;
  var chatView = null;

  var socket_options = {
    hostname : options.SOCKETCLUSTER_HOST,
    port : options.SOCKETCLUSTER_PORT
  };
  export default {
    computed : {
      ...mapGetters({
        token : 'user_token',
        messages : 'messages'
      })
    },
    data : function() {
      return {
        loggedIn : undefined,
        message : "",
        messages : []
      }
    },
    props : ['group', 'channel'],
    methods : {
      send : function(event){
        if(this.message != ""){
          socket.publish(this.group + '+' + this.channel, {message : this.message}, function(err){
            if(err){
              toastr.error(err);
              //this.$store.dispatch('new_err', err);
            }else{
              this.message = "";
            }
          }.bind(this));
        }
      },
      renderTime : function(datetime){
        var dt = new Date(datetime);
        if(Date.now() - dt.getTime() > 1000 * 60 * 60 * 24){
          return dt.getDay() + "/" + dt.getMonth() + "/" + dt.getFullYear();
        }else{
          return (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ":" + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes());
        }
      },
      addMessage : function(message){
        if(this.messages.length > 0){
          var lastMessage = this.messages[this.messages.length - 1];
          if(lastMessage.user != message.user){
            this.messages.push({
              user : message.user,
              datetime : message.datetime,
              messages : [message.message]
            });
          }else{
            var old_dt = new Date(lastMessage.datetime);
            var new_dt = new Date(message.datetime);
            if(this.renderTime(old_dt) == this.renderTime(new_dt)){
              lastMessage.messages.push(message.message);
            }else{
              this.messages.push({
                user : message.user,
                datetime : message.datetime,
                messages : [message.message]
              });
            }
          }
        }else{
          this.messages.push({
            user : message.user,
            datetime : message.datetime,
            messages : [message.message]
          });
        }
        chatView.scrollTop = chatView.scrollHeight;
      },
      subscribeNew : function(){
        this.messages = [];
        socket.unsubscribe(this.group + '+' + this.channel);
        socket.subscribe(this.group + '+' + this.channel, {waitForAuth : true}).watch(function(data){
          //this.addMessage(data);
          this.$store.dispatch('add_message', {message : data, gc : this.group + '+' + this.channel});
        }.bind(this));
      }
    },
    watch : {
      group : function(){
        this.subscribeNew();
        this.loadMessages();
      },
      channel : function(){
        this.subscribeNew();
        this.loadMessages();
      }
    },
    mounted : function(){
      chatView = this.$el.querySelector("#chatView");
      // socket = socketCluster.connect(socket_options);
      // socket.on('connect', function (status) {
      //   if(status.isAuthenticated){
      //     this.loggedIn = true;
      //     this.subscribeNew();
      //   }else{
      //     socket.emit('login', {token : this.token, channel : this.group + '+' + this.channel}, function(err){
      //       if(err){
      //         this.$router.push('/');
      //         if(this.token)
      //           toastr.error(err);
      //           //this.$store.dispatch('new_err', err);
      //       }else{
      //         this.loggedIn = true;
      //         this.subscribeNew();
      //       }
      //     }.bind(this));
      //   }
      // }.bind(this));
    },
    beforeDestroy : function(){
      socket.unsubscribe(this.group + '+' + this.channel);
    }
  }
</script>
<style>
  #chatView{
    overflow-y : auto;
    max-height: 75vh;
  }
  form.entry{
    position : fixed;
    bottom : 0;
    width : 100%;
    background-color: #FFFFFF;
  }
</style>
