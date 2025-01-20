<template>
    <div></div>
    <button @click="initSerial" class="serial-button">
        Init Serial
    </button>
</template>

<script setup>
import { ref } from 'vue';

const initSerial = async () => {
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        console.log('Serial connection initialized');
    } catch (error) {
        console.error('Failed to initialize serial connection:', error);
    }
};
</script>

<style scoped>
.serial-button {
    width: 32px;
    height: 32px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.serial-button:hover {
    background-color: #0056b3;
}
</style>