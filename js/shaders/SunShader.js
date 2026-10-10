/**
 * @fileoverview Custom Sun shader with physically-based rendering
 * Features:
 * - Procedural noise surface (convection cells, granules)
 * - Limb darkening effect (physically accurate)
 * - Animated surface activity
 * - Hot color temperature variation
 *
 * @module SunShader
 */

import * as THREE from 'three';

// Vertex shader - passes position and normal data to fragment
const sunVertexShader = `
    #include <common>

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Fragment shader - creates the sun's appearance
const sunFragmentShader = `
    #include <common>

    uniform float time;
    uniform sampler2D sunTexture;
    uniform bool hasTexture;
    uniform int qualityLevel; // 0=Low, 1=Medium, 2=High
    // uniform vec3 cameraPosition; // Redundant

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    // Simplex-like noise functions for procedural surface
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    // Optimized 3D noise function for better performance on mobile devices
    // Based on Morgan McGuire's implementation
    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        // First corner
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        // x0 = x0 - 0.0 + 0.0 * C.xxx;
        // x1 = x0 - i1  + 1.0 * C.xxx;
        // x2 = x0 - i2  + 2.0 * C.xxx;
        // x3 = x0 - 1.0 + 3.0 * C.xxx;
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
        vec3 x3 = x0 - D.yyy; // -1.0+3.0*C.x = -0.5 = -D.y

        // Permutations
        i = mod289(i);
        vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        // Gradients: 7x7 points over a square, mapped onto an octahedron.
        // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
        float n_ = 0.142857142857; // 1.0/7.0
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);    // mod(j,N)

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww ;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        // Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    }

    // Fractal Brownian Motion for layered noise
    // Scaled by quality level
    float fbm(vec3 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;

        // Dynamic loop limit based on quality
        // Note: In WebGL 1.0 loops must be constant, but for modern (WebGL 2) dynamic is okay.
        // We Use fixed upper bound for safety and break.
        for (int i = 0; i < 6; i++) {
            if (i >= octaves) break;
            value += amplitude * snoise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return value;
    }

    void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        // === LIMB DARKENING ===
        float NdotV = max(dot(vNormal, viewDir), 0.0);
        float mu = NdotV;
        float u = 0.6;
        float limbDarkening = 1.0 - u * (1.0 - mu);

        // === PROCEDURAL SURFACE NOISE ===
        vec3 noisePos = vPosition * 3.0;

        float surfaceNoise = 0.0;
        float sunspots = 0.0;

        // --- Quality-Based Branching ---
        if (qualityLevel == 0) {
            // LOW QUALITY: Single cheap noise layer
            surfaceNoise = snoise(noisePos * 0.5 + time * 0.02) * 0.5 + 0.5;

        } else if (qualityLevel == 1) {
            // MEDIUM QUALITY: Two noise layers
            float largeNoise = snoise(noisePos * 0.5 + time * 0.02);
            float mediumNoise = snoise(noisePos * 2.0 + time * 0.05);
            surfaceNoise = (largeNoise * 0.6 + mediumNoise * 0.4) * 0.5 + 0.5;

            // Simplified sunspots
            float sunspotNoise = snoise(noisePos * 0.3 + vec3(0.0, 0.0, time * 0.01));
            sunspots = smoothstep(0.65, 0.7, sunspotNoise) * 0.3;

        } else {
            // HIGH QUALITY: Three noise layers
            float largeNoise = snoise(noisePos * 0.5 + time * 0.02);
            float mediumNoise = snoise(noisePos * 2.0 + time * 0.05);
            float fineNoise = snoise(noisePos * 8.0 + time * 0.15);

            surfaceNoise = (largeNoise * 0.4 + mediumNoise * 0.35 + fineNoise * 0.25) * 0.5 + 0.5;

            float sunspotNoise = snoise(noisePos * 0.3 + vec3(0.0, 0.0, time * 0.01));
            sunspots = smoothstep(0.6, 0.7, sunspotNoise) * 0.3;
        }

        // === COLOR CALCULATION ===

        // Base color (photosphere - ~5800K blackbody)
        vec3 photosphereColor = vec3(1.0, 0.95, 0.85);

        // Hotter regions (slightly whiter)
        vec3 hotColor = vec3(1.0, 1.0, 0.95);

        // Cooler regions / sunspots (more orange/red)
        vec3 coolColor = vec3(1.0, 0.7, 0.4);

        // Sunspot color (very dark)
        vec3 sunspotColor = vec3(0.3, 0.2, 0.1);

        // Mix colors based on surface activity
        vec3 surfaceColor = mix(coolColor, hotColor, surfaceNoise);
        surfaceColor = mix(surfaceColor, photosphereColor, 0.5);
        if (qualityLevel > 0) { // No sunspots on Low for speed
            surfaceColor = mix(surfaceColor, sunspotColor, sunspots);
        }

        // === TEXTURE BLENDING ===
        if (hasTexture) {
            vec4 texColor = texture2D(sunTexture, vUv);
            surfaceColor = mix(surfaceColor, texColor.rgb, 0.6);
        }

        // === FINAL COLOR COMPOSITION ===
        vec3 finalColor = surfaceColor * limbDarkening;

        // Slight edge glow (chromosphere hint)
        float edgeGlow = pow(1.0 - NdotV, 3.0) * 0.3;
        finalColor += vec3(1.0, 0.5, 0.2) * edgeGlow;

        // Boost brightness (sun is emissive)
        finalColor *= 1.3;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Corona vertex shader
const coronaVertexShader = `
    #include <common>

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Corona fragment shader - creates the glowing atmosphere
const coronaFragmentShader = `
    #include <common>

    uniform float time;
    // uniform vec3 cameraPosition; // Redundant

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    // Simple noise for corona variation
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));

        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float NdotV = dot(vNormal, viewDir);

        // Corona intensity - strongest at edges (Fresnel-like)
        float fresnel = pow(1.0 - abs(NdotV), 2.5);

        // Add some variation for realistic corona streamers
        // Using simpler pattern for better performance on mobile
        float angle = atan(vNormal.y, vNormal.x);
        float streamer = sin(angle * 8.0 + time * 0.3) * 0.3 + 0.7; // Reduced complexity

        // Corona color gradient (white core to orange/red outer)
        vec3 innerColor = vec3(1.0, 0.95, 0.8);
        vec3 outerColor = vec3(1.0, 0.4, 0.1);
        vec3 coronaColor = mix(innerColor, outerColor, fresnel);

        // Final intensity
        float intensity = fresnel * streamer * 0.6; // Simplified computation

        // Fade out at very edge
        float edgeFade = smoothstep(0.0, 0.1, abs(NdotV));
        intensity *= edgeFade;

        gl_FragColor = vec4(coronaColor, intensity);
    }
`;

/**
 * Creates a Sun mesh with custom shader
 * @param {number} radius - Sun radius
 * @param {number} segments - Sphere segments (quality)
 * @param {number} qualityLevel - 0=Low, 1=Medium, 2=High
 * @returns {THREE.Mesh} Sun mesh with custom shader material
 */
export function createSunMesh(radius, segments = 64, qualityLevel = 2) {
    const geometry = new THREE.SphereGeometry(radius, segments, segments);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            sunTexture: { value: null },
            hasTexture: { value: false },
            qualityLevel: { value: qualityLevel },
            cameraPosition: { value: new THREE.Vector3() }
        },
        vertexShader: sunVertexShader,
        fragmentShader: sunFragmentShader,
        transparent: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Sun';

    // Store quality level on mesh for debug/updates
    mesh.userData.qualityLevel = qualityLevel;

    return mesh;
}

/**
 * Creates a corona glow mesh for the sun
 * @param {number} radius - Base sun radius
 * @param {number} scale - Corona scale relative to sun (default 1.8)
 * @returns {THREE.Mesh} Corona mesh
 */
export function createCoronaMesh(radius, scale = 1.8) {
    const geometry = new THREE.SphereGeometry(radius * scale, 48, 48);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            cameraPosition: { value: new THREE.Vector3() }
        },
        vertexShader: coronaVertexShader,
        fragmentShader: coronaFragmentShader,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'SunCorona';

    return mesh;
}

/**
 * Updates sun shader uniforms
 * @param {THREE.Mesh} sunMesh - The sun mesh
 * @param {THREE.Mesh} coronaMesh - The corona mesh (optional)
 * @param {THREE.Camera} camera - Active camera
 * @param {number} time - Elapsed time in seconds
 */
export function updateSunUniforms(sunMesh, coronaMesh, camera, time) {
    if (sunMesh && sunMesh.material.uniforms) {
        sunMesh.material.uniforms.time.value = time;
        if (camera) {
            sunMesh.material.uniforms.cameraPosition.value.copy(camera.position);
        }
    }

    if (coronaMesh && coronaMesh.material.uniforms) {
        coronaMesh.material.uniforms.time.value = time;
        if (camera) {
            coronaMesh.material.uniforms.cameraPosition.value.copy(camera.position);
        }
    }
}

/**
 * Sets the sun texture (blends with procedural)
 * @param {THREE.Mesh} sunMesh - The sun mesh
 * @param {THREE.Texture} texture - Sun texture
 */
export function setSunTexture(sunMesh, texture) {
    if (sunMesh && sunMesh.material.uniforms) {
        sunMesh.material.uniforms.sunTexture.value = texture;
        sunMesh.material.uniforms.hasTexture.value = true;
    }
}
