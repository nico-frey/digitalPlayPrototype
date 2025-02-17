<template>
    <div ref="scene"></div>
</template>

<script setup>
import 'pathseg'; // Import pathseg polyfill
import * as Matter from 'matter-js';
import { onMounted, ref, onBeforeUnmount } from 'vue';
import decomp from 'poly-decomp';

window.decomp = decomp; // Ensure poly-decomp is globally available for Matter.js

const scene = ref(null);
let shapes = [];
let currentShapeIndex = 0;
let visibleShapes = [];
let selectedShapeIndex = 0;

async function loadSVGs(folderPath, render, world, scaleFactor) {
    const response = await fetch(`${folderPath}/index.json`);
    const files = await response.json();

    let yOffset = 0;
    for (const fileName of files) {
        const svgResponse = await fetch(`${folderPath}/${fileName}`);
        const svgText = await svgResponse.text();

        const parser = new DOMParser();
        const svgDocument = parser.parseFromString(svgText, 'image/svg+xml');
        const svgPaths = svgDocument.querySelectorAll('path');

        for (const path of svgPaths) {
            const pathData = path.getAttribute('d');
            if (!pathData) {
                console.warn('Skipping path with no `d` attribute:', path);
                continue;
            }

            try {
                let vertices = Matter.Svg.pathToVertices(path, 30);
                vertices = vertices.map(vertex => ({
                    x: vertex.x * scaleFactor,
                    y: vertex.y * scaleFactor,
                }));

                const body = Matter.Bodies.fromVertices(
                    render.options.width / 2,
                    yOffset,
                    vertices,
                    {
                        friction: 0.01,
                        frictionAir: 0.01,
                        restitution: 0.5,
                        render: {
                            fillStyle: path.getAttribute('fill') || '#FF0000',
                            strokeStyle: path.getAttribute('fill') || '#FF0000',
                            opacity: 1, // Default full opacity
                            lineWidth: 1,
                        },
                    },
                    { tolerance: 0.01 }
                );

                shapes.push({
                    body,
                    pathData,
                    render: {
                        fillStyle: path.getAttribute('fill') || '#FF0000',
                        strokeStyle: path.getAttribute('fill') || '#FF0000',
                        opacity: 1, // Store default opacity
                    },
                });

                yOffset += 50 * scaleFactor;
            } catch (error) {
                console.error('Error processing path:', path, error);
            }
        }
    }

    for (let i = 0; i < 6 && i < shapes.length; i++) {
        Matter.World.add(world, shapes[i].body);
        visibleShapes.push(shapes[i].body);
        currentShapeIndex++;
    }
    highlightSelectedShape();
}

function highlightSelectedShape() {
    visibleShapes.forEach((shape, index) => {
        if (!shape.originalFillStyle) {
            shape.originalFillStyle = shape.render.fillStyle;
        }

        shape.render.fillStyle = index === selectedShapeIndex
            ? `rgba(255, 255, 255, 0.5)` // 50% transparent
            : shape.originalFillStyle; // Restore original color
    });
}

function cycleSelection(direction) {
    if (visibleShapes.length === 0) return;
    if (direction === 'right') {
        selectedShapeIndex = (selectedShapeIndex + 1) % visibleShapes.length;
    } else if (direction === 'left') {
        selectedShapeIndex = (selectedShapeIndex - 1 + visibleShapes.length) % visibleShapes.length;
    }
    highlightSelectedShape();
}

function createNewShape(render, scaleFactor, originalShape) {
    window.decomp = decomp;

    const pathData = originalShape.pathData;
    if (!pathData) {
        console.error('Missing path data for shape:', originalShape);
        return null;
    }

    try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathData}"/></svg>`, 'image/svg+xml');
        const pathElement = svgDoc.querySelector('path');

        if (!pathElement) {
            console.error('Failed to parse path data into SVG path element:', pathData);
            return null;
        }

        let vertices = Matter.Svg.pathToVertices(pathElement, 30);
        vertices = vertices.map(vertex => ({
            x: vertex.x * scaleFactor,
            y: vertex.y * scaleFactor,
        }));

        return Matter.Bodies.fromVertices(
            render.options.width / 2,
            -50 * scaleFactor,
            vertices,
            {
                friction: 0.01,
                frictionAir: 0.01,
                restitution: 0.5,
                render: {
                    fillStyle: originalShape.render.fillStyle,
                    strokeStyle: originalShape.render.strokeStyle,
                    lineWidth: originalShape.render.lineWidth || 2,
                    opacity: 1,
                },
            },
            { tolerance: 0.01 }
        );
    } catch (error) {
        console.error('Error creating shape from path:', pathData, error);
        return null;
    }
}

function removeSelectedShape(render, world, scaleFactor) {
    if (visibleShapes.length <= 1) return;

    const shapeToRemove = visibleShapes[selectedShapeIndex];
    Matter.World.remove(world, shapeToRemove);
    visibleShapes.splice(selectedShapeIndex, 1);

    if (currentShapeIndex >= shapes.length) {
        currentShapeIndex = 0;
    }

    const newShape = createNewShape(render, scaleFactor, shapes[currentShapeIndex]);
    if (newShape) {
        Matter.World.add(world, newShape);
        visibleShapes.push(newShape);
        currentShapeIndex++;
    }

    if (selectedShapeIndex >= visibleShapes.length) {
        selectedShapeIndex = 0;
    }
    highlightSelectedShape();
}

function handleKeyDown(event, render, world, scaleFactor) {
    if (event.key === 'ArrowRight') {
        cycleSelection('right');
    } else if (event.key === 'ArrowLeft') {
        cycleSelection('left');
    } else if (event.key === 'Enter') {
        removeSelectedShape(render, world, scaleFactor);
    }
}

onMounted(async () => {
    const { Engine, Render, Runner, World, Bodies } = Matter;
    const engine = Engine.create();
    const world = engine.world;
    world.gravity.y = 1;
    const render = Render.create({
        element: scene.value,
        engine: engine,
        options: {
            width: 500,
            height: window.innerHeight,
            wireframes: false,
            background: 'rgb(255,255,255)',
            hasBounds: false,
        },
    });
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
    const svgFolderPath = '/svgs';
    const scaleFactor = 1.5;
    await loadSVGs(svgFolderPath, render, world, scaleFactor);

    // Add static boundaries to prevent shapes from falling off the screen
    const boundaries = [
        Bodies.rectangle(render.options.width / 2, render.options.height + 50, render.options.width, 100, { isStatic: true, restitution: 0.5 }),
        Bodies.rectangle(-50, render.options.height / 2, 100, render.options.height, { isStatic: true, restitution: 0.5 }),
        Bodies.rectangle(render.options.width + 50, render.options.height / 2, 100, render.options.height, { isStatic: true, restitution: 0.5 }),
    ];
    World.add(world, boundaries);
    window.addEventListener('keydown', (event) => handleKeyDown(event, render, world, scaleFactor));
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown);
});
</script>
