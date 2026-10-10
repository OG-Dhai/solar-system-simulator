/**
 * Observability System - Telemetry Coordinator
 * Skill Activated: debugging-and-error-recovery
 * Aggregates data from all telemetry subsystems into a central zero-allocation ring buffer.
 * Determines system bottlenecks and handles remote batching for monitoring.
 */

export class TelemetryCoordinator {
    constructor() {
        // Zero-allocation ring buffers for aggregated metrics
        this.frameHistory = new Float32Array(600); // 10 seconds of 60Hz frame times
        this.frameHistoryIndex = 0;

        this.gpuHistory = new Float32Array(600);
        this.gpuHistoryIndex = 0;

        // Current Frame Aggregations
        this.currentMetrics = {
            fps: 0,
            frameTime: 0,
            gpuTime: 0,
            memoryBytes: 0,
            drawCalls: 0,
            physicsTime: 0,
            workerLatency: 0,
            bottleneck: 'UNKNOWN'
        };

        // Long-term stats for batch upload
        this.batchIntervalMs = 60000; // 60 seconds
        this.lastBatchTime = performance.now();
        this.aggregatedBatch = {
            frameTimeP50: 0,
            frameTimeP99: 0,
            gpuTimeP50: 0,
            gpuTimeP99: 0,
            totalMemoryAvg: 0,
            gcSpikeCount: 0,
            stalls: 0
        };
    }

    recordFrame(cpuTimeMs, gpuTimeMs) {
        // Ring buffer logic
        this.frameHistory[this.frameHistoryIndex] = cpuTimeMs;
        this.frameHistoryIndex = (this.frameHistoryIndex + 1) % this.frameHistory.length;

        if (gpuTimeMs > 0) {
            this.gpuHistory[this.gpuHistoryIndex] = gpuTimeMs;
            this.gpuHistoryIndex = (this.gpuHistoryIndex + 1) % this.gpuHistory.length;
        }

        this.currentMetrics.frameTime = cpuTimeMs;
        this.currentMetrics.gpuTime = gpuTimeMs;
        this.currentMetrics.fps = 1000 / (cpuTimeMs || 16.66);

        this._determineBottleneck();
        this._checkBatchUpload();
    }

    updateMetrics(metrics) {
        Object.assign(this.currentMetrics, metrics);
    }

    _determineBottleneck() {
        // Skill Activated: documentation-and-adrs
        // Heuristics for determining bottlenecks:
        // 1. If Frame Time > 16.6 and GPU time < 10 -> CPU Bound (Logic/Draw Calls)
        // 2. If GPU Time > 15 -> GPU Bound (Fillrate/Shaders)
        // 3. If physics/worker > 10 -> Simulation Bound
        
        const { frameTime, gpuTime, physicsTime } = this.currentMetrics;

        if (gpuTime > 15.0) {
            this.currentMetrics.bottleneck = 'GPU Bound (Fillrate/Shaders)';
        } else if (physicsTime > 10.0) {
            this.currentMetrics.bottleneck = 'Simulation Bound (Physics Worker)';
        } else if (frameTime > 16.6) {
            this.currentMetrics.bottleneck = 'CPU Bound (Main Thread)';
        } else {
            this.currentMetrics.bottleneck = 'Stable';
        }
    }

    _checkBatchUpload() {
        const now = performance.now();
        if (now - this.lastBatchTime > this.batchIntervalMs) {
            this._processBatch(now);
        }
    }

    _processBatch(now) {
        // Skill Activated: spec-driven-development
        // Process percentile data and dump to navigator.sendBeacon safely.
        try {
            const sortedFrames = Float32Array.from(this.frameHistory).sort();
            const p50Index = Math.floor(sortedFrames.length * 0.50);
            const p99Index = Math.floor(sortedFrames.length * 0.99);

            const payload = {
                timestamp: Date.now(),
                frameP50: sortedFrames[p50Index],
                frameP99: sortedFrames[p99Index],
                memory: this.currentMetrics.memoryBytes,
                bottleneck: this.currentMetrics.bottleneck
            };

            // Non-blocking send
            if (navigator.sendBeacon) {
                // In production, this would point to an actual observability endpoint
                // navigator.sendBeacon('/api/telemetry', JSON.stringify(payload));
            }
            
            this.lastBatchTime = now;
        } catch (e) {
            // Skill Activated: error-handling-patterns
            // Explicitly handle failure so telemetry doesn't crash the engine
            console.warn("Telemetry batch processing failed", e);
        }
    }

    getMetrics() {
        return this.currentMetrics;
    }
}
