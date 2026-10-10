import { World } from './ecs/core/World.js';
import { SimulationContext } from './SimulationContext.js';
import { Transform } from './ecs/components/Transform.js';
import { OrbitComponent } from './ecs/components/OrbitComponent.js';
import { RotationComponent } from './ecs/components/RotationComponent.js';
import { MeshComponent } from './ecs/components/MeshComponent.js';
import { GravityComponent } from './ecs/components/GravityComponent.js';
import { EclipseComponent } from './ecs/components/EclipseComponent.js';
import { RingComponent } from './ecs/components/RingComponent.js';
import { Snapshot } from './ecs/components/Snapshot.js';
import { InterpolatedState } from './ecs/components/InterpolatedState.js';

import { OrbitSystem } from './ecs/systems/OrbitSystem.js';
import { RotationSystem } from './ecs/systems/RotationSystem.js';
import { RenderSystem } from './ecs/systems/RenderSystem.js';
import { EclipseSystem } from './ecs/systems/EclipseSystem.js';
import { RingSystem } from './ecs/systems/RingSystem.js';
import { SnapshotSystem } from './ecs/systems/SnapshotSystem.js';
import { InterpolationSystem } from './ecs/systems/InterpolationSystem.js';

const context = new SimulationContext();

// Pre-allocate arrays for 1000 entities
const world = new World(1000);
context.register('World', world);

// Register Components
world.registerComponent(Transform);
world.registerComponent(OrbitComponent);
world.registerComponent(RotationComponent);
world.registerComponent(MeshComponent);
world.registerComponent(GravityComponent);
world.registerComponent(EclipseComponent);
world.registerComponent(RingComponent);
world.registerComponent(Snapshot);
world.registerComponent(InterpolatedState);

// Register Systems
world.registerSystem(OrbitSystem);
world.registerSystem(RotationSystem);
world.registerSystem(EclipseSystem);
world.registerSystem(RingSystem);
world.registerSystem(SnapshotSystem);
world.registerSystem(InterpolationSystem);
world.registerSystem(RenderSystem);

console.log('ECS initialized. Setting up solar system simulation...');

// Create a massive central star
const sun = world.createEntity();
world.addComponent(sun, Transform, { x: 0, y: 0, z: 0 });
world.addComponent(sun, GravityComponent, { mass: 1.989e30, isStatic: 1 });
world.addComponent(sun, MeshComponent, { 
    radius: 696340, 
    color: 0xffcc00, 
    emissive: 0xffcc00, 
    emissiveIntensity: 1.0,
    castShadow: 0,
    receiveShadow: 0
});
world.addComponent(sun, Snapshot, { x: 0, y: 0, z: 0 });
world.addComponent(sun, InterpolatedState, { x: 0, y: 0, z: 0 });

// Create an orbiting planet (Earth)
const earth = world.createEntity();
world.addComponent(earth, Transform, { x: 0, y: 0, z: 0 }); // Will be updated by OrbitSystem
world.addComponent(earth, OrbitComponent, { 
    a: 1.0, // 1 AU
    e: 0.0167,
    i: 0.00005,
    Omega: -11.26064,
    omega: 102.94719,
    period: 365.25,
    m0: 100.46435,
    parentEntity: sun
});
world.addComponent(earth, RotationComponent, { 
    axialTilt: 23.44, 
    rotationPeriod: 23.93, 
    currentAngle: 0, 
    rotationSpeed: 0 
});
world.addComponent(earth, MeshComponent, { 
    radius: 6371, 
    color: 0x2233ff, 
    roughness: 0.5, 
    metalness: 0.1,
    castShadow: 1,
    receiveShadow: 1
});
world.addComponent(earth, GravityComponent, { mass: 5.972e24, isStatic: 0 });
world.addComponent(earth, Snapshot, { x: 0, y: 0, z: 0 });
world.addComponent(earth, InterpolatedState, { x: 0, y: 0, z: 0 });

// Create an orbiting moon (Luna)
const moon = world.createEntity();
world.addComponent(moon, Transform, { x: 0, y: 0, z: 0 });
world.addComponent(moon, OrbitComponent, {
    a: 0.00257, // roughly distance in AU
    e: 0.0549,
    i: 5.145,
    Omega: 125.08,
    omega: 318.15,
    period: 27.32,
    m0: 115.3654,
    parentEntity: earth
});
world.addComponent(moon, RotationComponent, {
    axialTilt: 1.5424,
    rotationPeriod: 27.32, // Synchronous rotation
    currentAngle: 0,
    rotationSpeed: 0
});
world.addComponent(moon, MeshComponent, {
    radius: 1737,
    color: 0x888888,
    roughness: 0.9,
    metalness: 0.0,
    castShadow: 1,
    receiveShadow: 1
});
world.addComponent(moon, EclipseComponent, {
    inShadow: 0,
    shadowFactor: 0,
    targetEntity: earth
});
world.addComponent(moon, Snapshot, { x: 0, y: 0, z: 0 });
world.addComponent(moon, InterpolatedState, { x: 0, y: 0, z: 0 });

// Create Saturn with a ring
const saturn = world.createEntity();
world.addComponent(saturn, Transform, { x: 0, y: 0, z: 0 });
world.addComponent(saturn, OrbitComponent, {
    a: 9.58, // 9.58 AU
    e: 0.0565,
    i: 2.485,
    Omega: 113.66,
    omega: 339.39,
    period: 10759.22, // days
    m0: 317.020,
    parentEntity: sun
});
world.addComponent(saturn, RotationComponent, {
    axialTilt: 26.73,
    rotationPeriod: 10.656, // hours
    currentAngle: 0,
    rotationSpeed: 0
});
world.addComponent(saturn, MeshComponent, {
    radius: 58232,
    color: 0xeeddaa,
    roughness: 1.0,
    metalness: 0.0,
    castShadow: 1,
    receiveShadow: 1
});
world.addComponent(saturn, GravityComponent, { mass: 5.683e26, isStatic: 0 });
// Add the RingComponent
world.addComponent(saturn, RingComponent, {
    innerRadius: 1.2, // relative to planet radius
    outerRadius: 2.3,
    color: 0xaaaaaa,
    opacity: 0.8,
    textureUrl: 'saturn_rings.png'
});
world.addComponent(saturn, Snapshot, { x: 0, y: 0, z: 0 });
world.addComponent(saturn, InterpolatedState, { x: 0, y: 0, z: 0 });

console.log('Entities spawned. Running 10 ticks...');

let lastTime = performance.now();

// Simulate 10 frames
for (let i = 0; i < 10; i++) {
  // Mock delta time of 1/60th second
  world.tick(1/60);
  
  const transformStore = world.getComponentStore(Transform);
  const eclipseStore = world.getComponentStore(EclipseComponent);
  const ringStore = world.getComponentStore(RingComponent);
  
  console.log(`Tick ${i+1}: Earth Pos [X: ${transformStore.x[earth].toFixed(3)}, Z: ${transformStore.z[earth].toFixed(3)}] | Saturn Pos [X: ${transformStore.x[saturn].toFixed(3)}, Z: ${transformStore.z[saturn].toFixed(3)}] | Saturn Ring Inner: ${ringStore.innerRadius[saturn]}`);
}

console.log('Simulation ran successfully. RingsBase successfully migrated to pure ECS.');
