<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
import InitSerial from './components/InitSerial.vue';
import Sequence from './components/Sequence.vue';
import Stage from './components/Stage.vue';

export default {
  name: 'App',
  components: {
    Stage,
    InitSerial,
    Sequence
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin: 0;
  padding: 0;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  /* Ensures the canvas does not overflow */
}
</style>
