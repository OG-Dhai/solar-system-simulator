/**
 * @fileoverview Erdimplementierung
 * 
 * Erweitert PlanetBase mit erdspezifischen Funktionen:
 * - Wolkenschicht mit unabhängiger Rotation
 * - Atmosphärenshader mit Rayleigh-Streuung
 * - Nachtbeleuchtung (Stadtlichter) basierend auf Sonnenpositioni
 * 
 * @module Earth
 * @author Sonnensystem-Simulation
 */

import * as THREE from 'three';
import { PlanetBase } from './PlanetBase.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { createAtmosphereMesh, updateAtmosphereUniforms } from '../shaders/AtmosphereShader.js';
import { Logger } from '../utils/Logger.js';

export class Earth extends PlanetBase {
    constructor(data, key, quality, solarSystem) {
        super(data, key, quality, solarSystem);
        this.cloudMesh = null;
        this.atmosphereMesh = null;
        this.cloudRotationSpeed = 1.1; // 10% schneller als Planet
        this.earthShader = null;  // Referenz für sunPosition-Aktualisierung

        this.createCloudLayer(data);
        this.createEarthAtmosphere();
    }

    /**
     * Initialisiert das Erdmaterial mit Tag/Nacht-Texturen
     * 
     * @param {Object} data - Erdkonfigurationsdaten
     */
    initMaterial(data) {
        if (!this.mesh.material) {
            this.mesh.material = new THREE.MeshStandardMaterial();
        }

        this.mesh.material.setValues({
            color: 0xffffff,
            roughness: 0.6,
            metalness: 0
        });

        // 1. Tageskarte laden
        loadTexture('earth').then(t => {
            if (this._isDisposed) return;
            t.colorSpace = THREE.SRGBColorSpace;
            this.mesh.material.map = t;
            this.mesh.material.needsUpdate = true;
        });

        // 2. Spekularkarte (Ozean-Reflexionen)
        loadTexture('earth_specular').then(t => {
            if (this._isDisposed) return;
            this.mesh.material.roughness = 0.4; // Durchschnittliche Rauheit
            this.mesh.material.needsUpdate = true;
        });

        // 3. Normalkarte (Geländedetails)
        loadTexture('earth_normal').then(t => {
            if (this._isDisposed) return;
            this.mesh.material.normalMap = t;
            this.mesh.material.normalScale = new THREE.Vector2(0.3, 0.3);
            this.mesh.material.needsUpdate = true;
        });

        // 4. Nachtlichter (Emissive) - Stadtbeleuchtung
        loadTexture('earth_night').then(t => {
            if (this._isDisposed) return;
            t.colorSpace = THREE.SRGBColorSpace;
            this.mesh.material.emissiveMap = t;
            this.mesh.material.emissive = new THREE.Color(0xffffcc);  // Warmes Weiß-Gelb für Stadtlichter
            this.mesh.material.emissiveIntensity = 2.0;  // Helle Stadtlichter
            this.mesh.material.needsUpdate = true;
        });

        // Benutzerdefinierte Shader-Logik für Tag/Nacht-Übergang
        this.mesh.material.onBeforeCompile = (shader) => {
            shader.uniforms.sunPosition = { value: new THREE.Vector3(0, 0, 0) };
            this.earthShader = shader;  // Referenz für spätere Aktualisierung speichern
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                varying vec3 vWorldNormal;
                varying vec3 vWorldPosition;`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform vec3 sunPosition;
                varying vec3 vWorldNormal;
                varying vec3 vWorldPosition;`
            );
            // Nachtlichter nur auf der Schattenseite anzeigen
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                vec3 lightDir = normalize(sunPosition - vWorldPosition);
                float sunFacing = dot(vWorldNormal, lightDir);
                float nightFactor = 1.0 - smoothstep(-0.2, 0.1, sunFacing);
                totalEmissiveRadiance *= nightFactor;`
            );
        };
    }

    /**
     * Erstellt die Wolkenschicht
     * 
     * Separate transparente Sphäre leicht über der Erdoberfläche
     * mit unabhängiger Rotationsgeschwindigkeit.
     * 
     * @param {Object} data - Erdkonfigurationsdaten
     */
    createCloudLayer(data) {
        const cloudGeometry = new THREE.SphereGeometry(this.radius * 1.01, 48, 48);
        const cloudMaterial = new THREE.MeshPhongMaterial({
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            blending: THREE.NormalBlending,
            side: THREE.FrontSide
        });

        this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        this.cloudMesh.castShadow = true;
        this.cloudMesh.renderOrder = 1;

        loadTexture('earth_clouds').then(t => {
            if (this._isDisposed) return;
            t.colorSpace = THREE.SRGBColorSpace;
            cloudMaterial.map = t;
            cloudMaterial.needsUpdate = true;
        });

        this.tiltGroup.add(this.cloudMesh);
    }

    /**
     * Erstellt die Erdatmosphäre
     * 
     * Verwendet Rayleigh-Streuungs-Shader für realistischen
     * blauen Atmosphärenglow am Planetenrand.
     */
    createEarthAtmosphere() {
        this.atmosphereMesh = createAtmosphereMesh(this.radius, {
            segments: 48,
            atmosphereScale: 1.025
        });
        this.tiltGroup.add(this.atmosphereMesh);
    }

    /**
     * Aktualisiert Erde pro Frame
     * 
     * @param {number} visualDt - Visuelle Delta-Zeit
     * @param {number} simTime - Simulationszeit in Sekunden
     * @param {number} speed - Zeitgeschwindigkeit
     * @param {THREE.Camera} camera - Aktive Kamera
     */
    update(visualDt, simTime, speed, camera) {
        super.update(visualDt, simTime, speed, camera);

        // Wolkenrotation (schneller als Planetenrotation)
        if (this.cloudMesh) {
            const rotationSpeed = (2 * Math.PI) / (24 * 3600);
            this.cloudMesh.rotation.y += rotationSpeed * visualDt * speed * this.cloudRotationSpeed;
        }

        // Atmosphärenshader-Uniforms aktualisieren
        if (this.atmosphereMesh) {
            updateAtmosphereUniforms(
                this.atmosphereMesh,
                new THREE.Vector3(0, 0, 0),
                this.group.position,
                camera
            );
        }

        // Sonnenposition für Nachtlichter-Shader aktualisieren
        if (this.earthShader && this.earthShader.uniforms.sunPosition) {
            this.earthShader.uniforms.sunPosition.value.set(0, 0, 0);  // Sonne ist am Ursprung
        }
    }

    /**
     * Gibt alle Ressourcen frei
     */
    dispose() {
        if (this.cloudMesh) {
            this.cloudMesh.geometry.dispose();
            this.cloudMesh.material.map?.dispose();
            this.cloudMesh.material.dispose();
        }
        if (this.atmosphereMesh) {
            this.atmosphereMesh.geometry.dispose();
            this.atmosphereMesh.material.dispose();
        }
        super.dispose();
    }
}
