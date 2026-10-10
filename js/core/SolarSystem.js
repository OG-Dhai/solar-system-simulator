/**
 * @fileoverview Szenenmanager für das Sonnensystem
 * 
 * Verwaltet alle Himmelskörper, Planeten, Monde, Asteroiden und visuelle Effekte.
 * Implementiert Keplersche Orbitalmechanik und LOD-System für optimale Leistung.
 * 
 * @module SolarSystem
 * @author Sonnensystem-Simulation
 * @version 3.0.0
 */

import * as THREE from 'three';
import { CELESTIAL_DATA, HALLEY_DATA, ASTEROID_BELT, ASTEROID_BELT_SECONDARY, KUIPER_BELT, KUIPER_BELT_SECONDARY, getPlanets, getMoons, AU, degToRad, calculateOrbitalPosition, disposeThreeObject, generateAsteroidTransform, TIME_SCALE, YEAR_SECONDS, ROTATION_VISUAL_MULTIPLIER } from '../utils/Utils.js';
import { loadTexture, preloadTextures } from '../utils/EnhancedTextureLoader.js';
import { UnifiedRingSystem } from '../rings/UnifiedRingSystem.js';
import { MilkyWay } from './MilkyWay.js';
import { EclipseSystem } from '../utils/EclipseSystem.js';
import { createSunMesh, createCoronaMesh, updateSunUniforms, setSunTexture } from '../shaders/SunShader.js';
import { LagrangeVisualizer } from '../utils/LagrangeVisualizer.js';
import { Logger } from '../utils/Logger.js';

import { PlanetBase } from '../planets/PlanetBase.js';
import { AdvancedHalley } from '../planets/AdvancedHalley.js';

import { MoonBase } from '../moons/MoonBase.js';
import { CelestialBodyFactory } from './CelestialBodyFactory.js';

export class SolarSystem {
    constructor(scene, quality = {}) {
        if (!scene) throw new Error("SolarSystem requires a THREE.Scene instance");
        this.scene = scene;
        this.quality = quality;
        this.bodies = new Map();
        this.planets = new Map();
        this.moons = new Map();
        this.unifiedRingSystem = null;
        this.timeSpeed = 86400; // Standardgeschwindigkeit: 1 Tag pro Sekunde
        this.cinematicMode = false; // Kinomodus: individuelle Orbitalgeschwindigkeiten pro Planet
        this.simTime = 0;
        this.isPaused = false;
        this.orbitsVisible = true; // Orbitlinien standardmäßig aktivieren für bessere Orientierung
        this.sunRotationAngle = 0;
        this.sunMesh = null;
        this.sunGroup = null;
        this.sunLight = null;
        this.sunCoronaMesh = null;
        this.sunTime = 0;

        // Lagrange-Punkt-Visualisierung
        this.lagrangeVisualizer = null;
        this.halleyComet = null;
        this.cometTailSprite = null;
        this.asteroidMesh = null;
        this.asteroidMesh2 = null;
        this.kuiperMesh = null;
        this.kuiperMesh2 = null;
        this.distantSunSprite = null;
        this.starField = null;
        this._criticalPromises = [];
        this._dummyObject = new THREE.Object3D();
        this.zeroPosition = new THREE.Vector3(0, 0, 0);

        this._init();
    }

    /**
     * Initialisiert das gesamte Sonnensystem
     * @private
     */
    _init() {
        try {
            // 1. Beleuchtung und Umgebung
            this.createLighting();
            this.createMovingStars();
            this.milkyWay = new MilkyWay(this.scene);

            // 2. Sonne (Nahansicht und Fernansicht)
            this.createSun();
            this.createDistantSun();

            // 3. Einheitliche Systeme (vor Planeten initialisieren für Ringregistrierung)
            this.unifiedRingSystem = new UnifiedRingSystem(this.scene);
            this.eclipseSystem = new EclipseSystem(this.scene, this.sunMesh);
            this.lagrangeVisualizer = new LagrangeVisualizer(this.scene);

            // 4. Planeten und Himmelskörper
            this.createPlanets();
            this.createMoons();
            this.createAsteroidBelt();
            this.createKuiperBelt();

            // Halleyscher Komet mit nicht-gravitativen Kräften
            this.halleyComet = new AdvancedHalley(HALLEY_DATA, this.scene);
            this.bodies.set('halley', this.halleyComet);

            // 5. Echtzeit-Synchronisation
            this.setRealTime();

            // Initiale Sichtbarkeitseinstellungen
            this.setOrbitsVisible(this.orbitsVisible);
            this.setLagrangePointsVisible(false);

        } catch (err) {
            Logger.error('SolarSystem', '_init: Failed to initialize', err);
            throw err;
        }
    }

    createSun() {
        const data = CELESTIAL_DATA.sun;
        this.sunGroup = new THREE.Group();

        // Shader-Qualitätsstufe basierend auf Konfiguration bestimmen
        // Standard ist HIGH (2) falls undefiniert
        let shaderQuality = 2; // High/Ultra
        if (this.quality) {
            // Prüfe Beschreibungen oder abgeleitete Eigenschaften falls Preset-Name nicht direkt verfügbar
            // Ableitung aus sphereSegments möglich, da im Preset enthalten
            if (this.quality.sphereSegments <= 32) {
                shaderQuality = 0; // Low
            } else if (this.quality.sphereSegments <= 48) {
                shaderQuality = 1; // Medium
            }
        }

        // Sonne mit benutzerdefiniertem Shader erstellen (prozedurale Oberfläche mit Randverdunkelung)
        const sun = createSunMesh(data.radius, this.quality.sphereSegments || 64, shaderQuality);
        this.sunMesh = sun;
        this.sunGroup.add(sun);

        // Textur laden und mit prozeduralem Shader mischen
        const sunTexturePromise = loadTexture('sun').then(tex => {
            tex.colorSpace = THREE.SRGBColorSpace;
            setSunTexture(sun, tex);
        });
        this._criticalPromises.push(sunTexturePromise);

        // Benutzerdefinierte Korona mit animiertem Shader
        const corona = createCoronaMesh(data.radius, 1.8);
        this.sunCoronaMesh = corona;
        this.sunGroup.add(corona);

        // Sekundärer äußerer Schimmer (realistischere Größe und Intensität)
        const outerGlowGeo = new THREE.SphereGeometry(data.radius * 1.8, 32, 32); // Reduziert von 2.5 auf 1.8
        const outerGlowMat = new THREE.MeshBasicMaterial({
            color: 0xff9900, // Etwas weniger intensive Farbe
            transparent: true,
            opacity: 0.10, // Reduziert von 0.15 auf 0.10
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.sunGlowMesh = new THREE.Mesh(outerGlowGeo, outerGlowMat);
        this.sunGroup.add(this.sunGlowMesh);

        // Punktlicht für Schatten und Planetenbeleuchtung
        const light = new THREE.PointLight(0xffffff, 10.0, 0, 0); // Intensität erhöht von 5.0 auf 10.0, Abfall = 0 (unendliche Reichweite)
        light.castShadow = true;
        const shadowSize = this.quality.shadowMapSize || 2048;
        light.shadow.mapSize.set(shadowSize, shadowSize);
        // Bias reduziert und normalBias hinzugefügt um Self-Shadowing-Artefakte auf großen entfernten Sphären zu verhindern
        light.shadow.bias = -0.00005;
        light.shadow.normalBias = 0.05;
        this.sunGroup.add(light);
        this.sunLight = light;

        this.scene.add(this.sunGroup);
        this.bodies.set('sun', { mesh: sun, data, getPosition: () => this.zeroPosition });
    }

    // Erstellt den "Fernen Stern" der beim Herauszoomen erscheint (kleiner leuchtender Punkt mit Label)
    createDistantSun() {
        // Prozedurale Sterntextur erstellen (klein, scharf, sternartig)
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const cx = 64, cy = 64;

        // Scharfes Sternglühen
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.05, 'rgba(255, 255, 200, 0.9)');
        grad.addColorStop(0.2, 'rgba(255, 200, 100, 0.5)');
        grad.addColorStop(0.5, 'rgba(255, 150, 50, 0.1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const starTexture = new THREE.CanvasTexture(canvas);

        const material = new THREE.SpriteMaterial({
            map: starTexture,
            color: 0xffffee,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.distantSunSprite = new THREE.Sprite(material);
        this.distantSunSprite.scale.set(800, 800, 1); // Viel kleiner, schärfer
        this.scene.add(this.distantSunSprite);

        // "Sonne" Label mit Canvas-Textur auf Sprite erstellen
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256; labelCanvas.height = 64;
        const labelCtx = labelCanvas.getContext('2d');
        labelCtx.fillStyle = 'rgba(0,0,0,0)';
        labelCtx.fillRect(0, 0, 256, 64);
        labelCtx.font = 'bold 32px Arial';
        labelCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        labelCtx.textAlign = 'center';
        labelCtx.fillText('☀ Sonne', 128, 40);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
        });

        this.distantSunLabel = new THREE.Sprite(labelMaterial);
        this.distantSunLabel.scale.set(1500, 375, 1);
        this.distantSunLabel.position.set(0, 700, 0); // Über dem Sonnensprite
        this.scene.add(this.distantSunLabel);
    }

    createLighting() {
        // Umgebungslicht - NIEDRIGE Intensität für realistischen Weltraum-Look
        // Wir verlassen uns auf die Sonne (PointLight) für Hauptbeleuchtung und Emissive-Shader für Sichtbarkeit
        const ambient = new THREE.AmbientLight(0x404050, 0.2);
        this.scene.add(ambient);

        // Hemisphärenlicht - subtile Füllung
        // Himmelsfarbe (oben) leicht bläulich, Boden (unten) sehr dunkel
        const hemiLight = new THREE.HemisphereLight(0x1a1a2e, 0x000005, 0.1);
        this.scene.add(hemiLight);
    }

    createMovingStars() {
        // Sternfeld im NASA-Stil: Dicht, variierende Helligkeit, immer sichtbar
        const starCount = 6000; // Erhöht für dichteres Sternfeld wie bei der NASA
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            // Sphärische Verteilung - größerer Bereich für bessere Abdeckung
            const r = 8000 + Math.random() * 35000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Variierende Helligkeit (wie echte Sterne)
            const brightness = 0.4 + Math.random() * 0.6;
            // Leichte Farbvariation (manche Sterne wärmer/kühler)
            const colorTemp = Math.random();
            if (colorTemp < 0.1) {
                // Bläuliche Sterne (heiß)
                colors[i * 3] = brightness * 0.8;
                colors[i * 3 + 1] = brightness * 0.9;
                colors[i * 3 + 2] = brightness;
            } else if (colorTemp > 0.9) {
                // Rötliche Sterne (kühl)
                colors[i * 3] = brightness;
                colors[i * 3 + 1] = brightness * 0.7;
                colors[i * 3 + 2] = brightness * 0.5;
            } else {
                // Weiß/Gelbe Sterne (am häufigsten)
                colors[i * 3] = brightness;
                colors[i * 3 + 1] = brightness * 0.95;
                colors[i * 3 + 2] = brightness * 0.9;
            }

            // Zufällige Größen (wenige helle Sterne, viele schwache)
            sizes[i] = Math.random() < 0.05 ? 2.0 + Math.random() * 1.5 : 0.8 + Math.random() * 1.0;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            vertexColors: true,
            size: 1.5,
            transparent: true,
            opacity: 1.0, // Immer hell
            sizeAttenuation: false,
            depthWrite: false
        });

        this.starField = new THREE.Points(geometry, material);
        this.starField.renderOrder = -500; // Hinter Planeten aber vor Skybox rendern
        this.scene.add(this.starField);
    }
    /**
     * Erstellt alle Planeten und fügt sie zur Szene hinzu
     */
    createPlanets() {
        getPlanets().forEach(k => {
            const p = CelestialBodyFactory.createPlanet(CELESTIAL_DATA[k], k, this.quality, this);
            this.planets.set(k, p);
            this.bodies.set(k, p);

            // Pivot-Gruppe zur Szene hinzufügen (für korrekte Orbitalbewegung)
            const pivot = p.getPivotGroup();
            if (pivot) this.scene.add(pivot);

            // Orbitlinie hinzufügen
            if (p.getOrbitLine()) this.scene.add(p.getOrbitLine());
        });
    }

    /**
     * Erstellt alle Monde und ordnet sie ihren Mutterplaneten zu
     * 
     * Unterscheidet zwischen:
     * - Regulären Monden (folgen der Äquatorebene des Planeten)
     * - Irregulären Monden (folgen der Ekliptik, z.B. Erdmond, Nereid)
     */
    createMoons() {
        const planetMoons = new Map();

        this.planets.forEach((p, pk) => {
            const moonsForPlanet = [];

            getMoons(pk).forEach(mk => {
                const m = CelestialBodyFactory.createMoon(CELESTIAL_DATA[mk], mk, p);
                this.moons.set(mk, m);
                this.bodies.set(mk, m);
                moonsForPlanet.push(m);

                // Mond-Klassifizierung: Irreguläre Monde folgen der Ekliptik
                const irregularMoons = ['moon', 'nereid'];

                if (irregularMoons.includes(mk)) {
                    // Ekliptische Monde (folgen der Sonnenbahnebene)
                    p.getGroup().add(m.getGroup());
                    const orbitLine = m.getOrbitLine();
                    if (orbitLine) {
                        if (orbitLine.parent) orbitLine.parent.remove(orbitLine);
                        p.getGroup().add(orbitLine);
                    }
                } else {
                    // Äquatoriale Monde (folgen der Planetenneigung)
                    if (p.tiltGroup) {
                        p.tiltGroup.add(m.getGroup());
                        const orbitLine = m.getOrbitLine();
                        if (orbitLine) {
                            if (orbitLine.parent) orbitLine.parent.remove(orbitLine);
                            p.tiltGroup.add(orbitLine);
                        }
                    } else {
                        p.getGroup().add(m.getGroup());
                    }
                }
            });

            if (moonsForPlanet.length > 0) {
                planetMoons.set(p, moonsForPlanet);
            }
        });

        // Finsternisse für Planeten-Mond-Paare registrieren
        planetMoons.forEach((moons, planet) => {
            if (this.eclipseSystem) {
                this.eclipseSystem.registerPlanetEclipses(planet, moons);
            }
        });
    }

    createAsteroidBelt() {
        this.asteroidMesh = this.createBelt(ASTEROID_BELT, 0x887766, 'MainAsteroidBelt');
        this.asteroidMesh2 = this.createBelt(ASTEROID_BELT_SECONDARY, 0x665544, 'SecondaryAsteroidBelt');
    }

    createKuiperBelt() {
        this.kuiperMesh = this.createBelt(KUIPER_BELT, 0x8899aa, 'KuiperBelt');
        this.kuiperMesh2 = this.createBelt(KUIPER_BELT_SECONDARY, 0x667788, 'SecondaryKuiperBelt');
    }

    createBelt(config, color, name) {
        if (!config || !config.count) return;

        // Use a simpler geometry to reduce visual artifacts
        const geometry = new THREE.SphereGeometry(0.5, 8, 6); // Lower segment count to reduce complexity
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.7  // Slightly transparent to reduce visual noise
        });

        const mesh = new THREE.InstancedMesh(geometry, material, config.count);
        mesh.name = name;
        const dummy = new THREE.Object3D();

        for (let i = 0; i < config.count; i++) {
            const t = generateAsteroidTransform(i, config);
            dummy.position.copy(t.position);
            dummy.rotation.copy(t.rotation);
            dummy.scale.copy(t.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(mesh);
        return mesh;
    }

    // Old createHalleyComet removed in favor of Halley.js class

    fixedUpdate(dt) {
        if (this.isPaused) return;

        // 1. Zeit aktualisieren (deterministisch)
        this.simTime += dt * this.timeSpeed;

        // 2. Planeten- und Himmelskörper-Bewegung aktualisieren
        this.bodies.forEach(body => {
            if (body.fixedUpdate) {
                body.fixedUpdate(dt, this.simTime, this.timeSpeed);
            } else if (body.update) {
                // Fallback für Objekte die noch nicht migriert wurden
                body.update(dt, this.simTime, this.timeSpeed, null);
            }
        });

        // 3. Andere Systeme aktualisieren (Physik)
        if (this.eclipseSystem) {
            if (this.eclipseSystem.fixedUpdate) this.eclipseSystem.fixedUpdate();
            else if (this.eclipseSystem.update) this.eclipseSystem.update();
        }

        if (this.halleyComet) {
            let halleyDt = dt * this.timeSpeed;
            if (this.cinematicMode) {
                const HALLEY_CINEMATIC_MULTIPLIER = 2000.0;
                halleyDt *= HALLEY_CINEMATIC_MULTIPLIER;
            }

            if (this.halleyComet.fixedUpdate) {
                this.halleyComet.fixedUpdate(halleyDt, this.simTime);
            } else if (this.halleyComet.update) {
                this.halleyComet.update(halleyDt, this.simTime);
            }
        }
    }

    renderUpdate(visualDt, alpha, camera) {
        // 1. Sun rotation and shader updates (Visuell)
        if (!this.isPaused && this.sunMesh) {
            // Langsame sichtbare Rotation
            const sunPeriodSeconds = 25 * 86400; // 25 days
            const rotationSpeed = (2 * Math.PI) / sunPeriodSeconds;
            this.sunRotationAngle += rotationSpeed * visualDt * this.timeSpeed * ROTATION_VISUAL_MULTIPLIER;
            this.sunMesh.rotation.y = this.sunRotationAngle;

            // Sonnenshader-Zeit für animierte Oberfläche aktualisieren
            this.sunTime += visualDt * 0.5;
            updateSunUniforms(this.sunMesh, this.sunCoronaMesh, camera, this.sunTime);
        }

        // 2. Interpolierte Planeten- und Himmelskörper-Updates
        this.bodies.forEach(body => {
            if (body.renderUpdate) {
                body.renderUpdate(visualDt, alpha, camera);
            }
        });

        if (this.unifiedRingSystem) {
            if (this.unifiedRingSystem.renderUpdate) this.unifiedRingSystem.renderUpdate(camera, alpha);
            else if (this.unifiedRingSystem.update) this.unifiedRingSystem.update(camera, this.simTime);
        }

        // Lagrange-Punkt-Visualisierung für Gasriesen aktualisieren
        if (this.lagrangeVisualizer) {
            const gasGiants = ['jupiter', 'saturn', 'uranus', 'neptune'];
            gasGiants.forEach(key => {
                const planet = this.planets.get(key);
                if (planet && planet.lagrangePoints) {
                    // Basierend auf Orbitaldistanz des Planeten skalieren
                    const orbitScale = planet.orbitData?.a || 5;
                    this.lagrangeVisualizer.updatePlanetLagrangePoints(
                        key,
                        planet.lagrangePoints,
                        orbitScale * 0.02
                    );
                }
            });
            this.lagrangeVisualizer.updateLOD(camera);
        }

        // 5. Visuelle Logik (LOD und Übergänge)
        if (camera) {
            const dist = camera.position.length();

            // a) Milchstraße (Skybox) aktualisieren
            if (this.milkyWay) this.milkyWay.update(camera.position);

            // b) Steuerung der Sichtbarkeit: Sonnensystem vs. ferner Stern
            // Erweiterter Übergangsbereich: 100.000 bis 200.000 für Planetenbeobachtung aus großer Entfernung
            const FADE_START = 100000;  // Bei 100000 belassen um zu frühes Ausblenden zu verhindern
            const FADE_END = 200000;    // Bei 200000 belassen um zu frühes Ausblenden zu verhindern

            // Sichtbarkeitsfaktor berechnen (0.0 = nah, 1.0 = sehr weit)
            let viewFactor = (dist - FADE_START) / (FADE_END - FADE_START);
            viewFactor = Math.max(0, Math.min(1, viewFactor));

            // 1. Ferner Stern (Distant Sun Sprite)
            if (this.distantSunSprite) {
                // Erscheint allmählich bei zunehmender Entfernung
                this.distantSunSprite.material.opacity = viewFactor;
                this.distantSunSprite.visible = viewFactor > 0.01;
            }

            // 2. Planeten und Umlaufbahnen (verblassen allmählich)
            const planetOpacity = 1.0 - viewFactor;
            const isVisible = planetOpacity > 0.01;

            // Ausblenden auf Planeten anwenden (sicher ohne Physik zu brechen)
            this.planets.forEach(p => {
                // Alle visuellen Elemente des Planeten ausblenden
                if (p.mesh) {
                    // Materialopazität für weicheren Übergang aktualisieren
                    // KORREKTUR: Transparenz nur aktivieren wenn tatsächlich ausgeblendet wird (viewFactor > 0)
                    // Andernfalls deckend lassen um Z-Sorting-Probleme zu vermeiden
                    const isFading = viewFactor > 0.01 && viewFactor < 0.99;
                    const opacity = 1.0 - viewFactor;

                    p.mesh.visible = opacity > 0.01;

                    if (p.mesh.visible && p.mesh.material) {
                        const materials = Array.isArray(p.mesh.material) ? p.mesh.material : [p.mesh.material];
                        materials.forEach(mat => {
                            if ('opacity' in mat) {
                                // Wenn Ausblenden aktiv, Transparenz aktivieren und Opazität setzen
                                if (isFading) {
                                    mat.transparent = true;
                                    mat.opacity = opacity;
                                } else if (viewFactor <= 0.01) {
                                    // Voll sichtbar - deckend erzwingen
                                    mat.transparent = false;
                                    mat.opacity = 1.0;
                                } else {
                                    // Voll unsichtbar (durch mesh.visible = false behandelt, aber zur Sicherheit)
                                    mat.opacity = 0.0;
                                }
                            }
                        });
                    }
                }

                // WICHTIGE KORREKTUR: tiltGroup (Eltern) NICHT ausblenden, da sie Monde enthält!
                // Monde sind Kinder der tiltGroup. Wenn tiltGroup ausgeblendet wird, verschwinden Monde unabhängig vom Shader.
                if (p.tiltGroup) p.tiltGroup.visible = true;

                // Stattdessen nach spezifischen Kindern suchen die wir ausblenden wollen (wie Glow)
                if (p.glowMesh) {
                    p.glowMesh.visible = isVisible;
                    if (p.glowMesh.material && typeof p.glowMesh.material === 'object') {
                        const materials = Array.isArray(p.glowMesh.material) ? p.glowMesh.material : [p.glowMesh.material];
                        materials.forEach(mat => {
                            if (mat.transparent !== undefined) {
                                // Glow-Materialien sollten transparent bleiben (additive Mischung)
                                // Opazität nur basierend auf Sichtbarkeit anpassen
                                mat.transparent = true;  // Transparenz für additive Mischung beibehalten
                                mat.opacity = isVisible ? mat.userData?.originalOpacity || 0.3 : 0.0;
                            }
                        });
                    }
                }

                // Oder andere planetenspezifische Kinder in tiltGroup, die KEINE Monde sind
                // Nimmt an, dass Monde die einzigen anderen Dinge dort sind, oder wir sie sichtbar haben wollen.

                // Orbitlinien nur ausblenden wenn sie laut Benutzereinstellung UND Distanz sichtbar sein sollen
                if (p.orbitLine) {
                    p.orbitLine.visible = isVisible && (this.orbitsVisible !== false);
                    // Weichen Opazitätsübergang auf Orbitlinien anwenden
                    if (p.orbitLine.material) {
                        p.orbitLine.material.opacity = (isVisible && this.orbitsVisible !== false) ? 0.3 : 0.0;
                        p.orbitLine.material.transparent = true;
                    }
                }

                if (p.label) p.label.visible = isVisible && (dist < 20000 || p.key === 'jupiter' || p.key === 'saturn');
            });

            // Ausblenden auf Asteroidengürtel anwenden mit verbesserter Darstellung
            if (this.asteroidMesh) {
                this.asteroidMesh.visible = isVisible;
                // Weichen Übergang auf Asteroidengürtel anwenden
                if (this.asteroidMesh.material) {
                    const materials = Array.isArray(this.asteroidMesh.material) ? this.asteroidMesh.material : [this.asteroidMesh.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? 0.7 : 0.0;
                        }
                    });
                }
            }

            if (this.asteroidMesh2) {
                this.asteroidMesh2.visible = isVisible;
                if (this.asteroidMesh2.material) {
                    const materials = Array.isArray(this.asteroidMesh2.material) ? this.asteroidMesh2.material : [this.asteroidMesh2.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? 0.7 : 0.0;
                        }
                    });
                }
            }

            if (this.kuiperMesh) {
                this.kuiperMesh.visible = isVisible;
                if (this.kuiperMesh.material) {
                    const materials = Array.isArray(this.kuiperMesh.material) ? this.kuiperMesh.material : [this.kuiperMesh.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? 0.7 : 0.0;
                        }
                    });
                }
            }

            if (this.kuiperMesh2) {
                this.kuiperMesh2.visible = isVisible;
                if (this.kuiperMesh2.material) {
                    const materials = Array.isArray(this.kuiperMesh2.material) ? this.kuiperMesh2.material : [this.kuiperMesh2.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? 0.7 : 0.0;
                        }
                    });
                }
            }

            // Sonnenelemente beim Herauszoomen mit weichen Übergängen ausblenden
            if (this.sunMesh) {
                this.sunMesh.visible = isVisible;
                if (this.sunMesh.material) {
                    const materials = Array.isArray(this.sunMesh.material) ? this.sunMesh.material : [this.sunMesh.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? 1.0 : 0.0;
                        }
                    });
                }
            }
            if (this.sunCoronaMesh) {
                this.sunCoronaMesh.visible = isVisible;
                if (this.sunCoronaMesh.material) {
                    const materials = Array.isArray(this.sunCoronaMesh.material) ? this.sunCoronaMesh.material : [this.sunCoronaMesh.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? mat.userData?.originalOpacity || 0.5 : 0.0;
                        }
                    });
                }
            }
            if (this.sunGlowMesh) {
                this.sunGlowMesh.visible = isVisible;
                if (this.sunGlowMesh.material) {
                    const materials = Array.isArray(this.sunGlowMesh.material) ? this.sunGlowMesh.material : [this.sunGlowMesh.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? mat.userData?.originalOpacity || 0.15 : 0.0;
                        }
                    });
                }
            }
            if (this.sunLight) this.sunLight.visible = isVisible;

            // Halleyschen Kometen unabhängig von Distanz zeigen für bessere Sichtbarkeit
            if (this.halleyComet && this.halleyComet.mesh) {
                // Distanz von Kamera zu Komet für präzisere Sichtbarkeit berechnen
                if (camera) {
                    const cometDistance = this.halleyComet.mesh.position.distanceTo(camera.position);
                    // Komet sichtbar machen wenn er nah genug an der Kamera ist (innerhalb 5000 AU)
                    const isCometVisible = cometDistance < 5000 || isVisible;

                    this.halleyComet.mesh.visible = isCometVisible;

                    // Weichen Opazitätsübergang auf Kometenmesh anwenden
                    if (this.halleyComet.mesh.material) {
                        const materials = Array.isArray(this.halleyComet.mesh.material) ? this.halleyComet.mesh.material : [this.halleyComet.mesh.material];
                        materials.forEach(mat => {
                            if (mat.transparent !== undefined) {
                                mat.transparent = true;
                                const opacity = 1.0; // SICHTBAR ERZWINGEN [DEBUG]
                                mat.opacity = opacity;
                            }
                        });
                    }
                } else {
                    this.halleyComet.mesh.visible = isVisible;
                    if (this.halleyComet.mesh.material) {
                        const materials = Array.isArray(this.halleyComet.mesh.material) ? this.halleyComet.mesh.material : [this.halleyComet.mesh.material];
                        materials.forEach(mat => {
                            if (mat.transparent !== undefined) {
                                mat.transparent = true;
                                mat.opacity = 1.0;
                            }
                        });
                    }
                }
            }

            // Einheitliches Ringsystem ausblenden
            if (this.unifiedRingSystem && this.unifiedRingSystem.mesh) {
                this.unifiedRingSystem.mesh.visible = isVisible;
                if (this.unifiedRingSystem.mesh.material) {
                    const materials = Array.isArray(this.unifiedRingSystem.mesh.material) ? this.unifiedRingSystem.mesh.material : [this.unifiedRingSystem.mesh.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? 1.0 : 0.0;
                        }
                    });
                }
            }
            if (this.unifiedRingSystem && this.unifiedRingSystem.particleSystem) {
                this.unifiedRingSystem.particleSystem.visible = isVisible && this.unifiedRingSystem.particleSystem.visible;
                if (this.unifiedRingSystem.particleSystem.material) {
                    const materials = Array.isArray(this.unifiedRingSystem.particleSystem.material) ? this.unifiedRingSystem.particleSystem.material : [this.unifiedRingSystem.particleSystem.material];
                    materials.forEach(mat => {
                        if (mat.transparent !== undefined) {
                            mat.transparent = true;
                            mat.opacity = isVisible ? 0.8 : 0.0;
                        }
                    });
                }
            }

            this.moons.forEach(m => {
                // Konfigurierte Monde sind für die Engine immer "sichtbar"; der Shader behandelt visuelle Größe/Verblassen
                if (m.mesh) {
                    m.mesh.visible = true; // Monde bleiben aktiv, Shader regelt Größe

                    // KORREKTUR: Sicherstellen dass Monde NICHT transparent sind, außer gewollt
                    // Vorheriger Code erzwang transparent: true, was Sortierprobleme verursachte
                    if (m.mesh.material) {
                        const materials = Array.isArray(m.mesh.material) ? m.mesh.material : [m.mesh.material];
                        materials.forEach(mat => {
                            if ('opacity' in mat) {
                                // Opazität für Monde erzwingen
                                mat.transparent = false;
                                mat.opacity = 1.0;
                            }
                        });
                    }
                }
                // Gruppen (mit Mesh) müssen auch sichtbar sein
                if (m.group) m.group.visible = true;

                // Sichtbarkeit der Orbitlinien verwaltet durch MoonBase.setOrbitVisible und globale Einstellung
                // Orbitsichtbarkeit basierend auf globaler Einstellung aktualisieren
                if (m.setOrbitVisible) {
                    m.setOrbitVisible(this.orbitsVisible);
                }
            });

            // Sichtbarkeit von Halleys Kometenorbit unter Berücksichtigung der Benutzereinstellung aktualisieren
            if (this.halleyComet && this.halleyComet.orbitLine) {
                // Orbitlinie sichtbar machen wenn Komet sichtbar oder nah genug an Kamera
                if (camera) {
                    const cometDistance = this.halleyComet.mesh.position.distanceTo(camera.position);
                    const shouldShowOrbit = (cometDistance < 5000 || isVisible) && (this.orbitsVisible !== false);
                    this.halleyComet.orbitLine.visible = shouldShowOrbit;

                    // Weichen Opazitätsübergang anwenden um visuelle Artefakte zu vermeiden
                    if (this.halleyComet.orbitLine.material) {
                        this.halleyComet.orbitLine.material.opacity = shouldShowOrbit ? 0.3 : 0.0;
                        this.halleyComet.orbitLine.material.transparent = true;
                    }
                } else {
                    const shouldShowOrbit = isVisible && (this.orbitsVisible !== false);
                    this.halleyComet.orbitLine.visible = shouldShowOrbit;
                    if (this.halleyComet.orbitLine.material) {
                        this.halleyComet.orbitLine.material.opacity = shouldShowOrbit ? 0.3 : 0.0;
                        this.halleyComet.orbitLine.material.transparent = true;
                    }
                }
            }

            // c) Sternfeld: Nur innerhalb des Sonnensystems sichtbar
            // Beim Herauszoomen zur Galaxie sollten Sterne NICHT sichtbar sein
            if (this.starField) {
                // Sterne verblassen beim Herauszoomen (Start bei 12000, weg bei 18000)
                const STAR_FADE_START = 12000;
                const STAR_FADE_END = 18000;

                if (dist < STAR_FADE_START) {
                    // Innerhalb Sonnensystem: volles Sternfeld
                    this.starField.visible = true;
                    this.starField.material.opacity = 1.0;
                } else if (dist > STAR_FADE_END) {
                    // Außerhalb: keine Sterne (nur Galaxie sichtbar)
                    this.starField.visible = false;
                } else {
                    // Übergang: weich ausblenden
                    this.starField.visible = true;
                    this.starField.material.opacity = 1.0 - ((dist - STAR_FADE_START) / (STAR_FADE_END - STAR_FADE_START));
                }
            }

            // Fernes Sonnen-Label aktualisieren
            if (this.distantSunLabel) {
                this.distantSunLabel.material.opacity = viewFactor;
                this.distantSunLabel.visible = viewFactor > 0.01;
            }

            // d) Dynamische Mondgrößen aktualisieren (wird jetzt in MoonBase.js behandelt)
            // this.updateVisualScales(camera);
        }
    }

    // [updateVisualScales gelöscht, damit MoonBase eigene Skalierung behandeln kann]

    setRealTime() {
        const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
        const NOW = new Date().getTime();
        this.simTime = (NOW - J2000) / 1000;
        Logger.info("SolarSystem", "Real-Time Synced. Seconds since J2000:", this.simTime);
    }

    /**
     * Pausiert bzw. setzt die Simulation fort (wird vom Pause-Button der UI aufgerufen).
     * @returns {boolean} true, wenn die Simulation jetzt pausiert ist
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    /**
     * Setzt die Zeitgeschwindigkeit in simulierten Sekunden pro Echtzeit-Sekunde
     * (wird vom Zeit-Slider und vom Echtzeit-Button der UI aufgerufen).
     * @param {number} speed
     */
    setTimeSpeed(speed) {
        this.timeSpeed = speed;
    }

    getSimulationTime() {
        const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
        return J2000 + (this.simTime * 1000);
    }

    /**
     * Lädt kritische Assets vorab und meldet den Fortschritt.
     * @param {Function} onProgress Callback mit (loaded, total)
     * @returns {Promise}
     */
    preloadCriticalAssets(onProgress) {
        if (!this._criticalPromises || this._criticalPromises.length === 0) {
            if (onProgress) onProgress(1, 1);
            return Promise.resolve();
        }
        
        let loaded = 0;
        const total = this._criticalPromises.length;
        
        const wrapPromise = (p) => {
            return Promise.resolve(p).then(res => {
                loaded++;
                if (onProgress) onProgress(loaded, total);
                return res;
            }).catch(err => {
                loaded++;
                if (onProgress) onProgress(loaded, total);
                Logger.error("SolarSystem", "Fehler beim Vorladen von Assets", err);
            });
        };
        
        return Promise.all(this._criticalPromises.map(wrapPromise));
    }

    waitForCriticalAssets() {
        return Promise.all(this._criticalPromises || []);
    }

    /**
     * Sucht einen Himmelskörper anhand seines Schlüssels/Namens.
     * @param {string} name - Der Schlüssel (z.B. 'earth', 'moon')
     * @returns {Object|null}
     */
    getBodyByName(name) {
        return this.bodies.get(name) || null;
    }

    /**
     * Gibt die Weltposition eines Himmelskörpers zurück.
     * @param {string} name - Der Schlüssel
     * @returns {THREE.Vector3|null}
     */
    getBodyPosition(name) {
        const body = this.getBodyByName(name);
        if (body && body.mesh) {
            const pos = new THREE.Vector3();
            body.mesh.getWorldPosition(pos);
            return pos;
        } else if (body && body.getPosition) {
            return body.getPosition();
        }
        return null;
    }

    /**
     * Aktiviert/Deaktiviert den Kinomodus, in dem sich jeder Planet mit eigener Orbitalgeschwindigkeit bewegt
     * Merkur-Orbit ~10s, Erde ~60s, Neptun ~100s (visuell skaliert)
     */
    setCinematicMode(enabled) {
        this.cinematicMode = enabled;
        if (enabled) {
            // Im Kinomodus eine Basisgeschwindigkeit verwenden, die innere Planetenorbits sichtbar macht
            // Merkur-Orbitalperiode = 88 Tage, wir wollen ~88 echte Sekunden pro Orbit (majestätisch/langsam)
            // timeSpeed = 86400 (1 Tag pro Sekunde) ist eine gute professionelle Basis
            this.timeSpeed = 86400;
        }
    }


    /**
     * Setzt die Sichtbarkeit der Orbitlinien für alle Körper
     * @param {boolean} visible 
     */
    setOrbitsVisible(visible) {
        this.orbitsVisible = visible;
        this.bodies.forEach(b => {
            if (b.setOrbitVisible) b.setOrbitVisible(visible);
        });

        // KORREKTUR: Auch Monde umschalten!
        if (this.moons) {
            this.moons.forEach(m => {
                if (m.setOrbitVisible) m.setOrbitVisible(visible);
            });
        }
    }

    /**
     * Setzt den kinematischen Fokus auf einen Himmelskörper und passt Zeitgeschwindigkeit für beste Ästhetik an.
     * @param {string} key - Schlüssel des Himmelskörpers
     */
    setCinematicFocus(key) {
        if (!this.cinematicMode) return;

        // Angepasste Geschwindigkeiten für sichtbare Rotation (~0.5 - 2 Rotationen pro Sekunde)
        // und angemessene orbitale Drift.
        const CINEMATIC_SPEEDS = {
            sun: 250000,     // Langsame Rotation
            mercury: 150000, // Sehr langsame Rotation, schneller Orbit
            venus: 200000,   // Extrem langsame retrograde Rotation, schneller Orbit
            earth: 86400,    // 1 Rot/Sek
            mars: 88000,     // ~1 Rot/Sek
            jupiter: 30000,  // Schneller Dreher (10h) -> Braucht langsamere Zeit zur Würdigung
            saturn: 30000,   // Schneller Dreher
            uranus: 50000,   // Rollen
            neptune: 50000,  // ~16h
            pluto: 10000,    // Langsam
            // Kometen
            halley: 250000,
            // Monde
            moon: 86400,
            default: 86400
        };

        const targetSpeed = CINEMATIC_SPEEDS[key] || CINEMATIC_SPEEDS.default;

        // Weicher Übergang (Lerp) könnte hier hinzugefügt werden, aber direktes Setzen ist vorerst okay
        this.timeSpeed = targetSpeed;
        Logger.info('SolarSystem', `Cinematic focus set to ${key} (Speed: ${this.timeSpeed}x)`);
    }

    dispose() {
        this.bodies.forEach(b => { if (b.dispose) b.dispose(); });
        if (this.unifiedRingSystem) this.unifiedRingSystem.dispose();
        disposeThreeObject(this.sunGroup);
        disposeThreeObject(this.asteroidMesh);
        disposeThreeObject(this.asteroidMesh2);
        disposeThreeObject(this.kuiperMesh);
        disposeThreeObject(this.kuiperMesh2);
        if (this.halleyComet && this.halleyComet.dispose) this.halleyComet.dispose();
        if (this.backgroundSphere) disposeThreeObject(this.backgroundSphere);
        if (this.milkyWay) this.milkyWay.dispose();
        if (this.eclipseSystem) this.eclipseSystem.dispose();
        if (this.lagrangeVisualizer) this.lagrangeVisualizer.dispose();
        if (this._dummyObject) this._dummyObject = null;
    }

    /**
     * Lagrange-Punkt-Visualisierung umschalten
     * @returns {boolean} Neue Sichtbarkeit
     */
    toggleLagrangePoints() {
        if (this.lagrangeVisualizer) {
            return this.lagrangeVisualizer.toggle();
        }
        return false;
    }

    /**
     * Setzt die Sichtbarkeit der Lagrange-Punkte
     * @param {boolean} visible - Ob Lagrange-Punkte angezeigt werden sollen
     */
    setLagrangePointsVisible(visible) {
        if (this.lagrangeVisualizer) {
            this.lagrangeVisualizer.setVisible(visible);
        }
    }
}
