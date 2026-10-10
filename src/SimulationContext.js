/**
 * SimulationContext (DI Container)
 * 
 * Provides explicit ownership and lifecycle management for all core subsystems.
 * Eliminates global singletons and enforces a strict dependency graph.
 */
export class SimulationContext {
    constructor() {
        this.services = new Map();
        this.isRunning = false;
    }

    /**
     * Register a service/manager into the DI container
     * @param {string} name 
     * @param {object} instance 
     */
    register(name, instance) {
        if (this.services.has(name)) {
            throw new Error(`Service ${name} is already registered.`);
        }
        this.services.set(name, instance);
    }

    /**
     * Resolve a service by name
     * @param {string} name 
     * @returns {object}
     */
    resolve(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service ${name} not found in SimulationContext.`);
        }
        return service;
    }

    /**
     * Start the simulation
     */
    start() {
        this.isRunning = true;
        // Lifecycle: initialize any services that need explicit start
        for (const [name, service] of this.services.entries()) {
            if (typeof service.start === 'function') {
                service.start();
            }
        }
    }

    /**
     * Gracefully shutdown and cleanup
     */
    stop() {
        this.isRunning = false;
        // Lifecycle: cleanup in reverse order or as needed
        for (const [name, service] of this.services.entries()) {
            if (typeof service.dispose === 'function') {
                service.dispose();
            }
        }
        this.services.clear();
    }
}
