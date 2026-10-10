/**
 * @fileoverview Mathematische Hilfsfunktionen.
 * @module MathHelpers
 */

import * as THREE from 'three';

/**
 * Konvertiert Grad in Bogenmaß.
 * @param {number} d - Winkel in Grad
 * @returns {number} Winkel in Bogenmaß
 */
export function degToRad(d) {
    return d * (Math.PI / 180);
}

/**
 * Erstellt einen Pseudozufallszahlengenerator mit Seed.
 * Verwendet einen Linear Congruential Generator (LCG) Algorithmus.
 * Nützlich für deterministische prozedurale Generierung.
 * 
 * @param {number} s - Seed-Wert
 * @returns {function(): number} Funktion die Zufallszahlen 0-1 zurückgibt
 */
export function seededRandom(s) {
    let m = s;
    return () => {
        m = (m * 1103515245 + 12345) & 0x7fffffff;
        return m / 0x7fffffff;
    };
}
