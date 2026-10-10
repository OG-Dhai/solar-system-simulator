/**
 * @fileoverview Zentralisierte Physik- und Simulationskonstanten (Single Source of Truth)
 * 
 * "Code Complete" Konformität:
 * - Einzige Wahrheitsquelle für alle physikalischen Konstanten
 * - Dokumentiert mit NASA JPL Horizons / IAU Referenzen
 * - Kategorisiert nach Domäne (Physik, Simulation, Zeit)
 * 
 * @module Constants
 */

// =============================================================================
// UNIVERSELLE PHYSIKKONSTANTEN (NASA/IAU)
// =============================================================================

/**
 * Astronomische Einheit in Kilometern (IAU 2012 Definition)
 * Exakter Wert: 149.597.870,700 km
 * @constant {number}
 */
export const AU_KM = 149597870.700;

/**
 * Gravitationskonstante G (m^3 kg^-1 s^-2)
 * CODATA 2018 Wert
 * @constant {number}
 */
export const G = 6.67430e-11;

/**
 * Standard-Gravitationsparameter der Sonne (μ = GM)
 * km^3/s^2 (JPL DE440)
 * @constant {number}
 */
export const GM_SUN = 1.32712440018e11;

/**
 * Ein Julianisches Jahr in Sekunden (IAU)
 * 365,25 Tage * 86400 Sekunden
 * @constant {number}
 */
export const YEAR_SECONDS = 31557600;

/**
 * Ein Tag in Sekunden
 * @constant {number}
 */
export const SECONDS_PER_DAY = 86400;


// =============================================================================
// SIMULATIONS-SKALENKONSTANTEN
// =============================================================================

/** 
 * Simulationsmaßstab: Koordinaten zu AU Verhältnis.
 * 1 AU = 50 Three.js Einheiten.
 * @constant {number}
 */
export const AU_SCALE = 50;

/**
 * Skalierungsfaktoren für verschiedene Aspekte der Simulation.
 * @constant {Object}
 */
export const SCALE_FACTORS = {
    SIZE: 0.001,
    DISTANCE: 0.5,
    TIME: 0.1
};


// =============================================================================
// SIMULATIONSKONFIGURATION
// =============================================================================

/**
 * Zeitskalierungsfaktor für Orbitalbewegung.
 * Konvertiert Simulationszeit (Sekunden) zu Orbitalfortschritt.
 * 0,5 / 86400 ergibt physikalisch ansprechende Geschwindigkeiten relativ zur Echtzeit.
 * @constant {number}
 */
export const TIME_SCALE = 1.0 / 86400.0;

/**
 * Visueller Multiplikator für Mond-Orbitalgeschwindigkeit (erzeugt Parallaxe/Sichtbarkeit).
 * Auf 1,0 setzen für strikte physikalische Genauigkeit.
 * @constant {number}
 */
export const MOON_ORBIT_VISUAL_MULTIPLIER = 1.0;

/**
 * Visueller Multiplikator für Planetenrotation (macht Rotation sichtbar).
 * @constant {number}
 */
export const ROTATION_VISUAL_MULTIPLIER = 1000;

/**
 * Kepler-Löser-Toleranz (hohe Präzision)
 * @constant {number}
 */
export const NUMERICAL_TOLERANCE = 1e-15;

/** 
 * Gasriesen-Liste für Shader/Material-Logik 
 * @constant {string[]}
 */
export const GAS_GIANTS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune'];

/**
 * Visueller Skalierungsmultiplikator für Monde (macht sie sichtbar)
 * Kleine Monde wie Phobos (0,00175) benötigen hohe Skalierung für Sichtbarkeit
 * Auf 1,0 setzen für strikte physikalische Genauigkeit
 * @constant {number}
 */
export const MOON_VISUAL_SCALE = 1.0;

/**
 * Orbitaldistanz-Multiplikator für Monde (erhöht Orbitaldistanz für Sichtbarkeit)
 * @constant {number}
 */
export const MOON_ORBIT_SCALE = 1.0;
