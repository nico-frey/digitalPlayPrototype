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

const shapeProperties = {
  papagei: {
    restitution: 0.6,
    friction: 0.01,
    frictionAir: 0.0000001,
    density: 1,
    mass: 5,
    scaleFactor: 0.2,
    duplicateCount: 20,
  },
  wache: {
    restitution: 0,
    friction: 99999999,
    frictionAir: 0.2,
    density: 1,
    mass: 5,
    scaleFactor: 0.5,
    duplicateCount: 5,
  },
};

async function loadSVGs(folderPath, render, world, bodies, prefix) {
  const response = await fetch(`${folderPath}/index.json`);
  const files = await response.json();

  for (const fileName of files) {
    if (!fileName.startsWith(prefix)) continue; // Only load shapes with the specified prefix

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
        const shapeProps = shapeProperties[prefix] || {
          restitution: 0.5,
          friction: 0.1,
          frictionAir: 0.00001,
          density: 0.001,
          mass: 2,
          scaleFactor: 0.2,
          duplicateCount: 20,
        };
        const vertices = Matter.Svg.pathToVertices(path, 30).map((vertex) => ({
          x: vertex.x * shapeProps.scaleFactor,
          y: vertex.y * shapeProps.scaleFactor,
        }));

        for (let i = 0; i < shapeProps.duplicateCount; i++) {
          // Use duplicateCount property
          const body = Matter.Bodies.fromVertices(
            Matter.Common.random(0, render.options.width),
            Matter.Common.random(0, render.options.height),
            vertices,
            {
              mass: shapeProps.mass,
              density: shapeProps.density,
              friction: shapeProps.friction,
              frictionAir: shapeProps.frictionAir,
              restitution: shapeProps.restitution,
              render: {
                fillStyle: path.getAttribute('fill') || '#FF0000', // Default color, can be customized
                strokeStyle: path.getAttribute('fill') || '#FF0000', // Stroke in fill color to hide gaps
                lineWidth: 1, // stroke width 
              },
            },
            {
              // Options for decomposition
              tolerance: 0.01, // Lower tolerance increases precision
              quality: 0.1, // Higher quality reduces gaps
            }
          );

          // Add angular damping to slow down rotation over time
          body.angularDamping = 0.5; // Slow down rotation
          body.damping = 0.1; // Gradually slow linear movement

          Matter.Body.rotate(body, Matter.Common.random(0, Math.PI * 2));
          Matter.Body.setAngularVelocity(body, Matter.Common.random(-0.01, 0.01));

          Matter.World.add(world, body);
          bodies.push(body);
        }
      } catch (error) {
        console.error('Error processing path:', path, error);
      }
    }
  }
}

onMounted(async () => {
  const {
    Engine,
    Render,
    Runner,
    World,
    Bodies,
    Body,
    Mouse,
    Events,
    Common,
  } = Matter;

  const engine = Engine.create({
    positionIterations: 10, // Increase for more accurate collision positioning
    velocityIterations: 10, // Increase for better collision velocity adjustments
  });
  const world = engine.world;
  world.gravity.scale = 0;

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
    Bodies.rectangle(render.options.width / 2, -50, render.options.width, 100, {
      isStatic: true,
      restitution: 0.5, // Elasticity for boundaries
    }),
    Bodies.rectangle(
      render.options.width / 2,
      render.options.height + 50,
      render.options.width,
      100,
      {
        isStatic: true,
        restitution: 0.5,
      }
    ),
    Bodies.rectangle(-50, render.options.height / 2, 100, render.options.height, {
      isStatic: true,
      restitution: 0.5,
    }),
    Bodies.rectangle(
      render.options.width + 50,
      render.options.height / 2,
      100,
      render.options.height,
      {
        isStatic: true,
        restitution: 0.5,
      }
    ),
  ];

  World.add(world, boundaries);

  const attractiveBody = Bodies.circle(
    render.options.width / 2,
    render.options.height / 2,
    Math.max(render.options.width / 8, render.options.height / 8) / 10,
    {
      render: { fillStyle: 'rgba(240,240,240,0)', strokeStyle: 'rgb(240,240,240)', lineWidth: 0 },
      isStatic: true,
    }
  );

  World.add(world, attractiveBody);

  const bodies = [];
  const svgFolderPath = '/svgs'; // Path to your SVG folder (inside public folder)
  const prefixes = ['papagei', 'wache']; // List of prefixes
  let currentPrefixIndex = 0; // Initial index

  await loadSVGs(svgFolderPath, render, world, bodies, prefixes[currentPrefixIndex]);

  const mouse = Mouse.create(render.canvas);

  // Clamp body velocity to prevent glitching
  Events.on(engine, 'beforeUpdate', () => {
    const maxVelocity = 10; // Adjust as needed for reasonable speed
    bodies.forEach((body) => {
      if (Math.abs(body.velocity.x) > maxVelocity) {
        body.velocity.x = Math.sign(body.velocity.x) * maxVelocity;
      }
      if (Math.abs(body.velocity.y) > maxVelocity) {
        body.velocity.y = Math.sign(body.velocity.y) * maxVelocity;
      }
    });
  });

  // Reset positions for bodies that escape
  Events.on(engine, 'afterUpdate', () => {
    if (!mouse.position.x) return;

    // Smoothly move the attractor/repeller body towards the mouse
    Body.translate(attractiveBody, {
      x: (mouse.position.x - attractiveBody.position.x) * 0.12,
      y: (mouse.position.y - attractiveBody.position.y) * 0.12,
    });

    // Check mouse button state for repeller or attractor
    const isRepeller = mouse.button === 0 && mouse.sourceEvents.mousemove?.buttons === 1; // Left-click held

    bodies.forEach((body) => {
      const dx = attractiveBody.position.x - body.position.x;
      const dy = attractiveBody.position.y - body.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const forceMagnitude = ((isRepeller ? -0.0005 : 0.0005) * body.mass) / distance; // Negative for repeller

      Body.applyForce(body, body.position, {
        x: dx * forceMagnitude,
        y: dy * forceMagnitude,
      });
    });

    bodies.forEach((body) => {
      const dx = attractiveBody.position.x - body.position.x;
      const dy = attractiveBody.position.y - body.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const forceMagnitude = (0.00005 * body.mass) / distance;

      Body.applyForce(body, body.position, { x: dx * forceMagnitude, y: dy * forceMagnitude });
    });
  });

  window.addEventListener('keydown', async (event) => {
    if (event.code === 'Space') {
      // Remove only the dynamic bodies
      bodies.forEach((body) => Matter.World.remove(world, body));
      bodies.length = 0;

      // Cycle to the next prefix
      currentPrefixIndex = (currentPrefixIndex + 1) % prefixes.length;

      // Load new shapes
      await loadSVGs(svgFolderPath, render, world, bodies, prefixes[currentPrefixIndex]);
    }
  });
});
</script>

<style></style>
