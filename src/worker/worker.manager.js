import { Opcodes, MAX_ENTITIES } from './worker.protocol.js';

class RingBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffers = [];
    }

    push(item) {
        this.buffers.push(item);
    }

    isFull() {
        return this.buffers.length >= this.capacity;
    }

    popOldest() {
        return this.buffers.shift();
    }
    
    get latest() {
        return this.buffers[this.buffers.length - 1];
    }
    
    get previous() {
        return this.buffers[this.buffers.length - 2];
    }
}

// Simple Result pattern for explicit error handling
export const Result = {
    Ok: (value) => ({ ok: true, value }),
    Err: (error) => ({ ok: false, error })
};

export class PhysicsWorkerManager {
    constructor(context) {
        // Assume context is injected
        this.context = context;
        this.worker = null;
        this.snapshots = new RingBuffer(3); // Keep last 3 buffers for interp
        this.lastHeartbeat = Date.now();
        this.watchdogInterval = null;
        this.onReady = null;
        
        // 10 floats per entity = 40 bytes. + 2 floats for header.
        this.bufferSize = (2 + MAX_ENTITIES * 10) * 4; 
    }

    initWorker(initialState = null) {
        if (this.worker) {
            this.worker.terminate();
        }

        try {
            // Initialize Web Worker
            this.worker = new Worker(new URL('./physics.worker.js', import.meta.url), { type: 'module' });
            
            // Allocate two buffers for Ping-Pong Transferables
            const bufferA = new ArrayBuffer(this.bufferSize); 
            const bufferB = new ArrayBuffer(this.bufferSize);
            
            this.worker.onmessage = this.handleMessage.bind(this);
            this.worker.onerror = this.handleError.bind(this);
            
            // Handshake
            this.worker.postMessage({
                opcode: Opcodes.INIT,
                bufferA: bufferA,
                bufferB: bufferB,
                payload: { entityData: initialState }
            }, [bufferA, bufferB]); // Transfer initial ownership
            
            this.lastHeartbeat = Date.now();
            this.startWatchdog();
            
            return Result.Ok(true);
        } catch (err) {
            console.error("Failed to initialize PhysicsWorkerManager:", err);
            return Result.Err(err);
        }
    }

    handleMessage(event) {
        // Enforce explicit result pattern for incoming messages if applicable
        const { opcode, buffer, tick, error } = event.data;
        
        if (error) {
            console.error("Received explicit error from worker:", error);
            this.handleError(new Error(error));
            return;
        }

        switch (opcode) {
            case Opcodes.READY:
                if (this.onReady) this.onReady();
                break;
                
            case Opcodes.TICK_SYNC:
                if (!buffer) {
                    console.error("TICK_SYNC missing buffer payload.");
                    return;
                }
                this.snapshots.push(buffer);
                
                // Immediately return the oldest buffer back to the worker to handle backpressure
                if (this.snapshots.isFull()) {
                    const staleBuffer = this.snapshots.popOldest();
                    this.worker.postMessage({
                        opcode: Opcodes.RETURN_BUFFER,
                        buffer: staleBuffer
                    }, [staleBuffer]);
                }
                break;
                
            case Opcodes.HEARTBEAT:
                this.lastHeartbeat = Date.now();
                break;
        }
    }

    handleError(error) {
        console.error("Physics Worker Error handled via Result Pattern:", error);
        this.recoverWorker();
    }

    startWatchdog() {
        if (this.watchdogInterval) clearInterval(this.watchdogInterval);
        
        this.watchdogInterval = setInterval(() => {
            const now = Date.now();
            if (now - this.lastHeartbeat > 2000) { // 2 seconds without heartbeat
                console.warn("Physics Worker missed heartbeat. Restarting...");
                this.recoverWorker();
            }
        }, 1000);
    }

    recoverWorker() {
        // Extract last known state from the most recent snapshot if possible
        let lastKnownState = null;
        if (this.snapshots.latest) {
            // We would parse this.snapshots.latest into a readable state
            // lastKnownState = parseState(this.snapshots.latest);
        }
        
        const result = this.initWorker(lastKnownState);
        if (!result.ok) {
            console.error("Critical Failure: Worker recovery failed", result.error);
        }
    }

    terminate() {
        if (this.watchdogInterval) clearInterval(this.watchdogInterval);
        if (this.worker) this.worker.terminate();
    }
}
