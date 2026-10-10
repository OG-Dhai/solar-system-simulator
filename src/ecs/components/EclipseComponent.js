export const EclipseComponent = {
  name: 'EclipseComponent',
  schema: {
    inShadow: 'uint8',
    shadowFactor: 'float64', // 0.0 to 1.0 depending on umbra/penumbra
    targetEntity: 'int32' // The entity casting the shadow (e.g., the parent planet)
  }
};
