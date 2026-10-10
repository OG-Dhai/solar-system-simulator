/**
 * @fileoverview Haupteinstiegspunkt der Sonnensystem-Simulation
 * 
 * Diese Datei initialisiert die 3D-Szene mit Three.js und implementiert:
 * - WebXR Virtual Reality Unterstützung
 * - Videoaufnahme-Funktionalität
 * - Post-Processing (Bloom, FXAA)
 * - Adaptive Qualitätseinstellungen
 * 
 * @module Main
 * @author Sonnensystem-Simulation
 * @version 3.0.0
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { SolarSystem } from './SolarSystem.js';
import { Camera } from './Camera.js';
import { SolarSystemUI } from '../ui/SolarSystemUI.js';
import { getAutoQuality, getShadowMapTypeValue, clearQualityCache } from '../utils/PerformanceConfig.js';
import { Logger } from '../utils/Logger.js';

/** Fester Zeitschritt für Physik-Simulation (60 FPS) */
const FIXED_TIME_STEP = 1.0 / 60.0;

/**
 * Hauptanwendungsklasse für die Sonnensystem-Simulation
 * 
 * Verwaltet den gesamten Rendering-Zyklus, VR-Modus und Videoaufnahme.
 * Implementiert Fixed-Timestep-Physik für konsistente Simulation.
 */
class App {
    constructor() {
        // Three.js Kernkomponenten
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // Simulationskomponenten
        this.solarSystem = null;
        this.inputController = null;
        this.solarSystemUI = null;
        this.composer = null;

        // Rendering-Zustand
        this.frameProps = { count: 0, lastTime: performance.now() };
        this.isRunning = false;
        this.accumulator = 0;
        this.lastTime = 0;

        // Videoaufnahme-Eigenschaften
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;

        this._bindEvents();
    }

    /**
     * Bindet Event-Handler an die Klasseninstanz
     * @private
     */
    _bindEvents() {
        this._onResize = this._onResize.bind(this);
        this.render = this.render.bind(this);
    }

    /**
     * Initialisiert die Anwendung
     * 
     * Erstellt die 3D-Szene, konfiguriert WebGL-Renderer mit VR-Unterstützung,
     * lädt Texturen asynchron und startet die Render-Schleife.
     */
    init() {
        if (this.isRunning) return;

        try {
            // Szene erstellen
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x000005);

            // Kamera konfigurieren (großer Tiefenbereich für Sonnensystem)
            this.camera = new THREE.PerspectiveCamera(
                60,                                    // Sichtfeld
                window.innerWidth / window.innerHeight, // Seitenverhältnis
                0.00001,                               // Nahebene
                1000000                                // Fernebene
            );
            this.camera.position.set(0, 800, 800);
            this.camera.lookAt(0, 0, 0);

            // WebGL-Renderer mit optimierten Einstellungen
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance",
                logarithmicDepthBuffer: true,
                alpha: true,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true  // Erforderlich für Videoaufnahme
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);

            // Adaptive Pixeldichte basierend auf Geräteleistung
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isLowEndDevice = navigator.hardwareConcurrency < 4 ||
                (navigator.deviceMemory && navigator.deviceMemory < 4);

            if (isMobile || isLowEndDevice) {
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            } else {
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            }

            // Rendering-Qualität konfigurieren
            this.renderer.shadowMap.enabled = true;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.0;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;

            // WebXR VR-Unterstützung aktivieren
            this.renderer.xr.enabled = true;
            this.renderer.xr.setReferenceSpaceType('local');

            document.body.appendChild(this.renderer.domElement);

            // VR-Button zum DOM hinzufügen
            const vrButton = VRButton.createButton(this.renderer);
            document.body.appendChild(vrButton);

            // Qualitätseinstellungen automatisch erkennen
            const quality = getAutoQuality();
            this.renderer.shadowMap.type = getShadowMapTypeValue(quality.shadowMapType);

            // Simulationskomponenten initialisieren
            this.solarSystem = new SolarSystem(this.scene, quality);
            this.inputController = new Camera(this.camera, this.renderer, this.solarSystem);
            this.solarSystemUI = new SolarSystemUI({
                inputController: this.inputController,
                solarSystem: this.solarSystem
            });

            // Post-Processing-Effekte einrichten
            this._setupPostProcessing(quality);

            // Videoaufnahme-Funktionalität einrichten
            this._setupVideoRecording();

            // VR-Steuerung einrichten
            this._setupVRMouseControls();

            window.addEventListener('resize', this._onResize);
            this.isRunning = true;

            // Assets mit Fortschrittsanzeige vorladen
            this.solarSystem.preloadCriticalAssets((loaded, total) => {
                const percentage = Math.round((loaded / total) * 100);
                const liquid = document.getElementById('sun-liquid');
                const percentText = document.getElementById('loader-percentage');
                const statusText = document.getElementById('loader-status');

                if (liquid) liquid.style.height = `${percentage}%`;
                if (percentText) percentText.textContent = `${percentage}%`;
                if (statusText) {
                    if (percentage < 30) statusText.textContent = "Kern wird gezündet...";
                    else if (percentage < 60) statusText.textContent = "Stern wird betankt...";
                    else if (percentage < 90) statusText.textContent = "Fusion wird stabilisiert...";
                    else statusText.textContent = "System bereit";
                }
            }).then(() => {
                setTimeout(() => {
                    document.getElementById('loading-screen')?.classList.add('hidden');
                    this.lastTime = performance.now();
                    // setAnimationLoop für VR-Kompatibilität verwenden
                    this.renderer.setAnimationLoop(this.render);
                }, 500);
            });

        } catch (e) {
            Logger.error('Main', e);
            this._showError(e);
        }
    }

    /**
     * Richtet Post-Processing-Effekte ein
     * 
     * Konfiguriert Bloom-Effekt für leuchtende Himmelskörper
     * und FXAA für Kantenglättung.
     * 
     * @param {Object} quality - Qualitätseinstellungen
     * @private
     */
    _setupPostProcessing(quality) {
        try {
            this.composer = new EffectComposer(this.renderer);
            this.composer.addPass(new RenderPass(this.scene, this.camera));

            // Bloom-Effekt für Sonnenglühen
            const bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.5, 0.4, 0.85
            );
            bloom.strength = 0.3;
            bloom.radius = 0.8;
            bloom.threshold = 0.85;
            this.composer.addPass(bloom);

            // FXAA Antialiasing
            const fxaa = new ShaderPass(FXAAShader);
            fxaa.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
            this.composer.addPass(fxaa);
        } catch (e) {
            Logger.warn("Main", "Post-Processing fehlgeschlagen", e);
            this.composer = null;
        }
    }

    /**
     * Richtet die Videoaufnahme-Funktionalität ein
     * 
     * Verwendet MutationObserver, um auf den dynamisch erstellten
     * Aufnahme-Button zu warten.
     * @private
     */
    _setupVideoRecording() {
        const setupButton = () => {
            const recordBtn = document.getElementById('record-btn');
            if (!recordBtn) return false;

            recordBtn.addEventListener('click', () => {
                if (this.isRecording) {
                    this._stopRecording();
                } else {
                    this._startRecording();
                }
            });
            return true;
        };

        if (setupButton()) return;

        const observer = new MutationObserver((mutations, obs) => {
            if (setupButton()) obs.disconnect();
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
        }, 5000);
    }

    /**
     * Startet die Videoaufnahme
     * 
     * Erfasst den WebGL-Canvas mit 30 FPS und speichert
     * die Daten im WebM-Format.
     * @private
     */
    _startRecording() {
        try {
            const stream = this.renderer.domElement.captureStream(30);

            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                    ? 'video/webm;codecs=vp8'
                    : 'video/webm';

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 5000000
            });

            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this._downloadRecording();
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;

            const recordBtn = document.getElementById('record-btn');
            if (recordBtn) {
                recordBtn.innerHTML = '⏹️ Stopp';
                recordBtn.classList.add('recording');
            }
        } catch (error) {
            Logger.error('Main', 'Aufnahme konnte nicht gestartet werden', error);
        }
    }

    /**
     * Stoppt die aktuelle Videoaufnahme
     * @private
     */
    _stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.isRecording = false;

            const recordBtn = document.getElementById('record-btn');
            if (recordBtn) {
                recordBtn.innerHTML = '🎥 Aufnahme';
                recordBtn.classList.remove('recording');
            }
        }
    }

    /**
     * Lädt die aufgenommene Video-Datei herunter
     * @private
     */
    _downloadRecording() {
        if (this.recordedChunks.length === 0) return;

        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `Sonnensystem_Aufnahme_${timestamp}.webm`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Richtet VR-Steuerung mit Maus und Tastatur ein
     * 
     * Ermöglicht Navigation im VR-Modus:
     * - Maus ziehen: Blickrichtung ändern
     * - Mausrad: Vorwärts/Rückwärts bewegen
     * - WASD: Bewegung in alle Richtungen
     * - Zifferntasten: Zu Planeten springen
     * - F-Tasten: Zu Monden springen
     * @private
     */
    _setupVRMouseControls() {
        this.vrCameraGroup = new THREE.Group();
        this.vrCameraGroup.add(this.camera);
        this.scene.add(this.vrCameraGroup);

        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        // Maussteuerung für VR-Rotation
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (this.renderer.xr.isPresenting) {
                isDragging = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (isDragging && this.renderer.xr.isPresenting) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                this.vrCameraGroup.rotation.y -= deltaX * 0.005;
                this.vrCameraGroup.rotation.x -= deltaY * 0.005;
                this.vrCameraGroup.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.vrCameraGroup.rotation.x));

                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
        this.renderer.domElement.addEventListener('mouseleave', () => { isDragging = false; });

        // Mausrad für Vorwärts/Rückwärts-Bewegung
        this.renderer.domElement.addEventListener('wheel', (e) => {
            if (this.renderer.xr.isPresenting) {
                e.preventDefault();
                const moveSpeed = 50;
                const direction = new THREE.Vector3(0, 0, e.deltaY > 0 ? moveSpeed : -moveSpeed);
                direction.applyQuaternion(this.vrCameraGroup.quaternion);
                this.vrCameraGroup.position.add(direction);
            }
        }, { passive: false });

        // Tastatursteuerung für VR
        window.addEventListener('keydown', (e) => {
            if (!this.renderer.xr.isPresenting) return;

            const moveSpeed = 20;
            const direction = new THREE.Vector3();

            // WASD + QE für Bewegung
            switch (e.key.toLowerCase()) {
                case 'w': direction.z = -moveSpeed; break;
                case 's': direction.z = moveSpeed; break;
                case 'a': direction.x = -moveSpeed; break;
                case 'd': direction.x = moveSpeed; break;
                case 'q': direction.y = moveSpeed; break;
                case 'e': direction.y = -moveSpeed; break;
            }

            direction.applyQuaternion(this.vrCameraGroup.quaternion);
            this.vrCameraGroup.position.add(direction);

            // Zifferntasten für Planeten-Navigation
            const planetKeys = {
                '0': 'sun', '1': 'mercury', '2': 'venus', '3': 'earth',
                '4': 'mars', '5': 'jupiter', '6': 'saturn', '7': 'uranus',
                '8': 'neptune', '9': 'pluto', 'h': 'halley'
            };

            // F-Tasten für Mond-Navigation
            const moonKeys = {
                'F1': 'moon', 'F2': 'io', 'F3': 'europa', 'F4': 'ganymede',
                'F5': 'titan', 'F6': 'enceladus', 'F7': 'triton', 'F8': 'charon',
                'F9': 'phobos', 'F10': 'callisto'
            };

            const targetPlanet = planetKeys[e.key.toLowerCase()];
            const targetMoon = moonKeys[e.key];

            if ((targetPlanet || targetMoon) && this.solarSystem) {
                e.preventDefault();
                const bodyName = targetPlanet || targetMoon;
                const body = this.solarSystem.getBodyByName?.(bodyName);
                if (body && body.mesh) {
                    const pos = new THREE.Vector3();
                    body.mesh.getWorldPosition(pos);
                    const offset = body.radius ? body.radius * 5 : 10;
                    this.vrCameraGroup.position.set(pos.x + offset, pos.y + offset / 2, pos.z + offset);
                }
            }
        });
    }

    /**
     * Zeigt eine Fehlermeldung bei kritischen Fehlern
     * @param {Error} error - Der aufgetretene Fehler
     * @private
     */
    _showError(error) {
        const overlay = document.createElement('div');
        overlay.className = 'error-overlay';
        overlay.innerHTML = `
            <div class="error-title">Simulationsfehler</div>
            <div class="error-message">Die Sonnensystem-Simulation ist auf einen kritischen Fehler gestoßen.</div>
            <div class="error-details">${error.message}\n\n${error.stack || ''}</div>
            <button class="retry-btn" onclick="location.reload()">Simulation neu laden</button>
        `;
        document.body.appendChild(overlay);
        document.getElementById('loading-screen')?.classList.add('hidden');
    }

    /**
     * Behandelt Fenstergrößenänderungen
     * @private
     */
    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Haupt-Render-Schleife
     * 
     * Verwendet Fixed-Timestep-Akkumulator für konsistente Physik-Simulation
     * unabhängig von der Bildrate. Unterstützt sowohl Desktop als auch VR.
     * 
     * @param {number} time - Hochauflösender Zeitstempel in Millisekunden
     */
    render(time) {
        if (!this.isRunning) return;

        const currentTime = time || performance.now();
        const deltaMs = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Catch-Up Safeguard: Spiral of death prevention
        const frameTime = Math.min(deltaMs / 1000, 0.25);
        this.accumulator += frameTime;

        // Fixed-Timestep-Physik für konsistente Simulation
        while (this.accumulator >= FIXED_TIME_STEP) {
            if (this.solarSystem.fixedUpdate) {
                this.solarSystem.fixedUpdate(FIXED_TIME_STEP);
            } else {
                // Fallback for old architecture
                this.solarSystem.update(FIXED_TIME_STEP, FIXED_TIME_STEP, this.camera);
            }
            this.accumulator -= FIXED_TIME_STEP;
        }

        // Interpolation Alpha for smooth rendering between fixed steps
        const alpha = this.accumulator / FIXED_TIME_STEP;

        if (this.solarSystem.renderUpdate) {
            this.solarSystem.renderUpdate(frameTime, alpha, this.camera);
        }

        this.inputController.update(frameTime);

        // Post-Processing nur im Desktop-Modus verwenden
        if (this.composer && !this.renderer.xr.isPresenting) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        // FPS-Zähler aktualisieren
        const now = performance.now();
        this.frameProps.count++;
        if (now - this.frameProps.lastTime >= 1000) {
            const fps = Math.round((this.frameProps.count * 1000) / (now - this.frameProps.lastTime));
            if (this.solarSystemUI) this.solarSystemUI.updateFPS(fps);
            this.frameProps.count = 0;
            this.frameProps.lastTime = now;
        }
    }

    /**
     * Bereinigt alle Ressourcen beim Beenden
     * 
     * Stoppt die Render-Schleife, beendet Aufnahmen und
     * gibt WebGL-Ressourcen frei.
     */
    destroy() {
        this.isRunning = false;
        this.renderer.setAnimationLoop(null);

        if (this.isRecording) {
            this._stopRecording();
        }

        if (this.composer) {
            this.composer.renderPass.dispose();
            if (this.composer.passes) {
                this.composer.passes.forEach(pass => {
                    if (pass.dispose) pass.dispose();
                });
            }
            this.composer.dispose();
        }

        if (this.renderer) {
            this.renderer.dispose();
        }

        clearQualityCache();

        if (this.solarSystem) {
            this.solarSystem.dispose();
        }
    }
}

// Ressourcen beim Seitenverlassen bereinigen
window.addEventListener('beforeunload', () => {
    if (window.appInstance) {
        window.appInstance.destroy();
    }
});

// Anwendung starten
const app = new App();
window.appInstance = app;
app.init();
