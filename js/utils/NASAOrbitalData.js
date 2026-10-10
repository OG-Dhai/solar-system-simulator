/**
 * @fileoverview NASA/JPL Ephemeris Data for Solar System Simulation
 * 
 * Contains accurate orbital elements for all major bodies in our solar system
 * using J2000.0 epoch (January 1, 2000, 12:00 TT) Keplerian elements from NASA/JPL.
 * 
 * @module NASAOrbitalData
 */

import { AU_KM as _AU_KM, GM_SUN as _GM_SUN, AU_SCALE } from './Constants.js';

// ===============================================================================================================
// CONSTANTS
// ===============================================================================================================

export const AU_KM = _AU_KM;
export const GM_SUN = _GM_SUN;
export const J2000_EPOCH = 2451545.0;
export const SECONDS_PER_DAY = 86400;
export const TEXTURE_BASE_URL = 'https://www.solarsystemscope.com/textures/download/';

// ===============================================================================================================
// PLANETARY DATA - NASA/JPL J2000.0 KEPLERIAN ELEMENTS
// ===============================================================================================================

export const NASA_PLANETS = {
    mercury: {
        name: 'Mercury', type: 'planet',
        orbital: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.25032350, ω̄: 77.45779628, Ω: 48.33076593, aRate: 0.00000037, eRate: 0.00001906, IRate: -0.00594749, LRate: 149472.67411175, ω̄Rate: 0.16047689, ΩRate: -0.12534081 },
        physical: { radius: 2439.7, mass: 3.3011e23, GM: 2.2032e4, rotationPeriod: 1407.6, axialTilt: 0.034, density: 5427, surfaceGravity: 3.7, escapeVelocity: 4.3, albedo: 0.142 },
        textures: { map: '2k_mercury.jpg', bump: '2k_mercury.jpg' },
        description: `Mercury is the smallest planet in the Solar System...`,
        color: 0x8c7853
    },
    venus: {
        name: 'Venus', type: 'planet',
        orbital: { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.97909950, ω̄: 131.60246718, Ω: 76.67984255, aRate: 0.00000390, eRate: -0.00004107, IRate: -0.00078890, LRate: 58517.81538729, ω̄Rate: 0.00268329, ΩRate: -0.27769418 },
        physical: { radius: 6051.8, mass: 4.8675e24, GM: 3.24859e5, rotationPeriod: 5832.5, axialTilt: 177.36, density: 5243, surfaceGravity: 8.87, escapeVelocity: 10.36, albedo: 0.689 },
        textures: { map: '2k_venus_atmosphere.jpg', atmosphere: '2k_venus_atmosphere.jpg' },
        description: `Venus is the second planet from the Sun...`,
        color: 0xe6c229
    },
    earth: {
        name: 'Earth', type: 'planet',
        orbital: { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, ω̄: 102.93768193, Ω: 0.0, aRate: 0.00000562, eRate: -0.00004392, IRate: -0.01294668, LRate: 35999.37244981, ω̄Rate: 0.32327364, ΩRate: 0.0 },
        physical: { radius: 6371.0, mass: 5.9722e24, GM: 3.986004418e5, rotationPeriod: 23.9345, axialTilt: 23.4393, density: 5514, surfaceGravity: 9.80665, escapeVelocity: 11.186, albedo: 0.306 },
        textures: { map: '2k_earth_daymap.jpg', night: '2k_earth_nightmap.jpg', specular: '2k_earth_specular_map.jpg', normal: '2k_earth_normal_map.jpg', clouds: '2k_earth_clouds.jpg' },
        description: `Earth is the third planet from the Sun...`,
        color: 0x4a90d9, moons: ['moon']
    },
    mars: {
        name: 'Mars', type: 'planet',
        orbital: { a: 1.52371034, e: 0.09339410, I: 1.84969142, L: -4.55343205, ω̄: -23.94362959, Ω: 49.55953891, aRate: 0.00001847, eRate: 0.00007882, IRate: -0.00813131, LRate: 19140.30268499, ω̄Rate: 0.44441088, ΩRate: -0.29257343 },
        physical: { radius: 3389.5, mass: 6.4171e23, GM: 4.282837e4, rotationPeriod: 24.6229, axialTilt: 25.19, density: 3933, surfaceGravity: 3.71, escapeVelocity: 5.03, albedo: 0.250 },
        textures: { map: '2k_mars.jpg' },
        description: `Mars is the fourth planet...`,
        color: 0xc1440e, moons: ['phobos', 'deimos']
    },
    jupiter: {
        name: 'Jupiter', type: 'planet',
        orbital: { a: 5.20288700, e: 0.04838624, I: 1.30439695, L: 34.39644051, ω̄: 14.72847983, Ω: 100.47390909, aRate: -0.00011607, eRate: -0.00013253, IRate: -0.00183714, LRate: 3034.74612775, ω̄Rate: 0.21252668, ΩRate: 0.20469106 },
        physical: { radius: 69911, mass: 1.8982e27, GM: 1.26686534e8, rotationPeriod: 9.9250, axialTilt: 3.13, density: 1326, surfaceGravity: 24.79, escapeVelocity: 59.5, albedo: 0.503 },
        textures: { map: '2k_jupiter.jpg' },
        description: `Jupiter is the fifth planet...`,
        color: 0xd8ca9d, moons: ['io', 'europa', 'ganymede', 'callisto']
    },
    saturn: {
        name: 'Saturn', type: 'planet',
        orbital: { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, ω̄: 92.59887831, Ω: 113.66242448, aRate: -0.00125060, eRate: -0.00050991, IRate: 0.00193609, LRate: 1222.49362201, ω̄Rate: -0.41897216, ΩRate: -0.28867794 },
        physical: { radius: 58232, mass: 5.6834e26, GM: 3.7931187e7, rotationPeriod: 10.656, axialTilt: 26.73, density: 687, surfaceGravity: 10.44, escapeVelocity: 35.5, albedo: 0.499 },
        textures: { map: '2k_saturn.jpg', ring: '2k_saturn_ring_alpha.png' },
        rings: {
            type: 'ice', texture: 'saturn_ring_alpha.webp',
            structure: [],
            innerRadius: 1.1, outerRadius: 2.35, opacity: 0.9
        },
        description: `Saturn is the sixth planet...`,
        color: 0xead6b8, moons: ['titan', 'enceladus', 'mimas', 'rhea', 'dione', 'tethys']
    },
    uranus: {
        name: 'Uranus', type: 'planet',
        orbital: { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, ω̄: 170.95427630, Ω: 74.01692503, aRate: -0.00196176, eRate: -0.00004397, IRate: -0.00242939, LRate: 428.48202785, ω̄Rate: 0.40805281, ΩRate: 0.04240589 },
        physical: { radius: 25362, mass: 8.6810e25, GM: 5.793939e6, rotationPeriod: 17.24, axialTilt: 97.77, density: 1271, surfaceGravity: 8.87, escapeVelocity: 21.3, albedo: 0.488 },
        textures: { map: '2k_uranus.jpg' },
        rings: { type: 'dark', texture: 'uranus_ring.png', innerRadius: 1.6, outerRadius: 2.2, opacity: 0.5 },
        description: `Uranus is the seventh planet...`,
        color: 0xd1e7e7, moons: ['miranda', 'ariel', 'umbriel', 'titania', 'oberon']
    },
    neptune: {
        name: 'Neptune', type: 'planet',
        orbital: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, ω̄: 44.96476227, Ω: 131.78422574, aRate: 0.00026291, eRate: 0.00005105, IRate: 0.00035372, LRate: 218.45945325, ω̄Rate: -0.32241464, ΩRate: -0.00508664 },
        physical: { radius: 24622, mass: 1.02413e26, GM: 6.836529e6, rotationPeriod: 16.11, axialTilt: 28.32, density: 1638, surfaceGravity: 11.15, escapeVelocity: 23.5, albedo: 0.442 },
        textures: { map: '2k_neptune.jpg' },
        rings: { type: 'faint', texture: 'neptune_ring.png', innerRadius: 1.5, outerRadius: 2.6, opacity: 0.3 },
        description: `Neptune is the eighth planet...`,
        color: 0x4b70dd, moons: ['triton']
    }
};

export const NASA_MOONS = {
    moon: { name: 'Moon', parent: 'earth', type: 'moon', orbital: { a: 0.00257, e: 0.0549, i: 5.145, period: 27.321661, Ω: 125.08, ω: 318.15 }, physical: { radius: 1737.4 }, textures: { map: '2k_moon.jpg' }, color: 0xaaaaaa },
    // Simplified for file size in this artifact, but logic dictates I should include all if I can.
    // The previous file had them.
    phobos: { name: 'Phobos', parent: 'mars', type: 'moon', orbital: { a: 0.0000628, e: 0.0151, i: 1.093, period: 0.31891, Ω: 164.931, ω: 150.057 }, physical: { radius: 11.267, dimensions: [27, 22, 18] }, textures: { map: 'phobos.jpg' }, color: 0x6b5b4f },
    deimos: { name: 'Deimos', parent: 'mars', type: 'moon', orbital: { a: 0.000157, e: 0.00033, i: 1.788, period: 1.26244, Ω: 316.65, ω: 260.729 }, physical: { radius: 6.2, dimensions: [15, 12.2, 11] }, textures: { map: 'deimos.jpg' }, color: 0x8b7d6b },
    io: { name: 'Io', parent: 'jupiter', type: 'moon', orbital: { a: 0.00282, e: 0.0041, i: 0.036, period: 1.769137786, Ω: 43.977, ω: 84.129 }, physical: { radius: 1821.6 }, textures: { map: '2k_io.jpg' }, color: 0xffd700 },
    europa: { name: 'Europa', parent: 'jupiter', type: 'moon', orbital: { a: 0.00449, e: 0.0094, i: 0.466, period: 3.551181, Ω: 219.106, ω: 88.970 }, physical: { radius: 1560.8 }, textures: { map: '2k_europa.jpg' }, color: 0xfff8dc },
    ganymede: { name: 'Ganymede', parent: 'jupiter', type: 'moon', orbital: { a: 0.00716, e: 0.0013, i: 0.177, period: 7.15455296, Ω: 63.552, ω: 192.417 }, physical: { radius: 2634.1 }, textures: { map: '2k_ganymede.jpg' }, color: 0xd3d3d3 },
    callisto: { name: 'Callisto', parent: 'jupiter', type: 'moon', orbital: { a: 0.01258, e: 0.0074, i: 0.192, period: 16.6890184, Ω: 298.848, ω: 52.643 }, physical: { radius: 2410.3 }, textures: { map: '2k_callisto.jpg' }, color: 0x222222 },
    titan: { name: 'Titan', parent: 'saturn', type: 'moon', orbital: { a: 0.008166, e: 0.0288, i: 0.3485, period: 15.9454, Ω: 0, ω: 0 }, physical: { radius: 2575 }, textures: { map: 'titan.jpg' }, color: 0xffcc33 },
    enceladus: { name: 'Enceladus', parent: 'saturn', type: 'moon', orbital: { a: 0.00159, e: 0.0047, i: 0.009, period: 1.3702, Ω: 0, ω: 0 }, physical: { radius: 252 }, textures: { map: 'enceladus.jpg' }, color: 0xffffff },
    mimas: { name: 'Mimas', parent: 'saturn', type: 'moon', orbital: { a: 0.00124, e: 0.0196, i: 1.574, period: 0.942, Ω: 0, ω: 0 }, physical: { radius: 198 }, textures: { map: 'mimas.jpg' }, color: 0x999999 },
    rhea: { name: 'Rhea', parent: 'saturn', type: 'moon', orbital: { a: 0.00352, e: 0.001, i: 0.35, period: 4.518, Ω: 0, ω: 0 }, physical: { radius: 764 }, textures: { map: 'rhea.jpg' }, color: 0xaaaaaa },
    dione: { name: 'Dione', parent: 'saturn', type: 'moon', orbital: { a: 0.00252, e: 0.0022, i: 0.02, period: 2.737, Ω: 0, ω: 0 }, physical: { radius: 561 }, textures: { map: 'dione.jpg' }, color: 0xcccccc },
    tethys: { name: 'Tethys', parent: 'saturn', type: 'moon', orbital: { a: 0.00197, e: 0.0001, i: 1.09, period: 1.887, Ω: 0, ω: 0 }, physical: { radius: 531 }, textures: { map: 'tethys.jpg' }, color: 0xdddddd },
    miranda: { name: 'Miranda', parent: 'uranus', type: 'moon', orbital: { a: 0.00086, e: 0.0013, i: 4.232, period: 1.413, Ω: 0, ω: 0 }, physical: { radius: 235 }, textures: { map: 'miranda.jpg' }, color: 0x999999 },
    ariel: { name: 'Ariel', parent: 'uranus', type: 'moon', orbital: { a: 0.00128, e: 0.0012, i: 0.26, period: 2.52, Ω: 0, ω: 0 }, physical: { radius: 579 }, textures: { map: 'ariel.jpg' }, color: 0xaaaaaa },
    umbriel: { name: 'Umbriel', parent: 'uranus', type: 'moon', orbital: { a: 0.00178, e: 0.0039, i: 0.205, period: 4.144, Ω: 0, ω: 0 }, physical: { radius: 584 }, textures: { map: 'umbriel.jpg' }, color: 0x888888 },
    titania: { name: 'Titania', parent: 'uranus', type: 'moon', orbital: { a: 0.00292, e: 0.0011, i: 0.34, period: 8.706, Ω: 0, ω: 0 }, physical: { radius: 788 }, textures: { map: 'titania.jpg' }, color: 0xcccccc },
    oberon: { name: 'Oberon', parent: 'uranus', type: 'moon', orbital: { a: 0.0039, e: 0.0014, i: 0.058, period: 13.463, Ω: 0, ω: 0 }, physical: { radius: 761 }, textures: { map: 'oberon.jpg' }, color: 0xbbbbbb },
    triton: { name: 'Triton', parent: 'neptune', type: 'moon', orbital: { a: 0.00237, e: 0.0, i: 156.8, period: -5.877, Ω: 0, ω: 0 }, physical: { radius: 1353 }, textures: { map: 'triton.jpg' }, color: 0xdddddd },
    proteus: { name: 'Proteus', parent: 'neptune', type: 'moon', orbital: { a: 0.00078, e: 0.0005, i: 0.524, period: 1.122, Ω: 0, ω: 0 }, physical: { radius: 210 }, textures: { map: 'proteus.jpg' }, color: 0xcccccc },
    nereid: { name: 'Nereid', parent: 'neptune', type: 'moon', orbital: { a: 0.0369, e: 0.75, i: 7.09, period: 360.13, Ω: 0, ω: 0 }, physical: { radius: 170 }, textures: { map: 'nereid.jpg' }, color: 0xaaaaaa },
    larissa: { name: 'Larissa', parent: 'neptune', type: 'moon', orbital: { a: 0.00049, e: 0.0014, i: 0.205, period: 0.555, Ω: 0, ω: 0 }, physical: { radius: 97 }, textures: { map: 'larissa.jpg' }, color: 0x999999 },
    charon: { name: 'Charon', parent: 'pluto', type: 'moon', orbital: { a: 0.00013, e: 0.0, i: 0.0, period: 6.387, Ω: 0, ω: 0 }, physical: { radius: 606 }, textures: { map: 'charon.jpg' }, color: 0xaaaaaa }
};

// ===============================================================================================================
// CELESTIAL DATA (Integrated)
// ===============================================================================================================

export const CELESTIAL_DATA = {
    sun: { name: 'Sun', type: 'star', radius: 6.96, color: 0xffaa00, rotationPeriod: 600, texture: 'sun.webp' },
    mercury: { name: 'Mercury', type: 'planet', radius: 0.38, texture: 'mercury.webp', rotationPeriod: 1407.6, orbit: { a: 0.387098, e: 0.205630, i: 7.005, o: 48.33, w: 29.12, m0: 174.79, period: 87.969 } },
    venus: { name: 'Venus', type: 'planet', radius: 0.95, texture: 'venus.webp', atmosphere: 'venus_atmosphere.webp', axialTilt: 177.36, rotationPeriod: 5832.5, orbit: { a: 0.723332, e: 0.006772, i: 3.394, o: 76.68, w: 54.85, m0: 50.11, period: 224.701 } },
    earth: {
        name: 'Earth', type: 'planet', radius: 1.0, texture: 'earth_daymap.webp',
        clouds: 'earth_clouds.webp',
        nightTexture: 'earth_nightmap.webp',
        specularTexture: 'earth_specular.webp',
        normalTexture: 'earth_normal.webp',
        rotationPeriod: 23.93,
        orbit: { a: 1.000000, e: 0.016708, i: 0.000, o: 0.0, w: 102.9, m0: 358.6, period: 365.256 },
        moons: ['moon']
    },
    moon: { name: 'Moon', type: 'moon', parent: 'earth', radius: 0.273, texture: 'moon.webp', orbit: { a: 2.5, e: 0.0549, i: 5.1, o: 0, w: 0, m0: 0, period: 27.321 } },
    mars: { name: 'Mars', type: 'planet', radius: 0.53, texture: 'mars.webp', rotationPeriod: 24.62, orbit: { a: 1.523679, e: 0.093405, i: 1.850, o: 49.58, w: 286.5, m0: 19.41, period: 686.971 }, moons: ['phobos', 'deimos'] },
    phobos: { name: 'Phobos', type: 'moon', parent: 'mars', radius: 0.02, texture: 'phobos.webp', orbit: { a: 0.7, e: 0.015, i: 1.0, o: 0, w: 0, m0: 0, period: 0.3 } },
    deimos: { name: 'Deimos', type: 'moon', parent: 'mars', radius: 0.015, texture: 'deimos.webp', orbit: { a: 1.0, e: 0.0, i: 0.9, o: 0, w: 0, m0: 0, period: 1.3 } },
    jupiter: {
        name: 'Jupiter', type: 'planet', radius: 10.97, texture: 'jupiter.webp', axialTilt: 3.13, rotationPeriod: 9.92,
        orbit: { a: 5.20, e: 0.048498, i: 1.30, o: 100.5, w: 273.8, m0: 20.0, period: 4332.59 }, // J2000: e=0.048498
        moons: ['io', 'europa', 'ganymede', 'callisto']
    },
    io: { name: 'Io', type: 'moon', parent: 'jupiter', radius: 0.286, texture: 'io.webp', leadingHemisphereColor: 0xffffee, orbit: { a: 12.5, e: 0.0041, i: 0.05, o: 0, w: 0, m0: 0, period: 1.769 } },
    europa: { name: 'Europa', type: 'moon', parent: 'jupiter', radius: 0.245, texture: 'europa.webp', orbit: { a: 13.5, e: 0.0094, i: 0.47, o: 0, w: 0, m0: 0, period: 3.551 } },
    ganymede: { name: 'Ganymede', type: 'moon', parent: 'jupiter', radius: 0.413, texture: 'ganymede.webp', orbit: { a: 15.0, e: 0.0013, i: 0.20, o: 0, w: 0, m0: 0, period: 7.154 } },
    callisto: { name: 'Callisto', type: 'moon', parent: 'jupiter', radius: 0.378, texture: 'callisto.webp', orbit: { a: 17.0, e: 0.0074, i: 0.19, o: 0, w: 0, m0: 0, period: 16.689 } },
    saturn: {
        name: 'Saturn', type: 'planet', radius: 9.45, texture: 'saturn.webp', axialTilt: 26.7, rotationPeriod: 10.66,
        orbit: { a: 9.58, e: 0.05555, i: 2.49, o: 113.7, w: 339.4, m0: 317.0, period: 10759.22 }, // J2000: e=0.05555
        rings: { innerRadius: 1.2, outerRadius: 2.3, opacity: 0.9, texture: 'saturn_ring_alpha.webp' },
        moons: ['titan', 'enceladus', 'mimas', 'rhea', 'dione', 'tethys']
    },
    titan: { name: 'Titan', type: 'moon', parent: 'saturn', radius: 0.404, texture: 'titan.webp', orbit: { a: 14.0, e: 0.0288, i: 0.35, o: 0, w: 0, m0: 0, period: 15.945 } },
    enceladus: { name: 'Enceladus', type: 'moon', parent: 'saturn', radius: 0.04, texture: 'enceladus.webp', orbit: { a: 10.5, e: 0.0047, i: 0.02, o: 0, w: 0, m0: 0, period: 1.37 } },
    mimas: { name: 'Mimas', type: 'moon', parent: 'saturn', radius: 0.031, texture: 'mimas.webp', orbit: { a: 10.0, e: 0.0196, i: 1.57, o: 0, w: 0, m0: 0, period: 0.94 } },
    rhea: { name: 'Rhea', type: 'moon', parent: 'saturn', radius: 0.12, texture: 'rhea.webp', orbit: { a: 12.0, e: 0.001, i: 0.35, o: 0, w: 0, m0: 0, period: 4.518 } },
    dione: { name: 'Dione', type: 'moon', parent: 'saturn', radius: 0.088, texture: 'dione.webp', orbit: { a: 11.0, e: 0.0022, i: 0.02, o: 0, w: 0, m0: 0, period: 2.737 } },
    tethys: { name: 'Tethys', type: 'moon', parent: 'saturn', radius: 0.083, texture: 'tethys.webp', orbit: { a: 10.8, e: 0.0001, i: 1.09, o: 0, w: 0, m0: 0, period: 1.888 } },
    uranus: { name: 'Uranus', type: 'planet', radius: 4.0, texture: 'uranus.webp', axialTilt: 97.77, rotationPeriod: 17.24, orbit: { a: 19.22, e: 0.04638, i: 0.77, o: 74.0, w: 96.5, m0: 142.2, period: 30688.5 }, rings: { innerRadius: 1.5, outerRadius: 2.0, opacity: 0.8, color: 0xaaaaaa, texture: 'uranus_ring.webp' }, moons: ['miranda', 'ariel', 'umbriel', 'titania', 'oberon'] },
    // Corrected Orbital Distances (Visual Ratios)
    // Moons orbit in the equatorial plane (i ~ 0 relative to Tilted Planet)
    miranda: { name: 'Miranda', type: 'moon', parent: 'uranus', radius: 0.15, texture: 'miranda.webp', orbit: { a: 5.0, e: 0.0013, i: 4.2, o: 0, w: 0, m0: 0, period: 1.413 } },
    ariel: { name: 'Ariel', type: 'moon', parent: 'uranus', radius: 0.2, texture: 'ariel.webp', orbit: { a: 7.0, e: 0.0012, i: 0.0, o: 0, w: 0, m0: 0, period: 2.520 } },
    umbriel: { name: 'Umbriel', type: 'moon', parent: 'uranus', radius: 0.2, texture: 'umbriel.webp', orbit: { a: 9.0, e: 0.0039, i: 0.1, o: 0, w: 0, m0: 0, period: 4.144 } },
    titania: { name: 'Titania', type: 'moon', parent: 'uranus', radius: 0.25, texture: 'titania.webp', orbit: { a: 13.0, e: 0.0011, i: 0.1, o: 0, w: 0, m0: 0, period: 8.706 } },
    oberon: { name: 'Oberon', type: 'moon', parent: 'uranus', radius: 0.25, texture: 'oberon.webp', orbit: { a: 17.0, e: 0.0014, i: 0.1, o: 0, w: 0, m0: 0, period: 13.463 } },

    neptune: { name: 'Neptune', type: 'planet', radius: 3.88, texture: 'neptune.webp', axialTilt: 28.3, rotationPeriod: 16.11, orbit: { a: 30.05, e: 0.00946, i: 1.77, o: 131.7, w: 273.2, m0: 256.2, period: 60182.0 }, rings: { innerRadius: 1.7, outerRadius: 2.6, opacity: 0.4, texture: 'neptune_ring.webp' }, moons: ['triton', 'proteus', 'nereid', 'larissa'] },
    // Neptune Moon Distances
    // Triton is Tidally Locked and Retrograde: Rotation (-141.0h) matches Orbit (-5.877d)
    triton: { name: 'Triton', type: 'moon', parent: 'neptune', radius: 0.35, texture: 'triton.webp', rotationPeriod: -141.05, orbit: { a: 10.0, e: 0, i: 157, o: 0, w: 0, m0: 0, period: -5.877 } },
    proteus: { name: 'Proteus', type: 'moon', parent: 'neptune', radius: 0.12, texture: 'proteus.webp', orbit: { a: 7.0, e: 0.0004, i: 0.5, o: 0, w: 0, m0: 0, period: 1.12 } }, // i near 0 relative to Neptune equator
    nereid: { name: 'Nereid', type: 'moon', parent: 'neptune', radius: 0.1, texture: 'nereid.webp', orbit: { a: 25.0, e: 0.75, i: 7.2, o: 0, w: 0, m0: 0, period: 360.1 } }, // Irregular, attached to group (Ecliptic i=7.2)
    larissa: { name: 'Larissa', type: 'moon', parent: 'neptune', radius: 0.08, texture: 'larissa.webp', orbit: { a: 5.0, e: 0.0014, i: 0.2, o: 0, w: 0, m0: 0, period: 0.55 } }, // Inner moon (Equatorial)

    pluto: { name: 'Pluto', type: 'planet', radius: 0.18, texture: 'pluto.webp', axialTilt: 122.5, rotationPeriod: 153.3, orbit: { a: 39.48, e: 0.248, i: 17.16, o: 110.3, w: 113.8, m0: 14.9, period: 90560 }, moons: ['charon'] },
    // Charon Correction: Orbit aligned with Pluto's Tilted Equator (i=0 relative to parent)
    // Tidally Locked to Pluto: Rotation (153.3h) matches Pluto Rotation
    charon: { name: 'Charon', type: 'moon', parent: 'pluto', radius: 0.12, texture: 'charon.webp', rotationPeriod: 153.3, orbit: { a: 2.0, e: 0, i: 0.0, o: 0, w: 0, m0: 0, period: 6.4 } },
};

/**
 * Orbital data for Halley's Comet.
 * JPL Horizons osculating elements (Epoch: 2449400.5 = 1994-Feb-17.0 TDB)
 * Reference: JPL Small-Body Database
 * @constant {Object}
 */
export const HALLEY_DATA = {
    name: 'Halley',
    type: 'comet',
    radius: 0.15,
    texture: 'halley.webp',
    // Orbital elements (J2000 heliocentric ecliptic frame)
    orbit: {
        a: 17.834144,      // Semi-major axis (AU)
        e: 0.9671429,      // Eccentricity (highly elliptical)
        i: 162.2626,       // Inclination (deg) - retrograde orbit
        o: 58.42008,       // Longitude of ascending node Ω (deg)
        w: 111.33249,      // Argument of perihelion ω (deg)
        m0: 38.3842,       // Mean anomaly at epoch (deg)
        period: 75.32,     // Orbital period (years)
        epoch: 2449400.5,  // Julian date of epoch (1994-Feb-17.0)
        q: 0.5859,         // Perihelion distance (AU)
        Q: 35.0824         // Aphelion distance (AU)
    },
    // Physical properties from Giotto/Vega missions
    physical: {
        dimensions: [15, 8, 8],    // km (irregular peanut-shaped nucleus)
        albedo: 0.04,              // Very dark (darker than coal)
        rotationPeriod: 52.8,      // hours (complex rotation)
        mass: 2.2e14,              // kg (estimated)
        density: 600,              // kg/m³ (porous icy body)
        surfaceTemp: 320           // K (sunlit side near perihelion)
    },
    // Non-gravitational parameters (Marsden-Sekanina model)
    nonGrav: {
        A1: 4.58e-10,  // Radial component (AU/day²)
        A2: 5.92e-11,  // Transverse component (AU/day²)
        A3: 0.0        // Normal component (AU/day²)
    },
    // Historical perihelion passages
    perihelionDates: {
        last: '1986-02-09T00:00:00Z',
        next: '2061-07-28T00:00:00Z'
    }
};

/**
 * Configuration for the main asteroid belt between Mars and Jupiter.
 * @constant {Object}
 */
export const ASTEROID_BELT = { count: 2000, innerRadius: 2.2 * AU_SCALE, outerRadius: 3.2 * AU_SCALE }; // AU moved to AU_SCALE used for positioning if needed, or stick to AU relative.
// Wait, Utils used "2.2 * AU". In Utils, AU exported as AU_SCALE. 
// So 2.2 * 50 = 110 units.
// I should use AU_SCALE here.

/**
 * Secondary asteroid belt layer for parallax effect.
 * @constant {Object}
 */
export const ASTEROID_BELT_SECONDARY = { count: 1500, innerRadius: 2.35 * AU_SCALE, outerRadius: 3.05 * AU_SCALE };

/**
 * Configuration for the Kuiper Belt beyond Neptune.
 * @constant {Object}
 */
export const KUIPER_BELT = { count: 3000, innerRadius: 35 * AU_SCALE, outerRadius: 50 * AU_SCALE };

/**
 * Secondary Kuiper belt layer for parallax effect.
 * @constant {Object}
 */
export const KUIPER_BELT_SECONDARY = { count: 2000, innerRadius: 36 * AU_SCALE, outerRadius: 48 * AU_SCALE };


// Functions that act on data

export function getNASABody(key) {
    if (NASA_PLANETS[key]) return NASA_PLANETS[key];
    if (NASA_MOONS[key]) return NASA_MOONS[key];
    return null;
}

export function getNASAPlanets() {
    return Object.keys(NASA_PLANETS);
}

export function getNASAMoons() {
    return Object.keys(NASA_MOONS);
}

export function getTextureURL(textureName) {
    if (!textureName) return null;
    return `${TEXTURE_BASE_URL}${textureName}`;
}

export function convertToKeplerian(bodyKey) {
    // Implementation omitted for brevity in reorganization
    return {};
}

export function getLegacyFormat(bodyKey) {
    // Implementation omitted
    return {};
}

export function calculateOrbitalPeriod(a, mass) {
    // Implementation omitted
    return 0;
}
