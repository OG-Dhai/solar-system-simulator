/**
 * Observability System - Memory Telemetry
 * Skill Activated: error-handling-patterns
 * Tracks memory leaks and resource usage safely.
 */

export class MemoryTelemetry {
    constructor(coordinator) {
        this.coordinator = coordinator;
        this.isChrome = !!performance.memory;
        this.manualBytes = 0;
        this.checkIntervalMs = 2000;
        this.lastCheck = 0;
    }

    trackManualAllocation(bytes) {
        this.manualBytes += bytes;
    }

    trackManualFree(bytes) {
        this.manualBytes -= bytes;
        if (this.manualBytes < 0) this.manualBytes = 0;
    }

    update(now) {
        if (now - this.lastCheck < this.checkIntervalMs) return;
        this.lastCheck = now;

        try {
            let usedMemory = 0;
            if (this.isChrome) {
                usedMemory = performance.memory.usedJSHeapSize;
            } else {
                usedMemory = this.manualBytes;
            }

            this.coordinator.updateMetrics({ memoryBytes: usedMemory });
        } catch (e) {
            // Explicit error handling so memory profiling doesn't cause recursion or crashes
            console.warn("MemoryTelemetry failed to collect stats:", e);
        }
    }
}
