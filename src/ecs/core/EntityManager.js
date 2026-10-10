export class EntityManager {
  /**
   * @param {number} maxEntities - Maximum number of entities to pre-allocate
   */
  constructor(maxEntities) {
    this.maxEntities = maxEntities;
    
    // Each entity's component signature is a bitmask. 
    // 0 means dead/inactive or has no components.
    this.signatures = new Uint32Array(maxEntities);
    
    // Free list for recycling entity IDs
    this.freeQueue = [];
    for (let i = maxEntities - 1; i >= 0; i--) {
      this.freeQueue.push(i);
    }
    
    this.activeCount = 0;
    
    // Deferred destruction queue to avoid invalidating loops mid-frame
    this.deferredDeaths = [];
  }

  /**
   * Create a new entity and return its integer ID.
   * @returns {number} entity ID
   */
  create() {
    if (this.freeQueue.length === 0) {
      throw new Error("EntityManager: Max entities reached.");
    }
    const id = this.freeQueue.pop();
    this.signatures[id] = 0;
    this.activeCount++;
    return id;
  }

  /**
   * Mark an entity for destruction at the end of the frame.
   * @param {number} id 
   */
  destroy(id) {
    this.deferredDeaths.push(id);
  }

  /**
   * Set a component bit on an entity's signature.
   * @param {number} id 
   * @param {number} bit 
   */
  addComponentBit(id, bit) {
    this.signatures[id] |= (1 << bit);
  }

  /**
   * Remove a component bit from an entity's signature.
   * @param {number} id 
   * @param {number} bit 
   */
  removeComponentBit(id, bit) {
    this.signatures[id] &= ~(1 << bit);
  }

  /**
   * Get the signature bitmask for an entity.
   * @param {number} id 
   * @returns {number}
   */
  getSignature(id) {
    return this.signatures[id];
  }

  /**
   * Sweep phase: actually remove dead entities and reclaim their IDs.
   * This is called by the World at the end of the frame.
   */
  sweep() {
    for (let i = 0; i < this.deferredDeaths.length; i++) {
      const id = this.deferredDeaths[i];
      // Reset signature so queries ignore it immediately
      this.signatures[id] = 0;
      this.freeQueue.push(id);
      this.activeCount--;
    }
    this.deferredDeaths.length = 0;
  }
}
