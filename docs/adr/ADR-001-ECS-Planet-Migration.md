# ADR 001: Migration of Planet Entities to Entity Component System (ECS)

## Status
Accepted

## Context
The previous architecture used a monolithic inheritance chain (`CelestialBody -> PlanetBase -> Earth`) which tangled visual rendering logic (THREE.js meshes, materials, LOD) directly with physics calculations (Kepler equations, secular variations, rotations). This made scaling the simulation difficult and created "God classes".

## Decision
We decided to completely decouple the planet logic by transitioning to a pure Data-Oriented Design (DOD) using an Entity Component System (ECS) based on Structure of Arrays (SoA).

1. **Entity**: Planets are now just integer IDs.
2. **Components**: The monolithic state of `PlanetBase` was split into strictly defined schemas:
   - `Transform`: Holds absolute x, y, z positions.
   - `OrbitComponent`: Holds Keplerian elements (`a, e, i, Omega, omega, period, m0`).
   - `RotationComponent`: Holds axial tilt and rotation speeds.
   - `MeshComponent`: Holds basic rendering parameters without relying on THREE.js object instantiation.
   - `GravityComponent`: Holds mass data.
3. **Systems**:
   - `OrbitSystem`: Iterates over `OrbitComponent` arrays, utilizes the legacy `KeplerSolver.js`, and strictly updates `Transform` positions.
   - `RotationSystem`: Updates rotation angles independently.

## Skill Activation Log
- **Skill**: `doubt-driven-development`
- **Application**: Questioned the data ownership of LOD rules. Decided to keep LOD thresholds separate from the core physics `Transform` components to ensure that camera-distance calculations do not pollute the physics step.
- **Skill**: `code-simplification`
- **Application**: Removed the entire prototype chain for planets. Planets are now spawned purely via `world.addComponent()`.
- **Skill**: `code-review-and-quality`
- **Application**: Verified that the new `OrbitSystem` correctly calls the legacy Kepler math without requiring any object-oriented state, passing validation (see test run output from index.js).

## Consequences
- **Positive**: Physics logic is highly cache-friendly. Rendering can be swapped out or deferred without touching the physics code. No more `super.update()` calls hiding implicit behaviors.
- **Negative**: Creating a planet requires assembling 5+ components manually instead of `new Earth()`.
- **Mitigation**: We will create factory functions (e.g., `createPlanetEntity()`) in a later cleanup phase to encapsulate the component composition.
