import * as THREE from 'three';

export class EclipseSystem {
    constructor(scene, sunMesh) {
        this.scene = scene;
        this.sunMesh = sunMesh;
        this.shadowMeshes = new Map(); // Map<PlanetName, ShadowMesh>
        this.eclipseShadows = new Map(); // Map<PlanetName, [moon1, moon2, ...]> for planet-moon eclipses
    }

    /**
     * Register a planet-moon pair for eclipse shadow calculations
     * @param {Object} planet - The planet object (Earth, etc.)
     * @param {Object} moon - The moon object
     */
    addEclipseShadow(planet, moon) {
        if (!planet || !moon) return;

        // Create shadow circle (fuzzy black disc)
        // Use procedural texture for soft edges
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.9)'); // Dark core
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)'); // Soft edge
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Transparent
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false, // Don't write depth to avoid occlusion issues with atmosphere
            polygonOffset: true,
            polygonOffsetFactor: -4 // Ensure it draws on top of the planet
        });

        const geometry = new THREE.PlaneGeometry(1, 1);
        const shadowMesh = new THREE.Mesh(geometry, material);
        shadowMesh.visible = false;

        this.scene.add(shadowMesh);

        // Store data for updates
        const key = `${planet.key}_${moon.key}`;
        this.shadowMeshes.set(key, {
            mesh: shadowMesh,
            planet: planet,
            moon: moon
        });
    }

    /**
     * Register a planet and its moons for eclipse calculations
     * @param {Object} planet - The planet object
     * @param {Array} moons - Array of moon objects orbiting the planet
     */
    registerPlanetEclipses(planet, moons) {
        if (!planet || !moons || !Array.isArray(moons)) return;

        const planetKey = planet.key;
        this.eclipseShadows.set(planetKey, moons);

        // Also register each moon individually for the existing eclipse system
        moons.forEach(moon => {
            this.addEclipseShadow(planet, moon);
        });
    }

    update() {
        // Process individual planet-moon eclipse pairs
        this.shadowMeshes.forEach((data) => {
            const { mesh, planet, moon } = data;

            // 1. Celestial Positions (World Space)
            const sunPos = new THREE.Vector3(0, 0, 0); // Assuming Sun is at origin

            // Get accurate world positions
            const moonWorld = new THREE.Vector3();
            if (moon.mesh) moon.mesh.getWorldPosition(moonWorld);
            else return;

            const planetWorld = new THREE.Vector3();
            if (planet.mesh) planet.mesh.getWorldPosition(planetWorld);
            else return;

            // 2. Ray direction from Sun to Moon
            const rayDir = moonWorld.clone().sub(sunPos).normalize();

            // 3. Calculate intersection with Planet Sphere
            // Parametric line: P = Sun + t * Dir
            // Sphere: |P - PlanetCenter|^2 = R^2

            // Vector L from Ray Origin (Sun) to Sphere Center (Planet)
            const L = planetWorld.clone().sub(sunPos);
            // tca = projection of L onto ray direction
            const tca = L.dot(rayDir);

            // d2 = squared distance from sphere center to the ray
            const d2 = L.dot(L) - tca * tca;
            const radius2 = planet.radius * planet.radius;

            // If d2 > radius2, the ray misses the sphere (No Solar Eclipse)
            if (d2 > radius2) {
                // Check for Lunar Eclipse (Blood Moon)
                // This happens when Moon enters Earth's shadow
                this.checkLunarEclipse(planet, moon, sunPos, moonWorld, planetWorld);

                mesh.visible = false;
                return;
            }

            // --- Solar Eclipse Logic ---

            // Reset moon color if it was red from lunar eclipse
            if (moon.mesh && moon.mesh.material) {
                if (moon.mesh.material.uniforms && moon.mesh.material.uniforms.emissive) {
                    moon.mesh.material.uniforms.emissive.value.setHex(0x000000);
                } else if (moon.mesh.material.emissive && moon.mesh.material.emissive.setHex) {
                    moon.mesh.material.emissive.setHex(0x000000);
                }
            }

            // If we are here, the shadow ray hits the planet 'cylinder'.
            // We need to check if the moon is actually *between* Sun and Planet.
            const distSunMoon = sunPos.distanceTo(moonWorld);
            const distSunPlanet = sunPos.distanceTo(planetWorld);

            if (distSunMoon > distSunPlanet) {
                // Moon is behind the planet (Potentially Lunar Eclipse, handled above/next frame)
                mesh.visible = false;
                return;
            }

            // Calculate impact point on the planet surface
            // We want the shadow to appear "on top" of the planet.
            // Simple approximation: The point on the planet surface closest to the ray source (Sun/Moon)
            // vectorFromCenter = (PlanetCenter - RayIntersection).normalize() -> No.

            // Better: Project the shadow onto the plane perpendicular to the light at the planet center,
            // then map that onto the sphere.

            // Simplest effective method: Locate the intersection point on the front face.
            const thc = Math.sqrt(radius2 - d2);
            const t0 = tca - thc; // Distance from Sun to first intersection point

            const intersectionPoint = sunPos.clone().add(rayDir.multiplyScalar(t0));

            // Move it slightly above surface to prevent Z-fighting
            const surfaceNormal = intersectionPoint.clone().sub(planetWorld).normalize();
            const finalPos = planetWorld.clone().add(surfaceNormal.multiplyScalar(planet.radius * 1.002));

            // Update Shadow Mesh
            mesh.visible = true;
            mesh.position.copy(finalPos);
            mesh.lookAt(planetWorld); // Face the planet

            // Scale shadow based on geometry (similar triangles)
            // ShadowSize ~= MoonSize * (DistPlanetSun / DistMoonSun-ish)
            // Tuning factor 1.5 for penumbra effect
            const shadowSize = moon.radius * 3.5;
            mesh.scale.set(shadowSize, shadowSize, 1);
        });

        // Process planet-moon eclipses for all registered planets
        this.eclipseShadows.forEach((moons, planetKey) => {
            const planet = this.shadowMeshes.get(`${planetKey}_${moons[0]?.key}`)?.planet;
            if (!planet) return;

            // Get planet position
            const planetWorld = new THREE.Vector3();
            if (planet.mesh) planet.mesh.getWorldPosition(planetWorld);
            else return;

            // Sun position
            const sunPos = new THREE.Vector3(0, 0, 0);

            // Process each moon of this planet
            moons.forEach(moon => {
                if (!moon || !moon.mesh) return;

                // Get moon position
                const moonWorld = new THREE.Vector3();
                moon.mesh.getWorldPosition(moonWorld);

                // Check if moon is in planet's shadow (lunar eclipse equivalent)
                this.checkLunarEclipse(planet, moon, sunPos, moonWorld, planetWorld);
            });
        });
    }

    checkLunarEclipse(planet, moon, sunPos, moonWorld, planetWorld) {
        // FIX: Skip eclipse calculations for distant moons (Uranus, Neptune, Pluto)
        // They rely on high emissive values for visibility and shouldn't be darkened by this system
        // Check dynamic parent key first, then fallback to known planet names
        const distantParents = ['uranus', 'neptune', 'pluto'];
        let parentKey = '';
        if (moon.parentKey) parentKey = moon.parentKey.toLowerCase();
        else if (moon.parent && moon.parent.key) parentKey = moon.parent.key.toLowerCase();

        if (distantParents.includes(parentKey)) {
            return;
        }

        // Hardcoded fallback just in case parent info is missing
        const distantMoons = ['miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'proteus', 'nereid', 'larissa', 'charon'];
        if (moon.key && distantMoons.includes(moon.key.toLowerCase())) {
            return;
        }

        // Simple cylinder shadow model for Lunar Eclipse
        // Vector from Sun to Planet
        const sunToPlanet = planetWorld.clone().sub(sunPos).normalize();
        // Vector from Planet to Moon
        const planetToMoon = moonWorld.clone().sub(planetWorld);

        // Project Moon pos onto the Sun-Planet axis
        const projection = planetToMoon.dot(sunToPlanet);

        // If projection > 0, Moon is "behind" Earth relative to Sun
        if (projection > 0) {
            // Distance from Moon to the axis
            // rej = planetToMoon - projection * sunToPlanet
            const rejection = planetToMoon.clone().sub(sunToPlanet.clone().multiplyScalar(projection));
            const distToAxis = rejection.length();

            // Earth's shadow radius at this distance (approximately Earth radius, ignoring convergence for now)
            // Umbra radius usually shrinks, Penumbra grows. 
            // Simplified: If inside Earth radius * 1.2
            if (distToAxis < planet.radius * 1.0) {
                // IN SHADOW - BLOOD MOON
                if (moon.mesh && moon.mesh.material) {
                    const factor = 1.0 - (distToAxis / (planet.radius * 1.0));
                    // Smooth transition to Red
                    const redHex = 0x550000;

                    if (moon.mesh.material.uniforms) {
                        if (moon.mesh.material.uniforms.emissive) moon.mesh.material.uniforms.emissive.value.setHex(redHex);
                        if (moon.mesh.material.uniforms.emissiveIntensity) moon.mesh.material.uniforms.emissiveIntensity.value = factor * 0.8;
                    } else if (moon.mesh.material.emissive && moon.mesh.material.emissive.setHex) {
                        moon.mesh.material.emissive.setHex(redHex); // Dark Red
                        moon.mesh.material.emissiveIntensity = factor * 0.8;
                    }
                }
            } else {
                // Exit shadow
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

    dispose() {
        this.shadowMeshes.forEach(data => {
            this.scene.remove(data.mesh);
            data.mesh.geometry.dispose();
            data.mesh.material.dispose();
        });
        this.shadowMeshes.clear();
    }
}
