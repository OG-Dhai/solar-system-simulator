/**
 * @fileoverview Base class for all planets.
 * @module PlanetBase
 */

import * as THREE from 'three';
import { CelestialBody } from '../core/CelestialBody.js';
import { calculateOrbitalPosition, AU, degToRad, GAS_GIANTS, TIME_SCALE, distanceScale } from '../utils/Utils.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { evolveOrbitalElements } from '../core/KeplerSolver.js';
import { computeSecularEvolution } from '../core/SecularVariations.js';
import { ROTATION_VISUAL_MULTIPLIER } from '../utils/Constants.js';
import { LagrangeSolver } from '../core/LagrangeSolver.js';
import { Logger } from '../utils/Logger.js';
// If SecularVariations.js exists, I should move it to core or utils.
// Checking file list: YES, SecularVariations.js exists.
// I should move/copy it to js/core/SecularVariations.js.

export class PlanetBase extends CelestialBody {
    constructor(data, key, quality = {}, solarSystem = null) {
        super(data, key);
        this.orbitData = { ...data.orbit };
        this.orbitData.a = distanceScale(this.orbitData.a, 1.0);
        this.solarSystem = solarSystem;
        this.quality = quality;
        this._isDisposed = false;
        this._abortControllers = [];
        this.orbitLine = null;

        // Initialize rings registration if solarSystem has unified ring system
        this.registerRings = this.solarSystem && this.solarSystem.unifiedRingSystem ? this.registerRings.bind(this) : null;

        this.tiltGroup = new THREE.Group();
        this.tiltGroup.name = `${this.name}_tilt`;

        this.group.remove(this.mesh);
        this.mesh.rotation.z = 0;
        this.tiltGroup.add(this.mesh);

        this.tiltGroup.rotation.x = degToRad(this.axialTilt);
        this.group.add(this.tiltGroup);

        this.initMaterial(data);

        this.pivotGroup = new THREE.Group();
        this.pivotGroup.add(this.group);

        if (data.rings) {
            Logger.info('PlanetBase', `${this.name} has ring data:`, data.rings);
            if (this.solarSystem && this.solarSystem.unifiedRingSystem) {
                Logger.info('PlanetBase', `Registering rings for ${this.name}`);
                this.registerRings(data.rings);
            } else {
                Logger.warn('PlanetBase', `No unified ring system available for ${this.name}`);
            }
        }
        this.createOrbitLine();

        this._evolvedElementsCache = {};
        this._positionCache = new THREE.Vector3();

        // Cache rotation speed to avoid recalculation every frame
        this._rotationSpeed = (2 * Math.PI) / ((this.data.rotationPeriod || 1) * 3600);
    }

    initMaterial(data) {
        // Base implementation - can be overridden
        const isGas = GAS_GIANTS.includes(this.name) || this.name === 'Venus';

        // Anti-Glare Logic for Venus, Jupiter, Saturn
        // The Sun intensity is 10.0, which blows out standard white materials.
        // We must darken the base color (albedo) significantly to act as "sunglasses".
        const isBrightPlanet = ['Jupiter', 'Saturn', 'Venus'].includes(this.name);

        if (!this.mesh.material) {
            this.mesh.material = new THREE.MeshStandardMaterial();
        }
        this.mesh.material.setValues({
            color: isBrightPlanet ? 0x555555 : 0xffffff, // 0x555555 (~33%) compensates for 10x sun intensity
            roughness: isGas ? 1.0 : 0.9, // 1.0 for gas/clouds (Matte)
            metalness: 0.0,
            envMapIntensity: 0.0, // Disable environment reflections completely
            transparent: false,
            opacity: 1.0
        });

        // TEMP DEBUG: Log material properties for all planets
        console.log(`[DEBUG] PlanetBase material initialized:`, {
            name: this.name,
            transparent: this.mesh.material.transparent,
            opacity: this.mesh.material.opacity,
            type: this.mesh.material.type
        });

        // Enable Shadows, but disable receiveShadow for distant small bodies to prevent self-shadowing acne
        this.mesh.castShadow = true;

        // Distant planets (Uranus, Neptune, Pluto) might have shadow bias issues due to distance
        // Disable receiveShadow for them to ensure they are lit by the sun (and ambient)
        // Also add strong emissive lighting since they receive very little sunlight
        const DISTANT_PLANETS = ['uranus', 'neptune', 'pluto'];
        if (DISTANT_PLANETS.includes(this.name.toLowerCase())) {
            this.mesh.receiveShadow = false;
            // FIX: Add strong emissive for distant planets - they're 19-40 AU from the sun
            this.mesh.material.emissive = new THREE.Color(0x222222); // Subtle self-illumination
            this.mesh.material.emissiveIntensity = 0.1; // Reduced from 0.6 to 0.1 for realism
            console.log(`[PlanetBase] Applied subtle emissive to distant planet: ${this.name}`);
        } else {
            this.mesh.receiveShadow = true;
        }

        if (data.texture) {
            const texName = data.texture.replace('textures/', '').replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(t => {
                if (this._isDisposed) return;
                t.colorSpace = THREE.SRGBColorSpace;
                this.mesh.material.map = t;
                this.mesh.material.needsUpdate = true;

                // TEMP DEBUG: Log texture loading
                console.log(`[DEBUG] PlanetBase texture loaded:`, this.name, texName);
            }).catch(err => {
                console.warn(`PlanetBase: Failed to load texture for ${this.name}:`, texName, err);
            });
        }
    }

    registerRings(ringConfig) {
        Logger.info('PlanetBase', `Called for ${this.name} with config:`, ringConfig);
        if (this.solarSystem && this.solarSystem.unifiedRingSystem) {
            Logger.info('PlanetBase', `Adding ring to unified system for ${this.name}`);
            this.solarSystem.unifiedRingSystem.addRing(this, ringConfig);
        } else {
            Logger.error('PlanetBase', `No unified ring system available for ${this.name}`);
        }
    }

    createOrbitLine() {
        // Improved orbit line creation with better visual quality
        const pts = [];
        const segments = 720;
        for (let i = 0; i <= segments; i++) {
            pts.push(calculateOrbitalPosition(this.orbitData, (i / segments) * Math.PI * 2));
        }

        // Use LineMaterial for better visual quality instead of LineBasicMaterial
        // This creates smoother, more consistent lines that look better at various distances
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            linewidth: 1  // Note: linewidth is often ignored in WebGL2, but we set it anyway
        });

        this.orbitLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            lineMaterial
        );
        this.orbitLine.name = `${this.key}_orbit_line_legacy`;
        this.orbitLine.userData = { source: 'PlanetBase', key: this.key };

        // Store original opacity for later use in transitions
        this.orbitLine.material.userData = { originalOpacity: 0.3 };
    }

    /**
     * Updates the orbit line position to remain centered at the origin (around the sun)
     */
    updateOrbitLinePosition() {
        if (!this.orbitLine) return;

        // Planet orbits should be centered at the sun (origin), so reset position to 0
        // The orbit line is already positioned correctly since planets orbit around the sun
        // This is mainly to ensure the orbit line stays at the right position
        this.orbitLine.position.set(0, 0, 0);
    }

    updateOrbitLine() {
        // Update the orbit line to reflect current orbital parameters
        if (!this.orbitLine) return;

        const pts = [];
        const segments = 720;
        // Use evolved orbital parameters if available, otherwise use original
        const orbitData = this._evolvedElementsCache || this.orbitData;

        for (let i = 0; i <= segments; i++) {
            pts.push(calculateOrbitalPosition(orbitData, (i / segments) * Math.PI * 2));
        }

        // Update the geometry with new points
        this.orbitLine.geometry.setFromPoints(pts);
        this.orbitLine.geometry.computeBoundingSphere();
    }

    update(visualDt, simTime, speed, camera) {
        // Calculate Julian Centuries since J2000 for secular variations
        const T = simTime / (36525 * 86400); // Julian centuries

        // Apply secular variations for long-term orbital evolution
        // This accounts for gravitational perturbations from other planets
        let evolvedParams;
        if (this._evolvedElementsCache) {
            evolvedParams = computeSecularEvolution(
                this.orbitData,
                T,
                this.key,
                this._evolvedElementsCache
            );
        } else {
            evolvedParams = this.orbitData;
        }

        // Calculate mean anomaly
        // If we have secular evolution data (MRate), use the evolved M (Degrees) -> Radians
        let M;
        if (evolvedParams.M !== undefined && (evolvedParams.MRate || evolvedParams.n)) {
            M = degToRad(evolvedParams.M);
        } else {
            // Fallback to linear period
            M = degToRad(this.orbitData.m0 || 0) + (simTime * TIME_SCALE) / this.orbitData.period * 2 * Math.PI;
        }

        // Use evolved orbital parameters for position calculation
        calculateOrbitalPosition(evolvedParams, M, this._positionCache);
        this.group.position.copy(this._positionCache);

        // Calculate Lagrange points for gas giants
        if (GAS_GIANTS.includes(this.key) && this.solarSystem) {
            const sunPos = new THREE.Vector3(0, 0, 0);
            const planetMass = this.data.mass || 1;
            const sunMass = 333000; // Sun's mass relative to Earth
            this.lagrangePoints = LagrangeSolver.calculateAllPoints(sunPos, this.group.position, sunMass, planetMass);
        }

        // Rotation (use cached rotation speed)
        if (this.mesh) {
            this.mesh.rotation.y += this._rotationSpeed * visualDt * speed * ROTATION_VISUAL_MULTIPLIER;
            // Wrap rotation to prevent float overflow on long simulations
            if (this.mesh.rotation.y > 6.283185) this.mesh.rotation.y -= 6.283185;
        }

        // Update orbit line periodically to stay aligned with evolving orbital parameters
        // Only update occasionally to avoid performance impact
        if (simTime % 86400 < 10) { // Update once per day (approximately)
            this.updateOrbitLine();
        }

        // Update orbit line position to ensure it remains centered properly
        this.updateOrbitLinePosition();

        // LOD Update: Reduce geometry complexity for distant planets
        if (camera) {
            this.updateLODWithCamera(camera);
        }
    }



    getOrbitLine() { return this.orbitLine; }
    getPivotGroup() { return this.pivotGroup; }

    dispose() {
        this._isDisposed = true;
        this._abortControllers.forEach(c => c.abort());
        super.dispose();
    }
}
