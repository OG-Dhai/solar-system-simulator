import { Query } from '../core/Query.js';
import { Transform } from '../components/Transform.js';
import { Snapshot } from '../components/Snapshot.js';

export function SnapshotSystem(world) {
  const query = new Query(world, [Transform, Snapshot]);
  const transformStore = world.getComponentStore(Transform);
  const snapshotStore = world.getComponentStore(Snapshot);

  return {
    priority: 900, // Executes at the end of fixedUpdate
    fixedUpdate(fixedDt) {
      const entities = query.execute();
      const tickIndex = world.currentTick % 4;
      
      const xProp = `x${tickIndex}`;
      const yProp = `y${tickIndex}`;
      const zProp = `z${tickIndex}`;
      
      const targetX = snapshotStore[xProp];
      const targetY = snapshotStore[yProp];
      const targetZ = snapshotStore[zProp];
      
      const srcX = transformStore.x;
      const srcY = transformStore.y;
      const srcZ = transformStore.z;

      for (let i = 0; i < entities.length; i++) {
        const id = entities[i];
        targetX[id] = srcX[id];
        targetY[id] = srcY[id];
        targetZ[id] = srcZ[id];
      }
    }
  };
}
