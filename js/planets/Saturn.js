/**
 * @fileoverview Saturn-Implementierung mit Ringschatten-Projektion.
 * @module Saturn
 */
import * as THREE from 'three';
import { PlanetBase } from './PlanetBase.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { degToRad } from '../utils/Utils.js';
import { createGasGiantGlowMesh, updateGasGiantGlowUniforms } from '../shaders/GasGiantShader.js';

export class Saturn extends PlanetBase {
    constructor(data, key, quality, solarSystem) {
        super(data, key, quality, solarSystem);

        // Ringschatten-Konfiguration
        this.ringInnerRadius = data.rings?.innerRadius || 1.2;
        this.ringOuterRadius = data.rings?.outerRadius || 2.3;
        this.glowMesh = null;

        // Standardmaterial durch benutzerdefinierten Shader für Ringschatten ersetzen
        this.initRingShadowMaterial(data);
        this.createSaturnGlow();
    }

    /**
     * Erstellt äußeren atmosphärischen Schimmer für Saturn
     */
    createSaturnGlow() {
        // Warmer gold/beiger Schimmer für Saturn
        const glowColor = new THREE.Color(0.9, 0.8, 0.6);
        this.glowMesh = createGasGiantGlowMesh(this.radius, glowColor, 1.015);
        this.glowMesh.name = 'saturn_glow';
        this.tiltGroup.add(this.glowMesh);
    }

    // Überschreibt Eltern-initMaterial um Konflikte mit Custom-Shader zu vermeiden
    initMaterial(data) {
        // Eltern-Implementierung überspringen - Saturn verwendet eigenes ShaderMaterial
        // Der Shader wird stattdessen in initRingShadowMaterial initialisiert
    }

    initRingShadowMaterial(data) {
        // MeshStandardMaterial für konsistente Beleuchtung (Schatten, Terminator) wie bei der Erde
        const material = new THREE.MeshStandardMaterial({
            color: 0x665544,  // Abgedunkeltes Gold um Auswaschen zu verhindern (war 0xeadaa8)
            roughness: 1.0,   // Mattes Finish
            metalness: 0.0,
            emissive: 0x000000,
            emissiveIntensity: 0.0,
            transparent: false,
            opacity: 1.0,
            envMapIntensity: 0.0 // Keine Reflexionen
        });

        // Für Konsistenz speichern (obwohl wir jetzt auf StandardMaterial setzen)
        this.ringShadowMaterial = material;

        // Textur laden
        if (data.texture) {
            const texName = data.texture.replace('textures/', '').replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(tex => {
                if (this._isDisposed) return;
                tex.colorSpace = THREE.SRGBColorSpace;
                material.map = tex;
                material.needsUpdate = true;
            });
        }

        // Mesh-Material ersetzen
        if (this.mesh) {
            this.mesh.material.dispose();
            this.mesh.material = material;
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            // Materialeigenschaften sicherstellen
            this.mesh.material.transparent = false;
            this.mesh.material.depthWrite = true;
            this.mesh.material.opacity = 1.0;
        }
    }

    update(visualDt, simTime, speed, camera) {
        // Eltern-Update aufrufen
        super.update(visualDt, simTime, speed, camera);

        const sunPosition = new THREE.Vector3(0, 0, 0);

        // Ringschatten-Uniforms aktualisieren - NICHT MEHR NÖTIG (durch StandardMaterial-Schatten behandelt)
        /*
        if (this.ringShadowMaterial && this.ringShadowMaterial.uniforms) {
             // ... alte Logik entfernt ...
        }
        */

        // Glow aktualisieren
        if (this.glowMesh) {
            updateGasGiantGlowUniforms(this.glowMesh, sunPosition);
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
