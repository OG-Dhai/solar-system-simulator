/**
 * @fileoverview Eingabecontroller für Kamera und Benutzerinteraktion.
 * Handhabt Kamera-Tracking, sanfte Fluganimationen und Benutzereingabe-Events.
 * @module InputController
 * 
 * Architektur: Standardklasse mit Dependency Injection (Kein Singleton)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CELESTIAL_DATA, SCALE_FACTORS } from '../utils/Utils.js';
import { Logger } from '../utils/Logger.js';

/**
 * Controller für Kamerabewegung und Benutzereingabe.
 * Standardklasse - wird von Main.js via Dependency Injection instanziiert.
 */
export class Camera {
    /**
     * Erstellt den Eingabecontroller.
     * @param {THREE.Camera} camera - Die Three.js-Kamera (Dependency Injection)
     * @param {THREE.WebGLRenderer} renderer - Der Three.js-Renderer (Dependency Injection)
     * @param {Object} targetSystem - Systemschnittstelle mit { bodies: Map, getBodyPosition(key): Vector3 } (Dependency Injection)
     * @throws {Error} Wenn erforderliche Abhängigkeiten nicht bereitgestellt werden
     */
    constructor(camera, renderer, targetSystem) {
        // Erforderliche Abhängigkeiten validieren
        if (!camera) {
            throw new Error("InputController benötigt eine THREE.Camera-Instanz");
        }
        if (!renderer) {
            throw new Error("InputController benötigt eine THREE.WebGLRenderer-Instanz");
        }
        if (!targetSystem) {
            throw new Error("InputController benötigt ein targetSystem mit bodies und getBodyPosition");
        }

        /** @type {THREE.Camera} Referenz zur Kamera */
        this.camera = camera;

        /** @type {THREE.WebGLRenderer} Referenz zum Renderer */
        this.renderer = renderer;

        /** @type {Object} Zielsystem (SolarSystem oder kompatible Schnittstelle) */
        this.system = targetSystem;

        /** @type {string|null} Aktuell verfolgter Körper-Schlüssel */
        this.trackedBody = null;

        /** @type {THREE.Vector3} Letzte verfolgte Position */
        this.lastTargetPos = new THREE.Vector3();

        /** @type {OrbitControls|null} Three.js Orbit-Controls */
        this.controls = null;

        /** @type {THREE.Vector3} Kamera-Offset vom Ziel */
        this.cameraOffset = new THREE.Vector3();

        // Fluganimation-Zustand
        /** @type {boolean} Ob gerade eine Fluganimation läuft */
        this.isFlying = false;

        /** @type {number} Flug-Startzeitstempel */
        this.flightStartTime = 0;

        /** @type {number} Flugdauer in ms */
        this.flightDuration = 2000;

        /** @type {THREE.Vector3} Flug-Start-Kameraposition */
        this.flyStartPos = new THREE.Vector3();

        /** @type {THREE.Vector3} Flug-Start-Zielposition */
        this.flyStartTarget = new THREE.Vector3();

        /** @type {string|null} Zielkörper-Schlüssel */
        this.flyEndBody = null;

        /** @type {function|null} Promise-Resolver für Flugabschluss */
        this.flyResolve = null;

        // Gebundene Event-Handler (für Bereinigung)
        this._onDblClick = null;
        this._onKeyDown = null;

        /** @type {boolean} Schutz für Event-Listener-Anhängung */
        this._listenersAttached = false;

        /** @type {number} Flug-ID für Abbruch */
        this._flightId = 0;

        // Sofort initialisieren (Konstruktor behandelt alles)
        this._initControls();
        this._setupEvents();
    }

    /**
     * Initialisiert OrbitControls.
     * @private
     */
    _initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 0.00001; // Sehr nahes Zoomen für kleine Monde erlauben (Radius < 0.001)
        this.controls.maxDistance = 100000;
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 1.2;
    }

    /**
     * Richtet Event-Listener für Benutzereingaben ein.
     * @private
     */
    _setupEvents() {
        // Schutz gegen doppelte Listener-Anhängung
        if (this._listenersAttached) {
            Logger.warn('InputController', 'Event-Listener bereits angehängt');
            return;
        }
        this._listenersAttached = true;

        // Doppelklick zum Fokussieren auf Körper
        this._onDblClick = (e) => {
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );
            const ray = new THREE.Raycaster();
            ray.setFromCamera(mouse, this.camera);

            // Injiziertes System statt globalem Import verwenden
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

        // ESC zum Entsperren der Kamera
        this._onKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.trackedBody = null;
            }
        };
        window.addEventListener('keydown', this._onKeyDown);
    }

    /**
     * Fokussiert die Kamera auf einen Himmelskörper.
     * @param {string} key - Körper-Schlüssel zum Fokussieren
     */
    focusOnBody(key) {
        if (!key) {
            Logger.warn('InputController', 'Schlüssel ist erforderlich');
            return;
        }

        this.trackedBody = key;
        // Injiziertes System statt globalem Import verwenden
        const pos = this.system.getBodyPosition(key);
        if (!pos) {
            Logger.warn('InputController', `Körper "${key}" nicht gefunden`);
            return;
        }

        this.lastTargetPos.copy(pos);

        // Visuellen Radius für Kamerapositionierung berechnen
        let visualRadius = 1.0;

        // Versuchen das Körperobjekt zu finden um seine tatsächliche Skalierung/Radius zu erhalten
        const bodyObj = this.system.bodies.get(key);
        if (bodyObj && bodyObj.radius) {
            visualRadius = bodyObj.radius;
        } else {
            // Fallback auf Daten
            const data = CELESTIAL_DATA[key];
            visualRadius = data?.radius || 1.0;
        }

        // Kameradistanz basierend auf Körpertyp und -größe anpassen
        let r;
        if (key === 'sun') {
            r = visualRadius * 4.0; // Sonne benötigt spezielle Behandlung wegen ihrer Größe
        } else if (['moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea', 'dione', 'tethys', 'enceladus', 'mimas', 'titania', 'oberon', 'umbriel', 'ariel', 'miranda', 'triton', 'charon'].includes(key)) {
            // MOND-FIX: 0.5-Limit entfernen um Heranzoomen auf kleine Monde zu erlauben (Phobos r=0.0017)
            r = visualRadius * 5.0;
        } else {
            r = visualRadius * 5.0; // 5x Radius ist eine gute Betrachtungsdistanz für Planeten
        }

        // INTELLIGENTE KAMERAPOSITIONIERUNG:
        // Anstatt eines festen Offsets (der uns oft auf die dunkle Seite bringt),
        // berechnen wir eine Position relativ zum Sonne-Körper-Vektor.

        // 1. Vektor von Sonne (0,0,0) zum Körper
        const sunToBody = pos.clone().normalize();

        // 2. Wir wollen von der "beleuchteten" Seite betrachten, also positionieren wir die Kamera
        // irgendwo "zwischen" Sonne und Körper (oder leicht versetzt).
        // Vektor der VOM Körper zur Sonne zeigt:
        const viewDir = sunToBody.clone().negate();

        // 3. Leichten "Terminator"-Winkel hinzufügen (z.B. 30-45 Grad nach oben/seitlich) für kinematische Schatten
        const up = new THREE.Vector3(0, 1, 0);
        viewDir.applyAxisAngle(up, THREE.MathUtils.degToRad(15)); // 15 Grad seitlich
        viewDir.add(new THREE.Vector3(0, 0.4, 0)).normalize(); // Leicht erhöht

        // 4. Endgültige Kameraposition berechnen
        const adjustedOffset = viewDir.multiplyScalar(r);

        this.cameraOffset.copy(adjustedOffset);

        this.controls.target.copy(pos);
        this.camera.position.copy(pos).add(adjustedOffset);
    }

    /**
     * Fliegt die Kamera sanft zu einem Himmelskörper.
     * @param {string} key - Körper-Schlüssel zum Anfliegen
     * @param {number} [duration=2000] - Flugdauer in ms
     * @returns {Promise<void>} Promise das resolved wenn der Flug abgeschlossen ist
     */
    flyTo(key, duration = 2000) {
        // Flugdauer validieren
        if (!Number.isFinite(duration) || duration <= 0) {
            Logger.warn('InputController', `Ungültige Dauer ${duration}, verwende Standard 2000ms`);
            duration = 2000;
        } else {
            const clamped = Math.max(500, Math.min(30000, duration));
            if (clamped !== duration) {
                Logger.warn('InputController', `Dauer ${duration} auf ${clamped}ms begrenzt`);
                duration = clamped;
            }
        }

        // Flug-ID inkrementieren und für diesen Flug erfassen
        const currentFlightId = ++this._flightId;

        return new Promise((resolve) => {
            // Existierenden Flug abbrechen um Promise-Leaks zu verhindern
            if (this.isFlying && this.flyResolve) {
                Logger.warn('InputController', 'Vorherigen Flug abbrechen');
                this.flyResolve();
                this.flyResolve = null;
            }

            // Injiziertes System statt globalem Import verwenden
            const pos = this.system.getBodyPosition(key);
            if (!pos) {
                Logger.warn('InputController', `Körper "${key}" nicht gefunden`);
                resolve();
                return;
            }

            this.trackedBody = null;
            this.isFlying = true;
            this.flyEndBody = key;
            this.flightDuration = duration;
            this.flightStartTime = performance.now();
            this.flyResolve = () => {
                // Nur resolven wenn dies noch der aktuelle Flug ist
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
     * Aktualisiert Kamera-Tracking und Fluganimation.
     * Sollte jeden Frame aufgerufen werden.
     */
    update() {
        // Flugmodus
        if (this.isFlying) {
            const now = performance.now();
            const elapsed = now - this.flightStartTime;
            const progress = Math.min(elapsed / this.flightDuration, 1);

            // EaseInOutCubic
            const t = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // Injiziertes System statt globalem Import verwenden
            const destPos = this.system.getBodyPosition(this.flyEndBody);

            if (destPos) {
                this.controls.target.lerpVectors(this.flyStartTarget, destPos, t);

                // Zieldistanz dynamisch basierend auf Zielkörpergröße neu berechnen
                let visualRadius = 1.0;
                const bodyObj = this.system.bodies.get(this.flyEndBody);
                if (bodyObj && bodyObj.radius) {
                    visualRadius = bodyObj.radius;
                } else {
                    visualRadius = (CELESTIAL_DATA[this.flyEndBody]?.radius || 1.0);
                }

                // Kameradistanz basierend auf Körpertyp und -größe für Flug anpassen
                let r;
                if (this.flyEndBody === 'sun') {
                    r = visualRadius * 4.0;
                } else if (['moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea', 'dione', 'tethys', 'enceladus', 'mimas', 'titania', 'oberon', 'umbriel', 'ariel', 'miranda', 'triton', 'charon'].includes(this.flyEndBody)) {
                    r = visualRadius * 5.0;
                } else {
                    r = visualRadius * 5.0; // 5x Radius gibt eine viel bessere "Majestätische" Ansicht (Saturn-Ringe sichtbar)
                }

                // INTELLIGENTES FLUGZIEL:
                // Dieselbe sonnenrelative Logik wie focusOnBody für konsistente Ankunft verwenden
                const sunToBody = destPos.clone().normalize();
                const viewDir = sunToBody.clone().negate();

                // Kinematischer Winkel - VERBESSERT
                const up = new THREE.Vector3(0, 1, 0);
                viewDir.applyAxisAngle(up, THREE.MathUtils.degToRad(15));
                viewDir.add(new THREE.Vector3(0, 0.4, 0)).normalize();

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

        // Kamera-Tracking-Modus
        if (this.trackedBody) {
            const curPos = this.system.getBodyPosition(this.trackedBody);
            if (curPos) {
                const currentOffset = this.camera.position.clone().sub(this.controls.target);
                this.controls.target.copy(curPos);
                this.camera.position.copy(curPos).add(currentOffset);
                this.lastTargetPos.copy(curPos);
            }
        }

        // OrbitControls aktualisieren
        if (this.controls) {
            // KINEMATISCHER MODUS: Auto-Rotation auf Benutzerwunsch deaktiviert ("Störend")
            // Kamera verfolgt den Planeten stetig (via obiger Logik), kein Drehen.
            this.controls.autoRotate = false;

            this.controls.update();
        }
    }

    /**
     * Aktiviert oder deaktiviert den kinematischen Kameramodus
     * @param {boolean} active 
     */
    setCinematic(active) {
        this.isCinematic = active;
        if (!active && this.controls) {
            this.controls.autoRotate = false;
        }
    }

    /**
     * Gibt Event-Listener und Ressourcen frei.
     * Sollte aufgerufen werden wenn der Controller zerstört wird.
     */
    dispose() {
        // Event-Listener entfernen
        if (this._onDblClick && this.renderer) {
            this.renderer.domElement.removeEventListener('dblclick', this._onDblClick);
        }
        if (this._onKeyDown) {
            window.removeEventListener('keydown', this._onKeyDown);
        }

        // OrbitControls freigeben
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        // Zustand zurücksetzen
        this._listenersAttached = false;
        this.system = null;
        this.camera = null;
        this.renderer = null;
    }
}

// Keine Standard-Instanz - Main.js erstellt sie via Dependency Injection
