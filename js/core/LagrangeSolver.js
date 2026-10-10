/**
 * @fileoverview Analytical solver for Lagrange Points (L1-L5).
 * Calculates the equilibrium points in the Restricted Three-Body Problem (CR3BP).
 * 
 * The solver uses the Hill Sphere and Roche Lobe approximations for
 * fast, real-time performance suitable for 60FPS simulation.
 * 
 * @module LagrangeSolver
 */

import * as THREE from 'three';
import { Logger } from '../utils/Logger.js';

export class LagrangeSolver {
    /**
     * Validate input parameters for Lagrange calculations
     * @private
     * @param {THREE.Vector3} pos1 - Primary body position
     * @param {THREE.Vector3} pos2 - Secondary body position
     * @param {number} m1 - Primary mass
     * @param {number} m2 - Secondary mass
     * @returns {boolean} True if inputs are valid
     */
    static _validateInputs(pos1, pos2, m1, m2) {
        if (!pos1 || !pos2) {
            Logger.warn('LagrangeSolver', 'Invalid positions (null or undefined)');
            return false;
        }
        if (typeof pos1.distanceTo !== 'function' || typeof pos2.clone !== 'function') {
            Logger.warn('LagrangeSolver', 'Positions must be THREE.Vector3 instances');
            return false;
        }
        if (!Number.isFinite(m1) || !Number.isFinite(m2) || m1 <= 0 || m2 <= 0) {
            Logger.warn('LagrangeSolver', 'Invalid masses (must be positive finite numbers)');
            return false;
        }
        return true;
    }

    static _safeDefault() {
        return new THREE.Vector3(0, 0, 0);
    }

    static calculateL1(pos1, pos2, m1, m2) {
        if (!this._validateInputs(pos1, pos2, m1, m2)) return this._safeDefault();

        const R = pos1.distanceTo(pos2);
        if (R === 0) return pos1.clone();

        const direction = new THREE.Vector3().subVectors(pos2, pos1).normalize();
        const factor = Math.cbrt(m2 / (3 * m1));
        const distFromSecondary = R * factor;

        return pos2.clone().sub(direction.multiplyScalar(distFromSecondary));
    }

    static calculateL2(pos1, pos2, m1, m2) {
        if (!this._validateInputs(pos1, pos2, m1, m2)) return this._safeDefault();

        const R = pos1.distanceTo(pos2);
        if (R === 0) return pos1.clone();

        const direction = new THREE.Vector3().subVectors(pos2, pos1).normalize();
        const factor = Math.cbrt(m2 / (3 * m1));
        const distFromSecondary = R * factor;

        return pos2.clone().add(direction.multiplyScalar(distFromSecondary));
    }

    static calculateL3(pos1, pos2, m1, m2) {
        if (!this._validateInputs(pos1, pos2, m1, m2)) return this._safeDefault();

        const R = pos1.distanceTo(pos2);
        if (R === 0) return pos1.clone();

        const direction = new THREE.Vector3().subVectors(pos1, pos2).normalize();
        const distFromPrimary = R * (1 - (7 * m2) / (12 * m1));

        return pos1.clone().add(direction.multiplyScalar(distFromPrimary));
    }

    static calculateL4(pos1, pos2) {
        if (!pos1 || !pos2) return this._safeDefault();

        const vec = new THREE.Vector3().subVectors(pos2, pos1);
        const axis = new THREE.Vector3(0, 1, 0);
        vec.applyAxisAngle(axis, Math.PI / 3);

        return pos1.clone().add(vec);
    }

    static calculateL5(pos1, pos2) {
        if (!pos1 || !pos2) return this._safeDefault();

        const vec = new THREE.Vector3().subVectors(pos2, pos1);
        const axis = new THREE.Vector3(0, 1, 0);
        vec.applyAxisAngle(axis, -Math.PI / 3);

        return pos1.clone().add(vec);
    }

    static calculateAllPoints(pos1, pos2, m1, m2) {
        return {
            l1: this.calculateL1(pos1, pos2, m1, m2),
            l2: this.calculateL2(pos1, pos2, m1, m2),
            l3: this.calculateL3(pos1, pos2, m1, m2),
            l4: this.calculateL4(pos1, pos2),
            l5: this.calculateL5(pos1, pos2)
        };
    }
}
