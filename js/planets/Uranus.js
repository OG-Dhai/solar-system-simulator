/**
 * @fileoverview Uranus-Implementierung mit cyan/blaugrünem atmosphärischem Dunst.
 *
 * Uranus-Eigenschaften:
 * - Methanatmosphäre absorbiert rotes Licht, reflektiert blaugrün
 * - Extreme Achsenneigung (98°) - rotiert auf der Seite
 * - Hochebenen-Dunstschichten
 * - Sehr subtile Bänderung im Vergleich zu Jupiter/Saturn
 *
 * @module Uranus
 */

import * as THREE from 'three';
import { PlanetBase } from './PlanetBase.js';
import { createUranusAtmosphereMesh, updateAtmosphereUniforms } from '../shaders/AtmosphereShader.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { createGasGiantGlowMesh, updateGasGiantGlowUniforms } from '../shaders/GasGiantShader.js';

export class Uranus extends PlanetBase {
    constructor(data, key, quality, solarSystem) {
        super(data, key, quality, solarSystem);
        this.atmosphereMesh = null;
        this.glowMesh = null;

        this.initUranusMaterial(data);
        this.createUranusGlow();
    }

    /**
     * Uranus mit zuverlässigem Standardmaterial initialisieren
     */
    initUranusMaterial(data) {
        // Verwendet zuverlässiges MeshStandardMaterial anstatt komplexem Atmosphären-Shader
        const uranusMaterial = new THREE.MeshStandardMaterial({
            color: 0x9bcbeb,  // Charakteristische blaugrüne Farbe des Uranus
            roughness: 0.8,
            metalness: 0.1,
            emissive: 0x111111,  // Minimales Emissive für Sichtbarkeit
            emissiveIntensity: 0.05,  // Sehr geringe Selbstbeleuchtung für Sichtbarkeit
            transparent: false,
            opacity: 1.0
        });

        // Standardmaterial ersetzen
        this.mesh.material.dispose();
        this.mesh.material = uranusMaterial;

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
                console.error(`Uranus: Textur konnte nicht geladen werden:`, texName, err);
            });
        }
    }

    /**
     * Erstellt Uranus' cyan/blaugrüne Methanatmosphäre
     */
    createUranusAtmosphere() {
        // Vorerst komplexen Atmosphären-Shader überspringen und nur das Hauptmesh verwenden
        // this.atmosphereMesh = createUranusAtmosphereMesh(this.radius, {
        //     segments: 48,
        //     atmosphereScale: 1.02
        // });
        // this.tiltGroup.add(this.atmosphereMesh);
    }

    /**
     * Erstellt äußeren atmosphärischen Schimmer
     */
    createUranusGlow() {
        // Cyan/blaugrüner Schimmer für Uranus
        const glowColor = new THREE.Color(0.5, 0.8, 0.85);
        this.glowMesh = createGasGiantGlowMesh(this.radius, glowColor, 1.04);
        this.glowMesh.name = 'uranus_glow';
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
