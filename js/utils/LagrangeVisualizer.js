/**
 * @fileoverview Lagrange-Punkt-Visualisierungssystem
 *
 * Rendert die 5 Lagrange-Punkte (L1-L5) für Planeten im Sonnensystem.
 * Verwendet instanziertes Rendering für Leistung.
 *
 * Lagrange-Punkte:
 * - L1: Zwischen Sonne und Planet (instabil)
 * - L2: Jenseits des Planeten von der Sonne (instabil)
 * - L3: Gegenüberliegende Seite der Sonne vom Planeten (instabil)
 * - L4: 60° vor dem Planeten im Orbit (stabil - Trojaner-Asteroiden)
 * - L5: 60° hinter dem Planeten im Orbit (stabil - Trojaner-Asteroiden)
 *
 * @module LagrangeVisualizer
 */

import * as THREE from 'three';

export class LagrangeVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this.markers = new Map(); // planetKey -> { l1, l2, l3, l4, l5 Meshes }
        this.labels = new Map(); // planetKey -> { l1, l2, l3, l4, l5 Sprites }

        // Gemeinsame Geometrien und Materialien für Leistung
        this.markerGeometry = null;
        this.labelMaterials = {};

        this.initSharedAssets();
    }

    /**
     * Initialisiert gemeinsame Geometrien und Materialien
     */
    initSharedAssets() {
        // Kleiner Oktaeder für L1, L2, L3 (instabile Punkte)
        this.unstableGeometry = new THREE.OctahedronGeometry(0.3, 0);

        // Größerer Diamant für L4, L5 (stabile Punkte - Trojaner-Positionen)
        this.stableGeometry = new THREE.OctahedronGeometry(0.5, 0);

        // Materialien mit verschiedenen Farben pro Punkttyp
        this.materials = {
            l1: new THREE.MeshBasicMaterial({
                color: 0xff6666, // Rot - instabil
                transparent: true,
                opacity: 0.8
            }),
            l2: new THREE.MeshBasicMaterial({
                color: 0xff9966, // Orange - instabil
                transparent: true,
                opacity: 0.8
            }),
            l3: new THREE.MeshBasicMaterial({
                color: 0xffcc66, // Gelb - instabil
                transparent: true,
                opacity: 0.8
            }),
            l4: new THREE.MeshBasicMaterial({
                color: 0x66ff66, // Grün - stabil (führende Trojaner)
                transparent: true,
                opacity: 0.9
            }),
            l5: new THREE.MeshBasicMaterial({
                color: 0x6666ff, // Blau - stabil (nachfolgende Trojaner)
                transparent: true,
                opacity: 0.9
            })
        };

        // Label-Texturen erstellen
        this.createLabelTextures();
    }

    /**
     * Erstellt Text-Label-Texturen für jeden Lagrange-Punkt
     */
    createLabelTextures() {
        const labels = ['L1', 'L2', 'L3', 'L4', 'L5'];

        labels.forEach(label => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');

            // Hintergrund
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, 64, 32);

            // Rahmen
            ctx.strokeStyle = this.getLabelColor(label);
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, 62, 30);

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 32, 16);

            const texture = new THREE.CanvasTexture(canvas);
            this.labelMaterials[label.toLowerCase()] = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false
            });
        });
    }

    /**
     * Gibt Label-Rahmenfarbe basierend auf Stabilität zurück
     */
    getLabelColor(label) {
        const colors = {
            'L1': '#ff6666',
            'L2': '#ff9966',
            'L3': '#ffcc66',
            'L4': '#66ff66',
            'L5': '#6666ff'
        };
        return colors[label] || '#ffffff';
    }

    /**
     * Erstellt oder aktualisiert Lagrange-Punkt-Marker für einen Planeten
     * @param {string} planetKey - Planeten-Identifier
     * @param {Object} lagrangePoints - Objekt mit l1-l5 Vector3-Positionen
     * @param {number} scale - Skalierungsfaktor basierend auf Orbit-Größe des Planeten
     */
    updatePlanetLagrangePoints(planetKey, lagrangePoints, scale = 1) {
        if (!lagrangePoints) return;

        // Marker erstellen falls sie nicht existieren
        if (!this.markers.has(planetKey)) {
            this.createMarkersForPlanet(planetKey, scale);
        }

        const markers = this.markers.get(planetKey);
        const labels = this.labels.get(planetKey);

        // Positionen aktualisieren
        const points = ['l1', 'l2', 'l3', 'l4', 'l5'];
        points.forEach(point => {
            if (lagrangePoints[point] && markers[point]) {
                markers[point].position.copy(lagrangePoints[point]);
                markers[point].visible = this.visible;

                // Label-Position aktualisieren (leicht über Marker versetzt)
                if (labels && labels[point]) {
                    labels[point].position.copy(lagrangePoints[point]);
                    labels[point].position.y += scale * 0.8;
                    labels[point].visible = this.visible;
                }
            }
        });
    }

    /**
     * Erstellt Marker-Meshes für einen bestimmten Planeten
     */
    createMarkersForPlanet(planetKey, scale) {
        const markers = {};
        const labels = {};

        const points = ['l1', 'l2', 'l3', 'l4', 'l5'];

        points.forEach(point => {
            // Geometrie basierend auf Stabilität wählen
            const isStable = point === 'l4' || point === 'l5';
            const geometry = isStable ? this.stableGeometry : this.unstableGeometry;

            // Marker-Mesh erstellen
            const mesh = new THREE.Mesh(geometry, this.materials[point]);
            mesh.scale.setScalar(scale * 0.5);
            mesh.visible = false;
            mesh.name = `${planetKey}_${point}`;
            this.scene.add(mesh);
            markers[point] = mesh;

            // Label-Sprite erstellen
            const sprite = new THREE.Sprite(this.labelMaterials[point]);
            sprite.scale.set(scale * 1.5, scale * 0.75, 1);
            sprite.visible = false;
            sprite.name = `${planetKey}_${point}_label`;
            this.scene.add(sprite);
            labels[point] = sprite;
        });

        this.markers.set(planetKey, markers);
        this.labels.set(planetKey, labels);
    }

    /**
     * Setzt Sichtbarkeit aller Lagrange-Punkt-Marker
     * @param {boolean} visible - Ob Marker angezeigt werden sollen
     */
    setVisible(visible) {
        this.visible = visible;

        this.markers.forEach((markers) => {
            Object.values(markers).forEach(mesh => {
                mesh.visible = visible;
            });
        });

        this.labels.forEach((labels) => {
            Object.values(labels).forEach(sprite => {
                sprite.visible = visible;
            });
        });
    }

    /**
     * Sichtbarkeit umschalten
     * @returns {boolean} Neuer Sichtbarkeitszustand
     */
    toggle() {
        this.setVisible(!this.visible);
        return this.visible;
    }

    /**
     * Marker-Skalierung basierend auf Kameradistanz aktualisieren (LOD)
     * @param {THREE.Camera} camera - Aktive Kamera
     */
    updateLOD(camera) {
        if (!this.visible || !camera) return;

        this.markers.forEach((markers, planetKey) => {
            Object.entries(markers).forEach(([point, mesh]) => {
                const distance = camera.position.distanceTo(mesh.position);

                // Marker basierend auf Distanz für konsistente Bildschirmgröße skalieren
                const baseScale = distance * 0.01;
                const minScale = 0.1;
                const maxScale = 5.0;
                const scale = Math.max(minScale, Math.min(maxScale, baseScale));

                mesh.scale.setScalar(scale);

                // Entsprechende Label-Skalierung aktualisieren
                const labels = this.labels.get(planetKey);
                if (labels && labels[point]) {
                    labels[point].scale.set(scale * 3, scale * 1.5, 1);
                }

                // Ausblenden wenn sehr weit oder sehr nah
                const normalizedDist = distance / 100;
                let opacity = 1.0;
                if (normalizedDist > 50) {
                    opacity = Math.max(0, 1 - (normalizedDist - 50) / 50);
                } else if (normalizedDist < 1) {
                    opacity = normalizedDist;
                }

                mesh.material.opacity = opacity * 0.8;
            });
        });
    }

    /**
     * Gibt alle Ressourcen frei
     */
    dispose() {
        this.markers.forEach((markers) => {
            Object.values(markers).forEach(mesh => {
                this.scene.remove(mesh);
            });
        });

        this.labels.forEach((labels) => {
            Object.values(labels).forEach(sprite => {
                this.scene.remove(sprite);
                sprite.material.map?.dispose();
                sprite.material.dispose();
            });
        });

        this.unstableGeometry.dispose();
        this.stableGeometry.dispose();

        Object.values(this.materials).forEach(mat => mat.dispose());
        Object.values(this.labelMaterials).forEach(mat => {
            mat.map?.dispose();
            mat.dispose();
        });

        this.markers.clear();
        this.labels.clear();
    }
}
