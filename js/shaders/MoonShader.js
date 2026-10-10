
import * as THREE from 'three';

// ============================================================================
// BASE MOON SHADER
// ============================================================================

/**
 * Creates a generic shader material for Moons
 * @param {THREE.Texture} [texture] - Optional initial texture
 * @returns {THREE.ShaderMaterial} The moon material
 */
export function createMoonMaterial(texture) {
    return new THREE.ShaderMaterial({
        uniforms: {
            map: { value: texture || null },
            hasTexture: { value: texture ? 1.0 : 0.0 }, // Flag to avoid black-hole effect
            color: { value: new THREE.Color(0xffffff) },
            sunPosition: { value: new THREE.Vector3(0, 0, 0) },
            cameraPosition: { value: new THREE.Vector3() },
            emissive: { value: new THREE.Color(0x000000) },
            emissiveIntensity: { value: 0.0 },
            viewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            minPixelSize: { value: 3.0 }, // Ensure visible at distance (3px star-like)
            radius: { value: 1.0 }
        },
        transparent: false,  // Explicitly set to false to prevent transparency
        vertexShader: `
            #include <common>

            uniform vec2 viewport;
            uniform float minPixelSize;
            uniform float radius;

            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);

                // --- DYNAMIC SCREEN-SPACE SIZING ---
                // Calculate View Position
                vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

                // Distance to camera
                float dist = length(mvPosition.xyz);

                // Projected size of radius (approximate)
                // projectionMatrix[1][1] is essentially (1.0 / tan(fov/2))
                float projectedRadius = (radius * projectionMatrix[1][1] * viewport.y) / (-mvPosition.z * 2.0);

                // Determine scale factor
                // If projected size is smaller than minPixelSize, scale up
                float currentPixelSize = max(projectedRadius * 2.0, 0.0001); // Avoid div by zero
                float targetPixelSize = max(minPixelSize, 0.0);

                float scale = 1.0;

                // Smooth transition:
                // Only scale UP if we are smaller than threshold.
                // As we get closer (currentPixelSize increases), scale drops back to 1.0 automatically.
                if (currentPixelSize < targetPixelSize) {
                    scale = targetPixelSize / currentPixelSize;
                }

                // Apply scale to vertex position
                vec3 scaledPos = position * scale;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(scaledPos, 1.0);

                // Correct depth for large scales to prevent z-fighting
                // Pushing it slightly towards camera if scaled up heavily?
                // Actually for moons, keeping them at correct depth is better for orbits.

                vec4 worldPosition = modelMatrix * vec4(scaledPos, 1.0);
                vWorldPosition = worldPosition.xyz;
            }
        `,
        fragmentShader: `
            #include <common>

            uniform sampler2D map;
            uniform float hasTexture;
            uniform vec3 color;
            uniform vec3 sunPosition;
            uniform vec3 emissive;
            uniform float emissiveIntensity;

            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {

                // Handle missing texture (avoid black moon)
                vec4 texColor = vec4(1.0);
                if (hasTexture > 0.5) {
                    texColor = texture2D(map, vUv);
                }

                // Lighting
                // --- STANDARD LAMBERTIAN SHADING (High Contrast) ---

                vec3 lightDir = normalize(sunPosition - vWorldPosition);
                float NdotL = max(dot(vNormal, lightDir), 0.0);

                float sunIntensity = 4.0; // High intensity for bright impact
                vec3 ambient = vec3(0.02); // Pitch black night (very low ambient)

                vec3 directLight = vec3(NdotL * sunIntensity);
                vec3 lighting = directLight + ambient;

                vec3 finalColor = (texColor.rgb * color) * lighting + (emissive * emissiveIntensity);

                gl_FragColor = vec4(finalColor, texColor.a);
            }
        `
    });
}

// ============================================================================
// IO VOLCANIC SHADER
// ============================================================================

export function createIoShaderMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            map: { value: null },
            hasTexture: { value: 0.0 },
            time: { value: 0 },
            sunPosition: { value: new THREE.Vector3() },
            cameraPosition: { value: new THREE.Vector3() },
            lavaColor: { value: new THREE.Color(0xffaa00) },
            emissive: { value: new THREE.Color(0x000000) },
            emissiveIntensity: { value: 1.0 },
            viewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            minPixelSize: { value: 3.0 },
            radius: { value: 1.0 }
        },
        transparent: false,  // Explicitly set to false to prevent transparency
        vertexShader: `
            #include <common>

            uniform vec2 viewport;
            uniform float minPixelSize;
            uniform float radius;

            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);

                // --- DYNAMIC SCREEN-SPACE SIZING ---
                // Calculate View Position
                vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

                // Distance to camera
                float dist = length(mvPosition.xyz);

                // Projected size of radius (approximate)
                float projectedRadius = (radius * projectionMatrix[1][1] * viewport.y) / (-mvPosition.z * 2.0);

                // Determine scale factor
                float currentPixelSize = max(projectedRadius * 2.0, 0.0001);
                float targetPixelSize = max(minPixelSize, 0.0);

                float scale = 1.0;

                if (currentPixelSize < targetPixelSize) {
                    scale = targetPixelSize / currentPixelSize;
                }

                // Apply scale
                vec3 scaledPos = position * scale;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(scaledPos, 1.0);

                vec4 worldPosition = modelMatrix * vec4(scaledPos, 1.0);
                vWorldPosition = worldPosition.xyz;
            }
        `,
        fragmentShader: `
            uniform sampler2D map;
            uniform float hasTexture;
            uniform float time;
            uniform vec3 sunPosition;
            uniform vec3 lavaColor;
            uniform vec3 emissive;
            uniform float emissiveIntensity;

            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            void main() {

                vec4 texColor = vec4(1.0, 0.9, 0.5, 1.0); // Default yellowish if no texture
                if (hasTexture > 0.5) {
                    texColor = texture2D(map, vUv);
                }

                // Directional Light
                vec3 lightDir = normalize(sunPosition - vWorldPosition);
                float diff = max(dot(vNormal, lightDir), 0.0);

                // Volcanic activity (based on dark spots in texture usually,
                // but here we simulate with noise if texture is dark)
                // Assuming Io texture has dark spots for volcanoes

                float brightness = length(texColor.rgb);
                float lavaMask = (1.0 - brightness) * step(brightness, 0.4);

                // Pulse the lava
                float pulse = 0.5 + 0.5 * sin(time * 2.0 + vUv.x * 10.0);
                vec3 emission = lavaColor * lavaMask * pulse * 0.8;

                // Shadow side should still show lava
                float sunIntensity = 5.0;
                vec3 lighting = vec3(0.05) + vec3(diff * sunIntensity);
                // Mix in Eclipse emissive effect (for shadow coloring)
                vec3 finalColor = texColor.rgb * lighting + emission + (emissive * emissiveIntensity);

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
    });
}

export function updateIoUniforms(material, time, sunPosition, camera) {
    if (material.uniforms) {
        material.uniforms.time.value = time;
        if (sunPosition) material.uniforms.sunPosition.value.copy(sunPosition);
        if (camera) material.uniforms.cameraPosition.value.copy(camera.position);
    }
}

export function setIoTexture(material, texture) {
    if (material.uniforms) {
        material.uniforms.map.value = texture;
        if (texture) material.uniforms.hasTexture.value = 1.0;
    }
}

// ============================================================================
// EUROPA ICE SHADER
// ============================================================================

export function createEuropaShaderMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            map: { value: null },
            hasTexture: { value: 0.0 },
            time: { value: 0 },
            sunPosition: { value: new THREE.Vector3() },
            cameraPosition: { value: new THREE.Vector3() },
            iceColor: { value: new THREE.Color(0xaaccff) },
            emissive: { value: new THREE.Color(0x000000) },
            emissiveIntensity: { value: 1.0 },
            viewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            minPixelSize: { value: 3.0 },
            radius: { value: 1.0 }
        },
        transparent: false,  // Explicitly set to false to prevent transparency
        vertexShader: `
            #include <common>

            uniform vec2 viewport;
            uniform float minPixelSize;
            uniform float radius;

            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);

                // --- DYNAMIC SCREEN-SPACE SIZING ---
                // Calculate View Position
                vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

                // Distance to camera
                float dist = length(mvPosition.xyz);

                // Projected size of radius (approximate)
                float projectedRadius = (radius * projectionMatrix[1][1] * viewport.y) / (-mvPosition.z * 2.0);

                // Determine scale factor
                float currentPixelSize = max(projectedRadius * 2.0, 0.0001);
                float targetPixelSize = max(minPixelSize, 0.0);

                float scale = 1.0;

                if (currentPixelSize < targetPixelSize) {
                    scale = targetPixelSize / currentPixelSize;
                }

                // Apply scale
                vec3 scaledPos = position * scale;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(scaledPos, 1.0);

                vec4 worldPosition = modelMatrix * vec4(scaledPos, 1.0);
                vWorldPosition = worldPosition.xyz;
            }
        `,
        fragmentShader: `
            uniform sampler2D map;
            uniform float hasTexture;
            uniform float time;
            uniform vec3 sunPosition;
            uniform vec3 emissive;
            uniform float emissiveIntensity;

            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {

                vec4 texColor = vec4(0.9, 0.95, 1.0, 1.0); // Default ice white if no texture
                if (hasTexture > 0.5) {
                    texColor = texture2D(map, vUv);
                }

                // Lighting
                vec3 lightDir = normalize(sunPosition - vWorldPosition);
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                vec3 halfDir = normalize(lightDir + viewDir);

                float diff = max(dot(vNormal, lightDir), 0.0);
                float spec = pow(max(dot(vNormal, halfDir), 0.0), 32.0); // Shiny ice

                // Ice shimmer effect
                float shimmer = sin(vUv.y * 50.0 + time) * 0.1;

                float sunIntensity = 5.0;
                vec3 lighting = vec3(0.1) + vec3(diff * sunIntensity); // Ambient + Diffuse
                vec3 specular = vec3(0.3) * spec;

                vec3 finalColor = texColor.rgb * lighting + specular + shimmer * diff + (emissive * emissiveIntensity);

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
    });
}

export function updateEuropaUniforms(material, time, sunPosition, camera) {
    if (material.uniforms) {
        material.uniforms.time.value = time;
        if (sunPosition) material.uniforms.sunPosition.value.copy(sunPosition);
        if (camera) material.uniforms.cameraPosition.value.copy(camera.position);
    }
}

export function setEuropaTexture(material, texture) {
    if (material.uniforms) {
        material.uniforms.map.value = texture;
        if (texture) material.uniforms.hasTexture.value = 1.0;
    }
}

// ============================================================================
// ENCELADUS PLUME SHADER
// ============================================================================

/**
 * Creates the Enceladus plume particle system
 * @param {number} radius - Radius of Enceladus
 * @returns {THREE.Points} The particle system
 */
export function createEnceladusPlumes(radius) {
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();

    // Arrays for attributes
    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount * 3); // For variation
    const sizes = new Float32Array(particleCount);

    // South pole limits (approximate for Tiger Stripes)
    // Enceladus radius is small, plumes extend significantly

    for (let i = 0; i < particleCount; i++) {
        // Initial position at South Pole 
        // Randomized slightly to simulate the 4 tiger stripes area
        // South pole is (0, -radius, 0)

        // Random angle for disk spread around pole
        const angle = Math.random() * Math.PI * 2;
        const distFromPole = Math.random() * (radius * 0.3); // Spread around pole

        const x = Math.cos(angle) * distFromPole;
        const z = Math.sin(angle) * distFromPole;
        const y = -radius + (Math.random() * radius * 0.05); // Just at/below surface

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Random values for animation
        randoms[i * 3] = Math.random();
        randoms[i * 3 + 1] = Math.random();
        randoms[i * 3 + 2] = Math.random();

        sizes[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            radius: { value: radius },
            opacity: { value: 0.6 },
            color: { value: new THREE.Color(0xddeeff) }, // Icy blue-white
            sunPosition: { value: new THREE.Vector3() }
        },
        vertexShader: `
            #include <common>

            uniform float time;
            uniform float radius;
            attribute vec3 aRandom;
            attribute float aSize;

            varying float vAlpha;

            void main() {
                // Animate particles moving away from south pole
                // We restart them based on time and random offset

                float lifeTime = 4.0 + aRandom.x * 2.0; // Life between 4-6 seconds
                float t = mod(time + aRandom.y * 10.0, lifeTime) / lifeTime;

                // Initial position (base)
                vec3 pos = position;

                // Ejection direction: primarily down (South) but fanning out
                // Normalized vector from center (which is 0,0,0) to pos
                vec3 normal = normalize(pos);

                // But we want them to shoot 'out' from the pole, which is -Y
                // Actually normal at South Pole is (0, -1, 0)

                // Movement: Linear away from surface + some spread
                float speed = radius * (1.5 + aRandom.z);
                float distance = speed * t;

                // Add some noise/spread as they go out
                vec3 spread = vec3(
                    sin(t * 10.0 + aRandom.x * 100.0) * 0.1,
                    0.0,
                    cos(t * 10.0 + aRandom.x * 100.0) * 0.1
                ) * distance * 0.2;

                vec3 newPos = pos + (normal * distance) + spread;

                // Fade out based on life
                // Fade in quickly, fade out slowly
                vAlpha = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.5, 1.0, t));

                vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
                gl_Position = projectionMatrix * mvPosition;

                // Size attenuation
                gl_PointSize = (20.0 * aSize + 10.0) * (100.0 / -mvPosition.z);
            }
        `,
        fragmentShader: `
            #include <common>

            uniform vec3 color;
            uniform float opacity;
            varying float vAlpha;

            void main() {

                // Soft circle particle
                vec2 center = gl_PointCoord - 0.5;
                float dist = length(center);
                float circle = 1.0 - smoothstep(0.3, 0.5, dist);

                if (circle < 0.01) discard;

                gl_FragColor = vec4(color, opacity * vAlpha * circle);
            }
        `,
        transparent: true,  // This should remain true for particle effects
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    return points;
}

/**
 * Updates the Enceladus plumes
 * @param {THREE.Points} plumeSystem - The particle system
 * @param {number} time - Current simulation time
 * @param {THREE.Vector3} sunPosition - Position of the sun (for lighting/backlighting effects)
 */
export function updateEnceladusPlumes(plumeSystem, time, sunPosition) {
    if (plumeSystem && plumeSystem.material.uniforms) {
        plumeSystem.material.uniforms.time.value = time;
        if (sunPosition) {
            plumeSystem.material.uniforms.sunPosition.value.copy(sunPosition);
        }
    }
}
