/**
 * @fileoverview Milchstraßen-Galaxie-Manager
 * Handhabt den Übergang von Innenansicht (Skybox) zu Außenansicht (Spiral-Mesh).
 * @module MilkyWay
 */

import * as THREE from 'three';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { Logger } from '../utils/Logger.js';

export class MilkyWay {
    constructor(scene) {
        this.scene = scene;
        this.skyboxMesh = null;  // Innenansicht
        this.spiralMesh = null;  // Außenansicht (Spirale)

        this.init();
    }

    async init() {
        // 1. Innenansicht erstellen (Skybox)
        // Riesige Kugel für Hintergrundsterne - muss GRÖSSER sein als starField (20000-40000)
        const skyGeo = new THREE.SphereGeometry(45000, 64, 64);
        const skyMat = new THREE.MeshBasicMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            transparent: true,
            opacity: 1.0
        });
        this.skyboxMesh = new THREE.Mesh(skyGeo, skyMat);
        this.skyboxMesh.renderOrder = -1000; // Hinter allem rendern
        this.scene.add(this.skyboxMesh);

        // Skybox-Textur laden (Zuerst lokal versuchen, Fallback auf ESO-Online-Bild)
        loadTexture('stars_milky_way')
            .then(tex => {
                tex.colorSpace = THREE.SRGBColorSpace;
                this.skyboxMesh.material.map = tex;
                this.skyboxMesh.material.needsUpdate = true;
            })
            .catch(err => {
                Logger.warn("MilkyWay", "Lokale Milchstraßen-Textur fehlgeschlagen, verwende ESO-Fallback");
                const loader = new THREE.TextureLoader();
                const esoUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/60/ESO_-_Milky_Way.jpg';
                loader.load(esoUrl, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    if (this.skyboxMesh) {
                        this.skyboxMesh.material.map = tex;
                        this.skyboxMesh.material.needsUpdate = true;
                    }
                });
            });

        // 2. Außenansicht erstellen (Spiralgalaxie)
        // Flache Ebene, die die Galaxie von außen darstellt
        const spiralGeo = new THREE.PlaneGeometry(100000, 100000);
        const spiralMat = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            depthWrite: false,
            transparent: true,
            opacity: 0.0, // Anfangs verborgen
            blending: THREE.AdditiveBlending
        });
        this.spiralMesh = new THREE.Mesh(spiralGeo, spiralMat);
        this.spiralMesh.rotation.x = -Math.PI / 2; // Horizontal flach
        // Das Sonnensystem befindet sich nicht im Zentrum der Galaxie - sondern in einem äußeren Arm
        // (ca. 26.000 Lichtjahre vom Zentrum)
        // Wir positionieren das SpiralMesh so, dass das galaktische Zentrum von uns entfernt erscheint
        this.spiralMesh.position.set(25000, -500, 15000);
        this.scene.add(this.spiralMesh);

        // Spiralgalaxie-Textur laden
        // Benötigt 'galaxy_spiral'-Textur. Fallback auf prozedural falls nicht vorhanden.
        loadTexture('galaxy_spiral').then(tex => {
            tex.colorSpace = THREE.SRGBColorSpace;
            this.spiralMesh.material.map = tex;
            this.spiralMesh.material.needsUpdate = true;
        }).catch(() => {
            Logger.warn('MilkyWay', 'Spiral-Textur nicht gefunden, erstelle prozedurale Fallback.');
            this.createProceduralSpiral();
        });
    }

    createProceduralSpiral() {
        // Temporäre prozedurale Textur für die Galaxie erstellen
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 1024; // Hohe Auflösung für großes Mesh
        const ctx = canvas.getContext('2d');

        // Leuchtendes Halo/Spiral-Approximation zeichnen
        const cx = 512, cy = 512;

        // Hintergrund-Glühen
        const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 500);
        grad.addColorStop(0, 'rgba(255, 240, 220, 1)'); // Heller Kern
        grad.addColorStop(0.1, 'rgba(230, 230, 255, 0.8)'); // Bläulich-weiß
        grad.addColorStop(0.3, 'rgba(100, 120, 255, 0.4)'); // Mittlere Arme
        grad.addColorStop(0.6, 'rgba(50, 50, 100, 0.1)'); // Äußere Arme
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Ausblenden

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 1024);

        // Prozedurale Arme hinzufügen (einfache Bögen)
        ctx.strokeStyle = 'rgba(200, 210, 255, 0.3)';
        ctx.lineWidth = 40;
        ctx.filter = 'blur(20px)';

        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            for (let j = 0; j < 100; j++) {
                const angle = (j / 20) + (i * 2 * Math.PI / 3);
                const r = j * 5;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;

        if (this.spiralMesh) {
            this.spiralMesh.material.map = tex;
            this.spiralMesh.material.needsUpdate = true;
        }
    }

    update(cameraPosition) {
        if (!cameraPosition) return;
        const distance = cameraPosition.length();

        // Übergangsdistanzen (Three.js-Einheiten)
        const FADE_START = 10000;  // Beginn: Skybox ausblenden / Spirale einblenden
        const FADE_END = 50000;    // Grenze: rein externe Ansicht

        if (distance < FADE_START) {
            // Innerhalb des Sonnensystems
            if (this.skyboxMesh) this.skyboxMesh.material.opacity = 1.0;
            if (this.spiralMesh) this.spiralMesh.material.opacity = 0.0;
        } else if (distance > FADE_END) {
            // Tiefer Weltraum
            if (this.skyboxMesh) this.skyboxMesh.material.opacity = 0.0;
            if (this.spiralMesh) this.spiralMesh.material.opacity = 0.8;
        } else {
            // Übergangsphase
            const alpha = (distance - FADE_START) / (FADE_END - FADE_START);

            if (this.skyboxMesh) this.skyboxMesh.material.opacity = 1.0 - alpha;
            if (this.spiralMesh) this.spiralMesh.material.opacity = alpha * 0.8;
        }

        // NASA-Fakt: Die Milchstraße braucht ~225 Millionen Jahre für eine Rotation
        // Bei menschlichen Zeitskalen (auch mit Zeitraffer) sollte die Galaxie STATISCH erscheinen
        // Unrealistische Rotation entfernt
    }

    dispose() {
        if (this.skyboxMesh) {
            this.scene.remove(this.skyboxMesh);
            this.skyboxMesh.geometry.dispose();
            this.skyboxMesh.material.dispose();
        }
        if (this.spiralMesh) {
            this.scene.remove(this.spiralMesh);
            this.spiralMesh.geometry.dispose();
            this.spiralMesh.material.dispose();
        }
    }
}
