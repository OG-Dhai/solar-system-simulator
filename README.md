# Solar System Simulator

A real-time simulation of the solar system that runs in the browser, built with Three.js and WebGL 2. Planet positions are computed at runtime from orbital elements instead of following pre-baked animation paths. The scene can be viewed on a desktop or, with a WebXR-capable headset, in VR.

Developed independently by Dhai Othman as a project for the module *Mixed Reality / Computer Graphics* at HTW Berlin (winter semester 2025/26).

**Status:** course project. See [Known issues](#known-issues).

## Features

- Sun, the eight planets, selected moons, planetary rings and Halley's comet (`js/planets/`, `js/moons/`, `js/rings/`).
- Keplerian orbits solved at runtime (`js/core/KeplerSolver.js`), using orbital elements based on NASA/JPL values (`js/utils/NASAOrbitalData.js`) and secular variations of those elements (`js/core/SecularVariations.js`).
- GLSL shaders for the Sun and its corona, atmospheres for Earth, Venus and Mars, a glow effect for the gas giants, the ring systems and the comet.
- Star background derived from Hipparcos and Yale Bright Star catalogue data (`js/utils/RealStarData.js`), plus a Milky Way backdrop.
- Post-processing with bloom, FXAA and ACES filmic tone mapping.
- Controls for pausing, time speed (real time, slider, cinematic mode), body and moon selection with an info panel, and orbit-line visibility.
- VR mode through the WebXR Device API (Three.js `VRButton`).
- Recording of the canvas to a `.webm` video with the MediaStream Recording API.
- If a texture file is missing, the body falls back to a generated colour texture.

## Tech stack

JavaScript (ES modules), Three.js r160, WebGL 2 and GLSL, WebXR, Vite, Vitest, Playwright, ESLint.

## Getting started

Requires Node.js 18 or newer and a browser with WebGL 2.

```bash
npm install
npm run dev       # development server on http://localhost:5173
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Project structure

```
index.html        entry page, loads js/core/Main.js
js/core/          app core, render loop, camera, orbital mechanics
js/planets/       planet definitions
js/moons/         moon definitions
js/rings/         ring systems
js/shaders/       GLSL shader modules
js/utils/         constants, orbital and star data, texture loading, helpers
js/ui/            on-screen controls
css/              styles
public/textures/  planet textures (NASA) and generated placeholder textures
src/              experimental ECS layer (see below)
docs/adr/         architecture decision records
tests/            unit tests (Vitest) and browser tests (Playwright)
```

## Tests

```bash
npm test            # unit tests (Vitest)
npm run test:e2e    # browser tests (Playwright, starts the dev server)
```

The Playwright tests need a Playwright browser; install it once with `npx playwright install chromium`.

Unit tests (`tests/unit/`):

- **Kepler solver:** the returned eccentric anomaly satisfies Kepler's equation for eccentricities from 0 to 0.967 and 24 mean anomalies each; circular-orbit and invalid-input behaviour; angle normalisation; consistency of true anomaly and radius; linear evolution of orbital elements.
- **Orbital positions and velocities:** circular orbits stay at radius *a* in the ecliptic plane; perihelion and aphelion distances; scaling; inclination; degrees and radians input; speeds match the vis-viva equation; about 29.8 km/s at 1 AU.
- **Planet data:** for each of the eight planets, the elements are valid and the orbital period matches Kepler's third law within 1%.
- **Lagrange points:** positions of L1 to L5 for the Sun–Earth system and safe handling of missing input.
- **Helpers:** gravitational acceleration, orbital period and energy helpers, degree conversion, and the seeded random generator.
- **N-body simulator:** two checks are marked as expected failures (`it.fails`). See Known issues.

Browser tests (`tests/e2e/app.spec.js`) run the real app and check that:

- it loads, shows a WebGL canvas and the control panel, and throws no page errors;
- simulation time advances;
- **Pause** stops the simulation time and **Play** resumes it;
- **Orbit Lines** hides and shows the orbit lines;
- selecting Earth shows its info and moon selector, and selecting the Sun hides the moon selector;
- **Real Time** and **Cinematic** switch the time mode.

The tests do not check rendering output pixel by pixel, VR mode, video recording, shader appearance or performance.

## Experimental ECS layer (`src/`)

`src/` contains a data-oriented Entity Component System with typed-array component storage, a worker-based physics protocol, an asset streaming system and telemetry modules. The planned migration is described in `docs/adr/`. This layer is **not used by the running application**: `index.html` loads `js/core/Main.js`, which imports nothing from `src/`. The testing plan in `tests/architecture/adrs/` describes goals that the current tests do not cover.

## Known issues

- `js/core/NBodySimulator.js` is not used by the app. Its `verlet` and `rk4` integrators do not keep a simple Sun–Earth orbit stable over one simulated year (the Earth drifts to several AU). The two tests for this are marked as expected failures.
- Lagrange points are calculated, but the app hides them and has no control to show them.
- Shader code for Io and Europa exists in `js/shaders/MoonShader.js` but is not used.
- The ring loader first requests `.png` versions of two ring textures that do not exist, then falls back to the `.webp` files. This causes two harmless 404 requests.
- `npm run lint` reports 299 problems: 81 `no-unused-vars` warnings (mostly unused imports), 2 `no-useless-catch` errors, and 216 formatting errors (quotes, indentation, blank lines, trailing commas) that `eslint --fix` can correct.
- Some modules exist twice, for example under both `js/utils/` and `js/data/` or `js/infrastructure/`. The `js/data/` copy of `NASAOrbitalData.js` imports a `Constants.js` that does not exist in that folder; the app uses the `js/utils/` version.
- The JPL Horizons proxy in `scripts/api/` is registered as a Vite plugin but is not called by the application.

## Credits

- [Three.js](https://threejs.org/) for rendering, post-processing and WebXR helpers.
- Orbital elements based on NASA/JPL data. Star positions are based on the Hipparcos and Yale Bright Star catalogues.
- Planet textures for Mercury, Venus (including `venus_atmosphere` and `venus_surface`), Earth (day, night, clouds, normal and specular maps), Mars, Jupiter, Saturn, Uranus and Neptune: NASA imagery. NASA does not endorse this project.
- All other textures in `public/textures/` (Sun, moons, Pluto and Charon, ring strips, star and galaxy backgrounds, Halley's comet) are simple placeholders generated by `scripts/generate-placeholder-textures.py` from noise, colour gradients and random dots. They are not real surface maps. To recreate missing placeholders without overwriting the NASA textures, run `python3 scripts/generate-placeholder-textures.py public/textures --keep-existing` (requires Pillow and NumPy).

## License

No license has been chosen for the code in this repository yet. Three.js and the other npm dependencies keep their own licences.
