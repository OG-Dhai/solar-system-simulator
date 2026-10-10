/**
 * Streaming Queue
 * Throttles concurrent loading and decompression tasks to prevent stalling.
 * Sorts pending requests by visibility and distance priority.
 * Skill activated: incremental-implementation
 */

export class StreamingQueue {
    constructor(workerPool) {
        this.workerPool = workerPool;
        this.pendingRequests = []; // Array of { id, priority, handle }
        this.activeRequests = new Set();
        this.MAX_CONCURRENT_REQUESTS = 4;
    }

    enqueue(request) {
        this.pendingRequests.push(request);
        // Sort highest priority first
        this.pendingRequests.sort((a, b) => b.priority - a.priority);
    }

    updatePriority(id, newPriority) {
        const req = this.pendingRequests.find(r => r.id === id);
        if (req) {
            req.priority = newPriority;
            this.pendingRequests.sort((a, b) => b.priority - a.priority);
        }
    }

    /**
     * Called every frame. Dispatches pending requests if we have capacity.
     */
    tick(budget_ms) {
        // Start new requests if we have available worker slots
        while (this.activeRequests.size < this.MAX_CONCURRENT_REQUESTS && this.pendingRequests.length > 0) {
            const request = this.pendingRequests.shift();
            this._dispatchRequest(request);
        }
    }

    async _dispatchRequest(request) {
        this.activeRequests.add(request.id);
        try {
            // Offload to Web Worker pool for file I/O and decompression
            const rawData = await this.workerPool.loadAndTranscode(request.id);
            
            // Mark RAM resident, but still needs GPU upload
            request.handle.cpuData = rawData;
            
            // Notify system it's ready for upload
            // Usually we fire an event or directly tell the residency/upload system
            document.dispatchEvent(new CustomEvent('AssetRAMResident', { detail: request }));

        } catch (err) {
            console.error(`Failed to load asset ${request.id}`, err);
            // Handle error, maybe retry or mark as failed
        } finally {
            this.activeRequests.delete(request.id);
        }
    }
}
