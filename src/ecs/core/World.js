import { EntityManager } from './EntityManager.js';
import { ComponentManager } from './ComponentManager.js';
import { SystemManager } from './SystemManager.js';
import { EventBus } from '../utils/EventBus.js';

export class World {
  /**
   * @param {number} maxEntities - Pre-allocation limit for entities
   */
  constructor(maxEntities = 100000) {
    this.maxEntities = maxEntities;
    
    this.entityManager = new EntityManager(maxEntities);
    this.componentManager = new ComponentManager(maxEntities);
    this.systemManager = new SystemManager(this);
    this.events = new EventBus();
    
    // For fixed-timestep accumulator
    this.accumulator = 0;
    this.fixedTimeStep = 1 / 60; // 60Hz physics by default
    this.currentTick = 0;
  }

  /**
   * Create a new entity ID.
   * @returns {number}
   */
  createEntity() {
    return this.entityManager.create();
  }

  /**
   * Defer entity destruction to the end of the frame.
   * @param {number} entityId 
   */
  destroyEntity(entityId) {
    this.entityManager.destroy(entityId);
  }

  /**
   * Register a component schema.
   * @param {Object} ComponentDef 
   */
  registerComponent(ComponentDef) {
    this.componentManager.register(ComponentDef);
  }

  /**
   * Register a system.
   * @param {Function} SystemFactory 
   */
  registerSystem(SystemFactory) {
    this.systemManager.register(SystemFactory);
  }

  /**
   * Add a component to an entity. Optionally initialize its data in the SoA store.
   * @param {number} entityId 
   * @param {Object} ComponentDef 
   * @param {Object} [initialData] 
   */
  addComponent(entityId, ComponentDef, initialData = null) {
    const bit = this.componentManager.getBit(ComponentDef);
    if (bit === undefined) {
      throw new Error(`World: Component ${ComponentDef.name} not registered.`);
    }

    this.entityManager.addComponentBit(entityId, bit);

    // Initialize the SoA fields for this entity if schema exists
    if (ComponentDef.schema && initialData) {
      const store = this.componentManager.getStore(ComponentDef);
      for (const key in ComponentDef.schema) {
        if (initialData[key] !== undefined) {
          store[key][entityId] = initialData[key];
        }
      }
    }
  }

  /**
   * Remove a component from an entity.
   * @param {number} entityId 
   * @param {Object} ComponentDef 
   */
  removeComponent(entityId, ComponentDef) {
    const bit = this.componentManager.getBit(ComponentDef);
    if (bit !== undefined) {
      this.entityManager.removeComponentBit(entityId, bit);
    }
  }

  /**
   * Access the SoA storage for a component directly.
   * Exposes raw TypedArrays for ultra-fast iteration in Systems.
   * @param {Object} ComponentDef 
   * @returns {Object} Example: { x: Float64Array, y: Float64Array }
   */
  getComponentStore(ComponentDef) {
    return this.componentManager.getStore(ComponentDef);
  }

  /**
   * Tick the simulation. Orchestrates physics accumulator and rendering.
   * @param {number} dt - Delta time in seconds
   */
  tick(dt) {
    // Fixed Timestep Integration (Physics)
    this.accumulator += dt;
    
    // Frame Synchronization: Spiral of death safeguard
    const MAX_TICKS_PER_FRAME = 10;
    let ticksExecuted = 0;
    
    while (this.accumulator >= this.fixedTimeStep && ticksExecuted < MAX_TICKS_PER_FRAME) {
      this.systemManager.fixedUpdate(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      this.currentTick++;
      ticksExecuted++;
    }
    
    // If we hit the cap, clamp the accumulator to prevent persistent lag build-up
    if (ticksExecuted === MAX_TICKS_PER_FRAME) {
      this.accumulator = 0;
    }

    // Variable Timestep Integration (Rendering)
    // Pass the interpolation factor if systems need it: accumulator / fixedTimeStep
    const alpha = this.accumulator / this.fixedTimeStep;
    this.systemManager.update(dt, alpha);

    // End of frame cleanup
    this.entityManager.sweep();
  }
}
