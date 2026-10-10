/**
 * @fileoverview Titan implementation.
 * @module Saturn_Titan
 */

import * as THREE from 'three';
import { MoonBase } from './MoonBase.js';
import { createAtmosphereMesh, updateAtmosphereUniforms } from '../shaders/AtmosphereShader.js';

export class Saturn_Titan extends MoonBase {
    constructor(data, key, parent) {
        super(data, key, parent);
        this.atmosphereMesh = null;
        this.createAtmosphere();
    }

    createAtmosphere() {
        // Skip the complex atmosphere shader that might be causing visibility issues
        // this.atmosphereMesh = createAtmosphereMesh(this.radius, {
        //     segments: 32,
        //     atmosphereScale: 1.05,
        //     rayleighCoefficients: new THREE.Vector3(1.0, 0.4, 0.05)
        // });
        // this.group.add(this.atmosphereMesh);

        // Instead, use a reliable standard material for visibility
        if (this.mesh.material) {
            this.mesh.material.roughness = 0.9;  // Very rough surface
            this.mesh.material.metalness = 0.05; // Non metallic
            this.mesh.material.emissive = new THREE.Color(0x111111); // Minimal emissive for visibility
            this.mesh.material.emissiveIntensity = 0.05; // Low self-illumination for visibility
        }
    }

    update(visualDt, simTime, speed, camera) {
        super.update(visualDt, simTime, speed, camera);
        if (this.atmosphereMesh) {
            const worldPos = new THREE.Vector3().copy(this.group.position);
            if (this.parent && this.parent.group) {
                worldPos.add(this.parent.group.position);
            }
            updateAtmosphereUniforms(this.atmosphereMesh, new THREE.Vector3(0, 0, 0), worldPos);
        }
    }

    dispose() {
        if (this.atmosphereMesh) {
            this.atmosphereMesh.geometry.dispose();
            this.atmosphereMesh.material.dispose();
        }
        super.dispose();
    }
}
