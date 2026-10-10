/**
 * Asset Manager
 * Implements strict API contracts for asset streaming ownership, ref-counting,
 * and high-level request aggregation.
 * Skill activated: spec-driven-development
 */

export class AssetHandle {
    constructor(id) {
        this.id = id;
        this.isReady = false;
        this.data = null; // Populated when fully resident
    }
}

export class AssetManager {
    constructor(queue, cache, residency) {
        this.queue = queue;
        this.cache = cache;
        this.residency = residency;
        
        // Metadata tracking
        this.assets = new Map(); // id -> { handle, refCount }
    }

    /**
     * Request an asset. If it's already resident or streaming, 
     * it bumps the ref count and returns the shared handle.
     */
    requestAsset(id, priority) {
        let record = this.assets.get(id);

        if (record) {
            record.refCount++;
            // Update priority in the queue if it's still streaming
            this.queue.updatePriority(id, priority);
            return record.handle;
        }

        // It's a new request
        const handle = new AssetHandle(id);
        this.assets.set(id, { handle, refCount: 1 });

        // Notify cache it's actively used
        this.cache.updateUsage(id);

        // Check residency state, if unloaded, enqueue it
        if (this.residency.getState(id) === 'Unloaded') {
            this.queue.enqueue({ id, priority, handle });
        } else {
            // Already resident in Cache but refCount was 0 (about to be evicted)
            // Restore its state immediately
            this.residency.restore(id, handle);
        }

        return handle;
    }

    /**
     * Release an asset. Decrements ref-count. If 0, it tells the Cache
     * system that it is eligible for eviction.
     */
    releaseAsset(handle) {
        const record = this.assets.get(handle.id);
        if (!record) return;

        record.refCount--;
        if (record.refCount <= 0) {
            this.assets.delete(handle.id);
            // Notify the cache and residency systems that it can be evicted
            this.cache.markEligibleForEviction(handle.id);
        }
    }
}
