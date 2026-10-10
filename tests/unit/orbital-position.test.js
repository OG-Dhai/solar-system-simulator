import { describe, it, expect } from 'vitest';
import {
    calculateOrbitalPosition,
    calculateOrbitalVelocity,
    getOrbitalVelocity,
    getOrbitalRadius,
    solveKeplersEquation,
    validateOrbitalElements,
    AU_KM,
    DEG_TO_RAD
} from '../../js/core/KeplerSolver.js';
import { CELESTIAL_DATA } from '../../js/utils/NASAOrbitalData.js';

// Scene convention used by the app: the ecliptic plane is x/z, y points "up".

describe('calculateOrbitalPosition', () => {
    it('keeps a circular, non-inclined orbit at radius a in the x/z plane', () => {
        const el = { a: 2, e: 0, i: 0, Omega: 0, w: 0 };
        for (let M = 0; M < 360; M += 30) {
            const p = calculateOrbitalPosition({ ...el, M });
            expect(p.length()).toBeCloseTo(2, 10);
            expect(p.y).toBeCloseTo(0, 12);
        }
    });

    it('is at a(1 - e) at perihelion (M = 0) and a(1 + e) at aphelion (M = 180°)', () => {
        const el = { a: 1.5, e: 0.2, i: 10, Omega: 40, w: 70 };
        expect(calculateOrbitalPosition({ ...el, M: 0 }).length()).toBeCloseTo(1.5 * 0.8, 10);
        expect(calculateOrbitalPosition({ ...el, M: 180 }).length()).toBeCloseTo(1.5 * 1.2, 10);
    });

    it('applies the scale argument', () => {
        const el = { a: 1, e: 0.1, i: 5, Omega: 10, w: 20, M: 33 };
        const unscaled = calculateOrbitalPosition(el, false, 1);
        const scaled = calculateOrbitalPosition(el, false, 50);
        expect(scaled.length()).toBeCloseTo(unscaled.length() * 50, 8);
    });

    it('lifts the body out of the ecliptic for an inclined orbit', () => {
        // i = 90°, argument of periapsis 90°, at periapsis: the body sits on the +y axis
        const p = calculateOrbitalPosition({ a: 1, e: 0, i: 90, Omega: 0, w: 90, M: 0 });
        expect(p.y).toBeCloseTo(1, 10);
        expect(Math.hypot(p.x, p.z)).toBeCloseTo(0, 10);
    });

    it('accepts the mean anomaly in radians when isRadians is true', () => {
        const el = { a: 1, e: 0.3, i: 3, Omega: 15, w: 45 };
        const deg = calculateOrbitalPosition({ ...el, M: 123 });
        const rad = calculateOrbitalPosition({ ...el, M: 123 * DEG_TO_RAD }, true);
        expect(rad.distanceTo(deg)).toBeCloseTo(0, 10);
    });
});

describe('calculateOrbitalVelocity', () => {
    it('matches the vis-viva equation at several points of an eccentric orbit', () => {
        const el = { a: 1, e: 0.2, i: 4, Omega: 30, w: 60 };
        for (const M of [0, 45, 90, 180, 270]) {
            const v = calculateOrbitalVelocity({ ...el, M });
            const E = solveKeplersEquation(M * DEG_TO_RAD, el.e).E;
            const rKm = getOrbitalRadius(el.a, el.e, E) * AU_KM;
            expect(v.length()).toBeCloseTo(getOrbitalVelocity(rKm, el.a * AU_KM), 6);
        }
    });

    it('gives about 29.8 km/s for a circular orbit at 1 AU', () => {
        const v = calculateOrbitalVelocity({ a: 1, e: 0, i: 0, Omega: 0, w: 0, M: 0 });
        expect(v.length()).toBeGreaterThan(29.7);
        expect(v.length()).toBeLessThan(29.9);
    });
});

describe('planet data used by the scene (CELESTIAL_DATA)', () => {
    const planets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

    it.each(planets)('%s has valid elements and a period consistent with Kepler\'s third law (within 1%)', (key) => {
        const o = CELESTIAL_DATA[key].orbit;
        const result = validateOrbitalElements({ a: o.a, e: o.e, i: o.i, period: o.period });
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
    });
});
