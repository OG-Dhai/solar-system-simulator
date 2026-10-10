export class SystemManager {
  constructor(world) {
    this.world = world;
    this.systems = [];
  }

  /**
   * Register a new system factory.
   * @param {Function} SystemFactory - A function that receives the World and returns a system object.
   */
  register(SystemFactory) {
    const system = SystemFactory(this.world);
    
    // Default priority to 0 if not provided
    if (typeof system.priority === 'undefined') {
      system.priority = 0;
    }
    
    this.systems.push(system);
    
    // Sort systems by priority (lower number = executes first)
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute variable time step logic (e.g., Rendering, Interpolation)
   * @param {number} dt - Delta time in seconds
   * @param {number} alpha - Interpolation factor (0.0 to 1.0)
   */
  update(dt, alpha = 0) {
    for (let i = 0; i < this.systems.length; i++) {
      if (this.systems[i].update) {
        this.systems[i].update(dt, alpha);
      }
    }
  }

  /**
   * Execute fixed time step logic (e.g., Physics integration)
   * @param {number} fixedDt - Fixed delta time in seconds
   */
  fixedUpdate(fixedDt) {
    for (let i = 0; i < this.systems.length; i++) {
      if (this.systems[i].fixedUpdate) {
        this.systems[i].fixedUpdate(fixedDt);
      }
    }
  }
}
