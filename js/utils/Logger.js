/**
 * @fileoverview Strukturiertes Logging-Dienstprogramm für die Anwendung.
 * Ersetzt direkte Konsolennutzung um Filterung, Formatierung und Produktionsmodi zu ermöglichen.
 * @module Logger
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Konfiguration - kann über Query-Parameter oder Build-Umgebung gesteuert werden
const CURRENT_LEVEL = LOG_LEVELS.INFO;

export const Logger = {
    /**
     * Debug-Informationen protokollieren (ausführlich)
     * @param {string} component - Komponentenname
     * @param {string} message - Protokollnachricht
     * @param {...any} args - Zusätzliche Daten
     */
    debug: (component, message, ...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
            console.debug(`[${component}] 🔧 ${message}`, ...args);
        }
    },

    /**
     * Allgemeine Informationen protokollieren
     * @param {string} component - Komponentenname
     * @param {string} message - Protokollnachricht
     * @param {...any} args - Zusätzliche Daten
     */
    info: (component, message, ...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
            console.info(`[${component}] ℹ️ ${message}`, ...args);
        }
    },

    /**
     * Warnungen protokollieren
     * @param {string} component - Komponentenname
     * @param {string} message - Warnungsnachricht
     * @param {...any} args - Zusätzliche Daten
     */
    warn: (component, message, ...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
            console.warn(`[${component}] ⚠️ ${message}`, ...args);
        }
    },

    /**
     * Fehler protokollieren
     * @param {string} component - Komponentenname
     * @param {string} message - Fehlernachricht
     * @param {...any} args - Zusätzliche Daten
     */
    error: (component, message, ...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
            console.error(`[${component}] ❌ ${message}`, ...args);
        }
    }
};
