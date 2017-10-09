<template>
  <div v-for="gc in channels">
    <li>foo</li>
    <li><a class="subheader">{{gc.group}}</a></li>
    <li v-for="channel in gc.channels">
      <a class="waves-effect" v-on:click="changeGC(gc.group, channel)">{{channel}}</a>
    </li>
  </div>
</template>
<script>
  import {mapGetters} from 'vuex'

  export default {
    computed : {
      ...mapGetters({
        channels : 'channels'
      })
    },
    methods : {
      changeGC : function(group, channel){
        this.$emit('changeGC', group, channel);
      }
    },
    mounted : function(){
      console.log('foo');
    }
  }
</script>
