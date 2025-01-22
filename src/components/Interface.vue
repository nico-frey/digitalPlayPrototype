<template>
  <div ref="scene" class="scene">
    <div class="color-div red" @click="sendMessage('color1')"></div>
    <div class="color-div green" @click="sendMessage('color2')"></div>
    <div class="color-div blue" @click="sendMessage('color3')"></div>
  </div>
</template>

<script setup>
const socket = new WebSocket('ws://10.21.28.111:8080');
// const socket = new WebSocket('ws://195.176.29.132:8080');

const sendMessage = (message) => {
  socket.send(message);
};

socket.onopen = () => {
  console.log('Connected to server');
  socket.send('Nico stinkt');
};

socket.onmessage = (event) => {
  console.log(`Message from server: ${event.data}`);
};
</script>

<style>
.scene {
  background-color: rgb(176, 176, 176);
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.color-div {
  width: 100%;
  display: inline-block;
  cursor: pointer;
}

.red {
  background-color: #0073F1;
  height: 200px;
}

.green {
  background-color: #FF976D;
  flex: 1;

}

.blue {
  background-color: #FFD782;
  flex: 1;

}
</style>
