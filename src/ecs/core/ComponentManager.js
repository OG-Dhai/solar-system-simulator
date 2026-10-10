export class ComponentManager {
  /**
   * @param {number} maxEntities - Used to size the internal TypedArrays
   */
  constructor(maxEntities) {
    this.maxEntities = maxEntities;
    
    // Maps Component objects/references to their bit index (0-31)
    this.componentBits = new Map();
    this.nextBit = 0;
    
    // Stores the pure SoA data arrays: 
    // ComponentName -> { field1: TypedArray, field2: TypedArray }
    this.stores = new Map();
  }

  /**
   * Register a component definition.
   * Definitions should look like: { name: 'Transform', schema: { x: 'float64', y: 'float64' } }
   * @param {Object} ComponentDef 
   */
  register(ComponentDef) {
    if (this.componentBits.has(ComponentDef)) return;
    
    if (this.nextBit >= 32) {
      throw new Error("ComponentManager: Exceeded 32 component limit for standard bitmasks.");
    }
    
    const bit = this.nextBit++;
    this.componentBits.set(ComponentDef, bit);
    
    // Allocate SoA memory blocks based on schema
    const store = {};
    if (ComponentDef.schema) {
      for (const [field, type] of Object.entries(ComponentDef.schema)) {
        store[field] = this._createTypedArray(type, this.maxEntities);
      }
    }
    this.stores.set(ComponentDef.name, store);
  }

  /**
   * @param {Object} ComponentDef 
   * @returns {number} The bitmask for this component
   */
  getBit(ComponentDef) {
    return this.componentBits.get(ComponentDef);
  }

  /**
   * Get the data store (the struct of arrays) for a given component type.
   * @param {Object} ComponentDef 
   * @returns {Object}
   */
  getStore(ComponentDef) {
    return this.stores.get(ComponentDef.name);
  }

  _createTypedArray(type, size) {
    switch (type) {
      case 'float64': return new Float64Array(size);
      case 'float32': return new Float32Array(size);
      case 'int32': return new Int32Array(size);
      case 'uint32': return new Uint32Array(size);
      case 'int16': return new Int16Array(size);
      case 'uint16': return new Uint16Array(size);
      case 'int8': return new Int8Array(size);
      case 'uint8': return new Uint8Array(size);
      default:
        // Fallback for non-numeric/complex types (avoid in hot-paths)
        return new Array(size);
    }
  }
}
