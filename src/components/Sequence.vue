<template>
    <div ref="scene" style="width: 100%; height: 100%; position: relative;"></div>
</template>

<script setup>
import "pathseg"; // Import pathseg polyfill
import * as Matter from "matter-js";
import { onMounted, ref } from "vue";
import decomp from "poly-decomp";

window.decomp = decomp; // Register poly-decomp globally

const scene = ref(null);

onMounted(() => {
    const engine = Matter.Engine.create();
    const world = engine.world;
    const render = Matter.Render.create({
        element: scene.value,
        engine: engine,
        options: {
            width: 540, // 9:16 aspect ratio (vertical scene)
            height: 960,
            wireframes: false, // Render shapes with solid colors
            background: "#f0f0f0"
        }
    });

    Matter.Render.run(render);
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    // Add floor to stop shapes at the bottom
    const floor = Matter.Bodies.rectangle(270, 950, 540, 20, {
        isStatic: true,
        render: { fillStyle: "#cccccc" }
    });
    Matter.World.add(world, floor);

    // Load SVG shapes from the public/svgs folder
    const loadShapes = async () => {
        const shapes = [];
        for (let i = 1; i <= 8; i++) {
            try {
                const response = await fetch(`/svgs/shape${i}.svg`);
                const svgText = await response.text();
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
                const path = svgDoc.querySelector("path");

                if (!path) {
                    console.error(`No <path> found in shape${i}.svg`);
                    continue; // Skip this shape
                }

                const vertices = Matter.Svg.pathToVertices(path, 20);
                shapes.push(vertices);
            } catch (error) {
                console.error(`Failed to load shape${i}.svg`, error);
            }
        }

        if (shapes.length === 0) {
            console.error("No valid shapes were loaded. Please check your SVG files.");
        }

        return shapes;
    };


    const spawnShape = (shapes) => {
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        const body = Matter.Bodies.fromVertices(
            270, // Center x
            -50, // Start above the scene
            randomShape,
            {
                render: {
                    fillStyle: `hsl(${Math.random() * 360}, 50%, 70%)` // Random color
                }
            },
            true // Auto-repair concave shapes
        );
        Matter.World.add(world, body);
        return body;
    };

    loadShapes().then((shapes) => {
        const activeShapes = [];

        // Spawn initial 6 shapes
        for (let i = 0; i < 6; i++) {
            activeShapes.push(spawnShape(shapes));
        }

        // Handle shape clicks
        Matter.Events.on(render, "mousedown", (event) => {
            const mousePosition = event.source.mouse.absolute;
            const clickedBodies = Matter.Query.point(activeShapes, mousePosition);

            if (clickedBodies.length > 0) {
                const clickedBody = clickedBodies[0];
                Matter.World.remove(world, clickedBody);
                activeShapes.splice(activeShapes.indexOf(clickedBody), 1);

                // Add a new shape to maintain 6 shapes
                activeShapes.push(spawnShape(shapes));
            }
        });
    });

    return () => {
        Matter.Render.stop(render);
        Matter.Runner.stop(runner);
        Matter.World.clear(world);
        Matter.Engine.clear(engine);
        render.canvas.remove();
        render.textures = {};
    };
});
</script>

<style>
body,
html,
#app {
    margin: 0;
    padding: 0;
    overflow: hidden;
    width: 100%;
    height: 100%;
}
</style>