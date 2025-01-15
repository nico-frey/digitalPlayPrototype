<template>
  <div id="app">
    <div ref="scene"></div>
  </div>
</template>

<script setup>
import * as Matter from 'matter-js';
import { svgPathProperties } from 'svg-path-properties';
import { onMounted, ref } from 'vue';
import decomp from 'poly-decomp';

window.decomp = decomp; // Register poly-decomp globally

const scene = ref(null);

async function loadSVGs(folderPath, render, world, bodies) {
  const response = await fetch(`${folderPath}/index.json`);
  const files = await response.json();

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
        const properties = new svgPathProperties(pathData);
        const length = properties.getTotalLength();
        const vertices = [];

        for (let i = 0; i < length; i += 30) {
          const point = properties.getPointAtLength(i);
          vertices.push({ x: point.x, y: point.y });
        }

        for (let i = 0; i < 40; i++) { // Duplicate each shape 10 times
          const body = Matter.Bodies.fromVertices(
            Matter.Common.random(0, render.options.width),
            Matter.Common.random(0, render.options.height),
            [vertices],
            {
              mass: 1,
              friction: 0.01, // Lower friction for more sliding and rotation
              frictionAir: 0.005, // Slight air resistance
              restitution: 0.8, // Increase bounciness
              render: {
                fillStyle: path.getAttribute('fill') || '#FF0000', // Default color, can be customized
                strokeStyle: 'none', // No stroke
                lineWidth: 0, // No stroke width
              },
            },
            true
          );

          // Add angular damping to slow down rotation over time
          body.angularDamping = 0.02; // Slow down rotation
          body.damping = 0.5; // Gradually slow linear movement

          Matter.Body.rotate(body, Matter.Common.random(0, Math.PI * 2));
          Matter.Body.setAngularVelocity(body, Matter.Common.random(-0.1, 0.1));

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
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: 'rgb(240,240,240)',
    },
  });

  Render.run(render);

  const runner = Runner.create();
  Runner.run(runner, engine);

  const boundaries = [
    Bodies.rectangle(render.options.width / 2, -25, render.options.width, 50, { isStatic: true, restitution: 1 }),
    Bodies.rectangle(render.options.width / 2, render.options.height + 25, render.options.width, 50, { isStatic: true, restitution: 1 }),
    Bodies.rectangle(-25, render.options.height / 2, 50, render.options.height, { isStatic: true, restitution: 1 }),
    Bodies.rectangle(render.options.width + 25, render.options.height / 2, 50, render.options.height, { isStatic: true, restitution: 1 }),
  ];

  World.add(world, boundaries);

  const attractiveBody = Bodies.circle(
    render.options.width / 2,
    render.options.height / 2,
    Math.max(render.options.width / 8, render.options.height / 8) / 10,
    {
      render: { fillStyle: 'rgb(240,240,240)', strokeStyle: 'rgb(240,240,240)', lineWidth: 0 },
      isStatic: true,
    }
  );

  World.add(world, attractiveBody);

  const bodies = [];
  const svgFolderPath = '/svgs'; // Path to your SVG folder (inside public folder)
  await loadSVGs(svgFolderPath, render, world, bodies);

  const mouse = Mouse.create(render.canvas);

  // Clamp body velocity to prevent glitching
  Events.on(engine, 'beforeUpdate', () => {
    bodies.forEach((body) => {
      const maxSpeed = 20; // Adjust as needed
      if (body.velocity.x > maxSpeed) body.velocity.x = maxSpeed;
      if (body.velocity.x < -maxSpeed) body.velocity.x = -maxSpeed;
      if (body.velocity.y > maxSpeed) body.velocity.y = maxSpeed;
      if (body.velocity.y < -maxSpeed) body.velocity.y = -maxSpeed;
    });
  });

  // Reset positions for bodies that escape
  Events.on(engine, 'afterUpdate', () => {
    bodies.forEach((body) => {
      if (
        body.position.x < -50 ||
        body.position.x > render.options.width + 50 ||
        body.position.y < -50 ||
        body.position.y > render.options.height + 50
      ) {
        Matter.Body.setPosition(body, {
          x: Matter.Common.random(50, render.options.width - 50),
          y: Matter.Common.random(50, render.options.height - 50),
        });
      }
    });

    if (!mouse.position.x) return;

    Body.translate(attractiveBody, {
      x: (mouse.position.x - attractiveBody.position.x) * 0.12,
      y: (mouse.position.y - attractiveBody.position.y) * 0.12,
    });

    bodies.forEach((body) => {
      const dx = attractiveBody.position.x - body.position.x;
      const dy = attractiveBody.position.y - body.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const forceMagnitude = (0.00005 * body.mass) / distance;

      Body.applyForce(body, body.position, { x: dx * forceMagnitude, y: dy * forceMagnitude });
    });
  });
});

</script>

<style>
#app {
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
