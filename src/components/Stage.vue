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
            friction: 0.01,
            frictionAir: 0.01,
            restitution: 0.5,
            render: {
              fillStyle: path.getAttribute('fill') || '#FF0000',
              strokeStyle: path.getAttribute('fill') || '#FF0000',
              lineWidth: 1,
            },
          },
          {
            tolerance: 0.01,
          }
        );

        // Store the body, pathData, and render information
        shapes.push({
          body,
          pathData,
          render: {
            fillStyle: path.getAttribute('fill') || '#FF0000',
            strokeStyle: path.getAttribute('fill') || '#FF0000',
          },
        });

        yOffset += 50 * scaleFactor;
      } catch (error) {
        console.error('Error processing path:', path, error);
      }
    }
  }

  // Add the first 6 shapes to the world
  for (let i = 0; i < 6 && i < shapes.length; i++) {
    Matter.World.add(world, shapes[i].body);
    visibleShapes.push(shapes[i].body);
    currentShapeIndex++;
  }
}

function createNewShape(render, scaleFactor, originalShape) {
  // Ensure decomp is globally registered
  window.decomp = decomp;

  const pathData = originalShape.pathData;
  if (!pathData) {
    console.error('Missing path data for shape:', originalShape);
    return null;
  }

  try {
    // Parse the pathData into an SVG path element
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathData}"/></svg>`, 'image/svg+xml');
    const pathElement = svgDoc.querySelector('path');

    if (!pathElement) {
      console.error('Failed to parse path data into SVG path element:', pathData);
      return null;
    }

    // Convert the SVG path into vertices
    let vertices = Matter.Svg.pathToVertices(pathElement, 30);

    // Scale the vertices
    vertices = vertices.map(vertex => ({
      x: vertex.x * scaleFactor,
      y: vertex.y * scaleFactor,
    }));

    // Create a new shape from the vertices
    const newShape = Matter.Bodies.fromVertices(
      render.options.width / 2,
      -50 * scaleFactor,
      vertices,
      {
        friction: 0.01,
        frictionAir: 0.01,
        restitution: 0.5,
        render: {
          fillStyle: originalShape.render.fillStyle || '#FF0000',
          strokeStyle: originalShape.render.strokeStyle || '#FF0000', // Reapply strokeStyle
          lineWidth: originalShape.render.lineWidth || 2, // Reapply lineWidth
        },
      },
      {
        tolerance: 0.01,
      }
    );

    return newShape;
  } catch (error) {
    console.error('Error creating shape from path:', pathData, error);
    return null;
  }
}

function addNextShape(render, world, scaleFactor) {
  if (shapes.length === 0) {
    console.log('No shapes available to add.');
    return;
  }

  if (currentShapeIndex >= shapes.length) {
    currentShapeIndex = 0;
  }

  const nextShape = shapes[currentShapeIndex];

  const newShape = createNewShape(render, scaleFactor, nextShape);
  if (!newShape) {
    console.error('Failed to create new shape.');
    return;
  }

  Matter.World.add(world, newShape);
  visibleShapes.push(newShape);
  currentShapeIndex++;

  console.log(`Added new shape. Current shape index: ${currentShapeIndex}`);
}

function removeShapeAndAddNext(render, world, scaleFactor, shape) {
  Matter.World.remove(world, shape);
  visibleShapes = visibleShapes.filter(s => s !== shape);

  if (shapes.length === 0) {
    console.log('No more shapes available in the array.');
    return;
  }

  if (currentShapeIndex >= shapes.length) {
    currentShapeIndex = 0;
  }

  const originalShape = shapes[currentShapeIndex];
  currentShapeIndex++;

  const newShape = createNewShape(render, scaleFactor, originalShape);
  if (!newShape) {
    console.error('Failed to create new shape.');
    return;
  }

  Matter.World.add(world, newShape);
  visibleShapes.push(newShape);

  console.log('Added new shape. Visible shapes count:', visibleShapes.length);
}

let midiAccess = null;
let midiOutput = null;

// Initialize MIDI and set up the output device
async function initMIDI() {
  try {
    midiAccess = await navigator.requestMIDIAccess();
    console.log('MIDI access granted.');

    // Log available outputs
    for (const output of midiAccess.outputs.values()) {
      console.log('Available MIDI output:', output.name);
      if (output.name === 'customDevice Bus 1') {
        midiOutput = output;
        console.log('MIDI output device selected:', output.name);
      }
    }

    if (!midiOutput) {
      console.error('Custom MIDI device "customDevice" not found. Available devices:', Array.from(midiAccess.outputs.values()).map(o => o.name));
    }
  } catch (error) {
    console.error('Failed to initialize MIDI:', error);
  }
}


// Function to send a MIDI note
function sendMIDI(note, velocity = 127) {
  if (!midiOutput) {
    console.warn('MIDI output not initialized.');
    return;
  }

  const noteOnMessage = [0x90, note, velocity]; // Note On
  const noteOffMessage = [0x80, note, velocity]; // Note Off

  console.log('Sending MIDI Note On:', noteOnMessage);
  midiOutput.send(noteOnMessage);

  setTimeout(() => {
    console.log('Sending MIDI Note Off:', noteOffMessage);
    midiOutput.send(noteOffMessage);
  }, 200);
}

const recentCollisions = new Set();

function setupCollisionEvents(engine) {
  Matter.Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;

    pairs.forEach((pair) => {
      const pairKey = `${pair.bodyA.id}-${pair.bodyB.id}`; // Unique key for the collision pair

      if (recentCollisions.has(pairKey)) {
        return; // Skip if this pair is already on cooldown
      }

      console.log('Collision detected between:', pair.bodyA.label, pair.bodyB.label);

      // Send MIDI
      const randomNote = Math.floor(Math.random() * (72 - 100 + 1)) + 80; // Notes between C4 and C5
      sendMIDI(randomNote);

      // Add to cooldown set and remove after 200ms
      recentCollisions.add(pairKey);
      setTimeout(() => {
        recentCollisions.delete(pairKey);
      }, 999999);
    });
  });
}





onMounted(async () => {
  const { Engine, Render, Runner, World, Bodies, Mouse, MouseConstraint } = Matter;

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
  const scaleFactor = 1.5;
  await loadSVGs(svgFolderPath, render, world, scaleFactor);

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
      removeShapeAndAddNext(render, world, scaleFactor, clickedBody);
    }
  });

  World.add(world, mouseConstraint);

  await initMIDI();

  setupCollisionEvents(engine);

});
</script>

<style>
/* No styles needed for this simplified version */
</style>
