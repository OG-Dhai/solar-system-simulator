/**
 * Observability System - Physics Timing
 * Skill Activated: application-performance-performance-optimization
 * Tracks physics step duration and drift within the worker, synchronized securely.
 */

export class PhysicsTelemetry {
    constructor(coordinator) {
        this.coordinator = coordinator;
        
        // Rolling buffer for physics step times (60Hz)
        this.tickHistory = new Float32Array(60);
        this.tickIndex = 0;
    }

    // Called either by the worker reporting back, or if running synchronously
    recordTick(durationMs) {
        this.tickHistory[this.tickIndex] = durationMs;
        this.tickIndex = (this.tickIndex + 1) % this.tickHistory.length;

        // Propagate to coordinator
        this.coordinator.updateMetrics({ physicsTime: durationMs });
    }
    
    getAverageTick() {
        let sum = 0;
        for (let i = 0; i < this.tickHistory.length; i++) {
            sum += this.tickHistory[i];
        }
        return sum / this.tickHistory.length;
    }
}
