# ADR 003: Migration of Rings Entities to Entity Component System (ECS)

## Status
Accepted

## Context
In the legacy OOP architecture, rings were handled by the `RingsBase` class. This class explicitly contained `THREE.RingGeometry`, texture mappings, UV fixing logic, and mesh update loops. This strongly coupled the concept of a planetary ring with its WebGL rendering implementation, breaking the separation of concerns desired for the physics simulation and preventing pure-data execution.

## Decision
We migrated Rings logic to the ECS architecture by completely separating the logical parameters of a ring from its visual representation:

1. **RingComponent**:
   - Created a pure data schema holding `innerRadius`, `outerRadius`, `opacity`, and `color`.
   - Replaced heavy texture objects with a simple string reference (`textureUrl`), allowing the future render layer to load and apply the texture independently.

2. **RingSystem**:
   - Implemented a discrete system querying `[Transform, RingComponent]`.
   - Currently acts as a pure logic layer capable of managing dynamic degradation or opacity changes without touching materials.
   - Offloads all `THREE.js` mesh generation to the generic `RenderSystem`.

## Skill Activation Log
- **Skill**: `code-refactoring-refactor-clean`
- **Application**: Stripped out all THREE.js dependencies from the core simulation loop for Saturn's rings, strictly adhering to pure SoA components.

## Consequences
- **Positive**: Rings are now fully decoupled from rendering. A headless server can simulate a ringed planet without requiring WebGL or any drawing libraries.
- **Negative**: The actual creation of the 3D ring mesh is deferred entirely to the rendering client. If the physics engine requires collision detection with rings in the future, it must be added as a separate component/system (e.g., `RingColliderSystem`), as `RingComponent` is currently treated as largely visual metadata.
