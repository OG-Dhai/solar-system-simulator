/**
 * @fileoverview Phobos implementation.
 * @module Mars_Phobos
 */

import * as THREE from 'three';
import { MoonBase } from './MoonBase.js';

export class Mars_Phobos extends MoonBase {
    constructor(data, key, parent) {
        super(data, key, parent);
        this._createIrregularGeometry();
    }

    _createIrregularGeometry() {
        Object.values(this.geometryCache).forEach(g => g.dispose());
        this.geometryCache = {};

        const baseGeometry = new THREE.DodecahedronGeometry(this.radius, 1);
        const seed = this.key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        const seededRandom = (x, y, z) => {
            const n = Math.sin(seed + x * 12.9898 + y * 78.233 + z * 43.758) * 43758.5453;
            return n - Math.floor(n);
        };

        const pos = baseGeometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const noise = seededRandom(x, y, z);
            const displacement = 0.8 + noise * 0.4;
            pos.setXYZ(i, x * displacement, y * displacement, z * displacement);
        }
        pos.needsUpdate = true;
        baseGeometry.computeVertexNormals();
        baseGeometry.computeBoundingSphere();

        this.geometryCache['HIGH'] = baseGeometry;
        this.geometryCache['MEDIUM'] = baseGeometry;
        this.geometryCache['LOW'] = baseGeometry;

        if (this.mesh) this.mesh.geometry = baseGeometry;
    }

    initMaterial(data) {
        super.initMaterial(data);
        this.mesh.material.flatShading = true;
        this.mesh.material.roughness = 1.0;
        this.mesh.material.metalness = 0.0;
        this.mesh.material.color = new THREE.Color(220 / 255, 180 / 255, 160 / 255);
        this.mesh.material.bumpMap = null; // No bump map for irregular geometry usually
    }
}
