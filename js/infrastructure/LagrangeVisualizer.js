/**
 * @fileoverview Lagrange Point Visualization System
 *
 * Renders the 5 Lagrange points (L1-L5) for planets in the solar system.
 * Uses instanced rendering for performance.
 *
 * Lagrange Points:
 * - L1: Between Sun and planet (unstable)
 * - L2: Beyond planet from Sun (unstable)
 * - L3: Opposite side of Sun from planet (unstable)
 * - L4: 60° ahead of planet in orbit (stable - Trojan asteroids)
 * - L5: 60° behind planet in orbit (stable - Trojan asteroids)
 *
 * @module LagrangeVisualizer
 */

import * as THREE from 'three';

export class LagrangeVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this.markers = new Map(); // planetKey -> { l1, l2, l3, l4, l5 meshes }
        this.labels = new Map(); // planetKey -> { l1, l2, l3, l4, l5 sprites }

        // Shared geometries and materials for performance
        this.markerGeometry = null;
        this.labelMaterials = {};

        this.initSharedAssets();
    }

    /**
     * Initialize shared geometries and materials
     */
    initSharedAssets() {
        // Small octahedron for L1, L2, L3 (unstable points)
        this.unstableGeometry = new THREE.OctahedronGeometry(0.3, 0);

        // Larger diamond for L4, L5 (stable points - Trojan positions)
        this.stableGeometry = new THREE.OctahedronGeometry(0.5, 0);

        // Materials with different colors per point type
        this.materials = {
            l1: new THREE.MeshBasicMaterial({
                color: 0xff6666, // Red - unstable
                transparent: true,
                opacity: 0.8
            }),
            l2: new THREE.MeshBasicMaterial({
                color: 0xff9966, // Orange - unstable
                transparent: true,
                opacity: 0.8
            }),
            l3: new THREE.MeshBasicMaterial({
                color: 0xffcc66, // Yellow - unstable
                transparent: true,
                opacity: 0.8
            }),
            l4: new THREE.MeshBasicMaterial({
                color: 0x66ff66, // Green - stable (leading Trojans)
                transparent: true,
                opacity: 0.9
            }),
            l5: new THREE.MeshBasicMaterial({
                color: 0x6666ff, // Blue - stable (trailing Trojans)
                transparent: true,
                opacity: 0.9
            })
        };

        // Create label textures
        this.createLabelTextures();
    }

    /**
     * Create text label textures for each Lagrange point
     */
    createLabelTextures() {
        const labels = ['L1', 'L2', 'L3', 'L4', 'L5'];

        labels.forEach(label => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, 64, 32);

            // Border
            ctx.strokeStyle = this.getLabelColor(label);
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, 62, 30);

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 32, 16);

            const texture = new THREE.CanvasTexture(canvas);
            this.labelMaterials[label.toLowerCase()] = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false
            });
        });
    }

    /**
     * Get label border color based on stability
     */
    getLabelColor(label) {
        const colors = {
            'L1': '#ff6666',
            'L2': '#ff9966',
            'L3': '#ffcc66',
            'L4': '#66ff66',
            'L5': '#6666ff'
        };
        return colors[label] || '#ffffff';
    }

    /**
     * Create or update Lagrange point markers for a planet
     * @param {string} planetKey - Planet identifier
     * @param {Object} lagrangePoints - Object with l1-l5 Vector3 positions
     * @param {number} scale - Scale factor based on planet's orbit size
     */
    updatePlanetLagrangePoints(planetKey, lagrangePoints, scale = 1) {
        if (!lagrangePoints) return;

        // Create markers if they don't exist
        if (!this.markers.has(planetKey)) {
            this.createMarkersForPlanet(planetKey, scale);
        }

        const markers = this.markers.get(planetKey);
        const labels = this.labels.get(planetKey);

        // Update positions
        const points = ['l1', 'l2', 'l3', 'l4', 'l5'];
        points.forEach(point => {
            if (lagrangePoints[point] && markers[point]) {
                markers[point].position.copy(lagrangePoints[point]);
                markers[point].visible = this.visible;

                // Update label position (offset slightly above marker)
                if (labels && labels[point]) {
                    labels[point].position.copy(lagrangePoints[point]);
                    labels[point].position.y += scale * 0.8;
                    labels[point].visible = this.visible;
                }
            }
        });
    }

    /**
     * Create marker meshes for a specific planet
     */
    createMarkersForPlanet(planetKey, scale) {
        const markers = {};
        const labels = {};

        const points = ['l1', 'l2', 'l3', 'l4', 'l5'];

        points.forEach(point => {
            // Choose geometry based on stability
            const isStable = point === 'l4' || point === 'l5';
            const geometry = isStable ? this.stableGeometry : this.unstableGeometry;

            // Create marker mesh
            const mesh = new THREE.Mesh(geometry, this.materials[point]);
            mesh.scale.setScalar(scale * 0.5);
            mesh.visible = false;
            mesh.name = `${planetKey}_${point}`;
            this.scene.add(mesh);
            markers[point] = mesh;

            // Create label sprite
            const sprite = new THREE.Sprite(this.labelMaterials[point]);
            sprite.scale.set(scale * 1.5, scale * 0.75, 1);
            sprite.visible = false;
            sprite.name = `${planetKey}_${point}_label`;
            this.scene.add(sprite);
            labels[point] = sprite;
        });

        this.markers.set(planetKey, markers);
        this.labels.set(planetKey, labels);
    }

    /**
     * Set visibility of all Lagrange point markers
     * @param {boolean} visible - Whether to show markers
     */
    setVisible(visible) {
        this.visible = visible;

        this.markers.forEach((markers) => {
            Object.values(markers).forEach(mesh => {
                mesh.visible = visible;
            });
        });

        this.labels.forEach((labels) => {
            Object.values(labels).forEach(sprite => {
                sprite.visible = visible;
            });
        });
    }

    /**
     * Toggle visibility
     * @returns {boolean} New visibility state
     */
    toggle() {
        this.setVisible(!this.visible);
        return this.visible;
    }

    /**
     * Update marker scales based on camera distance (LOD)
     * @param {THREE.Camera} camera - Active camera
     */
    updateLOD(camera) {
        if (!this.visible || !camera) return;

        this.markers.forEach((markers, planetKey) => {
            Object.entries(markers).forEach(([point, mesh]) => {
                const distance = camera.position.distanceTo(mesh.position);

                // Scale markers based on distance for consistent screen size
                const baseScale = distance * 0.01;
                const minScale = 0.1;
                const maxScale = 5.0;
                const scale = Math.max(minScale, Math.min(maxScale, baseScale));

                mesh.scale.setScalar(scale);

                // Update corresponding label scale
                const labels = this.labels.get(planetKey);
                if (labels && labels[point]) {
                    labels[point].scale.set(scale * 3, scale * 1.5, 1);
                }

                // Fade out when very far or very close
                const normalizedDist = distance / 100;
                let opacity = 1.0;
                if (normalizedDist > 50) {
                    opacity = Math.max(0, 1 - (normalizedDist - 50) / 50);
                } else if (normalizedDist < 1) {
                    opacity = normalizedDist;
                }

                mesh.material.opacity = opacity * 0.8;
            });
        });
    }

    /**
     * Dispose all resources
     */
    dispose() {
        this.markers.forEach((markers) => {
            Object.values(markers).forEach(mesh => {
                this.scene.remove(mesh);
            });
        });

        this.labels.forEach((labels) => {
            Object.values(labels).forEach(sprite => {
                this.scene.remove(sprite);
                sprite.material.map?.dispose();
                sprite.material.dispose();
            });
        });

        this.unstableGeometry.dispose();
        this.stableGeometry.dispose();

        Object.values(this.materials).forEach(mat => mat.dispose());
        Object.values(this.labelMaterials).forEach(mat => {
            mat.map?.dispose();
            mat.dispose();
        });

        this.markers.clear();
        this.labels.clear();
    }
}
