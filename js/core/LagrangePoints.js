/**
 * @fileoverview Visualization component for Lagrange Points.
 * Creates and updates the markers (L1-L5) for a given system (e.g., Earth-Moon).
 * 
 * @module LagrangePoints
 */

import * as THREE from 'three';
import { LagrangeSolver } from './LagrangeSolver.js';

export class LagrangePoints {
    constructor(primaryBody, secondaryBody, opts = {}) {
        this.primary = primaryBody;     // e.g., Earth
        this.secondary = secondaryBody; // e.g., Moon
        this.m1 = opts.m1 || 5.97e24;   // Earth mass
        this.m2 = opts.m2 || 7.35e22;   // Moon mass

        this.group = new THREE.Group();
        this.group.name = `LagrangePoints_${primaryBody.name}_${secondaryBody.name}`;

        this.markers = {};
        this.labels = {}; // Note: Simple sprites or CSS2D needed for text, using colored spheres for now

        // FIX #4: Store shared geometry reference for proper disposal
        // Issue: Same geometry disposed 5 times (once per marker)
        // Solution: Store reference, dispose only once
        // Severity: HIGH
        // Reference: LagrangePoints.js:37-50
        this._sharedGeometry = null;

        this.initMarkers();
    }

    initMarkers() {
        const points = ['l1', 'l2', 'l3', 'l4', 'l5'];
        const colors = {
            l1: 0xff4444, // Unstable (Red)
            l2: 0xff4444,
            l3: 0xff4444,
            l4: 0x44ff44, // Stable (Green)
            l5: 0x44ff44
        };

        // FIX #4: Store geometry reference for single disposal
        // VISUAL: Smaller markers (0.1 radius) for subtle scientific overlay
        this._sharedGeometry = new THREE.SphereGeometry(0.1, 12, 12);

        points.forEach(p => {
            const material = new THREE.MeshBasicMaterial({
                color: colors[p],
                transparent: true,
                opacity: 0.5,           // More transparent for cinematic look
                depthWrite: false       // Don't occlude stars behind
            });
            const mesh = new THREE.Mesh(this._sharedGeometry, material);
            mesh.scale.setScalar(1.0);  // Use geometry size directly
            mesh.userData = { id: p, type: 'lagrangePoint' };

            this.group.add(mesh);
            this.markers[p] = mesh;
        });

        // Hidden by default - toggle with Orbits button for clean cinematic view
        this.group.visible = false;
    }

    update() {
        if (!this.primary || !this.secondary) return;

        // Get current world positions (handling potential parent transforms)
        // Ideally use the orbital positions directly if available to avoid matrix update lags
        const p1 = this.primary.getPosition ? this.primary.getPosition() : this.primary.position;
        const p2 = this.secondary.getPosition ? this.secondary.getPosition() : this.secondary.position;

        // Calculate points
        const points = LagrangeSolver.calculateAllPoints(p1, p2, this.m1, this.m2);

        // Update markers
        Object.keys(points).forEach(key => {
            if (this.markers[key]) {
                this.markers[key].position.copy(points[key]);
            }
        });
    }

    getGroup() {
        return this.group;
    }

    setVisible(visible) {
        this.group.visible = visible;
    }

    dispose() {
        // FIX #4: Dispose shared geometry only once
        // Issue: Memory leak/WebGL errors from multiple disposals
        // Solution: Dispose shared geometry separately from per-marker materials
        if (this._sharedGeometry) {
            this._sharedGeometry.dispose();
            this._sharedGeometry = null;
        }

        // Dispose only materials (not geometry - already disposed above)
        Object.values(this.markers).forEach(m => {
            if (m.material) m.material.dispose();
        });
        this.markers = {};
    }
}
