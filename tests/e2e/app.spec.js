import { test, expect } from '@playwright/test';

// These tests drive the real application in a browser. The app exposes itself as
// window.appInstance (js/core/Main.js), which the tests read to check simulation state.

async function openApp(page, errors) {
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForFunction(
        () => window.appInstance?.solarSystem && document.getElementById('loading-screen')?.classList.contains('hidden'),
        null,
        { timeout: 90_000 }
    );
}

const simTime = (page) => page.evaluate(() => window.appInstance.solarSystem.simTime);

test.describe('Solar System Simulator', () => {
    test('loads, renders a WebGL canvas and shows the control panel without page errors', async ({ page }) => {
        const errors = [];
        await openApp(page, errors);
        await expect(page.locator('canvas').first()).toBeVisible();
        await expect(page.locator('#planet-selector')).toBeVisible();
        await expect(page.locator('#btn-pause')).toHaveText('Pause');
        expect(errors).toEqual([]);
    });

    test('simulation time advances while running', async ({ page }) => {
        const errors = [];
        await openApp(page, errors);
        const t0 = await simTime(page);
        await page.waitForTimeout(1500);
        expect(await simTime(page)).toBeGreaterThan(t0);
        expect(errors).toEqual([]);
    });

    test('Pause stops simulation time and Play resumes it', async ({ page }) => {
        const errors = [];
        await openApp(page, errors);
        await page.locator('#btn-pause').click();
        await expect(page.locator('#btn-pause')).toHaveText('Play');
        const paused = await simTime(page);
        await page.waitForTimeout(1500);
        expect(await simTime(page)).toBe(paused);

        await page.locator('#btn-pause').click();
        await expect(page.locator('#btn-pause')).toHaveText('Pause');
        await page.waitForTimeout(1500);
        expect(await simTime(page)).toBeGreaterThan(paused);
        expect(errors).toEqual([]);
    });

    test('Orbit Lines button hides and shows the planet orbit lines', async ({ page }) => {
        const errors = [];
        await openApp(page, errors);
        const visibleLines = () => page.evaluate(() =>
            [...window.appInstance.solarSystem.bodies.values()].filter((b) => b.orbitLine).map((b) => b.orbitLine.visible)
        );
        expect((await visibleLines()).length).toBeGreaterThan(0);
        expect(await visibleLines()).not.toContain(false);

        await page.locator('#btn-orbits').click();
        await expect(page.locator('#btn-orbits')).toHaveText('Orbit Lines: OFF');
        expect(await visibleLines()).not.toContain(true);

        await page.locator('#btn-orbits').click();
        await expect(page.locator('#btn-orbits')).toHaveText('Orbit Lines: ON');
        expect(await visibleLines()).not.toContain(false);
        expect(errors).toEqual([]);
    });

    test('selecting Earth shows its info and offers its moon', async ({ page }) => {
        const errors = [];
        await openApp(page, errors);
        await page.locator('#planet-selector').selectOption('earth');
        await expect(page.locator('.info-title')).toHaveText('Earth');
        await expect(page.locator('#moon-selector-group')).toBeVisible();
        await expect(page.locator('#moon-selector option')).not.toHaveCount(0);

        await page.locator('#planet-selector').selectOption('sun');
        await expect(page.locator('.info-title')).toHaveText('Sun');
        await expect(page.locator('#moon-selector-group')).toBeHidden();
        expect(errors).toEqual([]);
    });

    test('Real Time and Cinematic buttons change the time mode', async ({ page }) => {
        const errors = [];
        await openApp(page, errors);
        await page.locator('.speed-btn', { hasText: 'Real Time' }).click();
        await expect(page.locator('.time-warp-display')).toHaveText('Real-Time');
        expect(await page.evaluate(() => window.appInstance.solarSystem.timeSpeed)).toBe(1);

        await page.locator('.speed-btn', { hasText: 'Cinematic' }).click();
        await expect(page.locator('.time-warp-display')).toHaveText('Cinematic');
        expect(await page.evaluate(() => window.appInstance.solarSystem.cinematicMode)).toBe(true);
        expect(errors).toEqual([]);
    });
});
