/**
 * @fileoverview Leistungskonfiguration für die Sonnensystem-Simulation.
 * Bietet zentralisierte Leistungsoptimierungsparameter und Qualitätsvoreinstellungen.
 * @module PerformanceConfig
 *
 * Referenz: https://threejs.org/docs/#api/en/renderers/WebGLRenderer
 */
import { Logger } from './Logger.js';

/**
 * Qualitätsvoreinstellungs-Definitionen für verschiedene Hardware-Fähigkeiten.
 * Alle Konfigurationswerte sind hier zentralisiert - Komponenten erhalten diese via DI.
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
        particleLimits: 8000,  // Partikellimit für Ringe
        shadowMapSize: 1024,
        description: 'Integrierte Grafik, Low-End Laptops'
    },
    MEDIUM: {
        sphereSegments: 48,
        bloomResolutionScale: 0.5,
        shadowMapType: 'PCFShadowMap',
        maxPixelRatio: 1.5,
        antialias: 'FXAA',
        particleLimits: 30000,
        shadowMapSize: 2048,
        description: 'Mittelklasse-GPUs, Gaming-Laptops'
    },
    HIGH: {
        sphereSegments: 64,
        bloomResolutionScale: 0.5,
        shadowMapType: 'PCFSoftShadowMap',
        maxPixelRatio: 2,
        antialias: 'FXAA',
        particleLimits: 60000,
        shadowMapSize: 4096,
        description: 'Dedizierte GPUs (GTX 1060+, RX 580+)'
    },
    ULTRA: {
        sphereSegments: 64,
        bloomResolutionScale: 1.0,
        shadowMapType: 'PCFSoftShadowMap',
        maxPixelRatio: 2,
        antialias: 'MSAA',
        particleLimits: 100000,
        shadowMapSize: 4096,
        description: 'High-End GPUs (RTX Serie, RX 6000+)'
    }
});

/**
 * Standard-Qualitätsstufe für die Simulation.
 * @type {string}
 */
export const DEFAULT_QUALITY = 'MEDIUM';

/**
 * Automatische GPU-Fähigkeitserkennung und Rückgabe der passenden Qualitätsvoreinstellung.
 * Verwendet WEBGL_debug_renderer_info zur GPU-Identifikation.
 * 
 * @returns {Object} Qualitätsvoreinstellung passend zur erkannten GPU-Fähigkeit
 */
// Cache für WebGL-Kontext um mehrfache Kontexterstellung zu vermeiden
let webglContextCache = null;
let cachedQuality = null;

export function getAutoQuality() {
    // Gecachte Qualität zurückgeben falls bereits ermittelt
    if (cachedQuality) {
        return cachedQuality;
    }

    try {
        // Bestehenden Kontext wiederverwenden falls verfügbar, sonst neuen erstellen
        if (!webglContextCache) {
            const canvas = document.createElement('canvas');
            // Minimale Größe setzen um Ressourcenverbrauch zu reduzieren
            canvas.width = 1;
            canvas.height = 1;
            webglContextCache = canvas.getContext('webgl') || canvas.getContext('webgl2');
        }

        if (!webglContextCache) {
            Logger.warn('PerformanceConfig', 'WebGL nicht verfügbar, verwende LOW Qualität');
            cachedQuality = QUALITY_PRESETS.LOW;
            return cachedQuality;
        }

        const debugInfo = webglContextCache.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) {
            Logger.info('PerformanceConfig', 'GPU-Erkennung nicht verfügbar, verwende MEDIUM Qualität');
            cachedQuality = QUALITY_PRESETS.MEDIUM;
            return cachedQuality;
        }

        const renderer = webglContextCache.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        Logger.info('PerformanceConfig', `Erkannte GPU - ${renderer}`);

        // High-End dedizierte GPUs
        if (/RTX|RX 6[0-9]|RX 7[0-9]|Arc A[0-9]|Radeon Pro/i.test(renderer)) {
            cachedQuality = QUALITY_PRESETS.HIGH;
            return cachedQuality;
        }

        // Mittelklasse-GPUs
        if (/GTX 1[0-9]|GTX 9[0-9]|RX 5[0-9]|Vega/i.test(renderer)) {
            cachedQuality = QUALITY_PRESETS.MEDIUM;
            return cachedQuality;
        }

        // Mobile/integrierte Grafik
        if (/Intel|Integrated|UHD|Iris|Mali|Adreno|Apple M/i.test(renderer)) {
            // Apple M-Serie ist leistungsfähig
            if (/Apple M[1-9]/i.test(renderer)) {
                cachedQuality = QUALITY_PRESETS.HIGH;
                return cachedQuality;
            }
            cachedQuality = QUALITY_PRESETS.LOW;
            return cachedQuality;
        }

        // Standard MEDIUM für unbekannte GPUs
        cachedQuality = QUALITY_PRESETS.MEDIUM;
        return cachedQuality;

    } catch (error) {
        Logger.warn('PerformanceConfig', 'GPU-Erkennung fehlgeschlagen', error);
        cachedQuality = QUALITY_PRESETS.MEDIUM;
        return cachedQuality;
    }
}

/**
 * Funktion zum Leeren des Caches bei Bedarf (z.B. beim Beenden der Anwendung)
 */
export function clearQualityCache() {
    if (webglContextCache) {
        // Versuchen den WebGL-Kontext freizugeben falls möglich
        const extension = webglContextCache.getExtension('WEBGL_lose_context');
        if (extension) {
            extension.loseContext();
        }
        webglContextCache = null;
    }
    cachedQuality = null;
}

/**
 * Gibt eine bestimmte Qualitätsvoreinstellung nach Namen zurück.
 * 
 * @param {string} presetName - Name der Voreinstellung (LOW, MEDIUM, HIGH, ULTRA)
 * @returns {Object|null} Qualitätsvoreinstellung oder null falls nicht gefunden
 */
export function getQualityPreset(presetName) {
    const normalized = String(presetName).toUpperCase();
    return QUALITY_PRESETS[normalized] || null;
}

/**
 * Validiert ob eine Qualitätsvoreinstellung alle erforderlichen Eigenschaften hat.
 * 
 * @param {Object} preset - Zu validierendes Preset-Objekt
 * @returns {boolean} True falls gültig
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
 * Konvertiert Shadow-Map-Typ-String in THREE-Konstantenwert.
 * 
 * @param {string} typeName - Shadow-Map-Typ-Name aus Preset ('BasicShadowMap', etc.)
 * @returns {number} THREE Shadow-Map-Typ Konstante
 */
export function getShadowMapTypeValue(typeName) {
    const shadowMapTypes = {
        'BasicShadowMap': 0,      // THREE.BasicShadowMap
        'PCFShadowMap': 1,        // THREE.PCFShadowMap
        'PCFSoftShadowMap': 2,    // THREE.PCFSoftShadowMap
        'VSMShadowMap': 3         // THREE.VSMShadowMap
    };
    return shadowMapTypes[typeName] ?? 0; // Standard ist BasicShadowMap
}

export default {
    QUALITY_PRESETS,
    DEFAULT_QUALITY,
    getAutoQuality,
    getQualityPreset,
    isValidPreset,
    getShadowMapTypeValue
};
