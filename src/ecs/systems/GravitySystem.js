import { Query } from '../core/Query.js';
import { Transform } from '../components/Transform.js';
import { Mass } from '../components/Mass.js';
import { Velocity } from '../components/Velocity.js';

const G = 6.67430e-11; // Gravitational constant

export function GravitySystem(world) {
  // Query all entities that have mass, transform, and velocity
  const query = new Query(world, [Transform, Mass, Velocity]);
  
  // Cache the SoA data stores
  const transformStore = world.getComponentStore(Transform);
  const massStore = world.getComponentStore(Mass);
  const velocityStore = world.getComponentStore(Velocity);

  return {
    priority: 10, // Executes early in the physics step
    fixedUpdate(fixedDt) {
      const entities = query.execute();
      const len = entities.length;
      
      // Basic O(N^2) n-body gravity for example purposes
      for (let i = 0; i < len; i++) {
        const a = entities[i];
        
        let fx = 0, fy = 0, fz = 0;
        
        for (let j = 0; j < len; j++) {
          if (i === j) continue;
          const b = entities[j];
          
          const dx = transformStore.x[b] - transformStore.x[a];
          const dy = transformStore.y[b] - transformStore.y[a];
          const dz = transformStore.z[b] - transformStore.z[a];
          
          const distSq = dx*dx + dy*dy + dz*dz;
          const dist = Math.sqrt(distSq);
          
          // F = G * (m1 * m2) / r^2
          const force = (G * massStore.value[a] * massStore.value[b]) / distSq;
          
          fx += force * (dx / dist);
          fy += force * (dy / dist);
          fz += force * (dz / dist);
        }
        
        // Apply acceleration (a = F/m) to velocity: v = v + a*dt
        const massA = massStore.value[a];
        velocityStore.x[a] += (fx / massA) * fixedDt;
        velocityStore.y[a] += (fy / massA) * fixedDt;
        velocityStore.z[a] += (fz / massA) * fixedDt;
      }
    }
  };
}
