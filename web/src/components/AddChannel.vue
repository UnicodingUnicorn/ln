<template>
  <form v-on:submit.prevent="addchannel">
    <div class="modal-content">
      <h4>Add channel to {{group}}</h4>
      <div class="row">
        <div class="col s12 input-field">
          <input placeholder="Channel name" id="channel_name" v-model="channel_name" type="text" class="validate">
          <label for="channel_name">Channel Name</label>
        </div>
      </div>
      <div class="row">
        <div class="col s12">
          <div id="addchannel-chips" class="chips chips-autocomplete"></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <input type="submit" class="modal-close waves-effect waves-green btn-flat" value="Add Channel">
      <a class="modal-close waves-effect waves-red btn-flat">Close</a>
    </div>
  </form>
</template>
<script>
  import channelsAPI from '../api/channels'
  import usersAPI from '../api/users'

  import {mapGetters} from 'vuex'

  import async from 'async'
  import toastr from 'toastr'

  $(document).ready(function(){
    usersAPI.get_usernames((usernames) => {
      var suggestions = {};
      async.each(usernames, (username, cb) => {
        suggestions[username] = null;
        cb();
      }, () => {
        $('#addchannel-chips').material_chip({
          placeholder: 'Add starting users',
          secondaryPlaceholder: 'Add starting users',
          autocompleteOptions : {
            data : suggestions,
            limit : Infinity,
            minLength : 1
          }
        });
      });
    });
  });

  export default {
    name : 'AddChannel',
    computed : {
      ...mapGetters({
        token : 'user_token',
        user_info : 'user_info'
      })
    },
    data(){
      return {
        channel_name : ''
      }
    },
    props : ['group'],
    methods : {
      addchannel : function(){
        var users = $('#addchannel-chips').material_chip('data');
        var userids = [];
        if(this.channel_name){
          channelsAPI.postChannel(this.token, {
            group : this.group,
            channel : this.channel_name
          }, () => {
            userids.push(this.user_info.sub);
            async.each(users, (user, cb) => {
              usersAPI.search_name(user.tag, (ids) => {
                userids.push(ids[0]);
                usersAPI.add_to_channel(ids[0], {group : this.group, channel : this.channel_name}, this.token, cb);
              });
            }, () => {
              this.$emit('addchannel', userids);
              toastr.error('Channel added!');
            });
          });
        }
      }
    }
  }
</script>
