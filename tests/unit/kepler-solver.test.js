import { describe, it, expect } from 'vitest';
import {
    solveKeplersEquation,
    normalizeAngle,
    getTrueAnomaly,
    getOrbitalRadius,
    getRadiusFromTrueAnomaly,
    evolveOrbitalElements
} from '../../js/core/KeplerSolver.js';

const TWO_PI = 2 * Math.PI;
const ECCENTRICITIES = [0, 0.0167, 0.2056, 0.5, 0.85, 0.967];
const MEAN_ANOMALIES = Array.from({ length: 24 }, (_, k) => (k / 24) * TWO_PI);

describe('solveKeplersEquation', () => {
    it('returns E that satisfies M = E - e*sin(E) for planet-like and comet-like eccentricities', () => {
        for (const e of ECCENTRICITIES) {
            for (const M of MEAN_ANOMALIES) {
                const result = solveKeplersEquation(M, e);
                const residual = Math.abs(result.E - e * Math.sin(result.E) - normalizeAngle(M));
                expect(residual, `e=${e}, M=${M}`).toBeLessThan(1e-12);
            }
        }
    });

    it('reports convergence for those inputs', () => {
        for (const e of ECCENTRICITIES) {
            for (const M of MEAN_ANOMALIES) {
                expect(solveKeplersEquation(M, e).converged, `e=${e}, M=${M}`).toBe(true);
            }
        }
    });

    it('returns E = M for a circular orbit', () => {
        expect(solveKeplersEquation(1.234, 0).E).toBeCloseTo(1.234, 12);
    });

    it('does not report convergence for a non-finite mean anomaly', () => {
        expect(solveKeplersEquation(Number.NaN, 0.1).converged).toBe(false);
    });
});

describe('normalizeAngle', () => {
    it('maps any angle into [0, 2π)', () => {
        for (const a of [-10, -Math.PI / 2, 0, 3, TWO_PI, 25]) {
            const n = normalizeAngle(a);
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThan(TWO_PI);
            expect(Math.cos(n)).toBeCloseTo(Math.cos(a), 12);
            expect(Math.sin(n)).toBeCloseTo(Math.sin(a), 12);
        }
    });
});

describe('true anomaly and radius', () => {
    it('places perihelion at E = 0 and aphelion at E = π', () => {
        expect(getTrueAnomaly(0, 0.3)).toBeCloseTo(0, 12);
        expect(getTrueAnomaly(Math.PI, 0.3)).toBeCloseTo(Math.PI, 12);
        expect(getOrbitalRadius(2, 0.3, 0)).toBeCloseTo(2 * (1 - 0.3), 12);
        expect(getOrbitalRadius(2, 0.3, Math.PI)).toBeCloseTo(2 * (1 + 0.3), 12);
    });

    it('gives the same radius from eccentric anomaly and from true anomaly', () => {
        const a = 1.5;
        const e = 0.4;
        for (let E = 0; E < TWO_PI; E += 0.37) {
            const nu = getTrueAnomaly(E, e);
            expect(getRadiusFromTrueAnomaly(a, e, nu)).toBeCloseTo(getOrbitalRadius(a, e, E), 10);
        }
    });
});

describe('evolveOrbitalElements', () => {
    it('applies linear rates per Julian century', () => {
        const base = { a: 1, aRate: 0.1, e: 0.01, eRate: 0.001, I: 2, IRate: -0.5, o: 10, oRate: 1, w: 20, wRate: 2, M: 30, MRate: 360 };
        const out = evolveOrbitalElements(base, 2);
        expect(out.a).toBeCloseTo(1.2, 12);
        expect(out.e).toBeCloseTo(0.012, 12);
        expect(out.i).toBeCloseTo(1, 12);
        expect(out.o).toBeCloseTo(12, 12);
        expect(out.w).toBeCloseTo(24, 12);
        expect(out.M).toBeCloseTo(750, 12);
    });

    it('copies the elements unchanged when no rates are given', () => {
        const base = { a: 1, e: 0.1 };
        expect(evolveOrbitalElements(base, 5)).toEqual(base);
    });
});
