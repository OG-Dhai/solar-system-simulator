/**
 * @fileoverview Jupiter-Implementierung mit animierten atmosphärischen Bändern.
 *
 * Jupiter-Funktionen:
 * - Animierte turbulente atmosphärische Bänder
 * - Differenzielle Rotation (Äquator schneller als Pole)
 * - Simulation des Großen Roten Flecks
 * - Sturmwarnungen und Wirbel
 * - Atmosphärische Randverdunkelung
 *
 * @module Jupiter
 */

import * as THREE from 'three';
import { PlanetBase } from './PlanetBase.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import {
    createJupiterAtmosphereMaterial,
    createGasGiantGlowMesh,
    updateJupiterUniforms,
    updateGasGiantGlowUniforms,
    setJupiterTexture
} from '../shaders/GasGiantShader.js';

export class Jupiter extends PlanetBase {
    constructor(data, key, quality, solarSystem) {
        super(data, key, quality, solarSystem);
        this.glowMesh = null;
        this.jupiterTime = 0;
        this.debugCounter = 0; // Zähler für Debug-Logging

        this.initJupiterMaterial(data);
        this.createJupiterGlow();
    }

    /**
     * Materialinitialisierung mit zuverlässigem Standardmaterial überschreiben
     */
    initJupiterMaterial(data) {
        // Verwendet zuverlässiges MeshStandardMaterial anstatt komplexem Shader
        const jupiterMaterial = new THREE.MeshStandardMaterial({
            color: 0xd8ca9d,  // Charakteristische Farbe des Jupiters
            roughness: 0.7,
            metalness: 0.1,
            emissive: 0x111111,  // Minimales Emissive für Sichtbarkeit
            emissiveIntensity: 0.05,  // Sehr geringe Selbstbeleuchtung für Sichtbarkeit
            transparent: false,
            opacity: 1.0,
            side: THREE.FrontSide
        });

        this.mesh.material.dispose();
        this.mesh.material = jupiterMaterial;

        // Materialeigenschaften sicherstellen
        this.mesh.material.transparent = false;
        this.mesh.material.depthWrite = true;
        this.mesh.material.opacity = 1.0;

        // Textur für Standardmaterial laden
        if (data.texture) {
            const texName = data.texture.replace('textures/', '').replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(t => {
                if (this._isDisposed) return;
                t.colorSpace = THREE.SRGBColorSpace;
                this.mesh.material.map = t;
                this.mesh.material.needsUpdate = true;
            }).catch(err => {
                console.error(`Jupiter: Failed to load texture:`, texName, err);
            });
        }
    }

    /**
     * Erstellt äußeren atmosphärischen Schimmer für Jupiter
     */
    createJupiterGlow() {
        // Warmer orange-brauner Schimmer für Jupiter
        const glowColor = new THREE.Color(0.8, 0.65, 0.5);
        this.glowMesh = createGasGiantGlowMesh(this.radius, glowColor, 1.02);
        this.glowMesh.name = 'jupiter_glow';

        // Sicherstellen, dass Glow-Mesh korrekt für Transparenz konfiguriert ist
        if (this.glowMesh.material) {
            this.glowMesh.material.transparent = true;  // Glow sollte transparent sein
            this.glowMesh.material.depthWrite = false;  // Depth-Fighting verhindern
            this.glowMesh.material.blending = THREE.AdditiveBlending;  // Korrektes Blending
        }

        // Render-Reihenfolge: Glow wird nach dem Hauptplaneten gerendert
        if (this.mesh && this.glowMesh) {
            this.glowMesh.renderOrder = this.mesh.renderOrder + 1;
        }

        this.tiltGroup.add(this.glowMesh);
    }

    update(visualDt, simTime, speed, camera) {
        super.update(visualDt, simTime, speed, camera);

        // Jupiter-Shader-Zeit für animierte Bänder aktualisieren
        this.jupiterTime += visualDt * speed * 0.001; // Langsame Animation

        const sunPosition = new THREE.Vector3(0, 0, 0);

        // Hauptshader aktualisieren
        if (this.mesh.material?.uniforms) {
            updateJupiterUniforms(this.mesh.material, this.jupiterTime, sunPosition, camera);

            // Materialeigenschaften sicherstellen
            this.mesh.material.transparent = false;
            this.mesh.material.depthWrite = true;
        }

        // Glow aktualisieren
        if (this.glowMesh) {
            updateGasGiantGlowUniforms(this.glowMesh, sunPosition, camera);
        }
    }

    dispose() {
        if (this.glowMesh) {
            this.glowMesh.geometry.dispose();
            this.glowMesh.material.dispose();
        }
        super.dispose();
    }
}