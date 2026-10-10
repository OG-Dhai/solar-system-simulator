/**
 * @fileoverview Neptun-Implementierung mit tiefblauem atmosphärischem Dunst.
 *
 * Neptun-Eigenschaften:
 * - Höchste Methankonzentration der Eisriesen (tieferes Blau als Uranus)
 * - Aktive Wettersysteme (Großer Dunkler Fleck, Scooter-Wolken)
 * - Schnellste Winde im Sonnensystem (bis zu 2.100 km/h)
 * - Starke atmosphärische Dynamik trotz Entfernung zur Sonne
 *
 * @module Neptune
 */

import * as THREE from 'three';
import { PlanetBase } from './PlanetBase.js';
import { createNeptuneAtmosphereMesh, updateAtmosphereUniforms } from '../shaders/AtmosphereShader.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { createGasGiantGlowMesh, updateGasGiantGlowUniforms } from '../shaders/GasGiantShader.js';

export class Neptune extends PlanetBase {
    constructor(data, key, quality, solarSystem) {
        super(data, key, quality, solarSystem);
        this.atmosphereMesh = null;
        this.glowMesh = null;

        this.initNeptuneMaterial(data);
        this.createNeptuneGlow();
    }

    /**
     * Neptun mit zuverlässigem Standardmaterial initialisieren
     */
    initNeptuneMaterial(data) {
        // Verwendet zuverlässiges MeshStandardMaterial anstatt komplexem Atmosphären-Shader
        const neptuneMaterial = new THREE.MeshStandardMaterial({
            color: 0x5b78c7,  // Charakteristische tiefblaue Farbe des Neptun
            roughness: 0.8,
            metalness: 0.1,
            emissive: 0x111111,  // Minimales Emissive für Sichtbarkeit
            emissiveIntensity: 0.05,  // Sehr geringe Selbstbeleuchtung für Sichtbarkeit
            transparent: false,
            opacity: 1.0
        });

        // Standardmaterial ersetzen
        this.mesh.material.dispose();
        this.mesh.material = neptuneMaterial;

        // Materialeigenschaften sicherstellen
        this.mesh.material.transparent = false;
        this.mesh.material.depthWrite = true;
        this.mesh.material.opacity = 1.0;

        // Textur laden falls verfügbar
        if (data.texture) {
            const texName = data.texture.replace('textures/', '').replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(tex => {
                if (this._isDisposed) return;
                tex.colorSpace = THREE.SRGBColorSpace;
                this.mesh.material.map = tex;
                this.mesh.material.needsUpdate = true;
            }).catch(err => {
                console.error(`Neptune: Textur konnte nicht geladen werden:`, texName, err);
            });
        }
    }

    /**
     * Erstellt Neptuns tiefblaue Methanatmosphäre
     */
    createNeptuneAtmosphere() {
        // Vorerst komplexen Atmosphären-Shader überspringen und nur das Hauptmesh verwenden
        // this.atmosphereMesh = createNeptuneAtmosphereMesh(this.radius, {
        //     segments: 48,
        //     atmosphereScale: 1.025
        // });
        // this.tiltGroup.add(this.atmosphereMesh);
    }

    /**
     * Erstellt äußeren atmosphärischen Schimmer
     */
    createNeptuneGlow() {
        // Tiefblauer Schimmer für Neptun
        const glowColor = new THREE.Color(0.3, 0.5, 0.9);
        this.glowMesh = createGasGiantGlowMesh(this.radius, glowColor, 1.04);
        this.glowMesh.name = 'neptune_glow';
        this.tiltGroup.add(this.glowMesh);
    }

    update(visualDt, simTime, speed, camera) {
        super.update(visualDt, simTime, speed, camera);

        const sunPosition = new THREE.Vector3(0, 0, 0);

        // Glow aktualisieren (Atmosphären-Shader-Updates überspringen)
        if (this.glowMesh) {
            updateGasGiantGlowUniforms(this.glowMesh, sunPosition, camera);
        }
    }

    dispose() {
        if (this.atmosphereMesh) {
            this.atmosphereMesh.geometry.dispose();
            this.atmosphereMesh.material.dispose();
        }
        if (this.glowMesh) {
            this.glowMesh.geometry.dispose();
            this.glowMesh.material.dispose();
        }
        super.dispose();
    }
}
