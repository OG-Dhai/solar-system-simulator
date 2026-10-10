export class Query {
  /**
   * @param {Object} world - Reference to the ECS World instance
   * @param {Array<Object>} all - Array of component types that an entity MUST have
   * @param {Array<Object>} none - Array of component types that an entity MUST NOT have
   */
  constructor(world, all = [], none = []) {
    this.world = world;
    this.entityManager = world.entityManager;
    this.componentManager = world.componentManager;
    
    this.maskAll = 0;
    this.maskNone = 0;

    for (let i = 0; i < all.length; i++) {
      this.maskAll |= (1 << this.componentManager.getBit(all[i]));
    }
    for (let i = 0; i < none.length; i++) {
      this.maskNone |= (1 << this.componentManager.getBit(none[i]));
    }
    
    // Cached array to avoid garbage collection during iteration
    this.results = [];
  }

  /**
   * Executes the query and returns a flat array of matching entity IDs.
   * Reuses the internal array to ensure zero-allocation during the loop.
   * @returns {Array<number>}
   */
  execute() {
    this.results.length = 0; // Clear without reallocating
    
    const signatures = this.entityManager.signatures;
    const max = this.entityManager.maxEntities;
    
    for (let i = 0; i < max; i++) {
      const sig = signatures[i];
      // Skip dead entities
      if (sig === 0) continue;
      
      // Match ALL required components
      if ((sig & this.maskAll) !== this.maskAll) continue;
      
      // Reject if ANY excluded components are present
      if (this.maskNone > 0 && (sig & this.maskNone) > 0) continue;
      
      this.results.push(i);
    }
    
    return this.results;
  }
}
