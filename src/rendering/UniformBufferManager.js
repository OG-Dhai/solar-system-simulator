/**
 * Manages Uniform Buffer Objects (UBOs) for batched state updates.
 * Replaces singular CPU-bound gl.uniform* calls with high-speed GPU block transfers.
 */
export class UniformBufferManager {
    /**
     * @param {WebGL2RenderingContext} gl 
     */
    constructor(gl) {
        if (!gl) throw new Error('[UniformBufferManager] WebGL2RenderingContext is required.');
        this.gl = gl;
        
        /** @type {Map<string, {buffer: WebGLBuffer, bindingPoint: number, size: number, data: Float32Array}>} */
        this.buffers = new Map();
        
        this._nextBindingPoint = 0;
    }

    /**
     * Registers a new Uniform Buffer Object (UBO).
     * @param {string} name - The uniform block name.
     * @param {number} sizeBytes - The size of the struct/block in bytes.
     * @returns {number} The assigned binding point.
     */
    createBuffer(name, sizeBytes) {
        if (this.buffers.has(name)) {
            return this.buffers.get(name).bindingPoint;
        }

        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, buffer);
        
        // DYNAMIC_DRAW because uniforms are expected to be updated frequently (per-frame or per-batch)
        this.gl.bufferData(this.gl.UNIFORM_BUFFER, sizeBytes, this.gl.DYNAMIC_DRAW);
        this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, null);

        const bindingPoint = this._nextBindingPoint++;
        
        this.buffers.set(name, {
            buffer,
            bindingPoint,
            size: sizeBytes,
            data: new Float32Array(sizeBytes / 4) // Typed view for CPU-side packing
        });

        // Bind the buffer base to the assigned binding point
        this.gl.bindBufferBase(this.gl.UNIFORM_BUFFER, bindingPoint, buffer);

        return bindingPoint;
    }

    /**
     * Updates a sub-region of a uniform buffer block.
     * @param {string} name - The uniform block name.
     * @param {Float32Array} floatData - The data to upload.
     * @param {number} [offsetBytes=0] - Offset in the GPU buffer.
     */
    updateBufferData(name, floatData, offsetBytes = 0) {
        const block = this.buffers.get(name);
        if (!block) {
            console.error(`[UniformBufferManager] Cannot update unknown buffer: ${name}`);
            return;
        }

        this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, block.buffer);
        // Upload directly to GPU memory mapping
        this.gl.bufferSubData(this.gl.UNIFORM_BUFFER, offsetBytes, floatData);
        this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, null);
    }

    /**
     * Binds a compiled WebGLProgram's uniform block to the appropriate binding point.
     * This establishes the connection between the shader and the UBO.
     * @param {WebGLProgram} program 
     * @param {string} blockName 
     */
    bindProgramBlock(program, blockName) {
        const block = this.buffers.get(blockName);
        if (!block) {
            console.warn(`[UniformBufferManager] Cannot bind program to unknown block: ${blockName}`);
            return;
        }

        const blockIndex = this.gl.getUniformBlockIndex(program, blockName);
        if (blockIndex !== this.gl.INVALID_INDEX) {
            this.gl.uniformBlockBinding(program, blockIndex, block.bindingPoint);
        }
    }

    /**
     * Helper to retrieve CPU-side backing array for packing data before an upload.
     * @param {string} name 
     * @returns {Float32Array|null}
     */
    getBackingArray(name) {
        const block = this.buffers.get(name);
        return block ? block.data : null;
    }
}
