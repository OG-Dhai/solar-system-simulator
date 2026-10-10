/**
 * Orbital Mechanics Core Functions
 * Implements Keplerian orbital mechanics and non-gravitational forces for comets
 */

import * as THREE from 'three';
import { GM_SUN } from '../utils/Constants.js';
import { AU_METERS } from '../utils/Utils.js';

// Constants
const G = 6.67430e-11;            // Gravitational constant (m³⋅kg⁻¹⋅s⁻²)
const GM_SUN_SI = GM_SUN * 1e9;   // Convert km³/s² to m³/s² (SI Units)

/**
 * Convert orbital elements to position and velocity vectors
 * @param {Object} elements - Orbital elements {a, e, i, o (longitude of ascending node), w (argument of periapsis), M (mean anomaly)}
 * @param {number} mu - Standard gravitational parameter (GM)
 * @returns {Object} Position and velocity vectors {position: Vector3, velocity: Vector3}
 */
export function orbitalElementsToStateVectors(elements, mu = GM_SUN_SI) {
    const { a, e, i, o, w, M } = elements;

    // Convert semi-major axis from AU to meters if it's in AU
    const a_meters = a > 1000000 ? a : a * AU_METERS; // If a > 1 million, assume it's already in meters

    // Convert angles from degrees to radians
    const i_rad = i * Math.PI / 180;
    const o_rad = o * Math.PI / 180;
    const w_rad = w * Math.PI / 180;
    const M_rad = M * Math.PI / 180;

    // Solve Kepler's equation to get eccentric anomaly
    const E = solveKeplerEquation(M_rad, e);

    // Calculate position and velocity in the orbital plane
    const cosE = Math.cos(E);
    const sinE = Math.sin(E);

    // Position in orbital plane (in meters)
    const r_x = a_meters * (cosE - e);
    const r_y = a_meters * Math.sqrt(1 - e * e) * sinE;

    // Velocity in orbital plane
    const n = Math.sqrt(mu / (a_meters * a_meters * a_meters)); // Mean motion
    const v_x = -a_meters * n * sinE / (1 - e * cosE);
    const v_y = a_meters * Math.sqrt(1 - e * e) * n * cosE / (1 - e * cosE);

    // Magnitude of position vector
    const r_mag = a_meters * (1 - e * cosE);

    // Position and velocity vectors in 3D space
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    // Apply orbital element transformations
    // Rotation matrix for converting from orbital plane to 3D space
    const cos_o = Math.cos(o_rad);
    const sin_o = Math.sin(o_rad);
    const cos_w = Math.cos(w_rad);
    const sin_w = Math.sin(w_rad);
    const cos_i = Math.cos(i_rad);
    const sin_i = Math.sin(i_rad);

    // COORDINATE SYSTEM FIX:
    // Three.js uses Y-Up. Keplerian math usually produces Z-Up (Inclination relative to XY plane).
    // We must map Math-Z to Three-Y, and Math-Y to Three-Z.

    // Position
    pos.x = r_x * (cos_o * cos_w - sin_o * sin_w * cos_i) +
        r_y * (-cos_o * sin_w - sin_o * cos_w * cos_i);

    // Three-Y (Height/Inclination) comes from Math-Z terms (P31, P32)
    pos.y = r_x * (sin_w * sin_i) + r_y * (cos_w * sin_i);

    // Three-Z (Depth/Planar Y) comes from Math-Y terms (P21, P22)
    pos.z = r_x * (sin_o * cos_w + cos_o * sin_w * cos_i) +
        r_y * (-sin_o * sin_w + cos_o * cos_w * cos_i);

    // Velocity
    vel.x = v_x * (cos_o * cos_w - sin_o * sin_w * cos_i) +
        v_y * (-cos_o * sin_w - sin_o * cos_w * cos_i);

    // Three-Y (Height Velocity)
    vel.y = v_x * (sin_w * sin_i) + v_y * (cos_w * sin_i);

    // Three-Z (Depth Velocity)
    vel.z = v_x * (sin_o * cos_w + cos_o * sin_w * cos_i) +
        v_y * (-sin_o * sin_w + cos_o * cos_w * cos_i);

    return { position: pos, velocity: vel };
}

/**
 * Solve Kepler's equation using Newton-Raphson method
 * @param {number} M - Mean anomaly (radians)
 * @param {number} e - Eccentricity
 * @returns {number} Eccentric anomaly (radians)
 */
export function solveKeplerEquation(M, e) {
    // Normalize mean anomaly to [0, 2π]
    let M_norm = M % (2 * Math.PI);
    if (M_norm < 0) M_norm += 2 * Math.PI;

    // Initial guess
    let E = M_norm;

    // Iteration parameters
    const tolerance = 1e-12;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
        const f = E - e * Math.sin(E) - M_norm;
        const f_prime = 1 - e * Math.cos(E);

        const delta = f / f_prime;
        E = E - delta;

        if (Math.abs(delta) < tolerance) {
            break;
        }
    }

    return E;
}

/**
 * Calculate true anomaly from eccentric anomaly
 * @param {number} E - Eccentric anomaly (radians)
 * @param {number} e - Eccentricity
 * @returns {number} True anomaly (radians)
 */
export function trueAnomalyFromEccentric(E, e) {
    const cos_E = Math.cos(E);
    const sin_E = Math.sin(E);

    const tan_v_2 = Math.sqrt(1 + e) * sin_E / (Math.sqrt(1 - e) * (1 - e * cos_E));
    const v = 2 * Math.atan(tan_v_2);

    // Ensure result is positive
    return v < 0 ? v + 2 * Math.PI : v;
}

/**
 * Calculate heliocentric distance from orbital elements
 * @param {number} a - Semi-major axis (AU)
 * @param {number} e - Eccentricity
 * @param {number} v - True anomaly (radians)
 * @returns {number} Distance from Sun (AU)
 */
export function heliocentricDistance(a, e, v) {
    return a * (1 - e * e) / (1 + e * Math.cos(v));
}

/**
 * Calculate non-gravitational forces for comets using Marsden-Sekanina model
 * @param {THREE.Vector3} position - Position vector (meters from Sun)
 * @param {THREE.Vector3} velocity - Velocity vector (m/s)
 * @param {Object} ngParams - Non-gravitational parameters {A1, A2, A3}
 * @param {boolean} isOutbound - Whether the comet is outbound from perihelion (for thermal hysteresis)
 * @returns {THREE.Vector3} Acceleration due to non-gravitational forces (m/s²)
 */
export function calculateNonGravitationalForces(position, velocity, ngParams = { A1: 0, A2: 0, A3: 0 }, isOutbound = false) {
    // Calculate distance from Sun in AU
    const r_magnitude = position.length();
    const r_au = r_magnitude / AU_METERS;

    // Calculate the sublimation function g(r) based on Rickman et al. 1987
    let g_r = sublimationFunction(r_au);

    // Apply thermal hysteresis effect for post-perihelion activity
    if (isOutbound) {
        g_r *= 1.8; // Enhancement factor for thermal hysteresis
    }

    // Define unit vectors for the non-gravitational force model
    const r_unit = position.clone().normalize();  // Radial direction (away from Sun)

    // Calculate angular momentum vector
    const h = new THREE.Vector3().crossVectors(position, velocity);
    const h_unit = h.clone().normalize();  // Normal direction (perpendicular to orbital plane)

    // Transverse direction (in orbital plane, perpendicular to radius vector)
    const t_unit = new THREE.Vector3().crossVectors(h_unit, r_unit).normalize();

    // Calculate non-gravitational acceleration components
    const a_radial = ngParams.A1 * g_r;
    const a_transverse = ngParams.A2 * g_r;
    const a_normal = ngParams.A3 * g_r;

    // Calculate total non-gravitational acceleration
    const ng_acceleration = new THREE.Vector3();
    ng_acceleration.addScaledVector(r_unit, a_radial);
    ng_acceleration.addScaledVector(t_unit, a_transverse);
    ng_acceleration.addScaledVector(h_unit, a_normal);

    return ng_acceleration;
}

/**
 * Sublimation function g(r) for cometary activity
 * Based on the model by Rickman, Lindblad, and Nieminen (1987)
 * @param {number} r_au - Distance from Sun in AU
 * @returns {number} Activity function value
 */
export function sublimationFunction(r_au) {
    // Standard parameters for the sublimation function
    const r0 = 2.808;  // Characteristic distance (AU)
    const m = 2.15;    // Exponent for inner region
    const n = 5.093;   // Exponent for outer region
    const k = 4.6142;  // Scaling exponent

    // Calculate g(r) using the empirical formula
    const innerTerm = Math.pow(r_au / r0, -m);
    const outerTerm = Math.pow(1 + Math.pow(r_au / r0, n), -k);

    return innerTerm * outerTerm;
}

/**
 * Calculate total acceleration for a comet (gravitational + non-gravitational)
 * @param {THREE.Vector3} position - Position vector (meters from Sun)
 * @param {THREE.Vector3} velocity - Velocity vector (m/s)
 * @param {Object} ngParams - Non-gravitational parameters {A1, A2, A3}
 * @param {boolean} isOutbound - Whether the comet is outbound from perihelion (for thermal hysteresis)
 * @returns {THREE.Vector3} Total acceleration (m/s²)
 */
export function calculateTotalAcceleration(position, velocity, ngParams = { A1: 0, A2: 0, A3: 0 }, isOutbound = false) {
    // Calculate gravitational acceleration (Newtonian)
    const r_magnitude = position.length();
    const r_unit = position.clone().normalize();

    // Gravitational acceleration magnitude (m/s²)
    const g_acc_magnitude = GM_SUN_SI / (r_magnitude * r_magnitude);

    // Gravitational acceleration vector (pointing toward Sun)
    const grav_acceleration = r_unit.multiplyScalar(-g_acc_magnitude);

    // Calculate non-gravitational acceleration
    const ng_acceleration = calculateNonGravitationalForces(position, velocity, ngParams, isOutbound);

    // Total acceleration is the sum of both
    return new THREE.Vector3().addVectors(grav_acceleration, ng_acceleration);
}

/**
 * Advance comet state using numerical integration
 * @param {Object} state - Current state {position: Vector3, velocity: Vector3}
 * @param {number} dt - Time step (seconds)
 * @param {Object} ngParams - Non-gravitational parameters {A1, A2, A3}
 * @param {boolean} isOutbound - Whether the comet is outbound from perihelion (for thermal hysteresis)
 * @returns {Object} New state {position: Vector3, velocity: Vector3}
 */
export function integrateCometMotion(state, dt, ngParams = { A1: 0, A2: 0, A3: 0 }, isOutbound = false) {
    // Use a more accurate Runge-Kutta 4th order (RK4) integration for better precision
    // This is especially important for comets with highly eccentric orbits
    const { position, velocity } = state;

    // RK4 integration
    // Stage 1: k1 = f(t_n, y_n)
    const k1_v = velocity.clone();
    const k1_a = calculateTotalAcceleration(position, velocity, ngParams, isOutbound);

    // Stage 2: k2 = f(t_n + dt/2, y_n + dt*k1/2)
    const k2_pos = position.clone().add(k1_v.clone().multiplyScalar(dt / 2));
    const k2_vel = velocity.clone().add(k1_a.clone().multiplyScalar(dt / 2));
    const k2_a = calculateTotalAcceleration(k2_pos, k2_vel, ngParams, isOutbound);

    // Stage 3: k3 = f(t_n + dt/2, y_n + dt*k2/2)
    const k3_pos = position.clone().add(k2_vel.clone().multiplyScalar(dt / 2));
    const k3_vel = velocity.clone().add(k2_a.clone().multiplyScalar(dt / 2));
    const k3_a = calculateTotalAcceleration(k3_pos, k3_vel, ngParams, isOutbound);

    // Stage 4: k4 = f(t_n + dt, y_n + dt*k3)
    const k4_pos = position.clone().add(k3_vel.clone().multiplyScalar(dt));
    const k4_vel = velocity.clone().add(k3_a.clone().multiplyScalar(dt));
    const k4_a = calculateTotalAcceleration(k4_pos, k4_vel, ngParams, isOutbound);

    // Combine the stages
    const newPosition = position.clone()
        .add(k1_v.clone().multiplyScalar(dt / 6))
        .add(k2_vel.clone().multiplyScalar(dt / 3))
        .add(k3_vel.clone().multiplyScalar(dt / 3))
        .add(k4_vel.clone().multiplyScalar(dt / 6));

    const newVelocity = velocity.clone()
        .add(k1_a.clone().multiplyScalar(dt / 6))
        .add(k2_a.clone().multiplyScalar(dt / 3))
        .add(k3_a.clone().multiplyScalar(dt / 3))
        .add(k4_a.clone().multiplyScalar(dt / 6));

    return { position: newPosition, velocity: newVelocity };
}

/**
 * Calculate orbital energy (specific mechanical energy)
 * @param {THREE.Vector3} position - Position vector (meters from Sun)
 * @param {THREE.Vector3} velocity - Velocity vector (m/s)
 * @param {number} mu - Standard gravitational parameter (m³/s²)
 * @returns {number} Specific mechanical energy (J/kg)
 */
export function calculateOrbitalEnergy(position, velocity, mu = GM_SUN_SI) {
    const r = position.length();
    const v_squared = velocity.lengthSq();

    return v_squared / 2 - mu / r;
}

/**
 * Calculate orbital period from semi-major axis
 * @param {number} a - Semi-major axis (meters)
 * @param {number} mu - Standard gravitational parameter (m³/s²)
 * @returns {number} Orbital period (seconds)
 */
export function calculateOrbitalPeriod(a, mu = GM_SUN_SI) {
    return 2 * Math.PI * Math.sqrt(a * a * a / mu);
}

/**
 * Calculate next perihelion passage time
 * @param {Object} elements - Current orbital elements
 * @param {number} currentTime - Current time (JD)
 * @returns {number} Time of next perihelion passage (JD)
 */
export function calculateNextPerihelion(elements, currentTime) {
    // Convert mean anomaly to epoch of perihelion passage
    const { a, e, M, T } = elements; // T is time of perihelion passage

    // For a complete implementation, we would need to calculate the 
    // time difference based on the current position in the orbit
    // This is a simplified approach assuming we have the time of perihelion

    // If we don't have T, we can estimate it from the current mean anomaly
    if (T === undefined) {
        // Calculate mean motion
        const n = Math.sqrt(GM_SUN_SI / (a * a * a)); // rad/s

        // Calculate time since perihelion passage
        const timeSincePeri = M / n; // seconds

        // Estimate next perihelion
        const period = calculateOrbitalPeriod(a);
        return currentTime + (period - timeSincePeri) / 86400; // Convert to days
    }

    return T;
}

/**
 * Calculate comet's water production rate
 * @param {number} r_au - Distance from Sun in AU
 * @param {boolean} isOutbound - Whether the comet is outbound from perihelion
 * @returns {number} Water production rate (molecules/s)
 */
export function calculateWaterProductionRate(r_au, isOutbound = false) {
    // Advanced model based on observational data for Halley's comet
    // Production rate typically follows Q = Q0 * (r_au)^(-k) where k is ~2.5-3.5

    // Base production rate at 1 AU (molecules/s)
    const Q0 = 5e28; // Typical for Halley's comet

    // Exponent for distance dependence
    const k = 2.54;

    // Calculate base production
    let Q = Q0 * Math.pow(r_au, -k);

    // Apply thermal hysteresis effect for post-perihelion activity
    // The subsurface layers continue to release gas even as the comet moves away from the Sun
    if (isOutbound) {
        // Enhanced activity post-perihelion due to thermal lag
        Q *= 1.8; // Post-perihelion enhancement factor based on thermal hysteresis
    } else if (r_au < 0.8) {
        // Pre-perihelion enhancement as the comet approaches the Sun
        Q *= 1.2; // Slight enhancement as temperature rises
    }

    return Q;
}

/**
 * Calculate comet's dust production rate
 * @param {number} r_au - Distance from Sun in AU
 * @param {number} phaseAngle - Phase angle (degrees)
 * @returns {number} Dust production rate
 */
export function calculateDustProductionRate(r_au, phaseAngle = 0) {
    // Simplified model for dust production
    const baseRate = 1000; // Arbitrary units
    const distanceFactor = Math.pow(r_au, -2.0);
    const phaseFactor = 1.0 + 0.01 * phaseAngle; // Simple phase angle correction

    return baseRate * distanceFactor * phaseFactor;
}
// Add newline at end of file
