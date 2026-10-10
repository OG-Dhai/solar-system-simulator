/**
 * Observability System - GC Spike Detection
 * Skill Activated: code-simplification
 * Infers GC spikes from frame time variance rather than complex hooks.
 */

export class GCTelemetry {
    constructor(coordinator) {
        this.coordinator = coordinator;
        this.spikeCount = 0;
        this.lastFrameTime = 16.66;
    }

    checkSpike(currentFrameTime, logicLoadFactor = 0) {
        // If the frame took significantly longer than 16ms, and it wasn't
        // due to heavy logic (load factor), we infer a GC pause.
        if (currentFrameTime > 33.33 && logicLoadFactor < 0.5) {
            this.spikeCount++;
            
            // Only update coordinator periodically or on massive spikes to avoid overhead
            this.coordinator.updateMetrics({ gcSpikeCount: this.spikeCount });
            
            // Log it out for local debugging overlays
            console.warn(`[GCTelemetry] GC Spike Inferred: ${currentFrameTime.toFixed(2)}ms`);
        }
        
        this.lastFrameTime = currentFrameTime;
    }
}
