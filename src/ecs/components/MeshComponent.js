export const MeshComponent = {
  name: 'MeshComponent',
  schema: {
    radius: 'float64',
    color: 'uint32',
    roughness: 'float64',
    metalness: 'float64',
    emissive: 'uint32',
    emissiveIntensity: 'float64',
    castShadow: 'uint8',
    receiveShadow: 'uint8',
    textureUrl: 'string', // Will fallback to Array
    meshId: 'string'      // Used to map to actual THREE.Mesh objects
  }
};
