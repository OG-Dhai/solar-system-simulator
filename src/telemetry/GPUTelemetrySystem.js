/**
 * Observability System - GPU Telemetry System
 * Skill Activated: doubt-driven-development
 * Collects GPU timing metrics using EXT_disjoint_timer_query.
 * Handles async readbacks and gracefully degrades if the extension is unavailable.
 */

export class GPUTelemetrySystem {
    constructor(gl, coordinator) {
        this.gl = gl;
        this.coordinator = coordinator;
        
        // Doubt-Driven Development: Always check for extension availability
        this.ext = gl.getExtension('EXT_disjoint_timer_query');
        if (!this.ext) {
            this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        }
        
        this.isSupported = !!this.ext;
        
        if (this.isSupported) {
            this.queryPool = [];
            this.activeQueries = [];
        } else {
            console.warn("GPUTelemetrySystem: EXT_disjoint_timer_query not supported. GPU metrics will be unavailable.");
        }
    }

    beginFrame() {
        if (!this.isSupported) return;

        let query = this.queryPool.pop();
        if (!query) {
            query = this.gl.createQuery();
        }

        this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
        this.activeQueries.push({ query, active: true });
    }

    endFrame() {
        if (!this.isSupported || this.activeQueries.length === 0) return;

        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        const currentQuery = this.activeQueries[this.activeQueries.length - 1];
        currentQuery.active = false;
        
        this._resolveQueries();
    }

    _resolveQueries() {
        // Resolve completed queries asynchronously to avoid stalling the pipeline
        for (let i = 0; i < this.activeQueries.length; i++) {
            const q = this.activeQueries[i];
            if (q.active) continue;

            const available = this.gl.getQueryParameter(q.query, this.gl.QUERY_RESULT_AVAILABLE);
            const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);

            if (available && !disjoint) {
                // Time is in nanoseconds, convert to milliseconds
                const timeNano = this.gl.getQueryParameter(q.query, this.gl.QUERY_RESULT);
                const timeMs = timeNano / 1000000.0;
                
                this.coordinator.updateMetrics({ gpuTime: timeMs });

                // Return to pool and remove from active
                this.queryPool.push(q.query);
                this.activeQueries.splice(i, 1);
                i--;
            } else if (available && disjoint) {
                // Disjoint occurred (e.g. GPU throttling), discard result
                this.queryPool.push(q.query);
                this.activeQueries.splice(i, 1);
                i--;
            }
        }
    }
}
