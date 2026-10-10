/**
 * @fileoverview Jupiter's moon Europa with ice crack surface effect.
 *
 * Europa features:
 * - Icy surface with extensive crack networks (lineae)
 * - Brownish-red cracks from subsurface ocean material
 * - Smooth ice plains between crack systems
 * - High surface reflectivity (albedo ~0.67)
 *
 * @module Jupiter_Europa
 */

import * as THREE from 'three';
import { MoonBase } from './MoonBase.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import {
    createEuropaShaderMaterial,
    updateEuropaUniforms,
    setEuropaTexture
} from '../shaders/MoonShader.js';

export class Jupiter_Europa extends MoonBase {
    constructor(data, key, parent) {
        super(data, key, parent);
        this.europaTime = 0;

        this.initEuropaMaterial(data);
    }

    /**
     * Initialize Europa's reliable standard material
     */
    initEuropaMaterial(data) {
        // Use reliable MeshStandardMaterial instead of complex shader
        const europaMaterial = new THREE.MeshStandardMaterial({
            color: 0xdce0e8,  // Europa's characteristic icy blue-white color
            roughness: 0.9,
            metalness: 0.05,
            emissive: 0x111111,  // Minimal emissive for visibility
            emissiveIntensity: 0.05,  // Very low self-illumination for visibility
            transparent: false,
            opacity: 1.0
        });

        this.mesh.material.dispose();
        this.mesh.material = europaMaterial;

        // Ensure material is not transparent
        this.mesh.material.transparent = false;
        this.mesh.material.opacity = 1.0;

        // Load base texture for standard material
        if (data.texture) {
            const texName = data.texture.replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(tex => {
                if (this._isDisposed) return;
                tex.colorSpace = THREE.SRGBColorSpace;
                this.mesh.material.map = tex;
                this.mesh.material.needsUpdate = true;
            });
        }
    }

    update(visualDt, simTime, speed, camera) {
        super.update(visualDt, simTime, speed, camera);

        // Update shader time for animated effects
        this.europaTime += visualDt * 0.1; // Slow animation

        // Calculate world position for lighting
        const worldPos = new THREE.Vector3();
        this.mesh.getWorldPosition(worldPos);

        // Sun is at origin
        const sunPosition = new THREE.Vector3(0, 0, 0);

        if (this.mesh.material?.uniforms) {
            updateEuropaUniforms(this.mesh.material, this.europaTime, sunPosition, camera);
        }
    }
}
