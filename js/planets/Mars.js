/**
 * @fileoverview Mars-Implementierung mit dünner staubiger Atmosphäre.
 *
 * Mars-Eigenschaften:
 * - Sehr dünne Atmosphäre (~0,6% des Erddrucks)
 * - Rötlich-oranger Staubdunst (Eisenoxid-Partikel)
 * - Sichtbar am Rand und während Staubstürmen
 * - Polarkappen
 *
 * @module Mars
 */

import * as THREE from 'three';
import { PlanetBase } from './PlanetBase.js';
import { createMarsAtmosphereMesh, updateAtmosphereUniforms } from '../shaders/AtmosphereShader.js';

export class Mars extends PlanetBase {
    constructor(data, key, quality, solarSystem) {
        super(data, key, quality, solarSystem);
        this.atmosphereMesh = null;

        this.createMarsAtmosphere();
    }

    /**
     * Erstellt die dünne staubige Atmosphäre des Mars
     * Sehr subtiler Effekt - Marsatmosphäre ist fast unsichtbar außer am Rand
     */
    createMarsAtmosphere() {
        this.atmosphereMesh = createMarsAtmosphereMesh(this.radius, {
            segments: 48,
            atmosphereScale: 1.008 // Sehr dünne Atmosphäre
        });

        // Opazität reduzieren, da Marsatmosphäre extrem dünn ist
        this.atmosphereMesh.material.uniforms.rayleighCoefficients.value.multiplyScalar(0.3);

        this.tiltGroup.add(this.atmosphereMesh);
    }

    update(visualDt, simTime, speed, camera) {
        super.update(visualDt, simTime, speed, camera);

        // Atmosphären-Uniforms für Sonnenposition aktualisieren
        if (this.atmosphereMesh) {
            updateAtmosphereUniforms(
                this.atmosphereMesh,
                new THREE.Vector3(0, 0, 0), // Sonne am Ursprung
                this.group.position
            );
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
