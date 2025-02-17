        <template>
            <div ref="sceneContainer"></div>
        </template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";

const sceneContainer = ref(null);
let scene, camera, renderer, world;
let RAPIER;

async function init() {
    await initPhysics();
    world = new RAPIER.World(new RAPIER.Vector2(0, -9.81)); // ✅ Proper gravity

    // ✅ 9:16 aspect ratio setup
    const aspectRatio = 9 / 16;
    const viewHeight = 10;
    const viewWidth = viewHeight * aspectRatio;

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(
        -viewWidth / 2,
        viewWidth / 2,
        viewHeight / 2,
        -viewHeight / 2,
        0.1,
        100
    );
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ alpha: true }); // ✅ Removes any unwanted background
    renderer.setSize(window.innerHeight * aspectRatio, window.innerHeight);
    sceneContainer.value.appendChild(renderer.domElement);

    createInvisibleBoundaries(viewWidth, viewHeight); // ✅ Walls exist, but aren’t visible
    createShapes(); // ✅ Objects fall naturally

    animate();
    window.addEventListener("resize", onWindowResize);
}

// ✅ Handle canvas resizing
function onWindowResize() {
    const aspectRatio = 9 / 16;
    const newWidth = window.innerHeight * aspectRatio;
    const newHeight = window.innerHeight;

    camera.left = -newWidth / 2;
    camera.right = newWidth / 2;
    camera.top = newHeight / 2;
    camera.bottom = -newHeight / 2;
    camera.updateProjectionMatrix();

    renderer.setSize(newWidth, newHeight);
}

// ✅ Load Rapier properly
async function initPhysics() {
    RAPIER = await import("@dimforge/rapier2d");
}

// ✅ Create "invisible" physics boundaries (left, right, bottom)
function createInvisibleBoundaries(viewWidth, viewHeight) {
    const thickness = 0.5; // Slightly thicker for stability

    // ✅ Bottom collider (floor)
    const bottomBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const bottomBody = world.createRigidBody(bottomBodyDesc);
    const bottomColliderDesc = RAPIER.ColliderDesc.cuboid(viewWidth / 2, thickness);
    world.createCollider(bottomColliderDesc, bottomBody);
    bottomBody.setTranslation(new RAPIER.Vector2(0, -viewHeight / 2)); // ✅ Fix collider placement

    // ✅ Left collider (wall)
    const leftBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const leftBody = world.createRigidBody(leftBodyDesc);
    const leftColliderDesc = RAPIER.ColliderDesc.cuboid(thickness, viewHeight / 2);
    world.createCollider(leftColliderDesc, leftBody);
    leftBody.setTranslation(new RAPIER.Vector2(-viewWidth / 2, 0)); // ✅ Fix collider placement

    // ✅ Right collider (wall)
    const rightBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const rightBody = world.createRigidBody(rightBodyDesc);
    const rightColliderDesc = RAPIER.ColliderDesc.cuboid(thickness, viewHeight / 2);
    world.createCollider(rightColliderDesc, rightBody);
    rightBody.setTranslation(new RAPIER.Vector2(viewWidth / 2, 0)); // ✅ Fix collider placement
}

// ✅ Create falling shapes with physics
function createShapes() {
    const positions = [
        { x: -2, y: 5 },
        { x: 0, y: 7 },
        { x: 2, y: 6 },
    ];

    positions.forEach((pos) => {
        const shapeBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y)
            .setLinearDamping(0.2) // ✅ Smooth movement
            .setAngularDamping(0.3); // ✅ Adds rotation realism

        const shapeBody = world.createRigidBody(shapeBodyDesc);
        const shapeColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5)
            .setRestitution(0.5); // ✅ Adds bounce

        world.createCollider(shapeColliderDesc, shapeBody);

        const shapeGeometry = new THREE.BoxGeometry(1, 1);
        const shapeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const shapeMesh = new THREE.Mesh(shapeGeometry, shapeMaterial);
        shapeMesh.userData.rapierBody = shapeBody;
        scene.add(shapeMesh);
    });
}

// ✅ Animation loop (sync physics to Three.js)
function animate() {
    requestAnimationFrame(animate);
    world.step();

    scene.children.forEach((obj) => {
        if (obj.userData.rapierBody) {
            const pos = obj.userData.rapierBody.translation();
            obj.position.set(pos.x, pos.y, 0);
        }
    });

    renderer.render(scene, camera);
}

// ✅ Cleanup when unmounting
onBeforeUnmount(() => {
    window.removeEventListener("resize", onWindowResize);
});

// ✅ Initialize everything on mount
onMounted(() => {
    init();
});
</script>

