/**
 * @fileoverview Structured logging utility for the application.
 * Replaces direct console usage to allow filtering, formatting, and production modes.
 * @module Logger
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Configuration - can be controlled via query params or build env
const CURRENT_LEVEL = LOG_LEVELS.INFO;

export const Logger = {
    /**
     * Log debug information (verbose)
     * @param {string} component - Component name
     * @param {string} message - Log message
     * @param {...any} args - Additional data
     */
    debug: (component, message, ...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
            console.debug(`[${component}] 🔧 ${message}`, ...args);
        }
    },

    /**
     * Log general information
     * @param {string} component - Component name
     * @param {string} message - Log message
     * @param {...any} args - Additional data
     */
    info: (component, message, ...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
            console.info(`[${component}] ℹ️ ${message}`, ...args);
        }
    },

    /**
     * Log warnings
     * @param {string} component - Component name
     * @param {string} message - Warning message
     * @param {...any} args - Additional data
     */
    warn: (component, message, ...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
            console.warn(`[${component}] ⚠️ ${message}`, ...args);
        }
    },

    /**
     * Log errors
     * @param {string} component - Component name
     * @param {string} message - Error message
     * @param {...any} args - Additional data
     */
    error: (component, message, ...args) => {
        if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
            console.error(`[${component}] ❌ ${message}`, ...args);
        }
    }
};
