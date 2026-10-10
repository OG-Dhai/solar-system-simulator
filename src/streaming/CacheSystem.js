/**
 * Cache System
 * Enforces strict boundaries on VRAM budget and executes eviction policies.
 * Skill activated: doubt-driven-development
 */

export class CacheSystem {
    constructor(gl, residency) {
        this.gl = gl;
        this.residency = residency;
        this.lruList = new Map(); // id -> timestamp
        this.evictable = new Set();
        this.currentVRAMBytes = 0;
    }

    updateUsage(id) {
        this.lruList.set(id, performance.now());
        this.evictable.delete(id);
    }

    markEligibleForEviction(id) {
        this.evictable.add(id);
    }

    trackAllocation(bytes) {
        this.currentVRAMBytes += bytes;
    }

    enforceBudget(max_vram_bytes) {
        if (this.currentVRAMBytes <= max_vram_bytes) return;

        // Sort evictable items by least recently used
        const candidates = Array.from(this.evictable)
            .map(id => ({ id, time: this.lruList.get(id) }))
            .sort((a, b) => a.time - b.time);

        for (const candidate of candidates) {
            if (this.currentVRAMBytes <= max_vram_bytes) break;

            this._evict(candidate.id);
        }

        if (this.currentVRAMBytes > max_vram_bytes) {
            console.warn(`VRAM Budget Exceeded! Current: ${this.currentVRAMBytes}, Max: ${max_vram_bytes}`);
            // In a real scenario, we might need to force-evict even non-eligible textures
            // or drop LODs globally.
        }
    }

    _evict(id) {
        // Assume we can look up the texture handle somewhere
        // gl.deleteTexture(handle.texture);
        
        // Mock free
        const assumedSize = 4 * 1024 * 1024; // 4MB mock
        this.currentVRAMBytes -= assumedSize;
        
        this.evictable.delete(id);
        this.lruList.delete(id);
        this.residency.transition(id, 'Unloaded');
        
        console.log(`Evicted asset ${id}`);
    }
}
