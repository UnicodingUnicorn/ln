<template>
  <div>
    <div class="modal-content">
      <div v-if="!is_self">
        <img v-if="user.avatar" class="circle avatar-image" v-bind:src="user.avatar">
        <img v-else class="circle avatar-image" v-bind:src="default_avatar">
      </div>
      <div v-else class="image-upload">
        <label for="avatar-upload">
          <img v-if="user.avatar" class="circle avatar-image" v-bind:src="user.avatar">
          <img v-else-if="avatar_preview" class="circle avatar-image" v-bind:src="avatar_preview">
          <img v-else class="circle avatar-image" v-bind:src="default_avatar">
        </label>
        <input id="avatar-upload" type="file" v-on:change="change_avatar"/>
      </div>
      <div class="row">
        <div class="col s3">
          <p><b>ID:</b></p>
        </div>
        <div class="col s9">
          <p>{{user.id}}</p>
        </div>
        <div class="col s3">
          <p><b>Name:</b></p>
        </div>
        <div class="col s9">
          <p>{{user.name}}</p>
        </div>
        <div class="col s3">
          <p><b>Username:</b></p>
        </div>
        <div class="col s9">
          <input v-if="is_self" type="text" placeholder="Username" v-model="username" >
          <p v-else>{{user.username}}</p>
        </div>
        <div class="col s3">
          <p><b>Email:</b></p>
        </div>
        <div class="col s9">
          <p>{{user.email}}</p>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <a v-if="is_self" class="modal-close waves-effect waves-green btn-flat" v-on:click="update_user"><i class="material-icons">done</i></a>
      <a v-if="!is_self" class="modal-close waves-effect btn-flat" v-on:click="openpm"><i class="material-icons">message</i></a>
      <a class="modal-close waves-effect btn-flat">Close</a>
    </div>
  </div>
</template>
<script>
  import { mapGetters } from 'vuex';
  import toastr from 'toastr';

  import messagesAPI from '../api/messages';
  import usersAPI from '../api/users';
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
        this.username = this.user.username;
      }
    },
    computed : {
      ...mapGetters({
        token : 'user_token',
        users : 'users',
        user_info : 'user_info'
      }),
      is_self : function(){
        return this.user.id == this.user_info.sub;
      }
    },
    data(){
      return {
        user : {},
        default_avatar : options.AVATAR_URL,
        avatar_preview : "",
        username : ""
      }
    },
    methods : {
      openpm : function(){
        this.$emit('openpm', this.user.id);
      },
      update_user : function(){
        var continueUpdate = (avatar) => {
          this.$store.dispatch("update_user", {
            token : this.token,
            username : this.username,
            avatar : avatar
          }).then(() => {
            this.$store.dispatch('refresh_user', this.user.id).then(() => {
              toastr.success("Profile updated!");
              this.$emit("updated_user");
            });
          });
        };
        if(this.avatar_preview){
          var formData = new FormData();
          formData.append('file', $('#avatar-upload')[0].files[0]);
          messagesAPI.send_file(formData, this.token, (res) => {
            continueUpdate(options.FILES_URL + '/' + this.user.id + '/' + res.body.filename);
          });
        }else{
          continueUpdate(undefined);
        }
      },
      change_avatar : function(){
        var file = $('#avatar-upload')[0].files[0];
        if(!file) return;
        var img = new Image();
        var reader = new FileReader();
        reader.onload = (event) => {
          this.avatar_preview = event.target.result;
        };
        reader.readAsDataURL(file);
      }
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
    overflow : hidden;
  }
  .image-upload > label {
    cursor : pointer;
  }
  .image-upload > input {
    display : none;
  }
</style>
