<template>
  <form v-on:submit.prevent="adduser">
    <div class="modal-content">
      <h4>Add a user to {{group}}:{{channel}}</h4>
      <div class="row">
        <div class="col s12">
          <div id="adduser-chips" class="chips chips-autocomplete"></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <input type="submit" class="modal-close waves-effect waves-green btn-flat" value="Add User">
      <a class="modal-close waves-effect waves-red btn-flat">Close</a>
    </div>
  </form>
</template>
<script>
  import usersAPI from '../api/users'

  import {mapGetters} from 'vuex'

  import async from 'async'
  import toastr from 'toastr'

  $(document).ready(function(){
    usersAPI.get_usernames(function(usernames){
      var suggestions = {};
      async.each(usernames, function(username, cb){
        suggestions[username] = null;
        cb();
      }, function(){
        $('#adduser-chips').material_chip({
          placeholder: 'Add a user',
          secondaryPlaceholder: 'Add a user',
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
    name : 'AddUser',
    computed : {
      ...mapGetters({
        token : 'user_token'
      })
    },
    props : ['group', 'channel'],
    methods : {
      adduser : function(){
        var users = $('#adduser-chips').material_chip('data');
        var userids = [];
        console.log(users);
        async.each(users, (user, cb) => {
          usersAPI.search_name(user.tag, (ids) => {
            userids.push(ids[0]);
            console.log('Adding ' + ids[0]);
            usersAPI.add_to_channel(ids[0], {group : this.group, channel : this.channel}, this.token, () => {
              console.log('Added ' + ids[0]);
              cb();
            });
          });
        }, () => {
          this.$emit('adduser', userids);
          toastr.error('Users added!');
        });
      }
    }
  }
</script>
