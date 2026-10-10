/**
 * @typedef {Object} MaterialState
 * @property {boolean} depthTest
 * @property {boolean} depthWrite
 * @property {boolean} blend
 * @property {number} srcBlend
 * @property {number} dstBlend
 * @property {boolean} cullFace
 * @property {number} cullFaceMode
 */

/**
 * @typedef {Object} MaterialConfig
 * @property {string} shaderHash - The ID/hash of the variant from the ShaderCache.
 * @property {MaterialState} state - WebGL state requirements.
 * @property {Record<string, number|number[]>} defaultUniforms - Baseline material uniforms.
 */

/**
 * Represents a pooled, immutable material configuration.
 */
export class Material {
    /**
     * @param {string} hash 
     * @param {MaterialConfig} config 
     */
    constructor(hash, config) {
        this.hash = hash;
        this.shaderHash = config.shaderHash;
        this.state = config.state;
        this.defaultUniforms = config.defaultUniforms || {};
    }
}

/**
 * Manages material instantiation, ensuring that identical configurations
 * resolve to the exact same Material instance in memory, preventing state duplication.
 */
export class MaterialPool {
    constructor() {
        /** @type {Map<string, Material>} */
        this.pool = new Map();
        
        // Internal counter to ensure unique IDs if a hash collision occurs (very rare)
        this._counter = 0;
    }

    /**
     * Generates a deterministic state hash for a material configuration.
     * @param {MaterialConfig} config 
     * @returns {string}
     */
    _hashConfig(config) {
        // Core state
        const s = config.state;
        const stateKey = `${s.depthTest ? 1 : 0}${s.depthWrite ? 1 : 0}${s.blend ? 1 : 0}-${s.srcBlend}-${s.dstBlend}-${s.cullFace ? 1 : 0}-${s.cullFaceMode}`;
        
        // Uniforms key - we only hash keys and scalar lengths to ensure structural identity
        let uniformKey = "";
        if (config.defaultUniforms) {
            const keys = Object.keys(config.defaultUniforms).sort();
            uniformKey = keys.map(k => {
                const v = config.defaultUniforms[k];
                const type = Array.isArray(v) || v.length ? `[${v.length}]` : 'scalar';
                return `${k}:${type}`;
            }).join(';');
        }

        return `MAT::${config.shaderHash}::${stateKey}::${uniformKey}`;
    }

    /**
     * Acquires a material from the pool, or creates it if it doesn't exist.
     * @param {MaterialConfig} config 
     * @returns {Material}
     */
    getMaterial(config) {
        if (!config.shaderHash) {
            throw new Error("[MaterialPool] Cannot acquire material without a valid shaderHash.");
        }

        const hash = this._hashConfig(config);

        if (this.pool.has(hash)) {
            return this.pool.get(hash);
        }

        const material = new Material(hash, config);
        this.pool.set(hash, material);
        
        return material;
    }

    /**
     * Applies the material's GPU pipeline state. This minimizes overhead
     * by skipping redundant calls if tracked externally.
     * @param {WebGL2RenderingContext} gl
     * @param {Material} material 
     */
    applyState(gl, material) {
        const s = material.state;
        
        // Depth
        if (s.depthTest) gl.enable(gl.DEPTH_TEST);
        else gl.disable(gl.DEPTH_TEST);
        
        gl.depthMask(s.depthWrite !== false); // Default to true

        // Blending
        if (s.blend) {
            gl.enable(gl.BLEND);
            gl.blendFunc(s.srcBlend || gl.SRC_ALPHA, s.dstBlend || gl.ONE_MINUS_SRC_ALPHA);
        } else {
            gl.disable(gl.BLEND);
        }

        // Culling
        if (s.cullFace) {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(s.cullFaceMode || gl.BACK);
        } else {
            gl.disable(gl.CULL_FACE);
        }
    }
}
