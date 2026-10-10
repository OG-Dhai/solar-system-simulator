/**
 * @fileoverview Finsternissystem für Sonnen- und Mondfinsternisse
 * 
 * Berechnet und visualisiert Schattenwürfe zwischen Himmelskörpern.
 * Unterstützt Sonnenfinsternisse (Mond verdeckt Sonne) und
 * Mondfinsternisse (Mond im Schatten des Planeten).
 * 
 * @module EclipseSystem
 */

import * as THREE from 'three';

export class EclipseSystem {
    constructor(scene, sunMesh) {
        this.scene = scene;
        this.sunMesh = sunMesh;
        this.shadowMeshes = new Map(); // Map<Planetenname, Schatten-Mesh>
        this.eclipseShadows = new Map(); // Map<Planetenname, [mond1, mond2, ...]> für Planet-Mond-Finsternisse
    }

    /**
     * Registriert ein Planet-Mond-Paar für Finsternisschatten-Berechnungen
     * @param {Object} planet - Das Planetenobjekt (Erde, etc.)
     * @param {Object} moon - Das Mondobjekt
     */
    addEclipseShadow(planet, moon) {
        if (!planet || !moon) return;

        // Schattenkreis erstellen (unscharfe schwarze Scheibe)
        // Prozedurale Textur für weiche Kanten verwenden
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.9)'); // Dunkler Kern
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)'); // Weiche Kante
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Transparent
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false, // Keine Tiefe schreiben um Verdeckungsprobleme mit Atmosphäre zu vermeiden
            polygonOffset: true,
            polygonOffsetFactor: -4 // Sicherstellen dass es über dem Planeten gezeichnet wird
        });

        const geometry = new THREE.PlaneGeometry(1, 1);
        const shadowMesh = new THREE.Mesh(geometry, material);
        shadowMesh.visible = false;

        this.scene.add(shadowMesh);

        // Daten für Updates speichern
        const key = `${planet.key}_${moon.key}`;
        this.shadowMeshes.set(key, {
            mesh: shadowMesh,
            planet: planet,
            moon: moon
        });
    }

    /**
     * Registriert einen Planeten und seine Monde für Finsternisberechnungen
     * @param {Object} planet - Das Planetenobjekt
     * @param {Array} moons - Array von Mondobjekten die den Planeten umkreisen
     */
    registerPlanetEclipses(planet, moons) {
        if (!planet || !moons || !Array.isArray(moons)) return;

        const planetKey = planet.key;
        this.eclipseShadows.set(planetKey, moons);

        // Jeden Mond auch einzeln für das bestehende Finsternissystem registrieren
        moons.forEach(moon => {
            this.addEclipseShadow(planet, moon);
        });
    }

    update() {
        // Einzelne Planet-Mond-Finsternis-Paare verarbeiten
        this.shadowMeshes.forEach((data) => {
            const { mesh, planet, moon } = data;

            // 1. Himmelskörper-Positionen (Weltkoordinaten)
            const sunPos = new THREE.Vector3(0, 0, 0); // Annahme: Sonne ist am Ursprung

            // Genaue Weltpositionen ermitteln
            const moonWorld = new THREE.Vector3();
            if (moon.mesh) moon.mesh.getWorldPosition(moonWorld);
            else return;

            const planetWorld = new THREE.Vector3();
            if (planet.mesh) planet.mesh.getWorldPosition(planetWorld);
            else return;

            // 2. Strahlrichtung von Sonne zu Mond
            const rayDir = moonWorld.clone().sub(sunPos).normalize();

            // 3. Schnittpunkt mit Planetenkugel berechnen
            // Parametrische Linie: P = Sonne + t * Richtung
            // Kugel: |P - Planetenzentrum|^2 = R^2

            // Vektor L von Strahlursprung (Sonne) zu Kugelzentrum (Planet)
            const L = planetWorld.clone().sub(sunPos);
            // tca = Projektion von L auf Strahlrichtung
            const tca = L.dot(rayDir);

            // d2 = Quadratische Distanz vom Kugelzentrum zum Strahl
            const d2 = L.dot(L) - tca * tca;
            const radius2 = planet.radius * planet.radius;

            // Wenn d2 > radius2, verfehlt der Strahl die Kugel (Keine Sonnenfinsternis)
            if (d2 > radius2) {
                // Auf Mondfinsternis (Blutmond) prüfen
                // Dies passiert wenn der Mond in den Schatten der Erde eintritt
                this.checkLunarEclipse(planet, moon, sunPos, moonWorld, planetWorld);

                mesh.visible = false;
                return;
            }

            // --- Sonnenfinsternis-Logik ---

            // Mondfarbe zurücksetzen falls rot von Mondfinsternis
            if (moon.mesh && moon.mesh.material) {
                if (moon.mesh.material.uniforms && moon.mesh.material.uniforms.emissive) {
                    moon.mesh.material.uniforms.emissive.value.setHex(0x000000);
                } else if (moon.mesh.material.emissive && moon.mesh.material.emissive.setHex) {
                    moon.mesh.material.emissive.setHex(0x000000);
                }
            }

            // Wenn wir hier sind, trifft der Schattenstrahl den Planeten-'Zylinder'.
            // Wir müssen prüfen ob der Mond tatsächlich *zwischen* Sonne und Planet ist.
            const distSunMoon = sunPos.distanceTo(moonWorld);
            const distSunPlanet = sunPos.distanceTo(planetWorld);

            if (distSunMoon > distSunPlanet) {
                // Mond ist hinter dem Planeten (Potentiell Mondfinsternis, oben/nächster Frame behandelt)
                mesh.visible = false;
                return;
            }

            // Auftreffpunkt auf der Planetenoberfläche berechnen
            // Wir wollen dass der Schatten "auf" dem Planeten erscheint.
            // Einfache Näherung: Der Punkt auf der Planetenoberfläche am nächsten zur Strahlquelle (Sonne/Mond)
            // vektorVomZentrum = (Planetenzentrum - Strahlschnittpunkt).normalize() -> Nein.

            // Besser: Schatten auf die Ebene senkrecht zum Licht am Planetenzentrum projizieren,
            // dann auf die Kugel abbilden.

            // Einfachste effektive Methode: Schnittpunkt auf der Vorderseite lokalisieren.
            const thc = Math.sqrt(radius2 - d2);
            const t0 = tca - thc; // Distanz von Sonne zum ersten Schnittpunkt

            const intersectionPoint = sunPos.clone().add(rayDir.multiplyScalar(t0));

            // Leicht über Oberfläche verschieben um Z-Fighting zu verhindern
            const surfaceNormal = intersectionPoint.clone().sub(planetWorld).normalize();
            const finalPos = planetWorld.clone().add(surfaceNormal.multiplyScalar(planet.radius * 1.002));

            // Schatten-Mesh aktualisieren
            mesh.visible = true;
            mesh.position.copy(finalPos);
            mesh.lookAt(planetWorld); // Zum Planeten ausrichten

            // Schatten basierend auf Geometrie skalieren (Strahlensatz)
            // Schattengröße ~= Mondgröße * (DistanzPlanetSonne / DistanzMondSonne-ungefähr)
            // Abstimmungsfaktor 1.5 für Halbschatten-Effekt
            const shadowSize = moon.radius * 3.5;
            mesh.scale.set(shadowSize, shadowSize, 1);
        });

        // Planet-Mond-Finsternisse für alle registrierten Planeten verarbeiten
        this.eclipseShadows.forEach((moons, planetKey) => {
            const planet = this.shadowMeshes.get(`${planetKey}_${moons[0]?.key}`)?.planet;
            if (!planet) return;

            // Planetenposition ermitteln
            const planetWorld = new THREE.Vector3();
            if (planet.mesh) planet.mesh.getWorldPosition(planetWorld);
            else return;

            // Sonnenposition
            const sunPos = new THREE.Vector3(0, 0, 0);

            // Jeden Mond dieses Planeten verarbeiten
            moons.forEach(moon => {
                if (!moon || !moon.mesh) return;

                // Mondposition ermitteln
                const moonWorld = new THREE.Vector3();
                moon.mesh.getWorldPosition(moonWorld);

                // Prüfen ob Mond im Schatten des Planeten ist (Mondfinsternis-Äquivalent)
                this.checkLunarEclipse(planet, moon, sunPos, moonWorld, planetWorld);
            });
        });
    }

    checkLunarEclipse(planet, moon, sunPos, moonWorld, planetWorld) {
        // FIX: Finsternisberechnungen für entfernte Monde überspringen (Uranus, Neptun, Pluto)
        // Sie verlassen sich auf hohe emissive-Werte für Sichtbarkeit und sollten nicht von diesem System verdunkelt werden
        // Erst dynamischen Parent-Key prüfen, dann Fallback auf bekannte Planetennamen
        const distantParents = ['uranus', 'neptune', 'pluto'];
        let parentKey = '';
        if (moon.parentKey) parentKey = moon.parentKey.toLowerCase();
        else if (moon.parent && moon.parent.key) parentKey = moon.parent.key.toLowerCase();

        if (distantParents.includes(parentKey)) {
            return;
        }

        // Hardcodierter Fallback falls Parent-Info fehlt
        const distantMoons = ['miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'proteus', 'nereid', 'larissa', 'charon'];
        if (moon.key && distantMoons.includes(moon.key.toLowerCase())) {
            return;
        }

        // Einfaches Zylinder-Schattenmodell für Mondfinsternis
        // Vektor von Sonne zu Planet
        const sunToPlanet = planetWorld.clone().sub(sunPos).normalize();
        // Vektor von Planet zu Mond
        const planetToMoon = moonWorld.clone().sub(planetWorld);

        // Mondposition auf die Sonne-Planet-Achse projizieren
        const projection = planetToMoon.dot(sunToPlanet);

        // Wenn Projektion > 0, ist Mond "hinter" der Erde relativ zur Sonne
        if (projection > 0) {
            // Distanz vom Mond zur Achse
            // rej = planetZuMond - projektion * sonnZuPlanet
            const rejection = planetToMoon.clone().sub(sunToPlanet.clone().multiplyScalar(projection));
            const distToAxis = rejection.length();

            // Erdschattenradius bei dieser Distanz (ungefähr Erdradius, Konvergenz erstmal ignorieren)
            // Kernschattenradius schrumpft normalerweise, Halbschatten wächst.
            // Vereinfacht: Wenn innerhalb Erdradius * 1.2
            if (distToAxis < planet.radius * 1.0) {
                // IM SCHATTEN - BLUTMOND
                if (moon.mesh && moon.mesh.material) {
                    const factor = 1.0 - (distToAxis / (planet.radius * 1.0));
                    // Sanfter Übergang zu Rot
                    const redHex = 0x550000;

                    if (moon.mesh.material.uniforms) {
                        if (moon.mesh.material.uniforms.emissive) moon.mesh.material.uniforms.emissive.value.setHex(redHex);
                        if (moon.mesh.material.uniforms.emissiveIntensity) moon.mesh.material.uniforms.emissiveIntensity.value = factor * 0.8;
                    } else if (moon.mesh.material.emissive && moon.mesh.material.emissive.setHex) {
                        moon.mesh.material.emissive.setHex(redHex); // Dunkelrot
                        moon.mesh.material.emissiveIntensity = factor * 0.8;
                    }
                }
            } else {
                // Schatten verlassen
                if (moon.mesh && moon.mesh.material) {
                    if (moon.mesh.material.uniforms && moon.mesh.material.uniforms.emissive) {
                        moon.mesh.material.uniforms.emissive.value.setHex(0x000000);
                    } else if (moon.mesh.material.emissive && moon.mesh.material.emissive.setHex) {
                        moon.mesh.material.emissive.setHex(0x000000);
                    }
                }
            }
        } else {
            if (moon.mesh && moon.mesh.material) {
                if (moon.mesh.material.uniforms && moon.mesh.material.uniforms.emissive) {
                    moon.mesh.material.uniforms.emissive.value.setHex(0x000000);
                } else if (moon.mesh.material.emissive && moon.mesh.material.emissive.setHex) {
                    moon.mesh.material.emissive.setHex(0x000000);
                }
            }
        }
    }

    /**
     * Gibt alle Ressourcen frei
     */
    dispose() {
        this.shadowMeshes.forEach(data => {
            this.scene.remove(data.mesh);
            data.mesh.geometry.dispose();
            data.mesh.material.dispose();
        });
        this.shadowMeshes.clear();
    }
}
