<template>
  <div ref="scene"></div>
</template>

<script setup>
import 'pathseg'; // Import pathseg polyfill
import * as Matter from 'matter-js';
import { onMounted, ref } from 'vue';
import decomp from 'poly-decomp';

window.decomp = decomp; // Register poly-decomp globally

const scene = ref(null);
let shapes = [];
let currentShapeIndex = 0;
let visibleShapes = [];

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

        // Apply scaling factor to vertices
        vertices = vertices.map(vertex => ({
          x: vertex.x * scaleFactor,
          y: vertex.y * scaleFactor,
        }));

        const body = Matter.Bodies.fromVertices(
          render.options.width / 2,
          yOffset,
          vertices,
          {
            friction: 0.01, // Ensure friction is set correctly
            frictionAir: 0.01, // Ensure air friction is set correctly
            restitution: 0.5, // Ensure restitution is set correctly
            render: {
              fillStyle: path.getAttribute('fill') || '#FF0000',
              strokeStyle: path.getAttribute('fill') || '#FF0000',
              lineWidth: 1,
            },
          },
          {
            // Options for decomposition
            tolerance: 0.01, // Lower tolerance increases precision
            quality: 0.1, // Higher quality reduces gaps
          }
        );

        shapes.push(body);
        yOffset += 50 * scaleFactor; // Adjust the offset for stacking
      } catch (error) {
        console.error('Error processing path:', path, error);
      }
    }
  }

  // Add the first 6 shapes to the world
  for (let i = 0; i < 6 && i < shapes.length; i++) {
    Matter.World.add(world, shapes[i]);
    visibleShapes.push(shapes[i]);
    currentShapeIndex++;
  }
}

function createNewShape(render, scaleFactor) {

  window.decomp = decomp;
  // Example: Create a simple rectangle as the new shape
  const newShape = Matter.Bodies.rectangle(
    render.options.width / 2,
    -50 * scaleFactor,
    50 * scaleFactor,
    50 * scaleFactor,
    {
      friction: 0.01,
      frictionAir: 0.01,
      restitution: 0.5,
      render: {
        fillStyle: '#FF0000', // Randomize color if needed
      },
    }
  );

  console.log('Created new shape:', newShape);
  return newShape;
}


function addNextShape(render, world, scaleFactor) {
  if (shapes.length === 0) {
    console.log('No shapes available to add.');
    return;
  }

  if (currentShapeIndex >= shapes.length) {
    currentShapeIndex = 0; // Wrap around to the start of the array
  }

  const nextShape = shapes[currentShapeIndex];

  // Fully reset all properties of the shape
  Matter.Body.set(nextShape, {
    position: { x: render.options.width / 2, y: -50 * scaleFactor * (currentShapeIndex + 1) },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    force: { x: 0, y: 0 },
    torque: 0,
  });

  // Explicitly reset friction and restitution
  nextShape.friction = 0.01;
  nextShape.frictionAir = 0.01;
  nextShape.restitution = 0.5;

  // Add the shape to the world and visibleShapes array
  Matter.World.add(world, nextShape);
  visibleShapes.push(nextShape);
  currentShapeIndex++;

  console.log(`Added new shape. Current shape index: ${currentShapeIndex}`);
}

function removeShapeAndAddNext(render, world, scaleFactor, shape) {
  // 1. Remove the old shape from the world
  Matter.World.remove(world, shape);

  // 2. Remove the shape from the `visibleShapes` array
  visibleShapes = visibleShapes.filter(s => s !== shape);

  console.log('Shape removed completely:', shape);

  // 3. Check if there are any shapes left to add
  if (shapes.length === 0) {
    console.log('No more shapes available in the array.');
    return;
  }

  // 4. Select the next shape from the shapes array
  if (currentShapeIndex >= shapes.length) {
    currentShapeIndex = 0; // Wrap around to the first shape
  }
  const originalShape = shapes[currentShapeIndex];
  currentShapeIndex++;

  // 5. Create a new copy of the shape to ensure no residual state
  const newShape = Matter.Bodies.fromVertices(
    render.options.width / 2,
    -50 * scaleFactor,
    originalShape.vertices, // Use the vertices from the original shape
    {
      friction: 0.01,
      frictionAir: 0.01,
      restitution: 0.5,
      render: originalShape.render, // Copy rendering properties
    }
  );

  // 6. Add the new shape to the world and visibleShapes
  Matter.World.add(world, newShape);
  visibleShapes.push(newShape);

  console.log('Added new shape. Current shape index:', currentShapeIndex);
  console.log('Visible shapes count:', visibleShapes.length);
}




onMounted(async () => {
  const { Engine, Render, Runner, World, Bodies, Mouse, MouseConstraint } = Matter;

  const engine = Engine.create();
  const world = engine.world;
  world.gravity.y = 1; // Regular gravity from the bottom

  const render = Render.create({
    element: scene.value,
    engine: engine,
    options: {
      width: 500,
      height: window.innerHeight,
      wireframes: false,
      background: 'rgb(255,255,255)',
    },
  });

  Render.run(render);

  const runner = Runner.create();
  Runner.run(runner, engine);

  const boundaries = [
    Bodies.rectangle(render.options.width / 2, render.options.height + 50, render.options.width, 100, {
      isStatic: true,
      restitution: 0.5,
    }),
    Bodies.rectangle(-50, render.options.height / 2, 100, render.options.height, {
      isStatic: true,
      restitution: 0.5,
    }),
    Bodies.rectangle(render.options.width + 50, render.options.height / 2, 100, render.options.height, {
      isStatic: true,
      restitution: 0.5,
    }),
  ];

  World.add(world, boundaries);

  const svgFolderPath = '/svgs';
  const scaleFactor = 1.4; // Example scale factor
  await loadSVGs(svgFolderPath, render, world, scaleFactor);

  // Add mouse control
  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: {
        visible: false,
      },
    },
  });

  Matter.Events.on(mouseConstraint, 'mousedown', (event) => {
    const mousePosition = event.mouse.position;
    const clickedBodies = Matter.Query.point(visibleShapes, mousePosition);

    if (clickedBodies.length > 0) {
      const clickedBody = clickedBodies[0];
      console.log('Shape removed. Adding new shape...');
      removeShapeAndAddNext(render, world, scaleFactor, clickedBody);
    }
  });

  World.add(world, mouseConstraint);
});
</script>

<style>
/* No styles needed for this simplified version */
</style>
