# ADR 001: Testing Pyramid and Runner Separation

## Context
The real-time orbital simulation requires strict verification of math correctness without the overhead of WebGL rendering. Conversely, visual output verification requires headless browser environments which are slow and prone to driver-specific false positives.

## Decision
We adopt a decoupled verification model leveraging a strict testing pyramid:
1. **80% Unit/Integration (Vitest):** Node.js environment, fast concurrent execution. Responsible for deterministic math, orbital accuracy, and state hash verification.
2. **15% Worker/Integration (Vitest/Playwright):** Testing Web Worker sync, ping-pong buffers, and thread recovery.
3. **5% E2E (Playwright):** Headless chromium execution. Responsible strictly for visual SSIM render regression and V8 heap snapshot memory tests.

## Consequences
- Prevents GPU instability from failing math correctness tests.
- CI pipeline is significantly faster as the heavy E2E tests are deferred to nightly/release gates.
- Requires maintaining two separate testing harnesses (Vitest and Playwright).
