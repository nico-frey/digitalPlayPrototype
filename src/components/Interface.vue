<template>
  <div ref="scene">
    <h1>test lol</h1>
    
  </div>
</template>

<script setup>
const socket = new WebSocket('ws://10.21.28.111:8080');
// const socket = new WebSocket('ws://195.176.29.132:8080');

socket.onopen = () => {
  console.log('Connected to server');
  socket.send('Nico stinkt');
};

socket.onmessage = (event) => {
  console.log(`Message from server: ${event.data}`);
};
</script>
