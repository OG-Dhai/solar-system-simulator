/**
 * @fileoverview Performance configuration for Solar System simulation.
 * Provides centralized performance tuning parameters and quality presets.
 * @module PerformanceConfig
 *
 * Reference: https://threejs.org/docs/#api/en/renderers/WebGLRenderer
 */
import { Logger } from './Logger.js';

/**
 * Quality preset definitions for different hardware capabilities.
 * All configuration values are centralized here - components receive these via DI.
 * @readonly
 * @enum {Object}
 */
export const QUALITY_PRESETS = Object.freeze({
    LOW: {
        sphereSegments: 32,
        bloomResolutionScale: 0.25,
        shadowMapType: 'BasicShadowMap',
        maxPixelRatio: 1,
        antialias: 'NONE',
        particleLimits: 8000,  // Particle count cap for rings
        shadowMapSize: 1024,
        description: 'Integrated graphics, low-end laptops'
    },
    MEDIUM: {
        sphereSegments: 48,
        bloomResolutionScale: 0.5,
        shadowMapType: 'PCFShadowMap',
        maxPixelRatio: 1.5,
        antialias: 'FXAA',
        particleLimits: 30000,
        shadowMapSize: 2048,
        description: 'Mid-range GPUs, gaming laptops'
    },
    HIGH: {
        sphereSegments: 64,
        bloomResolutionScale: 0.5,
        shadowMapType: 'PCFSoftShadowMap',
        maxPixelRatio: 2,
        antialias: 'FXAA',
        particleLimits: 60000,
        shadowMapSize: 4096,
        description: 'Dedicated GPUs (GTX 1060+, RX 580+)'
    },
    ULTRA: {
        sphereSegments: 64,
        bloomResolutionScale: 1.0,
        shadowMapType: 'PCFSoftShadowMap',
        maxPixelRatio: 2,
        antialias: 'MSAA',
        particleLimits: 100000,
        shadowMapSize: 4096,
        description: 'High-end GPUs (RTX series, RX 6000+)'
    }
});

/**
 * Default quality level for the simulation.
 * @type {string}
 */
export const DEFAULT_QUALITY = 'MEDIUM';

/**
 * Auto-detect GPU capability and return appropriate quality preset.
 * Uses WEBGL_debug_renderer_info to identify the GPU.
 * 
 * @returns {Object} Quality preset matching detected GPU capability
 */
// Cache for WebGL context to avoid creating multiple contexts
let webglContextCache = null;
let cachedQuality = null;

export function getAutoQuality() {
    // Return cached quality if already determined
    if (cachedQuality) {
        return cachedQuality;
    }

    try {
        // Reuse existing context if available, otherwise create a new one
        if (!webglContextCache) {
            const canvas = document.createElement('canvas');
            // Set minimal size to reduce resource usage
            canvas.width = 1;
            canvas.height = 1;
            webglContextCache = canvas.getContext('webgl') || canvas.getContext('webgl2');
        }

        if (!webglContextCache) {
            Logger.warn('PerformanceConfig', 'WebGL not available, using LOW quality');
            cachedQuality = QUALITY_PRESETS.LOW;
            return cachedQuality;
        }

        const debugInfo = webglContextCache.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) {
            Logger.info('PerformanceConfig', 'GPU detection unavailable, using MEDIUM quality');
            cachedQuality = QUALITY_PRESETS.MEDIUM;
            return cachedQuality;
        }

        const renderer = webglContextCache.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        Logger.info('PerformanceConfig', `Detected GPU - ${renderer}`);

        // High-end dedicated GPUs
        if (/RTX|RX 6[0-9]|RX 7[0-9]|Arc A[0-9]|Radeon Pro/i.test(renderer)) {
            cachedQuality = QUALITY_PRESETS.HIGH;
            return cachedQuality;
        }

        // Mid-range GPUs
        if (/GTX 1[0-9]|GTX 9[0-9]|RX 5[0-9]|Vega/i.test(renderer)) {
            cachedQuality = QUALITY_PRESETS.MEDIUM;
            return cachedQuality;
        }

        // Mobile/integrated graphics
        if (/Intel|Integrated|UHD|Iris|Mali|Adreno|Apple M/i.test(renderer)) {
            // Apple M-series are capable
            if (/Apple M[1-9]/i.test(renderer)) {
                cachedQuality = QUALITY_PRESETS.HIGH;
                return cachedQuality;
            }
            cachedQuality = QUALITY_PRESETS.LOW;
            return cachedQuality;
        }

        // Default to MEDIUM for unknown GPUs
        cachedQuality = QUALITY_PRESETS.MEDIUM;
        return cachedQuality;

    } catch (error) {
        Logger.warn('PerformanceConfig', 'GPU detection failed', error);
        cachedQuality = QUALITY_PRESETS.MEDIUM;
        return cachedQuality;
    }
}

// Function to clear the cache when needed (e.g., on application shutdown)
export function clearQualityCache() {
    if (webglContextCache) {
        // Attempt to free the WebGL context if possible
        const extension = webglContextCache.getExtension('WEBGL_lose_context');
        if (extension) {
            extension.loseContext();
        }
        webglContextCache = null;
    }
    cachedQuality = null;
}

/**
 * Get a specific quality preset by name.
 * 
 * @param {string} presetName - Name of the preset (LOW, MEDIUM, HIGH, ULTRA)
 * @returns {Object|null} Quality preset or null if not found
 */
export function getQualityPreset(presetName) {
    const normalized = String(presetName).toUpperCase();
    return QUALITY_PRESETS[normalized] || null;
}

/**
 * Validate that a quality preset has all required properties.
 * 
 * @param {Object} preset - Preset object to validate
 * @returns {boolean} True if valid
 */
export function isValidPreset(preset) {
    if (!preset || typeof preset !== 'object') return false;

    const requiredProps = [
        'sphereSegments',
        'bloomResolutionScale',
        'shadowMapType',
        'maxPixelRatio',
        'antialias',
        'antialias',
        'particleLimits',
        'shadowMapSize'
    ];

    return requiredProps.every(prop =>
        Object.prototype.hasOwnProperty.call(preset, prop)
    );
}

/**
 * Convert shadow map type string to THREE constant value.
 * 
 * @param {string} typeName - Shadow map type name from preset ('BasicShadowMap', etc.)
 * @returns {number} THREE shadow map type constant
 */
export function getShadowMapTypeValue(typeName) {
    const shadowMapTypes = {
        'BasicShadowMap': 0,      // THREE.BasicShadowMap
        'PCFShadowMap': 1,        // THREE.PCFShadowMap
        'PCFSoftShadowMap': 2,    // THREE.PCFSoftShadowMap
        'VSMShadowMap': 3         // THREE.VSMShadowMap
    };
    return shadowMapTypes[typeName] ?? 0; // Default to BasicShadowMap
}

export default {
    QUALITY_PRESETS,
    DEFAULT_QUALITY,
    getAutoQuality,
    getQualityPreset,
    isValidPreset,
    getShadowMapTypeValue
};
