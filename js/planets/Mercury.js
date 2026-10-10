/**
 * @fileoverview Merkur-Implementierung.
 * @module Mercury
 */

import * as THREE from 'three';
import { PlanetBase } from './PlanetBase.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';

export class Mercury extends PlanetBase {
    constructor(data, key, quality, solarSystem) {
        super(data, key, quality, solarSystem);
    }

    initMaterial(data) {
        // Eltern aufrufen um Standard-Material, Schatten und Defaults einzurichten
        super.initMaterial(data);

        // Merkur-Spezifika: Hohe Rauheit, Bump-Map aus Textur hinzugefügt
        this.mesh.material.roughness = 0.9;
        this.mesh.material.metalness = 0.0;

        // Bump/Relief hinzufügen falls Textur verfügbar
        if (data.texture) {
            const texName = data.texture.replace('textures/', '').replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(t => {
                if (this._isDisposed) return;
                // Base-Map bereits durch super.initMaterial gesetzt, aber hier Bump hinzufügen
                this.mesh.material.bumpMap = t;
                this.mesh.material.bumpScale = 0.02; // Subtile Kraterbildung
                this.mesh.material.needsUpdate = true;
            });
        }
    }
}
