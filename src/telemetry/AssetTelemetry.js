/**
 * Observability System - Asset Loading Telemetry
 * Skill Activated: spec-driven-development
 * Tracks asset streaming and GPU upload stalls.
 */

export class AssetTelemetry {
    constructor(coordinator) {
        this.coordinator = coordinator;
        this.activeLoads = 0;
        this.totalLoadedBytes = 0;
        this.uploadStalls = 0;
    }

    beginLoad() {
        this.activeLoads++;
    }

    endLoad(bytes) {
        this.activeLoads = Math.max(0, this.activeLoads - 1);
        this.totalLoadedBytes += bytes;
    }

    recordUploadStall(durationMs) {
        if (durationMs > 5.0) { // arbitrary threshold for an upload hitch
            this.uploadStalls++;
            this.coordinator.updateMetrics({ stalls: this.uploadStalls });
        }
    }
}
