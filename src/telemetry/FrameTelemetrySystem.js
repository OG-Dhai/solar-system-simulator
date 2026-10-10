/**
 * Observability System - Frame Telemetry System
 * Skill Activated: performance-optimization
 * Collects per-frame CPU timing metrics with near-zero overhead.
 */

export class FrameTelemetrySystem {
    constructor(coordinator) {
        this.coordinator = coordinator;
        this.frameStart = 0;
    }

    beginFrame() {
        this.frameStart = performance.now();
    }

    endFrame() {
        if (this.frameStart === 0) return;
        
        const frameEnd = performance.now();
        const duration = frameEnd - this.frameStart;
        
        // Push raw duration to the coordinator
        // GPU time will be updated asynchronously if available
        this.coordinator.recordFrame(duration, 0);
        
        this.frameStart = 0;
    }
}
