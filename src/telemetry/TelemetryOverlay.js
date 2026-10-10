/**
 * Observability System - Telemetry Overlay
 * Skill Activated: performance-optimization
 * Renders a lightweight, zero-DOM-reflow canvas overlay for live debugging.
 */

export class TelemetryOverlay {
    constructor(coordinator) {
        this.coordinator = coordinator;
        
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '10px';
        this.canvas.style.left = '10px';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '9999';
        this.canvas.width = 300;
        this.canvas.height = 120;
        
        document.body.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    }

    render() {
        const metrics = this.coordinator.getMetrics();
        const ctx = this.ctx;
        
        // Background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Text configuration
        ctx.font = '12px monospace';
        ctx.textBaseline = 'top';
        
        // Left Column
        ctx.fillStyle = metrics.frameTime > 16.6 ? '#f55' : '#5f5';
        ctx.fillText(`FPS: ${metrics.fps.toFixed(1)}`, 10, 10);
        ctx.fillText(`CPU: ${metrics.frameTime.toFixed(2)}ms`, 10, 25);
        
        ctx.fillStyle = metrics.gpuTime > 16.6 ? '#f55' : '#88f';
        ctx.fillText(`GPU: ${metrics.gpuTime.toFixed(2)}ms`, 10, 40);
        
        ctx.fillStyle = '#ccc';
        ctx.fillText(`MEM: ${(metrics.memoryBytes / 1048576).toFixed(1)} MB`, 10, 55);
        
        // Right Column
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Draw Calls: ${metrics.drawCalls}`, 130, 10);
        ctx.fillText(`Physics: ${metrics.physicsTime.toFixed(2)}ms`, 130, 25);
        ctx.fillText(`Worker: ${metrics.workerLatency.toFixed(2)}ms`, 130, 40);
        
        // Bottleneck Warning
        ctx.fillStyle = metrics.bottleneck === 'Stable' ? '#5f5' : '#f55';
        ctx.fillText(`State: ${metrics.bottleneck}`, 10, 85);
    }
}
