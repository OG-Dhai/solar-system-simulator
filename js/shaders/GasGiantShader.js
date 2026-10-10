/**
 * @fileoverview Gas Giant Atmospheric Shader
 *
 * Creates animated atmospheric band effects for Jupiter and Saturn.
 * Features:
 * - Animated turbulent bands with differential rotation
 * - Great Red Spot simulation (Jupiter)
 * - Storm vortices and eddies
 * - Realistic color gradients per band
 *
 * @module shaders/GasGiantShader
 */

import * as THREE from 'three';

// Vertex shader for gas giant atmosphere overlay
const gasGiantVertexShader = /* glsl */`
    #include <common>

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Fragment shader for Jupiter's atmospheric bands
const jupiterAtmosphereFragmentShader = /* glsl */`
    #include <common>

    uniform float time;
    uniform sampler2D baseTexture;
    uniform bool hasTexture;
    uniform vec3 sunPosition;
    // uniform vec3 cameraPosition; // Redundant

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    // Simplex noise for turbulence
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // FBM for layered turbulence
    float fbm(vec3 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;

        for (int i = 0; i < 5; i++) {
            if (i >= octaves) break;
            value += amplitude * snoise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return value;
    }

    void main() {
        // === BAND STRUCTURE ===
        // Jupiter has alternating light zones and dark belts
        float latitude = vUv.y; // 0 = south pole, 1 = north pole

        // Differential rotation: equator rotates faster than poles
        // System I (equator): 9h 50m 30s
        // System II (higher latitudes): 9h 55m 41s
        float rotationFactor = 1.0 - pow(abs(latitude - 0.5) * 2.0, 2.0) * 0.15;
        float longitude = vUv.x + time * 0.02 * rotationFactor;

        // Band pattern: multiple alternating light/dark bands
        float bandFrequency = 14.0; // Number of major bands
        float bandPattern = sin(latitude * 3.14159 * bandFrequency);

        // Add irregular band edges with noise
        vec3 noisePos = vec3(longitude * 10.0, latitude * 20.0, time * 0.1);
        float edgeNoise = fbm(noisePos, 3) * 0.15;
        bandPattern += edgeNoise;

        // === TURBULENCE & STORMS ===
        // Small-scale turbulence along band boundaries
        vec3 turbPos = vec3(longitude * 30.0, latitude * 50.0, time * 0.15);
        float turbulence = fbm(turbPos, 4) * 0.1;

        // Vortices (eddies at band interfaces)
        float vortexScale = 0.08;
        float vortex1 = snoise(vec3(longitude * 15.0 + time * 0.3, latitude * 30.0, time * 0.05)) * vortexScale;
        float vortex2 = snoise(vec3(longitude * 25.0 - time * 0.2, latitude * 40.0, time * 0.08)) * vortexScale;

        // === GREAT RED SPOT ===
        // Located at approximately 22° South latitude
        vec2 grsCenter = vec2(0.3, 0.28); // Approximate UV position
        float grsLongitude = mod(longitude + time * 0.005, 1.0); // Slow drift

        vec2 grsPos = vec2(grsLongitude, latitude);
        float grsDist = length((grsPos - grsCenter) * vec2(1.5, 3.0)); // Elliptical

        // GRS influence (anticyclonic vortex)
        float grsInfluence = smoothstep(0.12, 0.0, grsDist);

        // Swirling pattern within GRS
        float grsAngle = atan(grsPos.y - grsCenter.y, (grsPos.x - grsCenter.x) * 1.5);
        float grsSwirl = sin(grsAngle * 3.0 + grsDist * 30.0 - time * 0.5) * 0.5 + 0.5;

        // === COLOR PALETTE ===
        // Jupiter's colors from Cassini/Juno observations
        vec3 zoneColor = vec3(0.95, 0.9, 0.8);      // Light zones (ammonia ice)
        vec3 beltColor = vec3(0.7, 0.55, 0.4);      // Dark belts (deeper atmosphere)
        vec3 equatorColor = vec3(0.85, 0.75, 0.6);  // Equatorial band
        vec3 polarColor = vec3(0.6, 0.55, 0.5);     // Polar regions (darker)
        vec3 grsColor = vec3(0.85, 0.45, 0.35);     // Great Red Spot

        // Mix colors based on latitude and band pattern
        float bandMix = bandPattern * 0.5 + 0.5; // Normalize to 0-1
        vec3 baseColor = mix(beltColor, zoneColor, bandMix);

        // Equatorial region blending
        float equatorFactor = 1.0 - pow(abs(latitude - 0.5) * 2.0, 4.0);
        baseColor = mix(baseColor, equatorColor, equatorFactor * 0.3);

        // Polar darkening
        float polarFactor = pow(abs(latitude - 0.5) * 2.0, 3.0);
        baseColor = mix(baseColor, polarColor, polarFactor * 0.4);

        // Apply turbulence as color variation
        baseColor += vec3(turbulence + vortex1 + vortex2);

        // Apply Great Red Spot
        baseColor = mix(baseColor, grsColor * (0.8 + grsSwirl * 0.4), grsInfluence);

        // === TEXTURE BLENDING ===
        if (hasTexture) {
            vec4 texColor = texture2D(baseTexture, vUv);
            baseColor = mix(baseColor, texColor.rgb, 0.7);
        }

        // === LIGHTING ===
        vec3 lightDir = normalize(sunPosition - vWorldPosition);
        // --- STANDARD LIGHTING ---
        float sunIntensity = 4.0;
        float NdotL = max(dot(vNormal, lightDir), 0.0);

        // Ensure minimum lighting to prevent complete darkness
        vec3 ambient = vec3(0.3); // Further increased to ensure visibility
        vec3 directLight = vec3(NdotL * sunIntensity);

        vec3 lighting = ambient + directLight;

        // Ensure lighting is never too dark
        lighting = max(lighting, vec3(0.3)); // Higher minimum lighting threshold

        // Simple limb darkening
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float NdotV = max(dot(vNormal, viewDir), 0.0);
        float limbDarkening = pow(NdotV, 0.2); // Subtle darkening edges

        // Ensure limb darkening doesn't make it too dark
        limbDarkening = max(limbDarkening, 0.6); // Higher minimum limb darkening

        vec3 finalColor = baseColor * lighting * limbDarkening;

        // Ensure final color is never too dark
        finalColor = max(finalColor, vec3(0.3)); // Minimum color threshold

        // TEMP FIX: Ensure the planet is always visible with a solid color
        // This will help us determine if the issue is in the shader calculations
        if (hasTexture > 0.5 && length(texColor.rgb) > 0.01) {
            // Use texture-based color if available
            gl_FragColor = vec4(finalColor, 1.0);
        } else {
            // Fallback to procedural color to ensure visibility
            gl_FragColor = vec4(max(finalColor, vec3(0.4)), 1.0);
        }
    }
`;

// Simpler outer glow for gas giants
const gasGiantGlowFragmentShader = /* glsl */`
    #include <common>

    uniform vec3 glowColor;
    uniform vec3 sunPosition;
    // uniform vec3 cameraPosition; // Redundant

    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 lightDir = normalize(sunPosition - vWorldPosition);

        // Fresnel-based glow (stronger at edges)
        float NdotV = dot(vNormal, viewDir);
        float fresnel = pow(1.0 - abs(NdotV), 3.0);

        // Day/night factor
        float NdotL = dot(vNormal, lightDir);
        float dayFactor = smoothstep(-0.3, 0.3, NdotL);

        // Glow intensity
        float intensity = fresnel * dayFactor * 0.4;

        gl_FragColor = vec4(glowColor, intensity);
    }
`;

/**
 * Creates Jupiter atmosphere shader material with animated bands
 * @param {Object} options - Configuration options
 * @returns {THREE.ShaderMaterial} Jupiter shader material
 */
export function createJupiterAtmosphereMaterial(options = {}) {
    const {
        sunPosition = new THREE.Vector3(0, 0, 0)
    } = options;

    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            baseTexture: { value: null },
            hasTexture: { value: false },
            sunPosition: { value: sunPosition },
            cameraPosition: { value: new THREE.Vector3() }
        },
        vertexShader: gasGiantVertexShader,
        fragmentShader: jupiterAtmosphereFragmentShader,
        transparent: false
    });
}

/**
 * Creates a glow mesh for gas giants
 * @param {number} radius - Planet radius
 * @param {THREE.Color} glowColor - Glow color
 * @param {number} scale - Glow scale (default 1.03)
 * @returns {THREE.Mesh} Glow mesh
 */
export function createGasGiantGlowMesh(radius, glowColor, scale = 1.03) {
    const geometry = new THREE.SphereGeometry(radius * scale, 48, 48);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: glowColor },
            sunPosition: { value: new THREE.Vector3(0, 0, 0) },
            cameraPosition: { value: new THREE.Vector3() }
        },
        vertexShader: gasGiantVertexShader,
        fragmentShader: gasGiantGlowFragmentShader,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;

    // Ensure proper rendering order and transparency for glow effect
    material.transparent = true;
    material.depthWrite = false;
    material.blending = THREE.AdditiveBlending;

    return mesh;
}

/**
 * Updates Jupiter shader uniforms
 * @param {THREE.Material} material - Jupiter shader material
 * @param {number} time - Elapsed time
 * @param {THREE.Vector3} sunPosition - Sun position
 * @param {THREE.Camera} camera - Camera for lighting calculations
 */
export function updateJupiterUniforms(material, time, sunPosition, camera) {
    if (!material?.uniforms) return;

    material.uniforms.time.value = time;
    if (sunPosition) {
        material.uniforms.sunPosition.value.copy(sunPosition);
    }
    if (camera && material.uniforms.cameraPosition) {
        material.uniforms.cameraPosition.value.copy(camera.position);
    }
}

/**
 * Updates gas giant glow mesh uniforms
 * @param {THREE.Mesh} glowMesh - Glow mesh
 * @param {THREE.Vector3} sunPosition - Sun position
 * @param {THREE.Camera} camera - Camera for lighting calculations
 */
export function updateGasGiantGlowUniforms(glowMesh, sunPosition, camera) {
    if (!glowMesh?.material?.uniforms) return;

    if (sunPosition) {
        glowMesh.material.uniforms.sunPosition.value.copy(sunPosition);
    }
    if (camera && glowMesh.material.uniforms.cameraPosition) {
        glowMesh.material.uniforms.cameraPosition.value.copy(camera.position);
    }
}

/**
 * Sets the base texture for Jupiter
 * @param {THREE.Material} material - Jupiter shader material
 * @param {THREE.Texture} texture - Base texture
 */
export function setJupiterTexture(material, texture) {
    if (!material?.uniforms) return;

    material.uniforms.baseTexture.value = texture;
    material.uniforms.hasTexture.value = true;
}

export default {
    createJupiterAtmosphereMaterial,
    createGasGiantGlowMesh,
    updateJupiterUniforms,
    updateGasGiantGlowUniforms,
    setJupiterTexture
};
