import { Query } from '../core/Query.js';
import { InterpolatedState } from '../components/InterpolatedState.js';

export function RenderSystem(world, objectRegistry) {
  const query = new Query(world, [InterpolatedState]);
  const interpolatedStore = world.getComponentStore(InterpolatedState);

  return {
    priority: 1000, // Executes last in variable update
    update(dt, alpha) {
      const entities = query.execute();
      
      const outX = interpolatedStore.x;
      const outY = interpolatedStore.y;
      const outZ = interpolatedStore.z;

      for (let i = 0; i < entities.length; i++) {
        const id = entities[i];
        
        // objectRegistry maps EntityID -> THREE.Object3D (or similar graphics primitive)
        if (objectRegistry && objectRegistry[id]) {
          const obj3d = objectRegistry[id];
          
          // Direct property mutation without new Vector3 allocations
          obj3d.position.x = outX[id];
          obj3d.position.y = outY[id];
          obj3d.position.z = outZ[id];
          
          // Note: If using InstancedMesh, this adapter would calculate matrix offsets
          // and set mesh.instanceMatrix.needsUpdate = true instead.
        }
      }
    }
  };
}
