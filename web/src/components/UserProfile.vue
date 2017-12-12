<template>
  <div>
    <div class="modal-content">
      <img v-if="user.avatar" class="circle avatar-image" v-bind:src="user.avatar">
      <img v-else class="circle avatar-image" v-bind:src="default_avatar">
      <table>
        <tbody>
          <tr>
            <th>ID</th>
            <th>{{user.id}}</th>
          </tr>
          <tr>
            <th>Name</th>
            <th>{{user.name}}</th>
          </tr>
          <tr>
            <th>Username</th>
            <th>{{user.username}}</th>
          </tr>
          <tr>
            <th>Email</th>
            <th>{{user.email}}</th>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="modal-footer">
      <a v-if="user.id != user_info.sub" class="modal-close waves-effect btn-flat" v-on:click="openpm"><i class="material-icons">message</i></a>
      <a class="modal-close waves-effect btn-flat">Close</a>
    </div>
  </div>
</template>
<script>
  import { mapGetters } from 'vuex';

  import options from '../options';
  export default{
    name : 'UserProfile',
    props : {
      userid : {
        type : String,
        required : true
      }
    },
    watch : {
      userid : function(id){
        this.user = this.users[id];
        this.user.id = id;
      }
    },
    computed : {
      ...mapGetters({
        users : 'users',
        user_info : 'user_info'
      })
    },
    data(){
      return {
        user : {},
        default_avatar : options.AVATAR_URL
      }
    },
    methods : {
      openpm : function(){
        this.$emit('openpm', this.user.id);
      }
    },
    mounted : function(){
      this.user = this.user_info;
      this.user.id = this.user_info.sub;
    }
  }
</script>
<style>
  .avatar-image{
    display : block;
    margin : auto;
    width : 50%;
    max-height : 125px;
    max-width : 125px;
  }
</style>
