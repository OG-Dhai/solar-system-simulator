/**
 * @fileoverview Barrel-Export für Infrastruktur-Module
 * @module infrastructure
 */

export { Logger, log, warn, error, debug } from './Logger.js';
export { getAutoQuality, PerformanceConfig } from './PerformanceConfig.js';
export {
    EnhancedTextureLoader,
    loadTexture,
    TEXTURE_CDN_URLS_8K,
    TEXTURE_CDN_URLS_2K,
    LOCAL_TEXTURE_PATHS,
    FALLBACK_COLORS
} from './EnhancedTextureLoader.js';
export { EclipseSystem } from './EclipseSystem.js';
export { LagrangeVisualizer } from './LagrangeVisualizer.js';
