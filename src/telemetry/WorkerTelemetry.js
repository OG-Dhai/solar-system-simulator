/**
 * Observability System - Worker Timing
 * Skill Activated: incremental-implementation
 * Progressively tracks message latency and deserialization overhead.
 */

export class WorkerTelemetry {
    constructor(coordinator) {
        this.coordinator = coordinator;
        this.messageLatencyMs = 0;
    }

    // Call this before sending a postMessage
    attachTimestamp(payload) {
        payload.__telemetry_sentAt = performance.now();
        return payload;
    }

    // Call this when receiving a message from a worker
    recordReceipt(payload) {
        if (payload.__telemetry_sentAt) {
            const now = performance.now();
            this.messageLatencyMs = now - payload.__telemetry_sentAt;
            
            this.coordinator.updateMetrics({ workerLatency: this.messageLatencyMs });
        }
    }
}
