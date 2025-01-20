<template>
  <div id="app">
    <Stage />
    <!-- <InitSerial /> -->
  </div>
</template>

<script>
import InitSerial from './components/InitSerial.vue';
import Stage from './components/Stage.vue';

export default {
  name: 'App',
  components: {
    Stage,
    InitSerial
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
