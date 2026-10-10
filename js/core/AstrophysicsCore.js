/**
 * AstrophysicsCore.js
 * Modul zur Berechnung der Orbitaldynamik und Anwendung des Marsden-Sekanina-Modells
 * 
 * Wissenschaftliche Referenzen:
 * [2] Marsden et al. (1973) - Grundformeln für nicht-gravitationale Kräfte
 * Schleicher et al. - Wasserproduktionsraten für Halley's Komet
 * 
 * @module AstrophysicsCore
 */

import * as THREE from 'three';
import { AU_METERS } from '../utils/Utils.js';

// Astronomische Konstanten (SI-Einheiten)
const G = 6.67430e-11;            // Gravitationskonstante (m³/(kg·s²))
const SOL_MASS = 1.98847e30;      // Sonnenmasse (kg)
const GM = G * SOL_MASS;          // Standardgravitationsparameter der Sonne

// Sublimationsmodell-Konstanten für Wassereis
const SUBLIMATION_PARAMS = {
    r0: 2.808,      // AU
    m: 2.15,
    n: 5.093,
    k: 4.6142,
    alpha: 0.111262 // Normalisierungskonstante
};

// Nicht-gravitationale Kräfte-Parameter für Halley (Epoche 1986)
const HALLEY_NON_GRAV = {
    A1: 0.0,             // Radiale Kraft (oft vernachlässigt)
    A2: 1.5e-8,          // Transversale Kraft (Haupteinfluss auf Orbitalperiode)
    A3: 0.0              // Normale Kraft
};

/**
 * Berechnet den Skalierungsfaktor g(r) basierend auf der Sonnendistanz
 * @param {number} r_au - Distanz zur Sonne in AU
 * @returns {number} - g(r) Wert
 */
function calculate_g(r_au) {
    const { r0, m, n, k, alpha } = SUBLIMATION_PARAMS;

    const term1 = Math.pow(r_au / r0, -m);
    const inner_term = 1 + Math.pow(r_au / r0, n);
    const term2 = Math.pow(inner_term, -k);

    return alpha * term1 * term2;
}

/**
 * Berechnet den Gesamtbeschleunigungsvektor (Gravitation + nicht-gravitativ)
 * @param {THREE.Vector3} position - Positionsvektor (Meter)
 * @param {THREE.Vector3} velocity - Geschwindigkeitsvektor (m/s)
 * @returns {THREE.Vector3} - Beschleunigungsvektor (m/s²)
 */
export function computeTotalAcceleration(position, velocity) {
    const r_vec = position.clone();
    const r_mag = r_vec.length(); // Distanz in Metern
    const r_au = r_mag / AU_METERS; // Distanz in AU

    // 1. Newton'sche Gravitationsbeschleunigung: a = -GM/r³ * r
    // Negatives Vorzeichen, da Kraft anziehend ist (entgegengesetzt zum Positionsvektor)
    const gravity_mag = GM / (r_mag * r_mag * r_mag);
    const acc_gravity = r_vec.clone().multiplyScalar(-gravity_mag);

    // 2. Nicht-gravitationale Beschleunigung (Marsden-Sekanina)
    const g_val = calculate_g(r_au);

    // Definition der lokalen Orbital-Einheitsvektoren
    const u_r = position.clone().normalize(); // Radialer Vektor

    // Transversaler Vektor: senkrecht zum Radius in der Orbitalebene
    // Berechnung über Drehimpuls: h = r × v
    const h = new THREE.Vector3().crossVectors(position, velocity);
    // u_t = (h × u_r) / |h| -> garantiert Orthogonalität
    const u_t = new THREE.Vector3().crossVectors(h, u_r).normalize();

    // Normaler Vektor: senkrecht zur Orbitalebene
    const u_n = h.clone().normalize();

    // Komposition der nicht-gravitativen Kraft
    const acc_ng = new THREE.Vector3();
    acc_ng.addScaledVector(u_r, HALLEY_NON_GRAV.A1 * g_val);
    acc_ng.addScaledVector(u_t, HALLEY_NON_GRAV.A2 * g_val);
    acc_ng.addScaledVector(u_n, HALLEY_NON_GRAV.A3 * g_val);

    // Endergebnis: Summe beider Vektoren
    return acc_gravity.add(acc_ng);
}

/**
 * Berechnet die Wasserproduktionsrate Q(H2O) für visuelle Darstellung
 * Berücksichtigt thermische Hysterese
 * @param {number} r_au - Distanz in AU
 * @param {boolean} isOutbound - Entfernt sich der Komet von der Sonne?
 * @returns {number} - Produktionsrate (Moleküle/Sekunde)
 */
export function calculateWaterProduction(r_au, isOutbound) {
    // Grundgleichung für Prä-Perihel-Phase
    // Q = 4.36e29 * r^-2.54
    let Q = 4.36e29 * Math.pow(r_au, -2.54);

    // Post-Perihel-Korrektur (erhöhte Aktivität)
    if (isOutbound) {
        Q *= 1.8;
    }

    return Q;
}

/**
 * Hilfsfunktion zur Bestimmung ob Komet sich von Sonne entfernt (für thermische Hysterese)
 * @param {number} currentDistance - Aktuelle Sonnendistanz
 * @param {number} previousDistance - Vorherige Sonnendistanz
 * @returns {boolean} - true wenn Komet sich entfernt
 */
export function isOutbound(currentDistance, previousDistance) {
    return currentDistance > previousDistance;
}

/**
 * Orbitberechnung mittels numerischer Integration (Symplektisches Euler-Verfahren)
 * @param {Object} state - Aktueller Zustand {position: THREE.Vector3, velocity: THREE.Vector3}
 * @param {number} dt - Zeitschritt
 * @returns {Object} - Neuer Zustand nach Integration
 */
export function integrateMotion(state, dt) {
    // Beschleunigung an aktueller Position berechnen
    const acceleration = computeTotalAcceleration(state.position, state.velocity);

    // Aktuellen Zustand kopieren um direkte Modifikation zu vermeiden
    const newState = {
        position: state.position.clone(),
        velocity: state.velocity.clone()
    };

    // 1. Geschwindigkeit aktualisieren: v = v + a * dt
    const deltaV = acceleration.clone().multiplyScalar(dt);
    newState.velocity.add(deltaV);

    // 2. Position aktualisieren: r = r + v * dt
    const deltaR = newState.velocity.clone().multiplyScalar(dt);
    newState.position.add(deltaR);

    return newState;
}

/**
 * Berechnet die lokalen Orbital-Referenzvektoren
 * @param {THREE.Vector3} position - Positionsvektor
 * @param {THREE.Vector3} velocity - Geschwindigkeitsvektor
 * @returns {Object} - Enthält u_r, u_t, u_n
 */
export function calculateLocalOrbitalFrame(position, velocity) {
    // Radialer Vektor
    const u_r = position.clone().normalize();

    // Drehimpuls (Angular Momentum)
    const h = new THREE.Vector3().crossVectors(position, velocity);

    // Transversaler Vektor
    const u_t = new THREE.Vector3().crossVectors(h, u_r).normalize();

    // Normaler Vektor
    const u_n = h.clone().normalize();

    return { u_r, u_t, u_n };
}
