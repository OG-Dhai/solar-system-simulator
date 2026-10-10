/**
 * @fileoverview Hilfsfunktionen für die Sonnensystem-Simulation.
 * Enthält Hilfsfunktionen, prozedurale Generierung und Ressourcenverwaltung.
 * @module Utils
 */

import * as THREE from 'three';
import { CELESTIAL_DATA, NASA_PLANETS, NASA_MOONS } from './NASAOrbitalData.js';
import { calculateOrbitalPosition as _solvePrecisePosition } from '../core/KeplerSolver.js';
import { AU_SCALE, AU_KM } from './Constants.js';
import { seededRandom } from './MathHelpers.js';

// AU in Metern für interne Physikberechnungen definieren
const AU_METERS = AU_KM * 1000; // Konvertiere km zu Metern

export { degToRad, seededRandom } from './MathHelpers.js';

// Konstanten exportieren
export {
    AU_SCALE as AU, // Alias für Rückwärtskompatibilität falls benötigt, bevorzuge AU_SCALE
    SCALE_FACTORS,
    SECONDS_PER_DAY,
    TIME_SCALE,
    MOON_ORBIT_VISUAL_MULTIPLIER,
    ROTATION_VISUAL_MULTIPLIER,
    GAS_GIANTS,
    AU_KM,
    GM_SUN,
    YEAR_SECONDS
} from './Constants.js';

// AU in Metern separat exportieren da nicht in Constants.js
export { AU_METERS };

export {
    NASA_PLANETS,
    NASA_MOONS,
    CELESTIAL_DATA,
    HALLEY_DATA,
    ASTEROID_BELT,
    ASTEROID_BELT_SECONDARY,
    KUIPER_BELT,
    KUIPER_BELT_SECONDARY
} from './NASAOrbitalData.js';

// KeplerSolver-Funktionen re-exportieren
export {
    solveKepler,
    getTrueAnomaly,
    calculateOrbitalVelocity,
    validateOrbitalElements,
    runSelfTest as runKeplerSelfTest,
    NUMERICAL_TOLERANCE
} from '../core/KeplerSolver.js';


/**
 * Gibt ein Array aller Planeten-Schlüssel aus CELESTIAL_DATA zurück.
 * @returns {string[]} Array von Planeten-Schlüsseln
 */
export function getPlanets() {
    return Object.keys(CELESTIAL_DATA).filter(k => CELESTIAL_DATA[k].type === 'planet');
}

/**
 * Gibt ein Array von Mond-Schlüsseln für einen gegebenen Elternkörper zurück.
 * @param {string} k - Der Schlüssel des Elternkörpers
 * @returns {string[]} Array von Mond-Schlüsseln
 */
export function getMoons(k) {
    return CELESTIAL_DATA[k]?.moons || [];
}

/**
 * Orbitalelemente-Adapter-Cache (Modulebene)
 */
const _orbitAdapter = {
    a: 0, e: 0, i: 0, Omega: 0, w: 0, M: 0
};

/**
 * Berechnet die 3D-Position eines Körpers in seinem Orbit bei einer gegebenen Mittleren Anomalie.
 * Wrapper um KeplerSolver zur Anpassung des CELESTIAL_DATA-Formats.
 * 
 * @param {Object} orbitData - Orbitaldaten aus lokaler Struktur
 * @param {number} meanAnomaly - Aktuelle Mittlere Anomalie (Bogenmaß)
 * @param {THREE.Vector3} [target] - Optionaler Zielvektor
 * @returns {THREE.Vector3} Position im 3D-Raum
 */
export function calculateOrbitalPosition(orbitData, meanAnomaly, target = new THREE.Vector3()) {
    if (!orbitData || typeof meanAnomaly !== 'number') {
        return target.set(0, 0, 0);
    }

    _orbitAdapter.a = orbitData.a;
    _orbitAdapter.e = orbitData.e;
    _orbitAdapter.i = orbitData.i;
    _orbitAdapter.Omega = orbitData.o;
    _orbitAdapter.w = orbitData.w;
    _orbitAdapter.M = meanAnomaly;

    return _solvePrecisePosition(_orbitAdapter, true, AU_SCALE, target);
}

/**
 * Generiert Transformationsdaten für einen Asteroiden bei einem gegebenen Index.
 * Verwendet Seeded-Random für deterministische Platzierung.
 * 
 * @param {number} index - Asteroidenindex (wird als Seed verwendet)
 * @param {Object} config - Gürtelkonfiguration
 * @returns {Object} Transformationsdaten mit Position, Rotation und Skalierung
 */
export function generateAsteroidTransform(index, config) {
    const rand = seededRandom(index);
    const dist = config.innerRadius + rand() * (config.outerRadius - config.innerRadius);
    const angle = rand() * Math.PI * 2;
    const y = (rand() - 0.5) * 5;
    const size = 0.05 + rand() * 0.1;

    return {
        position: new THREE.Vector3(Math.cos(angle) * dist, y, Math.sin(angle) * dist),
        rotation: new THREE.Euler(rand(), rand(), rand()),
        scale: new THREE.Vector3(size, size, size),
        distance: dist,
        initialAngle: angle,
        orbitalPeriod: Math.sqrt(Math.pow(dist / AU_SCALE, 3)) * 365.25 * 86400, // Keplers drittes Gesetz
        rotationSpeed: rand() * 0.5
    };
}

/**
 * Skaliert die Orbitaldistanz eines Körpers für visuelle Klarheit.
 * @param {number} auDistance - Distanz in AU
 * @param {number} [scaleFactor=1.0] - Optionaler Skalierungsfaktor
 * @returns {number} Skalierte Distanz
 */
export function distanceScale(auDistance, scaleFactor = 1.0) {
    return auDistance * scaleFactor;
}

/**
 * Gibt ein Three.js-Objekt und alle seine Ressourcen frei.
 * Behandelt Geometrie, Materialien, Texturen und Kinder rekursiv.
 * 
 * @param {THREE.Object3D} object - Das freizugebende Three.js-Objekt
 * @param {boolean} [removeFromParent=true] - Ob vom Elternobjekt entfernt werden soll
 */
export function disposeThreeObject(object, removeFromParent = true) {
    if (!object) return;

    while (object.children.length > 0) {
        disposeThreeObject(object.children[0], true);
    }

    if (object.geometry) {
        object.geometry.dispose();
    }

    if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
            const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap',
                'emissiveMap', 'bumpMap', 'aoMap', 'alphaMap', 'envMap', 'lightMap'];
            textureProps.forEach(prop => {
                if (material[prop]) {
                    material[prop].dispose();
                }
            });
            material.dispose();
        });
    }

    if (removeFromParent && object.parent) {
        object.parent.remove(object);
    }
}
