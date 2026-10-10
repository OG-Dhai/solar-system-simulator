import { describe, it, expect } from 'vitest';
import { degToRad, seededRandom } from '../../js/utils/MathHelpers.js';

describe('degToRad', () => {
    it('converts degrees to radians', () => {
        expect(degToRad(180)).toBeCloseTo(Math.PI, 15);
        expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2, 15);
    });
});

describe('seededRandom', () => {
    it('produces the same sequence for the same seed', () => {
        const a = seededRandom(42);
        const b = seededRandom(42);
        for (let i = 0; i < 100; i++) expect(a()).toBe(b());
    });

    it('produces different sequences for different seeds', () => {
        const a = seededRandom(1);
        const b = seededRandom(2);
        const sa = Array.from({ length: 10 }, () => a());
        const sb = Array.from({ length: 10 }, () => b());
        expect(sa).not.toEqual(sb);
    });

    it('stays within [0, 1]', () => {
        const r = seededRandom(7);
        for (let i = 0; i < 10000; i++) {
            const v = r();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });
});
