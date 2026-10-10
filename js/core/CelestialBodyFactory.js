/**
 * @fileoverview Factory for instantiating Celestial Bodies
 * 
 * Replaces the brittle MoonBase/PlanetBase subclass explosion.
 * Reads CELESTIAL_DATA and determines if a specific class (like Earth)
 * or a generic base class should be instantiated.
 */

import { PlanetBase } from '../planets/PlanetBase.js';
import { MoonBase } from '../moons/MoonBase.js';

// Custom Planets with specific logic
import { Mercury } from '../planets/Mercury.js';
import { Venus } from '../planets/Venus.js';
import { Earth } from '../planets/Earth.js';
import { Mars } from '../planets/Mars.js';
import { Jupiter } from '../planets/Jupiter.js';
import { Saturn } from '../planets/Saturn.js';
import { Uranus } from '../planets/Uranus.js';
import { Neptune } from '../planets/Neptune.js';

// Custom Moons with specific logic
import { Mars_Phobos } from '../moons/Mars_Phobos.js';
import { Jupiter_Io } from '../moons/Jupiter_Io.js';
import { Jupiter_Europa } from '../moons/Jupiter_Europa.js';
import { Saturn_Titan } from '../moons/Saturn_Titan.js';
import { Saturn_Enceladus } from '../moons/Saturn_Enceladus.js';

const CUSTOM_PLANET_CLASSES = {
    mercury: Mercury,
    venus: Venus,
    earth: Earth,
    mars: Mars,
    jupiter: Jupiter,
    saturn: Saturn,
    uranus: Uranus,
    neptune: Neptune
};

const CUSTOM_MOON_CLASSES = {
    phobos: Mars_Phobos,
    io: Jupiter_Io,
    europa: Jupiter_Europa,
    titan: Saturn_Titan,
    enceladus: Saturn_Enceladus
};

export class CelestialBodyFactory {
    /**
     * Instantiates a Planet
     * @param {Object} data - The planet's configuration data from CELESTIAL_DATA
     * @param {string} key - The identifier key (e.g., 'earth')
     * @param {Object} quality - Quality settings for shaders
     * @param {Object} solarSystem - Reference to SolarSystem manager
     * @returns {PlanetBase}
     */
    static createPlanet(data, key, quality, solarSystem) {
        const Class = CUSTOM_PLANET_CLASSES[key] || PlanetBase;
        return new Class(data, key, quality, solarSystem);
    }

    /**
     * Instantiates a Moon
     * @param {Object} data - The moon's configuration data
     * @param {string} key - The identifier key (e.g., 'europa')
     * @param {PlanetBase} parentPlanet - Reference to the parent planet object
     * @returns {MoonBase}
     */
    static createMoon(data, key, parentPlanet) {
        const Class = CUSTOM_MOON_CLASSES[key] || MoonBase;
        return new Class(data, key, parentPlanet);
    }
}
