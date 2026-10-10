import { Query } from '../core/Query.js';
import { Transform } from '../components/Transform.js';
import { RotationComponent } from '../components/RotationComponent.js';

export function RotationSystem(world) {
  const query = new Query(world, [Transform, RotationComponent]);
  
  const rotationStore = world.getComponentStore(RotationComponent);

  return {
    priority: 35,
    update(dt) {
      const entities = query.execute();
      
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        
        const period = rotationStore.rotationPeriod[entity];
        const rotationSpeed = (2 * Math.PI) / (period * 3600); // Rough approximation
        
        rotationStore.currentAngle[entity] += rotationSpeed * dt;
        if (rotationStore.currentAngle[entity] > Math.PI * 2) {
          rotationStore.currentAngle[entity] -= Math.PI * 2;
        }
        
        // Transform doesn't have rotation natively in the current simple schema, 
        // but if it did we'd update it here. For now we just update the component state.
      }
    }
  };
}
