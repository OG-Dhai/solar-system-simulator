import { Query } from '../core/Query.js';
import { Transform } from '../components/Transform.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { EclipseComponent } from '../components/EclipseComponent.js';

export function EclipseSystem(world) {
  const query = new Query(world, [Transform, MeshComponent, EclipseComponent]);
  
  const transformStore = world.getComponentStore(Transform);
  const meshStore = world.getComponentStore(MeshComponent);
  const eclipseStore = world.getComponentStore(EclipseComponent);

  return {
    priority: 40, // Run after OrbitSystem has updated positions
    update(dt) {
      const entities = query.execute();
      
      const sunPos = { x: 0, y: 0, z: 0 }; // Assume sun is at origin for now
      
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        
        const parentEntity = eclipseStore.targetEntity[entity];
        if (parentEntity === undefined || parentEntity === -1) continue;
        
        // Get positions
        const moonX = transformStore.x[entity];
        const moonY = transformStore.y[entity];
        const moonZ = transformStore.z[entity];
        
        const planetX = transformStore.x[parentEntity];
        const planetY = transformStore.y[parentEntity];
        const planetZ = transformStore.z[parentEntity];
        
        // Planet radius (needed for shadow cone)
        const planetRadius = meshStore.radius[parentEntity] || 1;
        
        // Vector from Sun to Planet
        const s2pX = planetX - sunPos.x;
        const s2pY = planetY - sunPos.y;
        const s2pZ = planetZ - sunPos.z;
        const s2pDist = Math.sqrt(s2pX*s2pX + s2pY*s2pY + s2pZ*s2pZ);
        
        // Vector from Sun to Moon
        const s2mX = moonX - sunPos.x;
        const s2mY = moonY - sunPos.y;
        const s2mZ = moonZ - sunPos.z;
        const s2mDist = Math.sqrt(s2mX*s2mX + s2mY*s2mY + s2mZ*s2mZ);
        
        // Normalize
        const s2pDirX = s2pX / s2pDist;
        const s2pDirY = s2pY / s2pDist;
        const s2pDirZ = s2pZ / s2pDist;
        
        // Project moon position onto sun-planet axis
        const projection = (s2mX * s2pDirX) + (s2mY * s2pDirY) + (s2mZ * s2pDirZ);
        
        let inShadow = 0;
        let shadowFactor = 0.0;
        
        // If projection > 0, moon is on the same side as the planet relative to the sun
        if (projection > 0) {
          // Calculate distance from moon to the axis (rejection vector)
          const projX = sunPos.x + s2pDirX * projection;
          const projY = sunPos.y + s2pDirY * projection;
          const projZ = sunPos.z + s2pDirZ * projection;
          
          const rejX = moonX - projX;
          const rejY = moonY - projY;
          const rejZ = moonZ - projZ;
          const distanceToAxis = Math.sqrt(rejX*rejX + rejY*rejY + rejZ*rejZ);
          
          const distanceFromPlanet = Math.abs(s2mDist - s2pDist);
          
          // Approximated shadow cone radius
          const shadowRadiusAtMoon = planetRadius * (distanceFromPlanet / s2pDist + 1.0);
          
          if (distanceToAxis < shadowRadiusAtMoon) {
            inShadow = 1;
            shadowFactor = 1.0 - (distanceToAxis / shadowRadiusAtMoon);
          }
        }
        
        eclipseStore.inShadow[entity] = inShadow;
        eclipseStore.shadowFactor[entity] = shadowFactor;
        
        // Note: The RenderSystem would be responsible for reading `inShadow` 
        // and adjusting the `THREE.Mesh` material emissive values, keeping 
        // physics completely separate from rendering.
      }
    }
  };
}
