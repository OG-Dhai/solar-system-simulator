/**
 * @fileoverview Input controller for camera and user interaction.
 * Handles camera tracking, smooth flight animations, and user input events.
 * @module InputController
 * 
 * Architecture: Standard Class with Dependency Injection (No Singleton)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CELESTIAL_DATA, SCALE_FACTORS } from '../utils/Utils.js';
import { Logger } from '../utils/Logger.js';

/**
 * Controller for camera movement and user input.
 * Standard class - instantiated by Main.js via Dependency Injection.
 */
export class Camera {
    /**
     * Create the input controller.
     * @param {THREE.Camera} camera - The Three.js camera (Dependency Injection)
     * @param {THREE.WebGLRenderer} renderer - The Three.js renderer (Dependency Injection)
     * @param {Object} targetSystem - System interface with { bodies: Map, getBodyPosition(key): Vector3 } (Dependency Injection)
     * @throws {Error} If required dependencies are not provided
     */
    constructor(camera, renderer, targetSystem) {
        // Validate required dependencies
        if (!camera) {
            throw new Error("InputController requires a THREE.Camera instance");
        }
        if (!renderer) {
            throw new Error("InputController requires a THREE.WebGLRenderer instance");
        }
        if (!targetSystem) {
            throw new Error("InputController requires a targetSystem with bodies and getBodyPosition");
        }

        /** @type {THREE.Camera} Reference to camera */
        this.camera = camera;

        /** @type {THREE.WebGLRenderer} Reference to renderer */
        this.renderer = renderer;

        /** @type {Object} Target system (SolarSystem or any compatible interface) */
        this.system = targetSystem;

        /** @type {string|null} Currently tracked body key */
        this.trackedBody = null;

        /** @type {THREE.Vector3} Last tracked position */
        this.lastTargetPos = new THREE.Vector3();

        /** @type {OrbitControls|null} Three.js orbit controls */
        this.controls = null;

        /** @type {THREE.Vector3} Camera offset from target */
        this.cameraOffset = new THREE.Vector3();

        // Flight animation state
        /** @type {boolean} Whether currently in flight animation */
        this.isFlying = false;

        /** @type {number} Flight start timestamp */
        this.flightStartTime = 0;

        /** @type {number} Flight duration in ms */
        this.flightDuration = 2000;

        /** @type {THREE.Vector3} Flight start camera position */
        this.flyStartPos = new THREE.Vector3();

        /** @type {THREE.Vector3} Flight start target position */
        this.flyStartTarget = new THREE.Vector3();

        /** @type {string|null} Destination body key */
        this.flyEndBody = null;

        /** @type {function|null} Promise resolver for flight completion */
        this.flyResolve = null;

        // Bound event handlers (for cleanup)
        this._onDblClick = null;
        this._onKeyDown = null;

        /** @type {boolean} Guard for event listener attachment */
        this._listenersAttached = false;

        /** @type {number} Flight ID for cancellation */
        this._flightId = 0;

        // Initialize immediately (constructor handles everything)
        this._initControls();
        this._setupEvents();
    }

    /**
     * Initialize OrbitControls.
     * @private
     */
    _initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 0.00001; // Allow very close zoom for small moons (radius < 0.001)
        this.controls.maxDistance = 100000;
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 1.2;
    }

    /**
     * Set up event listeners for user input.
     * @private
     */
    _setupEvents() {
        // Guard against duplicate listener attachment
        if (this._listenersAttached) {
            Logger.warn('InputController', 'Event listeners already attached');
            return;
        }
        this._listenersAttached = true;

        // Double-click to focus on body
        this._onDblClick = (e) => {
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );
            const ray = new THREE.Raycaster();
            ray.setFromCamera(mouse, this.camera);

            // Use injected system instead of global import
            const meshes = [];
            this.system.bodies.forEach(b => {
                if (b.mesh) meshes.push(b.mesh);
            });

            const hits = ray.intersectObjects(meshes, true);
            if (hits.length) {
                let key = hits[0].object.userData.key;
                if (!key && hits[0].object.parent) {
                    key = hits[0].object.parent.userData?.key;
                }
                if (key) this.focusOnBody(key);
            }
        };
        this.renderer.domElement.addEventListener('dblclick', this._onDblClick);

        // ESC to unlock camera
        this._onKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.trackedBody = null;
            }
        };
        window.addEventListener('keydown', this._onKeyDown);
    }

    /**
     * Focus camera on a celestial body.
     * @param {string} key - Body key to focus on
     */
    focusOnBody(key) {
        if (!key) {
            Logger.warn('InputController', 'Key is required');
            return;
        }

        this.trackedBody = key;
        // Use injected system instead of global import
        const pos = this.system.getBodyPosition(key);
        if (!pos) {
            Logger.warn('InputController', `Body "${key}" not found`);
            return;
        }

        this.lastTargetPos.copy(pos);

        // Calculate visual radius for camera positioning
        // Check if explicit radius is in data, otherwise use default
        // Moons are usually small (<100km or scaled to <0.1 units)
        // We must apply SCALE_FACTORS.SIZE (0.001) to the raw km radius if it came from raw data
        // CELESTIAL_DATA often has pre-scaled values for planets but raw for moons?
        // Let's use the actual mesh size if available, or fallback to smart logic.

        let visualRadius = 1.0;

        // Try to find the body object to get its actual scale/radius
        // Since we only have 'key', we have to rely on CELESTIAL_DATA or system lookup if we added that.
        // But system.bodies is a Map.
        const bodyObj = this.system.bodies.get(key);
        if (bodyObj && bodyObj.radius) {
            visualRadius = bodyObj.radius;
        } else {
            // Fallback to data
            const data = CELESTIAL_DATA[key];
            visualRadius = data?.radius || 1.0;
            // Heuristic involving SCALE_FACTORS if needed?
            // Most CELESTIAL_DATA radii are already in 'units' or suitable for use.
            // Except for moons like Moon (0.273) or Phobos (0.00175).
        }

        // Adjust camera distance based on body type and size
        let r;
        if (key === 'sun') {
            r = visualRadius * 4.0; // Sun needs special handling due to its size
        } else if (['moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea', 'dione', 'tethys', 'enceladus', 'mimas', 'titania', 'oberon', 'umbriel', 'ariel', 'miranda', 'triton', 'charon'].includes(key)) {
            // MOON FIX: Remove 0.5 limit to allow zooming in on small moons (Phobos r=0.0017)
            r = visualRadius * 5.0;
        } else {
            r = visualRadius * 5.0; // 5x radius is a good viewing distance for planets
        }

        // SMART CAMERA POSITIONING:
        // Instead of a fixed offset (which often puts us on the dark side),
        // we calculate a position relative to the Sun-Body vector.

        // 1. Vector from Sun (0,0,0) to Body
        const sunToBody = pos.clone().normalize();

        // 2. We want to view from the "lit" side, so we position the camera 
        // somewhere "between" the Sun and the Body (or slightly offset).
        // A simple approach is to back up along the Sun-Body vector (towards the Sun).
        // Vector pointing OUT from body towards sun:
        const viewDir = sunToBody.clone().negate();

        // 3. Add a slight "terminator" angle (e.g., 30-45 degrees up/side) for cinematic shadows
        // This makes it look less flat than direct frontal lighting.
        // We'll rotate the view vector slightly around the Y axis and X axis.
        const up = new THREE.Vector3(0, 1, 0);
        viewDir.applyAxisAngle(up, THREE.MathUtils.degToRad(15)); // 15 degrees sideways (was 30)
        viewDir.add(new THREE.Vector3(0, 0.4, 0)).normalize(); // Slightly more elevation (was 0.3)

        // 4. Calculate final camera position
        const adjustedOffset = viewDir.multiplyScalar(r); // Distance r from body surface

        this.cameraOffset.copy(adjustedOffset);

        this.controls.target.copy(pos);
        this.camera.position.copy(pos).add(adjustedOffset);
    }

    /**
     * Smoothly fly camera to a celestial body.
     * @param {string} key - Body key to fly to
     * @param {number} [duration=2000] - Flight duration in ms
     * @returns {Promise<void>} Promise that resolves when flight completes
     */
    flyTo(key, duration = 2000) {
        // MED-002: Validate flight duration
        if (!Number.isFinite(duration) || duration <= 0) {
            Logger.warn('InputController', `Invalid duration ${duration}, defaulting to 2000ms`);
            duration = 2000;
        } else {
            const clamped = Math.max(500, Math.min(30000, duration));
            if (clamped !== duration) {
                Logger.warn('InputController', `Duration ${duration} clamped to ${clamped}ms`);
                duration = clamped;
            }
        }

        // Increment flight ID and capture for this flight
        const currentFlightId = ++this._flightId;

        return new Promise((resolve) => {
            // Cancel existing flight to prevent Promise leaks
            if (this.isFlying && this.flyResolve) {
                Logger.warn('InputController', 'Cancelling previous flight');
                this.flyResolve(); // Resolve previous promise to prevent leak
                this.flyResolve = null;
            }

            // Use injected system instead of global import
            const pos = this.system.getBodyPosition(key);
            if (!pos) {
                Logger.warn('InputController', `Body "${key}" not found`);
                resolve();
                return;
            }

            this.trackedBody = null;
            this.isFlying = true;
            this.flyEndBody = key;
            this.flightDuration = duration;
            this.flightStartTime = performance.now();
            this.flyResolve = () => {
                // Only resolve if this is still the current flight
                if (this._flightId === currentFlightId) {
                    resolve();
                }
            };

            this.flyStartPos.copy(this.camera.position);
            this.flyStartTarget.copy(this.controls.target);
            this.controls.enabled = false;
        });
    }

    /**
     * Update camera tracking and flight animation.
     * Should be called every frame.
     */
    update() {
        // Flight mode
        if (this.isFlying) {
            const now = performance.now();
            const elapsed = now - this.flightStartTime;
            const progress = Math.min(elapsed / this.flightDuration, 1);

            // EaseInOutCubic
            const t = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // Use injected system instead of global import
            const destPos = this.system.getBodyPosition(this.flyEndBody);

            if (destPos) {
                this.controls.target.lerpVectors(this.flyStartTarget, destPos, t);



                // Re-calculate target distance dynamically based on destination body size
                let visualRadius = 1.0;
                const bodyObj = this.system.bodies.get(this.flyEndBody);
                if (bodyObj && bodyObj.radius) {
                    visualRadius = bodyObj.radius;
                } else {
                    visualRadius = (CELESTIAL_DATA[this.flyEndBody]?.radius || 1.0);
                }

                // Adjust camera distance based on body type and size for flight
                let r;
                if (this.flyEndBody === 'sun') {
                    r = visualRadius * 4.0; // Sun needs special handling due to its size
                } else if (['moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea', 'dione', 'tethys', 'enceladus', 'mimas', 'titania', 'oberon', 'umbriel', 'ariel', 'miranda', 'triton', 'charon'].includes(this.flyEndBody)) {
                    // MOON FIX: Remove 0.5 limit to allow zooming in on small moons
                    r = visualRadius * 5.0; // Give a bit more space for moons
                } else {
                    r = visualRadius * 5.0; // 5x radius gives a much better "Majestic" view (Saturn rings visible)
                }

                // SMART FLIGHT TARGETING:
                // Use the same sun-relative logic as focusOnBody for consistent arrival
                const sunToBody = destPos.clone().normalize();
                const viewDir = sunToBody.clone().negate(); // Point towards sun

                // Cinematic angle - IMPROVED
                // 15 degrees side (less aggressive than 30) + 20 degrees up (better for rings)
                const up = new THREE.Vector3(0, 1, 0);
                viewDir.applyAxisAngle(up, THREE.MathUtils.degToRad(15));
                viewDir.add(new THREE.Vector3(0, 0.4, 0)).normalize(); // Increased elevation 0.3 -> 0.4

                const adjustedOffset = viewDir.multiplyScalar(r);
                const destCamPos = destPos.clone().add(adjustedOffset);
                this.camera.position.lerpVectors(this.flyStartPos, destCamPos, t);
            }

            if (progress >= 1) {
                this.isFlying = false;
                this.controls.enabled = true;
                this.focusOnBody(this.flyEndBody);
                if (this.flyResolve) {
                    this.flyResolve();
                    this.flyResolve = null;
                }
            }
            return;
        }

        // Camera tracking mode
        if (this.trackedBody) {
            // Use injected system instead of global import
            const curPos = this.system.getBodyPosition(this.trackedBody);
            if (curPos) {
                const currentOffset = this.camera.position.clone().sub(this.controls.target);
                this.controls.target.copy(curPos);
                this.camera.position.copy(curPos).add(currentOffset);
                this.lastTargetPos.copy(curPos);
            }
        }

        // Update OrbitControls
        if (this.controls) {
            // CINEMATIC MODE ROTATION LOGIC
            // CINEMATIC MODE: Auto-rotation disabled by user request ("Annoying")
            // Camera tracks steady with the planet (via above logic), no spin.
            this.controls.autoRotate = false;

            this.controls.update();
        }
    }

    /**
     * Enable or disable cinematic camera mode
     * @param {boolean} active 
     */
    setCinematic(active) {
        this.isCinematic = active;
        if (!active && this.controls) {
            this.controls.autoRotate = false;
        }
    }

    /**
     * Dispose of event listeners and resources.
     * Should be called when the controller is destroyed.
     */
    dispose() {
        // Remove event listeners
        if (this._onDblClick && this.renderer) {
            this.renderer.domElement.removeEventListener('dblclick', this._onDblClick);
        }
        if (this._onKeyDown) {
            window.removeEventListener('keydown', this._onKeyDown);
        }

        // Dispose OrbitControls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        // Reset state
        this._listenersAttached = false;
        this.system = null;
        this.camera = null;
        this.renderer = null;

        // InputController disposed
    }
}

// No default instance - Main.js creates it via Dependency Injection
