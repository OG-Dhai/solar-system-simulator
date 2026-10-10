/**
 * Observability System - Render Diagnostics
 * Skill Activated: code-review-and-quality
 * Tracks draw calls and state changes without inflating CPU overhead via proxies.
 */

export class RenderDiagnostics {
    constructor(coordinator) {
        this.coordinator = coordinator;
        
        // Reset per frame
        this.currentDrawCalls = 0;
        this.currentTriangles = 0;
        this.currentShaderBinds = 0;
    }

    reset() {
        this.coordinator.updateMetrics({ drawCalls: this.currentDrawCalls });
        
        this.currentDrawCalls = 0;
        this.currentTriangles = 0;
        this.currentShaderBinds = 0;
    }

    // Explicit manual counters used in the hot path
    recordDrawCall(triangleCount) {
        this.currentDrawCalls++;
        this.currentTriangles += triangleCount;
    }

    recordShaderBind() {
        this.currentShaderBinds++;
    }
}
