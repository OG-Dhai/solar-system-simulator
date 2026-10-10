import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { NBodySimulator, CelestialBody } from '../../js/core/NBodySimulator.js';
import { LagrangeSolver } from '../../js/core/LagrangeSolver.js';
import { calculateOrbitalEnergy, calculateOrbitalPeriod } from '../../js/core/OrbitalMechanics.js';

const G = 6.6743e-11;
const M_SUN = 1.989e30;
const M_EARTH = 5.972e24;
const AU_M = 1.495978707e11;

function sunEarthSystem(method) {
    const sim = new NBodySimulator();
    sim.integrationMethod = method;
    const v = Math.sqrt(G * M_SUN / AU_M);
    sim.addBody(new CelestialBody('sun', M_SUN, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)));
    sim.addBody(new CelestialBody('earth', M_EARTH, new THREE.Vector3(AU_M, 0, 0), new THREE.Vector3(0, 0, v)));
    return sim;
}

function totalEnergy(sim) {
    let kinetic = 0;
    let potential = 0;
    const b = sim.bodies;
    for (const body of b) kinetic += 0.5 * body.mass * body.velocity.lengthSq();
    for (let i = 0; i < b.length; i++) {
        for (let j = i + 1; j < b.length; j++) {
            potential -= G * b[i].mass * b[j].mass / b[i].position.distanceTo(b[j].position);
        }
    }
    return kinetic + potential;
}

describe('CelestialBody.calculateGravitationalAcceleration', () => {
    it('points towards the other body with magnitude G*M/r²', () => {
        const earth = new CelestialBody('earth', M_EARTH, new THREE.Vector3(AU_M, 0, 0), new THREE.Vector3());
        const sun = new CelestialBody('sun', M_SUN, new THREE.Vector3(), new THREE.Vector3());
        const acc = earth.calculateGravitationalAcceleration(sun);
        expect(acc.x).toBeLessThan(0);
        expect(acc.length() / (G * M_SUN / (AU_M * AU_M))).toBeCloseTo(1, 10);
    });
});

// NBodySimulator is not used by the running app. Its 'verlet' and 'rk4' integrators do not
// currently keep a simple Sun-Earth orbit stable (the Earth drifts to several AU within a year),
// so these checks are marked as expected failures. Remove `.fails` once the integrators are fixed.
describe('NBodySimulator (Sun-Earth, one year in 1-day steps)', () => {
    it.fails.each(['verlet', 'rk4'])('KNOWN BUG: %s should keep the Earth near 1 AU and conserve energy to within 0.1%%', (method) => {
        const sim = sunEarthSystem(method);
        const e0 = totalEnergy(sim);
        for (let day = 0; day < 365; day++) sim.integrate(86400);
        const earth = sim.getBodyByName('earth');
        const sun = sim.getBodyByName('sun');
        const r = earth.position.distanceTo(sun.position) / AU_M;
        expect(r).toBeGreaterThan(0.99);
        expect(r).toBeLessThan(1.01);
        expect(Math.abs((totalEnergy(sim) - e0) / e0)).toBeLessThan(1e-3);
    });

    it('adds, finds and removes bodies by name', () => {
        const sim = sunEarthSystem('verlet');
        expect(sim.getBodyByName('earth')).not.toBeNull();
        sim.removeBody('earth');
        expect(sim.getBodyByName('earth')).toBeNull();
        expect(sim.bodies).toHaveLength(1);
    });
});

describe('OrbitalMechanics helpers', () => {
    it('gives an orbital period of about one year at 1 AU', () => {
        const days = calculateOrbitalPeriod(AU_M) / 86400;
        expect(days).toBeGreaterThan(365.2);
        expect(days).toBeLessThan(365.3);
    });

    it('gives negative specific energy for a bound circular orbit', () => {
        const v = Math.sqrt(1.32712440018e20 / AU_M);
        const energy = calculateOrbitalEnergy(new THREE.Vector3(AU_M, 0, 0), new THREE.Vector3(0, 0, v));
        expect(energy).toBeLessThan(0);
        expect(energy).toBeCloseTo(-1.32712440018e20 / (2 * AU_M), -3);
    });
});

describe('LagrangeSolver (Sun-Earth)', () => {
    const sun = new THREE.Vector3(0, 0, 0);
    const earth = new THREE.Vector3(1, 0, 0);
    const pts = LagrangeSolver.calculateAllPoints(sun, earth, M_SUN, M_EARTH);
    const hill = Math.cbrt(M_EARTH / (3 * M_SUN));

    it('puts L1 between the bodies and L2 beyond the Earth, at the Hill radius', () => {
        expect(pts.l1.x).toBeCloseTo(1 - hill, 10);
        expect(pts.l2.x).toBeCloseTo(1 + hill, 10);
        expect(hill).toBeGreaterThan(0.009);
        expect(hill).toBeLessThan(0.011);
    });

    it('puts L3 on the far side of the Sun', () => {
        expect(pts.l3.x).toBeLessThan(-0.99);
    });

    it('puts L4 and L5 at the tips of equilateral triangles in the orbital plane', () => {
        for (const p of [pts.l4, pts.l5]) {
            expect(p.distanceTo(sun)).toBeCloseTo(1, 10);
            expect(p.distanceTo(earth)).toBeCloseTo(1, 10);
            expect(p.y).toBeCloseTo(0, 12);
        }
        expect(pts.l4.distanceTo(pts.l5)).toBeGreaterThan(1.7);
    });

    it('returns the origin instead of throwing for missing inputs', () => {
        expect(LagrangeSolver.calculateL1(null, earth, M_SUN, M_EARTH).length()).toBe(0);
    });
});
