/**
 * @fileoverview Saturn's moon Enceladus with ice plume particle system.
 *
 * Enceladus features:
 * - Highly reflective icy surface (highest albedo in solar system)
 * - Cryovolcanic plumes at south pole ("tiger stripes")
 * - Water ice particles ejected into space
 * - Source of Saturn's E ring
 * - Subsurface ocean confirmed by Cassini
 *
 * The plumes erupt from four parallel fractures called "tiger stripes":
 * - Alexandria, Cairo, Baghdad, Damascus sulci
 *
 * @module Saturn_Enceladus
 */

import * as THREE from 'three';
import { MoonBase } from './MoonBase.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import {
    createEnceladusPlumes,
    updateEnceladusPlumes
} from '../shaders/MoonShader.js';

export class Saturn_Enceladus extends MoonBase {
    constructor(data, key, parent) {
        super(data, key, parent);
        this.plumeSystem = null;
        this.enceladusTime = 0;

        this.initEnceladusSurface();
        this.createPlumes();
    }

    /**
     * Initialize Enceladus with reliable standard material
     */
    initEnceladusSurface() {
        // Replace the shader material with a reliable standard material
        const enceladusMaterial = new THREE.MeshStandardMaterial({
            color: 0xf0f5ff,  // Bright white ice color
            roughness: 0.95,  // Very rough ice surface
            metalness: 0.02,  // Very non-metallic
            emissive: 0x111111,  // Minimal emissive for visibility
            emissiveIntensity: 0.05,  // Very low self-illumination for visibility
            transparent: false,
            opacity: 1.0
        });

        // Replace the existing material
        this.mesh.material.dispose();
        this.mesh.material = enceladusMaterial;

        // Ensure material properties are correct
        this.mesh.material.transparent = false;
        this.mesh.material.depthWrite = true;
        this.mesh.material.opacity = 1.0;

        // Load texture if available
        if (this.data.texture) {
            const texName = this.data.texture.replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(tex => {
                if (this._isDisposed) return;
                tex.colorSpace = THREE.SRGBColorSpace;
                this.mesh.material.map = tex;
                this.mesh.material.needsUpdate = true;
            });
        }
    }

    /**
     * Create simplified plume effect (optional - can be disabled for performance)
     */
    createPlumes() {
        // For now, skip the complex particle system that might be causing blinking
        // this.plumeSystem = createEnceladusPlumes(this.radius);
        // this.plumeSystem.name = 'enceladus_plumes';
        // this.group.add(this.plumeSystem);

        // Instead, we can add a subtle glow effect if needed
    }

    update(visualDt, simTime, speed, camera) {
        super.update(visualDt, simTime, speed, camera);

        // Update moon rotation and position normally
        // Skip plume particle system updates to prevent blinking
    }

    dispose() {
        if (this.plumeSystem) {
            this.plumeSystem.geometry.dispose();
            this.plumeSystem.material.dispose();
            this.group.remove(this.plumeSystem);
        }
        super.dispose();
    }
}
