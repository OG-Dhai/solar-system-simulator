/**
 * @fileoverview Jupiter's moon Io with volcanic hotspot effects.
 *
 * Io features:
 * - Most volcanically active body in the solar system
 * - Over 400 active volcanoes
 * - Sulfur-covered surface (yellow, orange, red, white)
 * - Volcanic plumes up to 500 km high
 * - Lava lakes with temperatures up to 1,800°C
 *
 * Notable volcanoes simulated:
 * - Pele (persistent lava lake)
 * - Loki (largest volcanic depression)
 * - Prometheus (continuous eruption)
 * - Tvashtar (dramatic eruptions)
 *
 * @module Jupiter_Io
 */

import * as THREE from 'three';
import { MoonBase } from './MoonBase.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import {
    createIoShaderMaterial,
    updateIoUniforms,
    setIoTexture
} from '../shaders/MoonShader.js';

export class Jupiter_Io extends MoonBase {
    constructor(data, key, parent) {
        super(data, key, parent);
        this.ioTime = 0;

        this.initIoMaterial(data);
    }

    /**
     * Initialize Io's reliable standard material
     */
    initIoMaterial(data) {
        // Use reliable MeshStandardMaterial instead of complex shader
        const ioMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5c86d,  // Io's characteristic yellow/orange color
            roughness: 0.8,
            metalness: 0.1,
            emissive: 0x111111,  // Minimal emissive for visibility
            emissiveIntensity: 0.05,  // Very low self-illumination for visibility
            transparent: false,
            opacity: 1.0
        });

        this.mesh.material.dispose();
        this.mesh.material = ioMaterial;

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

        // Update shader time for volcanic animation
        this.ioTime += visualDt * speed * 0.01; // Moderate animation speed

        // Sun is at origin
        const sunPosition = new THREE.Vector3(0, 0, 0);

        if (this.mesh.material?.uniforms) {
            updateIoUniforms(this.mesh.material, this.ioTime, sunPosition, camera);
        }
    }
}
