# ADR 002: Deterministic Floating-Point Mathematics

## Context
The simulation relies on an ECS running a fixed timestep. To ensure multiplayer sync, regression testing, and state verification, identical inputs must result in bit-for-bit identical outputs across different V8 engine versions and architectures.
Native JavaScript functions (`Math.sin`, `Math.cos`, `Math.random`) are explicitly non-deterministic across platforms due to different libm implementations and hardware instructions.

## Decision
All physics and simulation modules must strictly avoid native `Math.*` trigonometric and random functions.
1. We will adopt a seeded pseudo-random number generator (PRNG) for all noise and generation.
2. We will implement or import a deterministic math library using lookup tables or fixed-point approximations for trigonometry if exact cross-platform determinism is required. For Node/Chromium tests, strict IEEE-754 is generally stable on the same arch, but state hashes will act as our safety net.

## Consequences
- Prevents the "butterfly effect" where a minor floating-point divergence alters the entire orbit simulation.
- Simulation tests can assert strict strict equality `toBe()` on state hashes rather than `.toBeCloseTo()`.
