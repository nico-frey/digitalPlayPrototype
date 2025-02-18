<script setup>
import { shallowRef, onMounted } from "vue";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier2d-compat";

const scene = new THREE.Scene();
const camera = shallowRef(null);
const renderer = shallowRef(null);
const cubeMesh = shallowRef(null);
const groundMesh = shallowRef(null);
const cubeBody = shallowRef(null);
const world = shallowRef(null);

onMounted(async () => {
    await RAPIER.init();

    // Set up Three.js
    camera.value = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.value.position.z = 5;

    renderer.value = new THREE.WebGLRenderer();
    renderer.value.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.value.domElement);

    // Create cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    cubeMesh.value = new THREE.Mesh(geometry, material);
    scene.add(cubeMesh.value);

    // Create ground
    const groundGeometry = new THREE.BoxGeometry(5, 0.2, 1);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    groundMesh.value = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.value.position.y = -1.5;
    scene.add(groundMesh.value);

    // Set up RAPIER physics world
    world.value = new RAPIER.World({ x: 0, y: -9.81 });

    // Create cube physics body
    const cubeColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5);
    const cubeBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2);
    cubeBody.value = world.value.createRigidBody(cubeBodyDesc);
    world.value.createCollider(cubeColliderDesc, cubeBody.value);

    // Create ground physics body
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(2.5, 0.1);
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1.5);
    const groundBody = world.value.createRigidBody(groundBodyDesc);
    world.value.createCollider(groundColliderDesc, groundBody);

    animate();
});

function animate() {
    requestAnimationFrame(animate);

    // Step the physics simulation
    world.value.step();

    if (cubeBody.value && cubeMesh.value) {
        const pos = cubeBody.value.translation();
        cubeMesh.value.position.set(pos.x, pos.y, 0);
    }

    if (renderer.value && camera.value) {
        renderer.value.render(scene, camera.value);
    }
}
</script>



<template>
    <div ref="container" style="width: 100vw; height: 100vh;"></div>
</template>
