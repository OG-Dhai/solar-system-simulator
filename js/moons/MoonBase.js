/**
 * @fileoverview Base class for moons.
 * @module MoonBase
 */

import * as THREE from 'three';
import { CelestialBody } from '../core/CelestialBody.js';
import { calculateOrbitalPosition, degToRad, AU_KM } from '../utils/Utils.js';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { SCALE_FACTORS, MOON_VISUAL_SCALE, MOON_ORBIT_SCALE, AU_SCALE } from '../utils/Constants.js';
import { createMoonMaterial } from '../shaders/MoonShader.js';
import { solveKeplersEquation } from '../core/KeplerSolver.js';
// Removed invalid import { resolveKepler ... }
import { NASA_MOONS } from '../utils/NASAOrbitalData.js'; // Import accurate moon data

export class MoonBase extends CelestialBody {
    constructor(data, key, parentPlanet) {
        // FIX: Getting correct physical radius is critical for proper scaling
        // If data.physical.radius is missing, check NASA_MOONS, otherwise default to Moon radius
        let physicalRadius = data.physical?.radius;

        if (!physicalRadius && NASA_MOONS[key.toLowerCase()]?.physical?.radius) {
            physicalRadius = NASA_MOONS[key.toLowerCase()].physical.radius;
        }

        // Final fallback if absolutely no data found
        if (!physicalRadius) {
            physicalRadius = 1737; // Default to Earth's Moon (Luna)
            console.warn(`[MoonBase] No physical radius found for ${key}, defaulting to 1737km`);
        }

        // Calculate visual radius using the scale factor
        const visualRadius = (physicalRadius / 6371.0) * MOON_VISUAL_SCALE;

        // Create data object with physical radius for the parent constructor
        const moonData = { ...data, radius: visualRadius, physical: { radius: physicalRadius } };

        super(moonData, key);

        // Now we can safely assign properties after calling super()
        this.physicalRadius = physicalRadius; // in km
        this.physicalMass = data.physical?.mass || 7.342e22; // Default to Moon mass if not specified
        this.rotationPeriod = data.physical?.rotationPeriod || 655.728; // Default to Moon rotation period in hours
        this.axialTilt = data.physical?.axialTilt || 1.5424; // Default to Moon axial tilt in degrees
        this.timeScale = 1.0; // Default time scale factor for orbital motion

        this.parent = parentPlanet;
        this.group.name = this.name;
        this.group.userData = { key, type: this.type, body: this };

        // DEBUG: Track instantiation to find duplicates
        this._debugId = Math.floor(Math.random() * 1000000);
        console.log(`[INSTANTIATION_CHECK] New MoonBase created: ${this.name} (${this.key}) | ID: ${this._debugId} | Parent: ${this.parent?.name}`);

        this.parentKey = data.parent;
        this.key = key;
        this._isDisposed = false;

        // Store orbital elements
        // FIX: Use orbit.a DIRECTLY as visual units (relative to planet radius)
        // NOT as AU converted to km - that produces distances of millions of km!
        // For moons, orbit.a should be a small value like 5-10 (visual units from planet center)
        const visualOrbitalDistance = data.orbital?.a || data.orbit?.a || 5.0; // in VISUAL UNITS

        this.orbitData = {
            a: visualOrbitalDistance * MOON_ORBIT_SCALE, // Already in visual units, just apply scale
            e: data.orbital?.e || data.orbit?.e || 0.0549,
            i: data.orbital?.i || data.orbit?.i || 5.145, // Stored in DEGREES
            Omega: data.orbital?.Ω || data.orbital?.Omega || data.orbit?.Ω || data.orbit?.o || 0, // Stored in DEGREES
            omega: data.orbital?.ω || data.orbital?.omega || data.orbit?.ω || data.orbit?.w || 0, // Stored in DEGREES
            period: data.orbital?.period || data.orbit?.period || 27.321661, // in days
            m0: data.orbital?.M0 || data.orbit?.M0 || data.orbit?.m0 || 0 // Mean anomaly at epoch
        };

        // Store orbital distance for reference
        this.physicalSemiMajorAxis = visualOrbitalDistance; // in visual units

        // Calculate mean motion (radians per day)
        this.meanMotion = (2 * Math.PI) / Math.abs(this.orbitData.period);

        // Store physical orbital period for accurate physics calculations
        this.physicalOrbitalPeriod = this.orbitData.period; // in days

        this.meanAnomaly = degToRad(data.orbital?.M0 || data.orbit?.M0 || Math.random() * 360);
        this.orbitLine = null;
        this._positionCache = new THREE.Vector3();

        // Cache rotation and orbital speeds to avoid recalculation every frame
        this._rotationSpeed = (2 * Math.PI) / ((this.rotationPeriod) * 3600); // radians per second
        this._meanMotion = (2 * Math.PI) / (Math.abs(this.orbitData.period) * 86400); // radians per second
        this._orbitDirection = this.orbitData.period < 0 ? -1 : 1;

        this.initMaterial(data);
        this._createUniversalOrbit(); // Enable orbit lines for moons
        this.updateOrbitalPosition();


    }

    initMaterial(data) {
        // Use Standard Material for Earth-like lighting (Day/Night/Shadows)
        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9, // Dusty surface
            metalness: 0.0,
            emissive: 0x111111,  // Minimal emissive for visibility
            emissiveIntensity: 0.05,  // Low self-illumination for visibility
            transparent: false,
            opacity: 1.0
        });

        // FIX: IMMEDIATELY boost emissive for moons of distant planets (Uranus, Neptune, Pluto)
        // This must happen BEFORE texture loading to ensure visibility
        const distantPlanets = ['uranus', 'neptune', 'pluto'];
        // Check multiple sources for parent key: data.parent, this.parentKey, or parentPlanet (passed to constructor)
        // parentPlanet is the actual planet object which has a 'key' property
        const parentKeyFromData = (data.parent || this.parentKey || '').toLowerCase();
        const parentKeyFromObject = (this.parent && this.parent.key) ? this.parent.key.toLowerCase() : '';
        const parentKey = parentKeyFromData || parentKeyFromObject;

        // FALLBACK: Hardcoded list of distant moons in case parent detection fails
        const distantMoonKeys = [
            'miranda', 'ariel', 'umbriel', 'titania', 'oberon',  // Uranus moons
            'triton', 'proteus', 'nereid', 'larissa',            // Neptune moons
            'charon'                                               // Pluto moons
        ];
        const isDistantByParent = distantPlanets.includes(parentKey);
        const isDistantByKey = distantMoonKeys.includes(this.key.toLowerCase());
        const isDistantMoon = isDistantByParent || isDistantByKey;

        // Debug log for distant moon detection
        console.log(`[MoonBase.initMaterial] ${this.key}: parentKey="${parentKey}", isDistantByParent=${isDistantByParent}, isDistantByKey=${isDistantByKey}, isDistantMoon=${isDistantMoon}`);

        if (isDistantMoon) {
            // Use HIGH emissive for distant moons to ensure visibility without washing out texture
            // Use Low emissive for distant moons to ensure visibility without washing out texture
            this.material.emissive = new THREE.Color(0x666666);
            this.material.emissiveIntensity = 0.5;
            this.material.roughness = 0.7;
            console.log(`[MoonBase] Applied emissive boost to distant moon: ${this.key}`);

            // NOTE: Local PointLight removed as it caused over-exposure
        }

        this.mesh.material = this.material;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Disable frustum culling to prevent the engine from culling the moon
        // when the CPU thinks it's a tiny dot, but the shader expands it.
        // NOTE: With StandardMaterial, we rely on actual geometry size.
        this.mesh.frustumCulled = false;

        // VISIBILITY FIX FOR DISTANT MOONS (Uranus, Neptune, Pluto):
        // Disable receiveShadow to prevent Shadow Map artifacts (false occlusion at 4000+ units)
        // Day/Night cycle (Terminator) works via N.L lighting even with receiveShadow=false.
        if (isDistantMoon) {
            this.mesh.receiveShadow = false;
            // Also reduce emissive to allow true "Night" side, as light will now work correctly
            this.material.emissive = new THREE.Color(0x111111);
            this.material.emissiveIntensity = 0.2;
        } else {
            this.mesh.receiveShadow = true;
        }

        // Ensure material is not transparent (double-check)
        this.mesh.material.transparent = false;
        this.mesh.material.opacity = 1.0;

        // Store distant moon flag for use in texture callback
        this._isDistantMoon = isDistantMoon;

        // Load Texture
        if (data.texture) {
            const texName = data.texture.replace(/\.(webp|jpg|png)$/, '');
            loadTexture(texName).then(t => {
                if (this._isDisposed) return;
                t.colorSpace = THREE.SRGBColorSpace;
                this.material.map = t;
                this.material.needsUpdate = true;

                // Double-check transparency after texture is loaded
                this.material.transparent = false;
                this.material.opacity = 1.0;

                if (!this._isDistantMoon) {
                    // For regular moons, reset emissive to black to allow full PBR shadows
                    this.material.emissive = new THREE.Color(0x000000);
                    this.material.emissiveIntensity = 0.0;
                }
                // Distant moons keep their "boosted" settings from initMaterial
                this.material.color = new THREE.Color(0xffffff);
            });
        } else {
            // Fallback for missing textures (gray moon)
            this.material.color.setHex(0xaaaaaa);
        }
    }

    /**
     * UNIVERSAL ORBIT GENERATOR
     * Applies to: Earth Moon, Mars Moons, Jupiter Moons, Saturn Moons, Uranus Moons, Neptune Moons, Pluto
     * Ensures consistent, high-precision orbit visualization across the entire solar system.
     */
    _createUniversalOrbit() {
        // [ORBIT_DEBUG] Generating Universal Orbit
        const orbitId = `${this.key}_orbit_${Date.now()}`;

        // Guard: If orbit line already exists, dispose it first to prevent duplicates
        if (this.orbitLine) {
            if (this.orbitLine.geometry) this.orbitLine.geometry.dispose();
            if (this.orbitLine.material) this.orbitLine.material.dispose();
            if (this.orbitLine.parent) this.orbitLine.parent.remove(this.orbitLine);
            this.group.remove(this.orbitLine);
            this.orbitLine = null;
        }

        // AGGRESSIVE CLEANUP: Remove ANY duplicate orbits that might be lingering in the parent group
        // This handles HMR (Hot Module Replacement) artifacts where old instances are gone but meshes remain
        if (this.parent && this.parent.group) {
            const orbitName = `${this.key}_universal_orbit`;
            // Iterate backwards to safely remove while looping
            for (let i = this.parent.group.children.length - 1; i >= 0; i--) {
                const child = this.parent.group.children[i];
                if (child.name === orbitName) {
                    console.warn(`[MoonBase] Removing stale duplicate orbit for ${this.key} found in parent`);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                    this.parent.group.remove(child);
                }
            }
        }

        // [ORBIT_DEBUG] DEEP ANALYSIS (Scaling Removed for Accuracy)
        // We now allow orbits to be drawn exactly where the physics says they are,
        // even if that means they are inside the planet (due to visual scale differences).
        // This ensures the moon (which is correct) is always ON the line.

        const segments = 256; // Reduced from 720 for TubeGeometry optimization
        const points = [];

        for (let i = 0; i < segments; i++) {
            const meanAnomaly = (i / segments) * Math.PI * 2;

            // INLINE CALCULATION to avoid Scaling Mismatches with Utils.js
            // 1. Solve Kepler's Equation
            const eccResult = solveKeplersEquation(meanAnomaly, this.orbitData.e);

            // Check for valid result (though solveKepler handles it)
            if (isNaN(eccResult.E)) continue;

            const E = eccResult.E;

            // 2. Calculate Radius & True Anomaly
            const r = this.orbitData.a * (1 - this.orbitData.e * Math.cos(E));

            // Atan2 is more robust for True Anomaly
            const sqrt1MinusE2 = Math.sqrt(1 - this.orbitData.e * this.orbitData.e);
            const tanNuOver2 = sqrt1MinusE2 * Math.sin(E) / (Math.cos(E) - this.orbitData.e);
            const nu = 2 * Math.atan(tanNuOver2);

            // 3. Orbital Plane Coordinates
            const x_orb = r * Math.cos(nu);
            const y_orb = r * Math.sin(nu);

            // 4. Rotate to 3D Space
            const cosOmega = Math.cos(degToRad(this.orbitData.Omega));
            const sinOmega = Math.sin(degToRad(this.orbitData.Omega));
            const cosI = Math.cos(degToRad(this.orbitData.i));
            const sinI = Math.sin(degToRad(this.orbitData.i));
            const cosW = Math.cos(degToRad(this.orbitData.omega));
            const sinW = Math.sin(degToRad(this.orbitData.omega));

            const P11 = cosOmega * cosW - sinOmega * sinW * cosI;
            const P12 = -cosOmega * sinW - sinOmega * cosW * cosI;
            const P21 = sinOmega * cosW + cosOmega * sinW * cosI;
            const P22 = -sinOmega * sinW + cosOmega * cosW * cosI;
            const P31 = sinW * sinI;
            const P32 = cosW * sinI;

            const x = P11 * x_orb + P12 * y_orb;
            const y = P31 * x_orb + P32 * y_orb;
            const z = P21 * x_orb + P22 * y_orb;

            // 5. No Scaling - Exact Physical Position
            points.push(new THREE.Vector3(x, y, z));
        }

        // If orbit generation failed (e.g. invalid data), create a safe fallback circle
        if (points.length < 3) {
            points.length = 0; // Clear
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * this.orbitData.a,
                    0,
                    Math.sin(angle) * this.orbitData.a
                ));
            }
        }

        // Create Curve Path
        const curve = new THREE.CatmullRomCurve3(points);
        curve.closed = true;

        // REVERT TO THIN LINES (USER REQUEST)
        // Use THREE.LineLoop for continuous connected loop without gaps
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(segments));

        // Use LineBasicMaterial for classic thin line look
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35, // Balanced opacity for visibility without clutter
            depthWrite: false, // Prevent z-fighting
        });

        this.orbitLine = new THREE.LineLoop(geometry, material);
        this.orbitLine.name = `${this.key}_orbit_line`; // Reverted naming convention
        this.orbitLine.userData = { orbitId: orbitId, type: 'orbit', body: this.key, isUniversal: true };

        // Store original opacity for later use in transitions
        this.orbitLine.material.userData = { originalOpacity: 0.35 };

        // FIX: Add orbit line to the PARENT PLANET's group, not the moon's group!
        // The moon's group moves (orbits), so adding the line to it causes the orbit to move with the moon.
        // We want the orbit line to be static around the planet.
        // FIX: Remove auto-add to parent group. 
        // We defer placement to SolarSystem.js to ensure it goes into the correct 
        // Coordinate Space (tiltGroup vs group) for 100% synchronization.
        if (this.parent && this.parent.group) {
            // Do nothing here. SolarSystem.js will grab this.orbitLine and attach it.
        } else {
            console.warn(`[MoonBase] Orbit line created but not attached. Waiting for SolarSystem.js.`);
        }

        // Ensure orbit line is visible by default
        this.orbitLine.visible = true;
    }


    updateOrbitalPosition() {
        // Use the rigorous update function with current simTime (0 at start)
        // But wait, updateOrbitalPositionKepler takes simTime.
        // We can just calculate position from current meanAnomaly directly using inline logic?
        // Actually, just calling updateOrbitalPositionKepler(0) is safer if m0 is set.
        // But better: replicate the math EXACTLY for static placement if needed,
        // OR just rely on the first update() call.
        // Let's perform a manual calculation consistent with createOrbitLine using m0.

        // Use inline logic (copy of updateOrbitalPositionKepler but for current Mean Anomaly)
        // This ensures constructor placement matches the line perfectly.

        const meanAnomaly = this.meanAnomaly; // Already in radians from constructor
        const eccResult = solveKeplersEquation(meanAnomaly, this.orbitData.e, undefined, undefined, this.key);
        const E = eccResult.E;

        // Check for valid eccentric anomaly
        if (isNaN(E)) {
            // Default to a position along the X-axis if calculation fails
            this.group.position.set(this.orbitData.a * (AU_SCALE / AU_KM), 0, 0);
            return;
        }

        // ... (Math copy) ...
        const r = this.orbitData.a * (1 - this.orbitData.e * Math.cos(E));

        // Check for valid radius
        if (isNaN(r) || r <= 0) {
            // Default to a position along the X-axis if calculation fails
            this.group.position.set(this.orbitData.a * (AU_SCALE / AU_KM), 0, 0);
            return;
        }

        // True Anomaly
        const sqrt1MinusE2 = Math.sqrt(1 - this.orbitData.e * this.orbitData.e);
        const tanNuOver2 = sqrt1MinusE2 * Math.sin(E) / (Math.cos(E) - this.orbitData.e);
        const nu = 2 * Math.atan(tanNuOver2);

        const x_orb = r * Math.cos(nu);
        const y_orb = r * Math.sin(nu);

        const cosOmega = Math.cos(degToRad(this.orbitData.Omega));
        const sinOmega = Math.sin(degToRad(this.orbitData.Omega));
        const cosI = Math.cos(degToRad(this.orbitData.i));
        const sinI = Math.sin(degToRad(this.orbitData.i));
        const cosW = Math.cos(degToRad(this.orbitData.omega));
        const sinW = Math.sin(degToRad(this.orbitData.omega));

        const P11 = cosOmega * cosW - sinOmega * sinW * cosI;
        const P12 = -cosOmega * sinW - sinOmega * cosW * cosI;
        const P21 = sinOmega * cosW + cosOmega * sinW * cosI;
        const P22 = -sinOmega * sinW + cosOmega * cosW * cosI;
        const P31 = sinW * sinI;
        const P32 = cosW * sinI;

        const x = P11 * x_orb + P12 * y_orb;
        const y = P31 * x_orb + P32 * y_orb;
        const z = P21 * x_orb + P22 * y_orb;

        // Check for NaN values in final position
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            // Default to a position along the X-axis if calculation fails
            this.group.position.set(this.orbitData.a, 0, 0);
            return;
        }

        // FIX: orbit.a is now in VISUAL UNITS, no scaling needed
        this.group.position.set(x, y, z);
    }

    /**
     * Update orbital position using Keplerian mechanics
     * @param {number} simTime - Simulation time in seconds
     */
    updateOrbitalPositionKepler(simTime) {
        // Calculate mean anomaly at current time
        const daysSinceEpoch = simTime / 86400; // Convert seconds to days
        const meanAnomaly = degToRad(this.orbitData.m0) + (this.meanMotion * daysSinceEpoch * this.timeScale);

        // Solve Kepler's equation to get eccentric anomaly
        const eccResult = solveKeplersEquation(meanAnomaly, this.orbitData.e, undefined, undefined, this.key);
        const E = eccResult.E;

        // Check for valid eccentric anomaly
        if (isNaN(E)) {
            // Default to a position along the X-axis if calculation fails
            this.group.position.set(this.orbitData.a * (AU_SCALE / AU_KM), 0, 0);
            return;
        }

        // Calculate true anomaly from eccentric anomaly
        const sqrt1MinusE2 = Math.sqrt(1 - this.orbitData.e * this.orbitData.e);
        const tanNuOver2 = sqrt1MinusE2 * Math.sin(E) / (Math.cos(E) - this.orbitData.e);
        const nu = 2 * Math.atan(tanNuOver2);

        // Calculate orbital radius
        const r = this.orbitData.a * (1 - this.orbitData.e * Math.cos(E));

        // Check for valid radius
        if (isNaN(r) || r <= 0) {
            // Default to a position along the X-axis if calculation fails
            this.group.position.set(this.orbitData.a, 0, 0);
            return;
        }

        // Convert to 3D position in orbital plane
        const x_orb = r * Math.cos(nu);
        const y_orb = r * Math.sin(nu);

        // Apply orbital element rotations to get 3D position in space
        const cosOmega = Math.cos(degToRad(this.orbitData.Omega));
        const sinOmega = Math.sin(degToRad(this.orbitData.Omega));
        const cosI = Math.cos(degToRad(this.orbitData.i));
        const sinI = Math.sin(degToRad(this.orbitData.i));
        const cosW = Math.cos(degToRad(this.orbitData.omega));
        const sinW = Math.sin(degToRad(this.orbitData.omega));

        const P11 = cosOmega * cosW - sinOmega * sinW * cosI;
        const P12 = -cosOmega * sinW - sinOmega * cosW * cosI;
        const P21 = sinOmega * cosW + cosOmega * sinW * cosI;
        const P22 = -sinOmega * sinW + cosOmega * cosW * cosI;
        const P31 = sinW * sinI;
        const P32 = cosW * sinI;

        const x = P11 * x_orb + P12 * y_orb;
        const y = P31 * x_orb + P32 * y_orb;
        const z = P21 * x_orb + P22 * y_orb;

        // Check for NaN values in final position
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            // Default to a position along the X-axis if calculation fails
            this.group.position.set(this.orbitData.a, 0, 0);
            return;
        }

        // Update position relative to parent planet
        // FIX: orbit.a is now in VISUAL UNITS, no scaling needed
        this.group.position.set(x, y, z);
    }

    // FIX: Changed 4th argument to 'camera' to match SolarSystem.js call signature
    update(visualDt, simTime, speed, camera) {
        // Rotation (use cached rotation speed)
        if (this.mesh) {
            this.mesh.rotation.y += this._rotationSpeed * visualDt * speed;
            // Wrap rotation to prevent float overflow
            if (this.mesh.rotation.y > 6.283185) this.mesh.rotation.y -= 6.283185;
        }

        // Update orbital position using Keplerian mechanics
        this.updateOrbitalPositionKepler(simTime);

        // DEBUG: Monitor material properties for Titania to see if they are being reset


        // Check if moon is in shadow of its parent planet
        // SKIP shadow check for distant moons - they need to stay bright
        if (!this._isDistantMoon) {
            this.checkPlanetShadow();
        }

        // StandardMaterial handles lighting automatically.
        // No need to update manual uniforms anymore.

        // LOD Update: Reduce geometry complexity for distant moons
        if (camera) {
            this.updateLODWithCamera(camera);
        }
    }

    /**
     * Check if the moon is in shadow of its parent planet
     */
    checkPlanetShadow() {
        if (!this.parent || !this.parent.mesh || !this.mesh) return;

        // Get positions of sun, planet, and moon
        const sunPos = new THREE.Vector3(0, 0, 0); // Sun is at origin
        const planetPos = new THREE.Vector3();
        this.parent.mesh.getWorldPosition(planetPos);
        const moonPos = new THREE.Vector3();
        this.mesh.getWorldPosition(moonPos);

        // Vector from sun to moon
        const sunToMoon = moonPos.clone().sub(sunPos);
        // Vector from sun to planet
        const sunToPlanet = planetPos.clone().sub(sunPos);

        // Check if moon is behind the planet relative to the sun
        const sunToMoonDir = sunToMoon.normalize();
        const sunToPlanetDir = sunToPlanet.normalize();

        // Calculate angle between the two vectors
        const angle = sunToMoonDir.angleTo(sunToPlanetDir);

        // Calculate angular radius of the planet as seen from the sun
        const planetAngularRadius = Math.atan(this.parent.radius / sunToPlanet.length());

        // If the angle is less than the planet's angular radius, the moon is in shadow
        if (angle < planetAngularRadius) {
            // Calculate distance from sun to planet and from sun to moon
            const sunToPlanetDist = sunToPlanet.length();
            const sunToMoonDist = sunToMoon.length();

            // Moon is in shadow if it's behind the planet (further from sun than planet)
            if (sunToMoonDist > sunToPlanetDist * 0.95) { // Allow slight tolerance
                // Apply shadow effect - make the moon darker
                this.applyShadowEffect(true);
                return;
            }
        }

        // Check if moon is in planet's umbral/penumbral shadow cone
        this.checkShadowCone(sunPos, planetPos, moonPos);
    }

    /**
     * Check if the moon is in the shadow cone of the planet
     */
    checkShadowCone(sunPos, planetPos, moonPos) {
        // Vector from sun to planet
        const sunToPlanet = planetPos.clone().sub(sunPos);
        // Vector from sun to moon
        const sunToMoon = moonPos.clone().sub(sunPos);

        // Project moon position onto the sun-planet axis
        const projection = sunToMoon.dot(sunToPlanet.normalize());

        // If projection is positive, moon is on the planet's side of the sun
        if (projection > 0) {
            // Calculate the rejection vector (perpendicular component)
            const projectedPoint = sunPos.clone().add(sunToPlanet.clone().multiplyScalar(projection));
            const rejection = moonPos.clone().sub(projectedPoint);
            const distanceToAxis = rejection.length();

            // Calculate the radius of the shadow cone at the moon's distance from the planet
            // Using similar triangles: planet_radius / (sun_to_planet_distance) = shadow_radius / (sun_to_moon_distance - sun_to_planet_distance)
            const sunToPlanetDist = planetPos.distanceTo(sunPos);
            const sunToMoonDist = moonPos.distanceTo(sunPos);
            const distanceFromPlanet = Math.abs(sunToMoonDist - sunToPlanetDist);

            // Approximate shadow cone radius (considering umbra and penumbra)
            // For simplicity, we'll use the planet's radius as the umbra radius at the planet's position
            // The shadow cone expands slightly beyond that
            const shadowRadiusAtMoon = this.parent.radius * (distanceFromPlanet / sunToPlanetDist + 1.0);

            if (distanceToAxis < shadowRadiusAtMoon) {
                // Moon is in shadow
                this.applyShadowEffect(true);
                return;
            }
        }

        // Moon is not in shadow
        this.applyShadowEffect(false);
    }

    /**
     * Apply shadow effect to the moon's appearance
     */
    applyShadowEffect(inShadow) {
        if (!this.mesh || !this.mesh.material) return;

        if (inShadow) {
            // Make the moon appear darker when in shadow
            // Adjust emissive color to simulate darkness
            if (this.mesh.material.emissive) {
                this.mesh.material.emissive.setHex(0x222222); // Dark gray
            }
            if (this.mesh.material.emissiveIntensity !== undefined) {
                // For distant moons, keep some light even in shadow (0.2 instead of 0.1)
                this.mesh.material.emissiveIntensity = this._isDistantMoon ? 0.2 : 0.1;
            }

            // Reduce overall brightness by adjusting the albedo/diffuse color
            if (this.mesh.material.color) {
                // Store original color if not already stored
                if (!this.originalColor) {
                    this.originalColor = this.mesh.material.color.clone();
                }

                // Darken the color
                const darkenedColor = this.originalColor.clone();
                darkenedColor.multiplyScalar(0.3); // Reduce to 30% brightness
                this.mesh.material.color.copy(darkenedColor);
            }
        } else {
            // Restore normal appearance when not in shadow
            // FIX: For distant moons, restore their emissive values
            if (this._isDistantMoon) {
                if (this.mesh.material.emissive) {
                    this.mesh.material.emissive.setHex(0xffffff);
                }
                if (this.mesh.material.emissiveIntensity !== undefined) {
                    this.mesh.material.emissiveIntensity = 0.5; // Restore to moderate intensity (visible but not glowing)
                }
            } else {
                if (this.mesh.material.emissive) {
                    this.mesh.material.emissive.setHex(0x111111); // Normal emissive
                }
                if (this.mesh.material.emissiveIntensity !== undefined) {
                    this.mesh.material.emissiveIntensity = 0.05; // Normal emissive intensity
                }
            }

            // Restore original color
            if (this.originalColor && this.mesh.material.color) {
                this.mesh.material.color.copy(this.originalColor);
            }
        }
    }

    getOrbitLine() { return this.orbitLine; }

    dispose() {
        this._isDisposed = true;
        if (this.orbitLine) {
            this.orbitLine.geometry.dispose();
            this.orbitLine.material.dispose();
        }
        super.dispose();
    }

    /**
     * Set the visibility of the orbit line
     * @param {boolean} visible
     */
    setOrbitVisible(visible) {
        if (this.orbitLine) {
            this.orbitLine.visible = visible;
            if (this.orbitLine.material) {
                // Use a slightly higher opacity when forced visible
                this.orbitLine.material.opacity = visible ? (this.orbitLine.material.userData.originalOpacity || 0.6) : 0.0;
            }
        }
    }
}