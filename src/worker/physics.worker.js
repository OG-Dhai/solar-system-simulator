import { Opcodes, FIXED_TIMESTEP } from './worker.protocol.js';

class PhysicsEngine {
    constructor() {
        this.availableBuffers = [];
        this.currentTick = 0;
        this.lastHeartbeat = Date.now();
        this.isRunning = false;
        this.loopInterval = null;
        this.entityData = null;
    }

    init(initialState, buffers) {
        this.entityData = initialState;
        this.availableBuffers.push(...buffers);
        this.isRunning = true;
        
        self.postMessage({ opcode: Opcodes.READY });
        
        this.loopInterval = setInterval(() => this.fixedUpdate(), FIXED_TIMESTEP);
    }

    returnBuffer(buffer) {
        if (buffer) {
            this.availableBuffers.push(buffer);
        }
    }

    pause() {
        this.isRunning = false;
    }

    resume() {
        this.isRunning = true;
    }

    fixedUpdate() {
        if (!this.isRunning) return;
        
        // Heartbeat for watchdog
        const now = Date.now();
        if (now - this.lastHeartbeat > 500) {
            this.lastHeartbeat = now;
            self.postMessage({ opcode: Opcodes.HEARTBEAT, tick: this.currentTick });
        }

        if (this.availableBuffers.length === 0) {
            // Backpressure: Main thread is too slow, wait for buffer return
            return; 
        }
        
        this.currentTick++;
        
        // Pop a buffer to write to
        const buffer = this.availableBuffers.pop();
        const view = new Float32Array(buffer);
        
        // Header: [Tick, Timestamp, EntityCount, ...]
        view[0] = this.currentTick;
        view[1] = performance.now();
        
        // Transfer ownership to Main Thread
        self.postMessage({ 
            opcode: Opcodes.TICK_SYNC, 
            buffer: buffer 
        }, [buffer]);
    }
}

const engine = new PhysicsEngine();

self.onmessage = (event) => {
    const { opcode, payload, buffer, bufferA, bufferB } = event.data;

    switch (opcode) {
        case Opcodes.INIT:
            engine.init(payload?.entityData, [bufferA, bufferB].filter(Boolean));
            break;
            
        case Opcodes.RETURN_BUFFER:
            engine.returnBuffer(buffer);
            break;
            
        case Opcodes.PAUSE:
            engine.pause();
            break;
            
        case Opcodes.RESUME:
            engine.resume();
            break;
    }
};
