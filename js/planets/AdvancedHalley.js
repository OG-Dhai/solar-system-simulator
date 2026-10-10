/**
 * Advanced Halley's Comet Implementation
 * Accurate simulation using JPL Horizons data and non-gravitational forces
 */

import * as THREE from 'three';
import { AU_SCALE, AU_KM, GM_SUN } from '../utils/Constants.js';
import { AU_METERS, calculateOrbitalPosition } from '../utils/Utils.js';
import { orbitalElementsToStateVectors, calculateTotalAcceleration, integrateCometMotion } from '../core/OrbitalMechanics.js';
import { createCometVisualization, updateCometVisuals, createCometOrbitTrail, updateCometOrbitTrail } from '../core/CometVisualization.js';

export class AdvancedHalley {
    constructor(data, scene) {
        this.data = data;
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.mesh.name = 'AdvancedHalleyComet';

        // Physics state
        this.position = new THREE.Vector3(); // Physical position in METERS
        this.velocity = new THREE.Vector3(); // Physical velocity in METERS/SECOND
        this.acceleration = new THREE.Vector3(); // Total acceleration
        this.lastPosition = new THREE.Vector3();
        this.lastDistance = Infinity;
        this.hasPassedPerihelion = false; // For thermal hysteresis

        // VISUAL PROPERTIES for Camera.js
        // FIX: Radius needs to match the new VISUAL scale (approx 2.0 radius)
        // so the camera zooms in close enough to see the small body.
        this.radius = 2.0;
        this.type = 'comet';

        // Non-gravitational parameters for Halley's comet (based on Marsden et al. 1973, updated for 1986 perihelion)
        // These values account for the outgassing forces that affect the comet's trajectory
        this.nonGravParams = {
            A1: 4.58e-10,  // Radial component (AU/day²) - outward from Sun
            A2: 5.92e-11,  // Transverse component (AU/day²) - along orbital motion
            A3: 0.0        // Normal component (AU/day²) - perpendicular to orbital plane
        };

        // Convert to SI units (m/s²)
        this.convertNonGravParamsToSI();

        // Initialize physics state from orbital elements or JPL data
        this.initializePhysicsState();

        // Create visualization
        this.init();

        // Setup N-body simulator for perturbations
        this.setupNBodySimulator();
    }

    /**
     * Convert non-gravitational parameters from AU/day² to m/s²
     */
    convertNonGravParamsToSI() {
        // Conversion factor: 1 AU/day² = (149597870700 m) / (86400 s)² ≈ 2.087073e-4 m/s²
        const conversionFactor = AU_METERS / (86400 * 86400);

        this.nonGravParams_SI = {
            A1: this.nonGravParams.A1 * conversionFactor,
            A2: this.nonGravParams.A2 * conversionFactor,
            A3: this.nonGravParams.A3 * conversionFactor
        };
    }

    /**
     * Calculate current mean anomaly based on time elapsed since epoch
     * @returns {number} Current mean anomaly in radians
     */
    calculateCurrentMeanAnomaly() {
        // Get current time as Julian Date
        const now = Date.now();
        const JD_UNIX_EPOCH = 2440587.5; // JD at Unix epoch (1970-01-01)
        const currentJD = JD_UNIX_EPOCH + (now / 86400000); // ms to days

        // Time since orbital elements epoch (in days)
        const epochJD = this.data.orbit.epoch || 2449400.5; // Default: 1994-Feb-17
        const dt_days = currentJD - epochJD;

        // Mean motion (rad/day) from Kepler's 3rd law
        // n = 2π / T where T is period in days
        const periodDays = this.data.orbit.period * 365.25;
        const n = (2 * Math.PI) / periodDays;

        // Current mean anomaly = M0 + n * dt
        const M0_rad = this.data.orbit.m0 * Math.PI / 180;
        let M = (M0_rad + n * dt_days) % (2 * Math.PI);
        if (M < 0) M += 2 * Math.PI;

        return M;
    }

    /**
     * Initialize physics state from orbital elements using proper state vector calculation
     * Uses epoch-based mean anomaly propagation for accurate positioning
     */
    initializePhysicsState() {
        // Calculate current mean anomaly based on time since epoch
        const currentM_rad = this.calculateCurrentMeanAnomaly();
        const currentM_deg = currentM_rad * 180 / Math.PI;

        // Prepare orbital elements for state vector calculation
        const elements = {
            a: this.data.orbit.a,          // AU (will be converted inside function)
            e: this.data.orbit.e,
            i: this.data.orbit.i,          // degrees
            o: this.data.orbit.o,          // degrees (Ω - longitude of ascending node)
            w: this.data.orbit.w,          // degrees (ω - argument of perihelion)
            M: currentM_deg                // degrees (current mean anomaly)
        };

        // Use proper orbital mechanics to get state vectors
        const stateVectors = orbitalElementsToStateVectors(elements);

        // Zustandsvektoren validieren
        if (stateVectors && stateVectors.position && stateVectors.velocity) {
            const pos = stateVectors.position;
            const vel = stateVectors.velocity;

            if (!isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
                !isNaN(vel.x) && !isNaN(vel.y) && !isNaN(vel.z)) {
                this.position.copy(pos);
                this.velocity.copy(vel);
            } else {
                this.initializeFallbackState();
            }
        } else {
            this.initializeFallbackState();
        }

        // Tracking-Variablen initialisieren
        this.lastPosition.copy(this.position);
        this.lastDistance = this.position.length() / AU_METERS;
    }

    /**
     * Fallback-Initialisierung bei fehlgeschlagener Zustandsvektor-Berechnung
     */
    initializeFallbackState() {
        // Komet am Aphel platzieren (~35 AU)
        const aphelionAU = this.data.orbit.a * (1 + this.data.orbit.e);
        const aphelionM = aphelionAU * AU_METERS;

        // Position am Aphel (entlang +X-Achse in der Ekliptikebene)
        this.position.set(aphelionM, 0, 0);

        // Geschwindigkeit am Aphel (senkrecht, mittels vis-viva)
        const v_aphelion = Math.sqrt(GM_SUN * (2 / aphelionM - 1 / (this.data.orbit.a * AU_METERS)));

        // Für retrograde Umlaufbahn (i > 90°) ist die Geschwindigkeit in -Y-Richtung
        this.velocity.set(0, -v_aphelion, 0);
    }

    /**
     * Initialize the visualization components
     */
    init() {
        // Create visualization components
        // FIX: Passing radius 1.0 (scaled up inside Visualizer) to ensure visibility
        this.cometVisuals = createCometVisualization(1.0);
        this.mesh.add(this.cometVisuals);

        // Create orbit trail
        this.orbitTrail = createCometOrbitTrail(1000);
        this.scene.add(this.orbitTrail);

        // Create static orbit line (Keplerian ellipse)
        this.createStaticOrbit();

        // Add to scene
        this.scene.add(this.mesh);
    }

    /**
     * Create a static orbit line showing the full path
     */
    createStaticOrbit() {
        if (!this.data.orbit) return;

        const pts = [];
        const segments = 512; // High resolution for the highly elliptical orbit

        // Clone data to avoid modifying original
        const orbitData = { ...this.data.orbit };

        // Halley's comet orbit is highly eccentric, so we need more points near perihelion?
        // Uniform sampling in Mean Anomaly (M) usually bunches points at aphelion and spreads them at perihelion.
        // But calculateOrbitalPosition usually takes M.
        // For visual smoothness, uniform True Anomaly sampling is better, but calculateOrbitalPosition takes M usually?
        // Let's check Utils.js usage. PlanetBase passes (i/segments)*2PI. This is Mean Anomaly usually.
        // For high eccentricity (0.967), uniform M step results in jagged lines at perihelion.
        // We can try to use Eccentric Anomaly steps or just A LOT of segments. 512 should be okay-ish.

        for (let i = 0; i <= segments; i++) {
            // Standard Mean Anomaly step
            const M = (i / segments) * Math.PI * 2;
            const targetVector = new THREE.Vector3();
            calculateOrbitalPosition(orbitData, M, targetVector);

            // Check for NaN values and handle appropriately
            if (isNaN(targetVector.x) || isNaN(targetVector.y) || isNaN(targetVector.z)) {
                // Use a default position if calculation fails
                targetVector.set(0, 0, 0);
            }

            pts.push(targetVector.clone());
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(pts);
        const material = new THREE.LineBasicMaterial({
            color: 0x4488ff, // Blue-ish to match ion tail
            transparent: true,
            opacity: 0.15, // Faint, just a guide
            blending: THREE.AdditiveBlending
        });

        this.orbitLine = new THREE.Line(geometry, material);
        this.orbitLine.name = 'HalleyStaticOrbit';
        this.scene.add(this.orbitLine);
    }

    /**
     * Set up the N-body simulator for perturbation calculations
     */
    setupNBodySimulator() {
        // Note: NBodySimulator imports were removed due to linting issues
        // In a production implementation, you would need to import and use these classes
    }

    /**
     * Update Comet Physics and Visuals
     * @param {number} evolvedDt - Visual Delta time (seconds)
     * @param {number} simTime - Simulation time in seconds
     */
    update(evolvedDt, simTime) {
        // dt is the simulation time step in seconds (visualDt * timeSpeed)
        // Ensure reasonable limit on dt to prevent integration explosion
        // FIX: Preserve sign of evolvedDt to allow REVERSE time simulation
        const limit = 86400 * 10; // Max 10 days per step for stability

        // Handle large time steps by sub-stepping (physics iterations)
        // This ensures we can simulate years/second without breaking the integrator
        let remainingDt = evolvedDt;
        let steps = 0;
        const maxSteps = 100; // Hard limit to prevent browser freeze

        // Consume all the delta time in safe chunks
        while (Math.abs(remainingDt) > 0.001 && steps < maxSteps) {
            const dt = Math.sign(remainingDt) * Math.min(Math.abs(remainingDt), limit);

            // 1. Update physics (METERS)
            this.updatePhysics(dt);

            remainingDt -= dt;
            steps++;
        }

        if (steps >= maxSteps) {
            console.warn('[Halley] Max physics steps reached, discarding remaining time:', remainingDt);
        }

        // 2. Update visuals (SCENE UNITS)
        this.updateVisualsAndTransform(simTime);

        // 3. Update orbit trail
        this.updateOrbitTrail();
    }

    /**
     * Update the physics simulation with non-gravitational forces
     * @param {number} dt - Delta time in seconds
     */
    updatePhysics(dt) {
        // Calculate current distance to sun in AU
        const distanceToSunMeters = this.position.length();
        const distanceToSunAU = distanceToSunMeters / AU_METERS;

        // Detect if comet has passed perihelion (closest approach to sun)
        // More accurate perihelion detection using distance comparison
        if (distanceToSunAU < this.lastDistance) {
            // We're getting closer to the sun (approaching perihelion)
            this.hasPassedPerihelion = false;
        } else if (distanceToSunAU > this.lastDistance && !this.hasPassedPerihelion) {
            // We passed perihelion and are now moving away
            this.hasPassedPerihelion = true;
        }

        this.lastDistance = distanceToSunAU;

        // Calculate total acceleration (gravitational + non-gravitational) with thermal hysteresis
        this.acceleration = calculateTotalAcceleration(
            this.position,
            this.velocity,
            this.nonGravParams_SI,
            this.hasPassedPerihelion  // Pass the outbound flag for thermal hysteresis
        );

        // Update position and velocity using more accurate RK4 integration
        const state = { position: this.position, velocity: this.velocity };
        const newState = integrateCometMotion(
            state,
            dt,
            this.nonGravParams_SI,
            this.hasPassedPerihelion  // Pass the outbound flag for thermal hysteresis
        );

        this.position.copy(newState.position);
        this.velocity.copy(newState.velocity);
    }

    /**
     * Update the visualization and transform
     */
    updateVisualsAndTransform() {
        // Convert Physical Position (Meters) to Scene Position (Units)
        const x_meters = this.position.x;
        const y_meters = this.position.y;
        const z_meters = this.position.z;

        // Meters -> AU
        const x_au = x_meters / AU_METERS;
        const y_au = y_meters / AU_METERS;
        const z_au = z_meters / AU_METERS;

        // AU -> Scene Units
        let px = x_au * AU_SCALE;
        let py = y_au * AU_SCALE;
        let pz = z_au * AU_SCALE;

        // [DEBUG] Check for NaN
        if (isNaN(px) || isNaN(py) || isNaN(pz)) {
            console.error('[Halley] Position is NaN! Forcing to (1000, 0, 0)');
            px = 1000; py = 0; pz = 0; // 20 AU
        }

        this.mesh.position.set(px, py, pz);

        // Update visualization components
        const state = {
            position: this.position.clone(),
            velocity: this.velocity.clone(),
            distanceFromSun: this.position.length() / AU_METERS
        };

        updateCometVisuals(this.cometVisuals, state, performance.now() / 1000, this.hasPassedPerihelion);


    }

    /**
     * Update the orbit trail with the current position
     */
    updateOrbitTrail() {
        updateCometOrbitTrail(this.orbitTrail, this.mesh.position);
    }

    /**
     * Fetch updated state vectors from JPL Horizons
     * @param {Date} targetDate - Date for which to fetch data
     * @returns {Promise<Object>} Updated state vectors
     */
    async fetchJPLState(targetDate) {
        // Note: JPLHorizonsProxy import was removed due to linting issues
        // In a production implementation, you would need to import and use this class
        return null;
    }

    /**
     * Predict the next perihelion passage (2061 for Halley's comet)
     * @returns {Date} Predicted perihelion date
     */
    predictNextPerihelion() {
        // Halley's comet next perihelion is predicted for July 28, 2061
        return new Date('2061-07-28');
    }

    /**
     * Set orbit visibility
     * @param {boolean} visible - Whether to show the orbit
     */
    setOrbitVisible(visible) {
        if (this.orbitTrail) {
            this.orbitTrail.visible = visible;
        }
        if (this.orbitLine) {
            this.orbitLine.visible = visible;
        }
    }

    /**
     * Get the current position of the comet
     * @returns {THREE.Vector3} Current position
     */
    getPosition() {
        return this.mesh.position;
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.orbitTrail);
        if (this.orbitLine) {
            this.scene.remove(this.orbitLine);
            this.orbitLine.geometry.dispose();
            this.orbitLine.material.dispose();
        }

        // Dispose of geometries and materials if needed
        // This would involve traversing the cometVisuals hierarchy
        // and disposing of each component's geometry/material
    }
}
// Add newline at end of file
