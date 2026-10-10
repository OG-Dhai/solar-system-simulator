/**
 * @typedef {Object} DrawCommand
 * @property {number} passId - 0: Pre-pass, 1: Opaque, 2: Transparent, 3: Post
 * @property {number} shaderId - Fast numeric mapping of shaderHash
 * @property {number} materialId - Fast numeric mapping of materialHash
 * @property {number} meshId - Fast numeric mapping of VAO/geometry
 * @property {number} instanceOffset - Offset in the global instance buffer
 * @property {number} instanceCount - Number of instances to draw
 */

/**
 * Manages the collection and strict sorting of draw commands to minimize GPU state changes.
 */
export class RenderQueue {
    constructor() {
        /** @type {DrawCommand[]} */
        this.commands = [];
        
        /** @type {Map<string, number>} */
        this._shaderIdMap = new Map();
        this._nextShaderId = 1;
        
        /** @type {Map<string, number>} */
        this._materialIdMap = new Map();
        this._nextMaterialId = 1;

        // Reusable comparison function to avoid GC overhead
        this._sortComparer = this._sortComparer.bind(this);
    }

    /**
     * Converts string hashes to fast numeric IDs for the sorting algorithm.
     * @param {string} shaderHash 
     * @returns {number}
     */
    _getFastShaderId(shaderHash) {
        if (this._shaderIdMap.has(shaderHash)) return this._shaderIdMap.get(shaderHash);
        const id = this._nextShaderId++;
        this._shaderIdMap.set(shaderHash, id);
        return id;
    }

    /**
     * @param {string} materialHash 
     * @returns {number}
     */
    _getFastMaterialId(materialHash) {
        if (this._materialIdMap.has(materialHash)) return this._materialIdMap.get(materialHash);
        const id = this._nextMaterialId++;
        this._materialIdMap.set(materialHash, id);
        return id;
    }

    /**
     * Pushes a new command into the queue for the current frame.
     * @param {number} passId 
     * @param {string} shaderHash 
     * @param {string} materialHash 
     * @param {number} meshId 
     * @param {number} instanceOffset 
     * @param {number} instanceCount 
     */
    pushCommand(passId, shaderHash, materialHash, meshId, instanceOffset, instanceCount) {
        this.commands.push({
            passId,
            shaderId: this._getFastShaderId(shaderHash),
            materialId: this._getFastMaterialId(materialHash),
            meshId,
            instanceOffset,
            instanceCount
        });
    }

    /**
     * Clears the command buffer. Should be called at the beginning of the frame.
     */
    clear() {
        this.commands.length = 0; // Truncate without reallocating
    }

    /**
     * Sorts the queued commands to minimize state changes.
     * Hierarchy: Pass -> Shader -> Material -> Mesh
     */
    sort() {
        this.commands.sort(this._sortComparer);
    }

    /**
     * @param {DrawCommand} a 
     * @param {DrawCommand} b 
     * @returns {number}
     */
    _sortComparer(a, b) {
        // 1. Pass (Opaque before Transparent)
        if (a.passId !== b.passId) return a.passId - b.passId;
        
        // 2. Shader (Minimize gl.useProgram)
        if (a.shaderId !== b.shaderId) return a.shaderId - b.shaderId;
        
        // 3. Material (Minimize gl.blendFunc, gl.bindTexture, etc.)
        if (a.materialId !== b.materialId) return a.materialId - b.materialId;
        
        // 4. Mesh (Minimize gl.bindVertexArray)
        return a.meshId - b.meshId;
    }

    /**
     * Optional radis-sort packing function if integer arrays are strictly needed for ultra-performance
     * (Currently JS JIT makes standard array sort sufficiently fast for < 10,000 items)
     * @param {DrawCommand} cmd
     * @returns {bigint}
     */
    _packSortKey(cmd) {
        // Example of a 64-bit packed sorting key
        return (BigInt(cmd.passId) << 48n) |
               (BigInt(cmd.shaderId) << 32n) |
               (BigInt(cmd.materialId) << 16n) |
               BigInt(cmd.meshId);
    }
}
