/**
 * @fileoverview Barrel-Export für Steuerungs-Module
 * @module controls
 */

export { Camera as InputController } from './InputController.js';
// Alias für Rückwärtskompatibilität während der Übergangsphase
export { Camera } from './InputController.js';
