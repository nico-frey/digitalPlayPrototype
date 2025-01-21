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
let splittingMode = ref(true); // Toggle for splitting mode
let currentAntiGravityZone = null; // Track the current anti-gravity zone

const shapeProperties = {
  papagei: {
    restitution: 0.6,
    friction: 0.01,
    frictionAir: 0.0000001,
    density: 1,
    mass: 5,
    scaleFactor: 1.4,
    duplicateCount: 1,
  },
  wache: {
    restitution: 0,
    friction: 99999999,
    frictionAir: 0.01,
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
    if (!fileName.startsWith(prefix)) continue;

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
    positionIterations: 10,
    velocityIterations: 10,
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
      restitution: 0.5,
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
  const svgFolderPath = '/svgs';
  const prefixes = ['papagei', 'wache'];
  let currentPrefixIndex = 0;

  await loadSVGs(svgFolderPath, render, world, bodies, prefixes[currentPrefixIndex]);

  // Clamp body velocity to prevent glitching
  Events.on(engine, 'beforeUpdate', () => {
    const maxVelocity = 10;
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
    // Remove bodies that go out of bounds
    bodies.forEach((body) => {
      if (
        body.position.x < -100 ||
        body.position.x > render.options.width + 100 ||
        body.position.y < -100 ||
        body.position.y > render.options.height + 100
      ) {
        Matter.World.remove(world, body);
        bodies.splice(bodies.indexOf(body), 1);
      }
    });

    // Merge shapes of the same kind if they are in close proximity
    const mergeDistance = 100; // Distance threshold for merging
    const shapesToMerge = {};

    bodies.forEach((body) => {
      const shapeType = body.render.fillStyle; // Assuming fillStyle is used to identify shape type
      if (!shapesToMerge[shapeType]) {
        shapesToMerge[shapeType] = [];
      }
      shapesToMerge[shapeType].push(body);
    });

    Object.values(shapesToMerge).forEach((shapeBodies) => {
      for (let i = 0; i < shapeBodies.length; i++) {
        for (let j = i + 1; j < shapeBodies.length; j++) {
          for (let k = j + 1; k < shapeBodies.length; k++) {
            const bodyA = shapeBodies[i];
            const bodyB = shapeBodies[j];
            const bodyC = shapeBodies[k];

            const distanceAB = Matter.Vector.magnitude(Matter.Vector.sub(bodyA.position, bodyB.position));
            const distanceAC = Matter.Vector.magnitude(Matter.Vector.sub(bodyA.position, bodyC.position));
            const distanceBC = Matter.Vector.magnitude(Matter.Vector.sub(bodyB.position, bodyC.position));

            if (distanceAB < mergeDistance && distanceAC < mergeDistance && distanceBC < mergeDistance) {
              console.log('Merging bodies:', bodyA, bodyB, bodyC);

              // Merge bodies
              const mergedVertices = Matter.Vertices.hull([...bodyA.vertices, ...bodyB.vertices, ...bodyC.vertices]);
              const mergedBody = Matter.Bodies.fromVertices(bodyA.position.x, bodyA.position.y, mergedVertices, {
                mass: bodyA.mass + bodyB.mass + bodyC.mass,
                density: bodyA.density,
                friction: bodyA.friction,
                frictionAir: bodyA.frictionAir,
                restitution: bodyA.restitution,
                render: bodyA.render,
              });

              Matter.World.add(world, mergedBody);
              bodies.push(mergedBody);

              // Remove original bodies
              Matter.World.remove(world, bodyA);
              Matter.World.remove(world, bodyB);
              Matter.World.remove(world, bodyC);
              bodies.splice(bodies.indexOf(bodyA), 1);
              bodies.splice(bodies.indexOf(bodyB), 1);
              bodies.splice(bodies.indexOf(bodyC), 1);

              // Remove any existing anti-gravity zone
              if (currentAntiGravityZone) {
                Matter.World.remove(world, currentAntiGravityZone);
                Events.off(engine, 'beforeUpdate', applyAntiGravity);
              }

              // Create an anti-gravity area at the collision point
              const antiGravityZone = Bodies.circle(mergedBody.position.x, mergedBody.position.y, 150, {
                isStatic: true,
                isSensor: true,
                render: { fillStyle: 'rgba(0, 255, 0, 0.0)' },
              });
              World.add(world, antiGravityZone);
              currentAntiGravityZone = antiGravityZone;

              // Apply anti-gravity effect
              const applyAntiGravity = () => {
                bodies.forEach((body) => {
                  const dx = body.position.x - antiGravityZone.position.x;
                  const dy = body.position.y - antiGravityZone.position.y;
                  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                  if (distance < 150) {
                    const forceMagnitude = -0.0005 * body.mass / distance; // Use the same repulsion force as mouse click
                    Matter.Body.applyForce(body, body.position, { x: dx * forceMagnitude, y: dy * forceMagnitude });
                  }
                });
              };

              Events.on(engine, 'beforeUpdate', applyAntiGravity);

              // Remove the anti-gravity zone after 5 seconds
              setTimeout(() => {
                Matter.World.remove(world, antiGravityZone);
                Events.off(engine, 'beforeUpdate', applyAntiGravity);
                currentAntiGravityZone = null;
              }, 5000);

              // Break out of the loops to avoid further processing of merged bodies
              i = shapeBodies.length;
              j = shapeBodies.length;
              k = shapeBodies.length;
            }
          }
        }
      }
    });
  });

  setInterval(() => {
    if (!splittingMode.value || bodies.length === 0) return;

    const largestBody = bodies.reduce((max, body) =>
      body.bounds.max.x - body.bounds.min.x > max.bounds.max.x - max.bounds.min.x ? body : max
    );

    const scaleFactor = 0.65;
    const leftVertices = largestBody.vertices.map((v) => ({
      x: largestBody.position.x + (v.x - largestBody.position.x) * scaleFactor - 20,
      y: largestBody.position.y + (v.y - largestBody.position.y) * scaleFactor,
    }));
    const rightVertices = largestBody.vertices.map((v) => ({
      x: largestBody.position.x + (v.x - largestBody.position.x) * scaleFactor + 20,
      y: largestBody.position.y + (v.y - largestBody.position.y) * scaleFactor,
    }));

    const leftBody = Bodies.fromVertices(largestBody.position.x - 20, largestBody.position.y, leftVertices, {
      restitution: largestBody.restitution,
      friction: largestBody.friction,
      density: largestBody.density,
      render: largestBody.render,
    });
    const rightBody = Bodies.fromVertices(largestBody.position.x + 20, largestBody.position.y, rightVertices, {
      restitution: largestBody.restitution,
      friction: largestBody.friction,
      density: largestBody.density,
      render: largestBody.render,
    });

    Body.applyForce(leftBody, leftBody.position, { x: -0.02, y: 0 });
    Body.applyForce(rightBody, rightBody.position, { x: 0.02, y: 0 });

    World.remove(world, largestBody);
    bodies.splice(bodies.indexOf(largestBody), 1);

    World.add(world, [leftBody, rightBody]);
    bodies.push(leftBody, rightBody);
  }, 1000);

  window.addEventListener('keydown', async (event) => {
    if (event.code === 'Space') {
      // Remove only the dynamic bodies
      bodies.forEach((body) => Matter.World.remove(world, body));
      bodies.length = 0;

      // Cycle to the next prefix
      currentPrefixIndex = (currentPrefixIndex + 1) % prefixes.length;

      // Load new shapes
      await loadSVGs(svgFolderPath, render, world, bodies, prefixes[currentPrefixIndex]);
    } else if (event.code === 'KeyS') {
      splittingMode.value = !splittingMode.value; // Toggle splitting mode
    }
  });
});
</script>

<style></style>
