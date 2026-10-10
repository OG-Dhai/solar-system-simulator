/**
 * @fileoverview Base class for planetary ring systems.
 * @module RingsBase
 */

import * as THREE from 'three';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';

export class RingsBase extends THREE.Group {
    constructor(data, planetRadius) {
        super();
        this.data = data;
        this.planetRadius = planetRadius;
        this.mesh = null;
        this.init();
    }

    init() {
        if (!this.data) return;
        // Basic ring creation logic
        const innerRadius = this.planetRadius * (this.data.innerRadius || 1.2);
        const outerRadius = this.planetRadius * (this.data.outerRadius || 2.3);

        const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);
        this.fixUVs(geometry, innerRadius, outerRadius);

        const material = this.createMaterial();
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.add(this.mesh);
    }

    createMaterial() {
        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            transparent: true,
            opacity: this.data.opacity || 0.8,
            depthWrite: false,
            color: this.data.color || 0xffffff
        });

        if (this.data.texture) {
            loadTexture(this.data.texture.replace('.webp', '').replace('.png', '')).then(tex => {
                material.map = tex;
                material.needsUpdate = true;
            });
        }
        return material;
    }

    fixUVs(geometry, innerRadius, outerRadius) {
        const pos = geometry.attributes.position;
        const uv = geometry.attributes.uv;
        const v3 = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v3.fromBufferAttribute(pos, i);
            const dist = v3.length();
            const u = (dist - innerRadius) / (outerRadius - innerRadius);
            uv.setXY(i, u, 0.5);
        }
        uv.needsUpdate = true;
    }

    update(dt) {
        // Rotation or shader updates
    }
}
