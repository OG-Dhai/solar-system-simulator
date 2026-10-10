import { Query } from '../core/Query.js';
import { Transform } from '../components/Transform.js';
import { OrbitComponent } from '../components/OrbitComponent.js';

// We import the existing Kepler solver from the legacy OOP architecture to reuse the math
import { solveKeplersEquation } from '../../../js/core/KeplerSolver.js';

export function OrbitSystem(world) {
  const query = new Query(world, [Transform, OrbitComponent]);
  
  const transformStore = world.getComponentStore(Transform);
  const orbitStore = world.getComponentStore(OrbitComponent);

  return {
    priority: 30, // Execute after basic movement
    update(dt) {
      const entities = query.execute();
      
      // Calculate simulation time from world accumulator or a passed global time
      // For now we'll use a rough translation from dt
      const timeScale = 1.0; 
      
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        
        const a = orbitStore.a[entity];
        const e = orbitStore.e[entity];
        const i_angle = orbitStore.i[entity] * (Math.PI / 180);
        const Omega = orbitStore.Omega[entity] * (Math.PI / 180);
        const omega = orbitStore.omega[entity] * (Math.PI / 180);
        const period = orbitStore.period[entity];
        const m0 = orbitStore.m0[entity] * (Math.PI / 180);
        
        // Very basic time progression for the mean anomaly
        // In a real system, we'd use global simulation time
        const meanMotion = (2 * Math.PI) / (period * 86400); 
        // We'll just step the mean anomaly forward for demonstration
        orbitStore.m0[entity] = (orbitStore.m0[entity] + meanMotion * dt * timeScale) % 360;
        
        const meanAnomaly = orbitStore.m0[entity] * (Math.PI / 180);
        
        const eccResult = solveKeplersEquation(meanAnomaly, e);
        if (isNaN(eccResult.E)) continue;
        const E = eccResult.E;
        
        const r = a * (1 - e * Math.cos(E));
        
        const sqrt1MinusE2 = Math.sqrt(1 - e * e);
        const tanNuOver2 = sqrt1MinusE2 * Math.sin(E) / (Math.cos(E) - e);
        const nu = 2 * Math.atan(tanNuOver2);
        
        const x_orb = r * Math.cos(nu);
        const y_orb = r * Math.sin(nu);
        
        const cosOmega = Math.cos(Omega);
        const sinOmega = Math.sin(Omega);
        const cosI = Math.cos(i_angle);
        const sinI = Math.sin(i_angle);
        const cosW = Math.cos(omega);
        const sinW = Math.sin(omega);
        
        const P11 = cosOmega * cosW - sinOmega * sinW * cosI;
        const P12 = -cosOmega * sinW - sinOmega * cosW * cosI;
        const P21 = sinOmega * cosW + cosOmega * sinW * cosI;
        const P22 = -sinOmega * sinW + cosOmega * cosW * cosI;
        const P31 = sinW * sinI;
        const P32 = cosW * sinI;
        
        const x = P11 * x_orb + P12 * y_orb;
        const y = P31 * x_orb + P32 * y_orb;
        const z = P21 * x_orb + P22 * y_orb;
        
        // Handle parent transform for hierarchical orbits (like Moons)
        const parentEntity = orbitStore.parentEntity[entity];
        let parentX = 0, parentY = 0, parentZ = 0;
        
        if (parentEntity !== undefined && parentEntity !== -1 && parentEntity !== 0) { // 0 might be a valid ID, assume -1 is null or check via another method.
            // Using a simple lookup. In a robust ECS, parentEntity should be properly typed or we'd use a TransformHierarchySystem.
            parentX = transformStore.x[parentEntity] || 0;
            parentY = transformStore.y[parentEntity] || 0;
            parentZ = transformStore.z[parentEntity] || 0;
        }
        
        transformStore.x[entity] = x + parentX;
        transformStore.y[entity] = y + parentY;
        transformStore.z[entity] = z + parentZ;
      }
    }
  };
}
