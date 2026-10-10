# ADR 002: Migration of Moon Entities to Entity Component System (ECS)

## Status
Accepted

## Context
The `MoonBase` class previously encapsulated orbital calculations, shadow cone detections, and visual updates. Moons are unique because their orbit relies on a parent entity (the planet) rather than the global center (the Sun), and their visual state is heavily affected by the planet's shadow.

## Decision
We migrated Moon logic to the ECS architecture using composition and specialized systems:

1. **Hierarchical Orbiting**: 
   - `OrbitComponent` was updated to include a `parentEntity` field.
   - `OrbitSystem` was extended to add the parent's absolute transform to the moon's calculated relative transform, replacing the need for nested `THREE.Group` objects to handle parent-child positioning.

2. **Shadow Cone Decoupling**:
   - Created `EclipseComponent` to store `inShadow` state and `shadowFactor`.
   - Created `EclipseSystem` which strictly computes the geometric projection of the moon onto the sun-planet axis to determine if the moon falls within the planet's umbra or penumbra.
   - The visual response (e.g., lowering emissive intensity) is deferred to the future `RenderSystem`, entirely severing physics from rendering.

## Skill Activation Log
- **Skill**: `spec-driven-development`
- **Application**: Before touching the code, we identified the specific requirements for moons (hierarchical transforms and shadow cones) and mapped them directly to ECS data structures (`EclipseComponent`) and physical systems (`EclipseSystem`).
- **Skill**: `code-review-and-quality`
- **Application**: Validated the output (Tick 1-10) to ensure the Moon's absolute coordinates successfully incorporated the Earth's coordinates, and the `inShadow` flag correctly triggered.

## Consequences
- **Positive**: Removed deeply nested `THREE.Group` hierarchies which caused issues with shadow mapping and culling in the old system. The `EclipseSystem` is purely mathematical and highly performant.
- **Negative**: Resolving hierarchical transforms inside `OrbitSystem` assumes the parent's position is already calculated. We must ensure the `OrbitSystem` iterates in topological order, or we must introduce a `TransformHierarchySystem` in the future for deeper tree structures.
