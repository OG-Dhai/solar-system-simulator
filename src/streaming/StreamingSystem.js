import { AssetManager } from './AssetManager.js';
import { StreamingQueue } from './StreamingQueue.js';
import { GPUUploadScheduler } from './GPUUploadScheduler.js';
import { TextureResidency, ResidencyState } from './TextureResidency.js';
import { CacheSystem } from './CacheSystem.js';
import { WorkerPool } from './WorkerPool.js';

/**
 * Streaming System
 * An ECS System that pumps the queues and enforces budgets every frame.
 */
export class StreamingSystem {
    constructor(gl) {
        this.workerPool = new WorkerPool();
        this.queue = new StreamingQueue(this.workerPool);
        this.scheduler = new GPUUploadScheduler(gl);
        this.residency = new TextureResidency();
        this.cache = new CacheSystem(gl, this.residency);
        this.manager = new AssetManager(this.queue, this.cache, this.residency);
        
        // Listen to events from the queue and scheduler
        document.addEventListener('AssetRAMResident', this.onAssetRAMResident.bind(this));
        document.addEventListener('AssetVRAMResident', this.onAssetVRAMResident.bind(this));

        // Constants
        this.MAX_UPLOAD_BYTES_PER_FRAME = 5 * 1024 * 1024; // 5MB per frame
        this.MAX_VRAM_BYTES = 512 * 1024 * 1024; // 512MB strict budget
    }

    onAssetRAMResident(e) {
        const req = e.detail;
        this.residency.transition(req.id, ResidencyState.RAM_RESIDENT);
        
        // Push it immediately to the upload scheduler
        this.residency.transition(req.id, ResidencyState.UPLOADING);
        this.scheduler.scheduleUpload(req);
    }

    onAssetVRAMResident(e) {
        const req = e.detail;
        this.residency.transition(req.id, ResidencyState.VRAM_RESIDENT);
        
        // The asset is fully resident and ready to be used by the renderer
        req.handle.isReady = true;
        
        // Track memory
        if (req.handle.cpuData) {
            this.cache.trackAllocation(req.handle.cpuData.byteLength);
            // Free the CPU data since it's on the GPU now
            req.handle.cpuData = null;
        }
    }

    /**
     * Executes every frame in the main loop.
     */
    update(dt) {
        // 1. Process CPU decompression and File I/O
        this.queue.tick(dt);

        // 2. Process PCI-e uploads to the GPU
        this.scheduler.pumpUploads(this.MAX_UPLOAD_BYTES_PER_FRAME);

        // 3. Enforce the strict VRAM budget, evicting if necessary
        this.cache.enforceBudget(this.MAX_VRAM_BYTES);
    }
}
