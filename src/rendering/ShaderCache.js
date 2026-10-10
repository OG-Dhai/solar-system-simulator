/**
 * @typedef {Object} ShaderVariantConfig
 * @property {string} id - Base identifier for the shader family.
 * @property {string} vertexSource - Raw GLSL vertex shader code.
 * @property {string} fragmentSource - Raw GLSL fragment shader code.
 * @property {Record<string, string|number|boolean>} defines - Preprocessor macros.
 */

/**
 * Manages asynchronous shader compilation, variant caching, and fallbacks.
 * Designed to prevent synchronous main-thread compilation stalls.
 */
export class ShaderCache {
    /**
     * @param {WebGL2RenderingContext} gl - The active WebGL2 context.
     */
    constructor(gl) {
        if (!gl) throw new Error('[ShaderCache] WebGL2RenderingContext is required.');
        this.gl = gl;
        
        /** @type {Map<string, WebGLProgram>} */
        this.programs = new Map();
        
        /** @type {Map<string, Promise<WebGLProgram>>} */
        this.pendingCompilations = new Map();
        
        // Initialize the fallback program immediately to guarantee safety
        this.fallbackProgram = this._compileFallbackProgram();
    }

    /**
     * Generates a deterministic hash for a shader variant based on its defines.
     * @param {ShaderVariantConfig} config
     * @returns {string}
     */
    generateVariantHash(config) {
        if (!config.defines || Object.keys(config.defines).length === 0) {
            return config.id;
        }
        
        const definesStr = Object.keys(config.defines)
            .sort()
            .map(key => `${key}=${config.defines[key]}`)
            .join(';');
            
        // FNV-1a simple hashing or string concatenation
        return `${config.id}::${definesStr}`;
    }

    /**
     * Prepends defines to the shader source.
     * @param {string} source 
     * @param {Record<string, string|number|boolean>} defines 
     * @returns {string}
     */
    _injectDefines(source, defines) {
        if (!defines) return source;
        const definesLines = Object.entries(defines)
            .map(([key, value]) => `#define ${key} ${value === true ? 1 : value === false ? 0 : value}`)
            .join('\n');
            
        // Inject right after the #version directive
        const versionMatch = source.match(/#version \d+ \w*\n?/);
        if (versionMatch) {
            return source.replace(versionMatch[0], `${versionMatch[0]}${definesLines}\n`);
        }
        return `${definesLines}\n${source}`;
    }

    /**
     * Synchronously compiles a shader object.
     * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
     * @param {string} source 
     * @returns {WebGLShader|null}
     */
    _compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        return shader;
    }

    /**
     * Asynchronously warms up a shader variant using KHR_parallel_shader_compile if available,
     * or standard compilation otherwise. Returns a promise resolving to the program.
     * @param {ShaderVariantConfig} config
     * @returns {Promise<WebGLProgram>}
     */
    async warmupVariant(config) {
        const hash = this.generateVariantHash(config);
        
        if (this.programs.has(hash)) {
            return this.programs.get(hash);
        }
        
        if (this.pendingCompilations.has(hash)) {
            return this.pendingCompilations.get(hash);
        }

        const compilePromise = new Promise((resolve) => {
            const vSource = this._injectDefines(config.vertexSource, config.defines);
            const fSource = this._injectDefines(config.fragmentSource, config.defines);

            const vShader = this._compileShader(this.gl.VERTEX_SHADER, vSource);
            const fShader = this._compileShader(this.gl.FRAGMENT_SHADER, fSource);

            const program = this.gl.createProgram();
            this.gl.attachShader(program, vShader);
            this.gl.attachShader(program, fShader);
            this.gl.linkProgram(program);

            // Using KHR_parallel_shader_compile if available
            const ext = this.gl.getExtension('KHR_parallel_shader_compile');
            
            const checkCompletion = () => {
                let isLinked = true;
                if (ext) {
                    isLinked = this.gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR);
                }
                
                if (isLinked) {
                    const linkStatus = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
                    if (!linkStatus) {
                        const info = this.gl.getProgramInfoLog(program);
                        console.error(`[ShaderCache] Program linking failed for variant ${hash}:\n${info}`);
                        // Clean up
                        this.gl.deleteShader(vShader);
                        this.gl.deleteShader(fShader);
                        this.gl.deleteProgram(program);
                        this.programs.set(hash, this.fallbackProgram);
                        resolve(this.fallbackProgram);
                        return;
                    }
                    
                    // Cleanup intermediate shaders
                    this.gl.deleteShader(vShader);
                    this.gl.deleteShader(fShader);
                    
                    this.programs.set(hash, program);
                    this.pendingCompilations.delete(hash);
                    resolve(program);
                } else {
                    // Check again next frame
                    requestAnimationFrame(checkCompletion);
                }
            };

            checkCompletion();
        });

        this.pendingCompilations.set(hash, compilePromise);
        return compilePromise;
    }

    /**
     * Retrieves a compiled program. If it's not ready, returns the fallback program.
     * @param {string} hash
     * @returns {WebGLProgram}
     */
    getProgram(hash) {
        const program = this.programs.get(hash);
        if (!program) {
            // Program is not compiled yet or not found, preventing stall
            return this.fallbackProgram;
        }
        return program;
    }

    /**
     * Compiles an un-fail-able magenta fallback shader.
     * @returns {WebGLProgram}
     */
    _compileFallbackProgram() {
        const vSource = `#version 300 es\nin vec4 position;\nuniform mat4 projectionMatrix;\nuniform mat4 modelViewMatrix;\nvoid main() { gl_Position = projectionMatrix * modelViewMatrix * position; }`;
        const fSource = `#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nvoid main() { fragColor = vec4(1.0, 0.0, 1.0, 1.0); }`; // Magenta
        
        const vShader = this._compileShader(this.gl.VERTEX_SHADER, vSource);
        const fShader = this._compileShader(this.gl.FRAGMENT_SHADER, fSource);
        const program = this.gl.createProgram();
        
        this.gl.attachShader(program, vShader);
        this.gl.attachShader(program, fShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error(`[ShaderCache] Critical failure: Fallback program failed to compile.`);
        }
        
        this.gl.deleteShader(vShader);
        this.gl.deleteShader(fShader);
        return program;
    }
}
