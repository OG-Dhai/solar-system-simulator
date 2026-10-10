/**
 * Worker Pool
 * Handles background file I/O and decompression (e.g. Basis Universal).
 * Built for robust error recovery in case of network failures or missing files.
 * Skill activated: debugging-and-error-recovery
 */

export class WorkerPool {
    constructor(size = navigator.hardwareConcurrency || 4) {
        this.size = size;
        this.workers = [];
        this.initPool();
    }

    initPool() {
        for (let i = 0; i < this.size; i++) {
            // Note: In reality, we'd load a dedicated worker script.
            // const worker = new Worker(new URL('./transcodeWorker.js', import.meta.url));
            
            // Mock worker
            const worker = {
                id: i,
                busy: false,
                transcode: async (assetId) => {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            // Simulate network failure or corruption
                            if (Math.random() < 0.01) {
                                reject(new Error(`Failed to fetch or decode asset ${assetId}`));
                            } else {
                                // Mock 4MB raw buffer
                                resolve(new ArrayBuffer(4 * 1024 * 1024));
                            }
                        }, 50); // Simulate 50ms async work
                    });
                }
            };
            this.workers.push(worker);
        }
    }

    async loadAndTranscode(assetId) {
        // Find an idle worker
        const worker = this.workers.find(w => !w.busy);
        if (!worker) {
            throw new Error('No available workers (this should be prevented by the StreamingQueue limits)');
        }

        worker.busy = true;
        try {
            const data = await worker.transcode(assetId);
            return data;
        } catch (error) {
            console.error(`[WorkerPool Error] Recovery needed for ${assetId}:`, error);
            throw error; // Let StreamingQueue handle retry/abortion
        } finally {
            worker.busy = false;
        }
    }
}
