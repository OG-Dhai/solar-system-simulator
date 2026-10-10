/**
 * @fileoverview Venus-Implementierung.
 * @module Venus
 */

import * as THREE from 'three';
import { PlanetBase } from './PlanetBase.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { createVenusAtmosphereMesh, updateAtmosphereUniforms } from '../shaders/AtmosphereShader.js';
import { Logger } from '../utils/Logger.js';

export class Venus extends PlanetBase {
    constructor(data, key, quality, solarSystem) {
        super(data, key, quality, solarSystem);
        this.venusOpacityMesh = null;
        this.venusAtmosphereMesh = null;
        this.venusAtmosphereRotationSpeed = 30.0; // Von 5.0 auf 30.0 erhöht um Rotation sichtbar zu machen

        // Material mit Textur initialisieren (Elternmethode aufrufen)
        this.initMaterial(data);

        if (data.atmosphere) {
            this.createVenusAtmosphereLayer(data);
        }
    }

    initMaterial(data) {
        // Eltern-initMaterial aufrufen um Texturladen zu behandeln
        super.initMaterial(data);

        // Zusätzliches Venus-spezifisches Material-Setup kann hier erfolgen
    }

    createVenusAtmosphereLayer(data) {
        // Schicht 1: Basistextur mit atmosphärischer Opazität
        const opacityGeo = new THREE.SphereGeometry(this.radius * 1.005, 48, 48);
        const opacityMat = new THREE.MeshStandardMaterial({
            color: 0xffeebb,
            depthWrite: true,
            roughness: 1.0,
            metalness: 0.0,
            transparent: true,
            opacity: 0.7  // Teilweise transparent machen um Basistextur darunter zu zeigen
        });

        // Basistextur auf Opazitäts-Mesh anwenden falls verfügbar
        if (data.texture) {
            const texName = data.texture.replace('textures/', '').replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(t => {
                if (this._isDisposed) return;
                t.colorSpace = THREE.SRGBColorSpace;
                opacityMat.map = t;
                opacityMat.needsUpdate = true;
            }).catch(err => {
                Logger.warn('Venus', `Textur konnte nicht geladen werden für Opazitäts-Mesh: ${texName}`, err);
            });
        }

        this.venusOpacityMesh = new THREE.Mesh(opacityGeo, opacityMat);
        this.venusOpacityMesh.renderOrder = 0;
        this.tiltGroup.add(this.venusOpacityMesh);

        // Schicht 2: Rayleigh
        try {
            this.venusAtmosphereMesh = createVenusAtmosphereMesh(this.radius, {
                segments: 48,
                atmosphereScale: 1.03
            });
            this.tiltGroup.add(this.venusAtmosphereMesh);
        } catch (e) {
            Logger.warn('Venus', 'Atmosphären-Shader fehlgeschlagen', e);
        }
    }

    update(visualDt, simTime, speed, camera) {
        super.update(visualDt, simTime, speed, camera);

        if (this.venusAtmosphereMesh) {
            const rotationSpeed = (2 * Math.PI) / ((this.data.rotationPeriod) * 3600);
            const rot = rotationSpeed * visualDt * speed * this.venusAtmosphereRotationSpeed;

            if (this.venusOpacityMesh) this.venusOpacityMesh.rotation.y += rot;

            updateAtmosphereUniforms(this.venusAtmosphereMesh, new THREE.Vector3(0, 0, 0), this.group.position, camera);
        }
    }

    dispose() {
        if (this.venusOpacityMesh) {
            this.venusOpacityMesh.geometry.dispose();
            this.venusOpacityMesh.material.dispose();
        }
        if (this.venusAtmosphereMesh) {
            this.venusAtmosphereMesh.geometry.dispose();
            this.venusAtmosphereMesh.material.dispose();
        }
        super.dispose();
    }
}
