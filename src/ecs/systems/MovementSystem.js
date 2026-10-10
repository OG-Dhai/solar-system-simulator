import { Query } from '../core/Query.js';
import { Transform } from '../components/Transform.js';
import { Velocity } from '../components/Velocity.js';

export function MovementSystem(world) {
  const query = new Query(world, [Transform, Velocity]);
  
  const transformStore = world.getComponentStore(Transform);
  const velocityStore = world.getComponentStore(Velocity);

  return {
    priority: 20, // Executes after gravity applies forces
    fixedUpdate(fixedDt) {
      const entities = query.execute();
      
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        
        // p = p + v*dt
        transformStore.x[entity] += velocityStore.x[entity] * fixedDt;
        transformStore.y[entity] += velocityStore.y[entity] * fixedDt;
        transformStore.z[entity] += velocityStore.z[entity] * fixedDt;
      }
    }
  };
}
