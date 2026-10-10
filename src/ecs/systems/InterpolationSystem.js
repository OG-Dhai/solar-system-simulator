import { Query } from '../core/Query.js';
import { Transform } from '../components/Transform.js';
import { Snapshot } from '../components/Snapshot.js';
import { InterpolatedState } from '../components/InterpolatedState.js';

export function InterpolationSystem(world) {
  const query = new Query(world, [Transform, Snapshot, InterpolatedState]);
  const transformStore = world.getComponentStore(Transform);
  const snapshotStore = world.getComponentStore(Snapshot);
  const interpolatedStore = world.getComponentStore(InterpolatedState);

  // Extrapolation limit (e.g., maximum 1.5 fixed ticks into the future)
  const EXTRAPOLATION_LIMIT = 1.5;

  return {
    priority: 50, // Executes early in variable update, before RenderSystem
    update(dt, alpha) {
      const entities = query.execute();
      
      // We delay rendering by exactly 1 tick to ensure we have two bounds.
      // currentTick points to the *next* tick to be simulated.
      // So currentTick - 1 is the latest fully simulated tick.
      // We interpolate between currentTick - 2 and currentTick - 1.
      
      let prevTick = world.currentTick - 2;
      let nextTick = world.currentTick - 1;
      
      // Safeguard for the first few frames
      if (prevTick < 0) prevTick = 0;
      if (nextTick < 0) nextTick = 0;
      
      const prevIdx = prevTick % 4;
      const nextIdx = nextTick % 4;
      
      const pX = snapshotStore[`x${prevIdx}`];
      const pY = snapshotStore[`y${prevIdx}`];
      const pZ = snapshotStore[`z${prevIdx}`];
      
      const nX = snapshotStore[`x${nextIdx}`];
      const nY = snapshotStore[`y${nextIdx}`];
      const nZ = snapshotStore[`z${nextIdx}`];
      
      const outX = interpolatedStore.x;
      const outY = interpolatedStore.y;
      const outZ = interpolatedStore.z;

      // Apply extrapolation limits if alpha > 1.0 (buffer underrun / spiral of death clamp)
      const clampedAlpha = alpha > EXTRAPOLATION_LIMIT ? EXTRAPOLATION_LIMIT : alpha;

      for (let i = 0; i < entities.length; i++) {
        const id = entities[i];
        
        const prevX = pX[id];
        const prevY = pY[id];
        const prevZ = pZ[id];
        
        // Linear interpolation formula: prev + (curr - prev) * alpha
        outX[id] = prevX + (nX[id] - prevX) * clampedAlpha;
        outY[id] = prevY + (nY[id] - prevY) * clampedAlpha;
        outZ[id] = prevZ + (nZ[id] - prevZ) * clampedAlpha;
      }
    }
  };
}
