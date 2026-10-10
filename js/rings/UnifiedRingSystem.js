/**
 * @fileoverview Unified Ring System using InstancedMesh for high performance.
 * Consolidates all planetary rings into a single draw call.
 * 
 * Features:
 * - InstancedMesh for O(1) draw call count regardless of ring count
 * - Custom ShaderMaterial for accurate radial branding and cutouts
 * - Dynamic texture atlas generation for different ring types
 * - Support for inner/outer radius and opacity per instance
 * 
 * @module UnifiedRingSystem
 */

import * as THREE from 'three';
import { loadTexture } from '../utils/EnhancedTextureLoader.js';
import { Logger } from '../utils/Logger.js';

export class UnifiedRingSystem {
    constructor(scene) {
        this.scene = scene;
        this.maxInstances = 10; // Only ~4-5 ringed planets exist in solar system
        this.instanceCount = 0;

        // Instance data storage
        this.instances = new Map(); // Map planetKey -> instanceId

        // Arrays for instanced attributes
        this.colors = new Float32Array(this.maxInstances * 3);
        this.radii = new Float32Array(this.maxInstances * 2); // [inner, outer]
        this.opacity = new Float32Array(this.maxInstances);
        this.textureParams = new Float32Array(this.maxInstances * 2); // [vOffset, vScale]

        // Texture Atlas
        this.atlasCanvas = document.createElement('canvas');
        this.atlasCanvas.width = 2048;
        this.atlasCanvas.height = 512; // 4 rows of 128px for better quality
        this.atlasContext = this.atlasCanvas.getContext('2d');
        this.atlasTexture = new THREE.CanvasTexture(this.atlasCanvas);
        this.atlasTexture.wrapS = THREE.RepeatWrapping;
        this.atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
        this.atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
        this.atlasTexture.magFilter = THREE.LinearFilter;
        this.atlasTexture.generateMipmaps = true;

        // Initialize mock atlas data (will be updated as textures load)
        this.atlasRows = new Map(); // Map textureName -> row index (0-3)
        this.nextRowIndex = 0;

        this.initMesh();
    }

    initMesh() {
        // Geometry: Simple Quad, scaled in vertex shader
        // We use a PlaneGeometry(1, 1) to representing localized coordinate space [-0.5, 0.5]
        // But traditional ring logic maps radius. 
        // Better: PlaneGeometry(1, 1) and scale via instanceMatrix to max radius.
        const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);

        // Instanced Attributes
        const colorAttribute = new THREE.InstancedBufferAttribute(this.colors, 3);
        const radiiAttribute = new THREE.InstancedBufferAttribute(this.radii, 2);
        const opacityAttribute = new THREE.InstancedBufferAttribute(this.opacity, 1);
        const textureParamsAttribute = new THREE.InstancedBufferAttribute(this.textureParams, 2);

        geometry.setAttribute('instanceColor', colorAttribute);
        geometry.setAttribute('instanceRadii', radiiAttribute);
        geometry.setAttribute('instanceOpacity', opacityAttribute);
        geometry.setAttribute('instanceTextureParams', textureParamsAttribute);

        // Custom Shader Material - Enhanced with lighting, gaps, Fresnel, and planet shadow
        const material = new THREE.ShaderMaterial({
            uniforms: {
                ringAtlas: { value: this.atlasTexture },
                sunPosition: { value: new THREE.Vector3(0, 0, 0) },
                cameraPosition: { value: new THREE.Vector3(0, 0, 0) },
                time: { value: 0.0 },
                planetRadius: { value: 1.0 },
                planetPosition: { value: new THREE.Vector3(0, 0, 0) }
            },
            vertexShader: `
                attribute vec3 instanceColor;
                attribute vec2 instanceRadii; // [inner, outer]
                attribute float instanceOpacity;
                attribute vec2 instanceTextureParams; // [vOffset, vScale]

                varying vec3 vColor;
                varying float vOpacity;
                varying vec2 vUv;
                varying float vInnerRadius;
                varying float vOuterRadius;
                varying vec2 vTexParams;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec3 vLocalPos;

                void main() {
                    vColor = instanceColor;
                    vOpacity = instanceOpacity;
                    vUv = uv;
                    vInnerRadius = instanceRadii.x;
                    vOuterRadius = instanceRadii.y;
                    vTexParams = instanceTextureParams;
                    vLocalPos = position.xyz;

                    // Transform position to world space
                    vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
                    vWorldPos = worldPosition.xyz;
                    
                    // Calculate normal in world space (ring is flat, normal is up in local space)
                    // The instanceMatrix includes rotation, so we transform the normal
                    mat3 normalMatrix = mat3(instanceMatrix);
                    vNormal = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
                    
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D ringAtlas;
                uniform vec3 sunPosition;
                // uniform vec3 cameraPosition; // Removed duplicate declaration
                uniform float time;
                uniform float planetRadius;
                uniform vec3 planetPosition;

                varying vec3 vColor;
                varying float vOpacity;
                varying vec2 vUv;
                varying float vInnerRadius;
                varying float vOuterRadius;
                varying vec2 vTexParams;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec3 vLocalPos;

                // === NOISE FUNCTIONS FOR SPARKLE ===
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float hash3(vec3 p) {
                    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
                }

                // Saturn Ring Gap definitions (normalized 0-1 across ring width)
                // Based on NASA/JPL data with additional gaps
                // D Ring: 66,900 - 74,510 km
                // C Ring: 74,658 - 92,000 km (Colombo Gap, Maxwell Gap)
                // B Ring: 92,000 - 117,580 km
                // Cassini Division: 117,580 - 122,170 km (Huygens Gap at edge)
                // A Ring: 122,170 - 136,775 km (Encke Gap, Keeler Gap)

                const float CASSINI_START = 0.42;
                const float CASSINI_END = 0.48;
                const float HUYGENS_START = 0.415;
                const float HUYGENS_END = 0.42;
                const float ENCKE_START = 0.75;
                const float ENCKE_END = 0.76;
                const float KEELER_START = 0.88;
                const float KEELER_END = 0.885;
                const float COLOMBO_START = 0.08;
                const float COLOMBO_END = 0.09;
                const float MAXWELL_START = 0.12;
                const float MAXWELL_END = 0.125;

                float calculateGapOpacity(float normalizedRadius) {
                    float gapFactor = 1.0;

                    // Cassini Division - most prominent gap (4,800 km wide)
                    if (normalizedRadius > CASSINI_START && normalizedRadius < CASSINI_END) {
                        float gapCenter = (CASSINI_START + CASSINI_END) * 0.5;
                        float distFromCenter = abs(normalizedRadius - gapCenter);
                        float gapWidth = (CASSINI_END - CASSINI_START) * 0.5;
                        gapFactor *= smoothstep(0.0, gapWidth, distFromCenter) * 0.12 + 0.03;
                    }

                    // Huygens Gap - at inner edge of Cassini Division
                    if (normalizedRadius > HUYGENS_START && normalizedRadius < HUYGENS_END) {
                        gapFactor *= 0.15;
                    }

                    // Encke Gap - 325 km wide gap in A Ring
                    if (normalizedRadius > ENCKE_START && normalizedRadius < ENCKE_END) {
                        gapFactor *= 0.1;
                    }

                    // Keeler Gap - 42 km wide, outer A Ring (maintained by Daphnis)
                    if (normalizedRadius > KEELER_START && normalizedRadius < KEELER_END) {
                        gapFactor *= 0.15;
                    }

                    // Colombo Gap - in C Ring
                    if (normalizedRadius > COLOMBO_START && normalizedRadius < COLOMBO_END) {
                        gapFactor *= 0.35;
                    }

                    // Maxwell Gap - in C Ring (87 km wide)
                    if (normalizedRadius > MAXWELL_START && normalizedRadius < MAXWELL_END) {
                        gapFactor *= 0.25;
                    }

                    return gapFactor;
                }

                // Calculate if ring point is in planet's shadow
                float calculatePlanetShadow(vec3 worldPos, vec3 sunPos, vec3 planetPos, float pRadius) {
                    // Direction from sun to ring point
                    vec3 toRing = worldPos - sunPos;
                    vec3 toPlanet = planetPos - sunPos;

                    // Project ring point onto sun-planet line
                    float t = dot(toRing, normalize(toPlanet));
                    float planetDist = length(toPlanet);

                    // Only shadow if ring is behind planet (from sun's view)
                    if (t < planetDist) return 1.0; // Ring is between sun and planet

                    // Find closest point on sun-planet line to ring point
                    vec3 closestPoint = sunPos + normalize(toPlanet) * t;
                    float distToLine = length(worldPos - closestPoint);

                    // Shadow with soft edge (penumbra)
                    float shadowRadius = pRadius * 1.05; // Slight expansion for soft edge
                    float shadow = smoothstep(shadowRadius * 0.8, shadowRadius, distToLine);

                    return shadow;
                }

                void main() {
                    // Calculate radial distance from center (0.5, 0.5) in UV space
                    vec2 centeredUv = vUv - 0.5;
                    float dist = length(centeredUv) * 2.0; // 0 to 1 range (where 1 = edge of quad)

                    // Current physical radius = dist * vOuterRadius
                    float currentRadius = dist * vOuterRadius;

                    // Ring Cutout Logic - Simple and clear
                    if (dist > 1.0) discard; // Outside quad
                    if (currentRadius < vInnerRadius) discard; // Inside inner radius

                    // Normalized position within ring (0 = inner edge, 1 = outer edge)
                    float normalizedRadius = (currentRadius - vInnerRadius) / (vOuterRadius - vInnerRadius);
                    normalizedRadius = clamp(normalizedRadius, 0.0, 1.0);

                    // Apply ring gaps
                    float gapOpacity = calculateGapOpacity(normalizedRadius);

                    // === VOLUMETRIC DEPTH SIMULATION ===
                    // Simulate multiple layers by varying opacity based on view angle
                    // This creates the illusion of ring thickness

                    // Ring bands - different density regions (NASA-based)
                    float bandDensity = 1.0;
                    // D Ring (inner) - very faint
                    if (normalizedRadius < 0.1) bandDensity = 0.3;
                    // C Ring - medium
                    else if (normalizedRadius < 0.25) bandDensity = 0.6;
                    // B Ring - densest, brightest
                    else if (normalizedRadius < 0.42) bandDensity = 1.0;
                    // A Ring - medium-bright
                    else if (normalizedRadius > 0.48) bandDensity = 0.8;
                    // F Ring - extremely thin outer ring
                    if (normalizedRadius > 0.95) bandDensity = 0.2;

                    // === LIGHTING CALCULATIONS ===
                    vec3 lightDir = normalize(sunPosition - vWorldPos);
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    vec3 normal = normalize(vNormal);

                    // Volumetric thickness - rings appear thicker when viewed edge-on
                    float edgeOnFactor = 1.0 - abs(dot(normal, viewDir));
                    float volumetricThickness = 1.0 + edgeOnFactor * 2.0; // 1x to 3x opacity

                    // Edge darkening for 3D depth illusion
                    float edgeDarkening = 1.0 - pow(edgeOnFactor, 3.0) * 0.4;

                    // Lambertian diffuse lighting (both sides of ring)
                    float NdotL = abs(dot(normal, lightDir));
                    float diffuse = mix(0.05, 1.0, NdotL); // Ambient of 0.05, max 1.0

                    // === MIE SCATTERING (Phase 5) ===
                    // Mie scattering phase function for ice particles
                    // Models how light scatters through ice crystals
                    float cosTheta = dot(-viewDir, lightDir);

                    // Henyey-Greenstein phase function
                    // g = asymmetry parameter (0.8 for ice = strong forward scattering)
                    float g = 0.76;
                    float g2 = g * g;
                    float miePhase = (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));

                    // Enhanced forward scattering with Mie
                    float forwardScatter = pow(max(cosTheta, 0.0), 8.0) * miePhase * 2.0;
                    float backScatter = pow(max(-cosTheta, 0.0), 2.0) * 0.1; // Weak back scatter
                    float mieScatter = (forwardScatter + backScatter) * bandDensity;

                    // Rayleigh scattering for smaller dust particles (blue shift)
                    float rayleigh = pow(max(cosTheta, 0.0), 2.0) * 0.15;
                    vec3 rayleighColor = vec3(0.7, 0.85, 1.0) * rayleigh;

                    // === FRESNEL & ICE MATERIAL ===
                    float NdotV = abs(dot(normal, viewDir));
                    float fresnel = pow(1.0 - NdotV, 2.0);
                    float fresnelOpacity = mix(1.0, 0.6, fresnel);

                    // Ice material with wavelength-dependent scattering
                    vec3 iceColor = vec3(0.95, 0.97, 1.0); // Slight blue tint
                    vec3 warmIce = vec3(1.0, 0.98, 0.92); // Warm reflected light on lit side
                    vec3 iceTint = mix(warmIce, iceColor, fresnel);
                    vec3 ambientIce = iceTint * 0.12;

                    // Subsurface scattering for translucent ice
                    float sss = pow(max(dot(lightDir, -normal), 0.0), 3.0) * 0.2;
                    vec3 sssColor = iceColor * sss;

                    // === ATMOSPHERIC HALO ===
                    // Rings create a subtle halo from scattered light
                    float haloIntensity = pow(1.0 - abs(normalizedRadius - 0.5) * 2.0, 2.0) * 0.1;
                    vec3 haloColor = iceColor * haloIntensity * mieScatter;

                    // Texture Sampling - Map radial position to texture
                    float u = normalizedRadius;

                    // V coordinate from atlas
                    float v = vTexParams.x + 0.5 * vTexParams.y;

                    // Sample texture normally
                    vec4 texColor = texture2D(ringAtlas, vec2(u, v));

                    // Ring density variation (procedural micro-detail with multiple frequencies)
                    float microDetail1 = 0.95 + 0.05 * sin(normalizedRadius * 200.0 + time * 0.3);
                    float microDetail2 = 0.9 + 0.1 * sin(normalizedRadius * 50.0 - time * 0.2);
                    float microDetail = microDetail1 * microDetail2;

                    // === ENHANCED PARTICLE SPARKLE EFFECT ===
                    // Use hash function for random distribution instead of regular sin waves
                    // This creates actual random sparkles like individual ice crystals catching light

                    // Calculate angular position for sparkle variation
                    float angle = atan(centeredUv.y, centeredUv.x);
                    float angularPos = angle / 6.28318 + 0.5; // Normalize to 0-1

                    // Create grid cells for sparkle positions
                    vec2 sparkleCell = vec2(normalizedRadius * 100.0, angularPos * 200.0);
                    vec2 cellId = floor(sparkleCell);
                    vec2 cellUv = fract(sparkleCell);

                    // Random sparkle intensity per cell
                    float sparkleRand = hash(cellId + floor(time * 0.5));

                    // Sparkle only appears when view angle is favorable (specular-like)
                    float sparkleSpecular = pow(max(cosTheta, 0.0), 4.0);

                    // Random threshold determines which cells sparkle
                    float sparkleThreshold = 0.92 - sparkleSpecular * 0.15;
                    float sparkleActive = step(sparkleThreshold, sparkleRand);

                    // Sparkle intensity varies with time (twinkling)
                    float twinkle = sin(time * 3.0 + sparkleRand * 6.28) * 0.5 + 0.5;
                    twinkle = pow(twinkle, 2.0);

                    // Distance from cell center affects sparkle intensity
                    float cellDist = length(cellUv - 0.5) * 2.0;
                    float sparkleShape = 1.0 - smoothstep(0.0, 0.5, cellDist);

                    // Final sparkle
                    float totalSparkle = sparkleActive * twinkle * sparkleShape * bandDensity * 0.6;
                    totalSparkle *= (1.0 + mieScatter * 0.8); // Forward scatter enhances sparkle

                    // Secondary larger sparkles (bigger ice chunks)
                    vec2 largeCell = vec2(normalizedRadius * 30.0, angularPos * 60.0);
                    float largeRand = hash(floor(largeCell) + floor(time * 0.3));
                    float largeSparkle = step(0.97, largeRand) * pow(sin(time * 2.0 + largeRand * 10.0) * 0.5 + 0.5, 3.0);
                    totalSparkle += largeSparkle * 0.4 * bandDensity;

                    // === PLANET SHADOW ON RINGS ===
                    float planetShadow = calculatePlanetShadow(vWorldPos, sunPosition, planetPosition, planetRadius);

                    // === FINAL COLOR COMPOSITION ===
                    vec3 baseColor = vColor * texColor.rgb;
                    vec3 litColor = baseColor * diffuse * edgeDarkening + ambientIce;
                    vec3 scatteredColor = litColor + iceTint * mieScatter * 0.4 + sssColor + rayleighColor;

                    // Apply planet shadow (darkens rings in shadow, keeps some ambient)
                    vec3 shadowedColor = mix(scatteredColor * 0.15, scatteredColor, planetShadow);

                    // Add sparkle (sparkles also reduced in shadow)
                    vec3 sparkleColor = shadowedColor + vec3(totalSparkle * planetShadow);

                    vec3 haloedColor = sparkleColor + haloColor * planetShadow;
                    vec3 finalColor = haloedColor * microDetail;

                    // Combine all opacity factors
                    float baseAlpha = vOpacity * texColor.a * bandDensity;
                    float scatterAlpha = baseAlpha * (1.0 + mieScatter * 0.3);
                    float volumetricAlpha = scatterAlpha * min(volumetricThickness, 1.5);
                    float finalAlpha = volumetricAlpha * gapOpacity * fresnelOpacity;

                    // Rings in shadow are slightly more transparent
                    finalAlpha *= mix(0.7, 1.0, planetShadow);

                    // Ensure minimum visibility
                    finalAlpha = max(finalAlpha, 0.02);

                    gl_FragColor = vec4(finalColor, finalAlpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending,
            alphaTest: 0.01 // Discard very transparent pixels
        });

        // Store material reference for uniform updates
        this.material = material;

        this.mesh = new THREE.InstancedMesh(geometry, material, this.maxInstances);
        this.mesh.count = 0;  // Start with no visible instances
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false; // Always render if system is visible, simple enough
        this.mesh.renderOrder = 1; // Render after planets but before UI
        this.scene.add(this.mesh);

        // Cache for update loop to avoid GC pressure
        this._dummyObject = new THREE.Object3D();
        this._primaryPlanet = null;
        this._maxRadius = 0;
    }

    /**
     * Add or update a ring for a planet.
     * @param {Object} planet - The Planet instance
     * @param {Object} ringConfig - Configuration from NASAOrbitalData
     */
    async addRing(planet, ringConfig) {
        if (!ringConfig) return;

        const key = planet.key || planet.name.toLowerCase();
        let index;

        if (this.instances.has(key)) {
            index = this.instances.get(key).index;
        } else {
            index = this.instanceCount++;
        }

        // Use physically accurate scales from NASAOrbitalData
        // Visual scales caused rings to be 2-3x larger than reality
        const visualScale = 1.0;

        const innerRadius = planet.radius * (ringConfig.innerRadius || 1.2);
        const outerRadius = planet.radius * visualScale * (ringConfig.outerRadius || 2.3);
        const scale = outerRadius * 2;

        // 2. Handle Texture Atlas
        const textureName = ringConfig.texture || 'default_ring'; // Fallback

        // Reserve row if new
        let rowIndex;
        if (this.atlasRows.has(textureName)) {
            rowIndex = this.atlasRows.get(textureName);
        } else {
            rowIndex = this.nextRowIndex++;
            this.atlasRows.set(textureName, rowIndex);
            // Load and draw to atlas
            this._loadTextureToAtlas(textureName, rowIndex);
        }

        // Set Texture Params (Atlas is 2048x512)
        // Max rows = 4 (Saturn, Uranus, Neptune, Jupiter). Fits 512px height (128px each).
        const rowHeightNormalized = 0.25;
        const rowOffset = rowIndex * rowHeightNormalized;

        // Now log after all variables are defined
        Logger.info('UnifiedRingSystem', `Added ring for ${key}. Planet radius: ${planet.radius}, Visual scale: ${visualScale}, Scale: ${scale.toFixed(2)}, R: [${innerRadius.toFixed(2)}, ${outerRadius.toFixed(2)}]`);
        Logger.info('UnifiedRingSystem', `Ring texture: ${textureName}, Row index: ${rowIndex}, Tex params: [${rowOffset}, ${rowHeightNormalized}]`);

        // Store reference for update loop
        this.instances.set(key, {
            index: index,
            planet: planet,
            scale: scale
        });

        // Set Static Attributes
        this.radii[index * 2] = innerRadius;
        this.radii[index * 2 + 1] = outerRadius;
        this.mesh.geometry.attributes.instanceRadii.needsUpdate = true;

        this.opacity[index] = ringConfig.opacity || 0.8;
        this.mesh.geometry.attributes.instanceOpacity.needsUpdate = true;

        const color = new THREE.Color(ringConfig.color || 0x888888); // Default to gray to prevent washout
        this.colors[index * 3] = color.r;
        this.colors[index * 3 + 1] = color.g;
        this.colors[index * 3 + 2] = color.b;
        this.mesh.geometry.attributes.instanceColor.needsUpdate = true;

        this.textureParams[index * 2] = rowOffset;
        this.textureParams[index * 2 + 1] = rowHeightNormalized;
        this.mesh.geometry.attributes.instanceTextureParams.needsUpdate = true;

        // CRITICAL: Update visible instance count so Three.js renders the rings
        this.mesh.count = this.instanceCount;

        // Track primary planet for shadow calculation (largest ringed planet)
        if (planet.radius > this._maxRadius) {
            this._maxRadius = planet.radius;
            this._primaryPlanet = planet;
        }

        Logger.info('UnifiedRingSystem', `Ringsystem aktualisiert: ${this.instanceCount} Instanzen, sichtbar: ${this.mesh.visible}`);
    }

    async _loadTextureToAtlas(textureName, rowIndex) {
        const rowHeight = 128;
        const y = rowIndex * rowHeight;

        try {
            // Try to load the texture first
            const cleanName = textureName
                .replace(/^textures\//, '')
                .replace(/^2k_/, '')
                .replace(/\.(webp|png|jpg|svg)$/i, '');

            const texture = await loadTexture(cleanName);
            const image = texture.image;

            // Draw to canvas at specific row
            // FORCE STRETCH: For ring gradients, we want to fill the entire UV width (0-1).
            // Do not preserve aspect ratio, as 1D gradients should fill the slot.
            const w = 2048;
            const x = 0;

            this.atlasContext.drawImage(image, x, y, w, rowHeight);
            this.atlasTexture.needsUpdate = true;

        } catch (err) {
            Logger.warn('UnifiedRingSystem', `Failed to load atlas texture ${textureName}, generating procedural ring`, err);

            // Generate procedural ring texture based on planet
            if (this.atlasContext) {
                const gradient = this.atlasContext.createLinearGradient(0, y, 2048, y);

                // Different patterns for different planets
                if (textureName.includes('saturn')) {
                    // Saturn: Multiple bands with varying opacity
                    gradient.addColorStop(0.0, 'rgba(200,180,140,0.0)');
                    gradient.addColorStop(0.15, 'rgba(200,180,140,0.9)');
                    gradient.addColorStop(0.25, 'rgba(180,160,120,0.3)');
                    gradient.addColorStop(0.35, 'rgba(200,180,140,0.8)');
                    gradient.addColorStop(0.45, 'rgba(160,140,100,0.2)');
                    gradient.addColorStop(0.55, 'rgba(200,180,140,0.7)');
                    gradient.addColorStop(0.65, 'rgba(180,160,120,0.4)');
                    gradient.addColorStop(0.75, 'rgba(200,180,140,0.6)');
                    gradient.addColorStop(0.85, 'rgba(160,140,100,0.1)');
                    gradient.addColorStop(1.0, 'rgba(200,180,140,0.0)');
                } else if (textureName.includes('uranus')) {
                    // Uranus: Single thin band
                    gradient.addColorStop(0.0, 'rgba(180,180,200,0.0)');
                    gradient.addColorStop(0.4, 'rgba(180,180,200,0.0)');
                    gradient.addColorStop(0.45, 'rgba(180,180,200,0.6)');
                    gradient.addColorStop(0.55, 'rgba(180,180,200,0.6)');
                    gradient.addColorStop(0.6, 'rgba(180,180,200,0.0)');
                    gradient.addColorStop(1.0, 'rgba(180,180,200,0.0)');
                } else if (textureName.includes('neptune')) {
                    // Neptune: Very faint rings
                    gradient.addColorStop(0.0, 'rgba(140,140,180,0.0)');
                    gradient.addColorStop(0.3, 'rgba(140,140,180,0.0)');
                    gradient.addColorStop(0.35, 'rgba(140,140,180,0.2)');
                    gradient.addColorStop(0.4, 'rgba(140,140,180,0.3)');
                    gradient.addColorStop(0.45, 'rgba(140,140,180,0.2)');
                    gradient.addColorStop(0.5, 'rgba(140,140,180,0.0)');
                    gradient.addColorStop(1.0, 'rgba(140,140,180,0.0)');
                } else {
                    // Default: Simple gradient
                    gradient.addColorStop(0, 'rgba(255,255,255,0)');
                    gradient.addColorStop(0.1, 'rgba(255,255,255,0.8)');
                    gradient.addColorStop(0.9, 'rgba(255,255,255,0.8)');
                    gradient.addColorStop(1, 'rgba(255,255,255,0)');
                }

                this.atlasContext.fillStyle = gradient;
                this.atlasContext.fillRect(0, y, 2048, rowHeight);
                this.atlasTexture.needsUpdate = true;
            }
        }
    }

    update(camera, time = 0) {
        if (!this.mesh) return;

        // Update shader uniforms for lighting
        if (this.material && this.material.uniforms) {
            // Sun is always at origin (0, 0, 0)
            this.material.uniforms.sunPosition.value.set(0, 0, 0);

            // Update camera position for view-dependent effects
            if (camera) {
                this.material.uniforms.cameraPosition.value.copy(camera.position);
            }

            // Update time for animated effects
            this.material.uniforms.time.value = time;

            // Update planet shadow uniforms (use cached primary planet)
            if (this._primaryPlanet) {
                this.material.uniforms.planetRadius.value = this._primaryPlanet.radius;
                this.material.uniforms.planetPosition.value.copy(this._primaryPlanet.group.position);
            }
        }

        // Use cached dummy object to avoid GC pressure
        const dummy = this._dummyObject;

        this.instances.forEach((data, key) => {
            const { index, planet, scale } = data;

            // Match position
            dummy.position.copy(planet.group.position);

            // Match rotation (axial tilt)
            // The unified ring is flat in its own local space (XY plane).
            // We need to match the planet's tilt plane.
            // Planet.tiltGroup contains the axial tilt.
            // And Planet.group handles orbital position.

            // We can approximate by copying the planet's tiltGroup world rotation?
            // Expensive to extract world rotation every frame from Euler/Quaternion.
            // But necessary for correctness.

            // Faster: Reconstruct rotation.
            // Planet.tiltGroup.rotation.x = axialTilt.
            // Planet.group has translation, no rotation (except orbital if applied?). 
            // Only Mesh spins.

            // So Ring Rotation = Planet Axial Tilt (X axis usually).
            dummy.rotation.x = planet.tiltGroup.rotation.x;

            // Special case: Rings are usually defined in XZ plane in Three.js terms if using RingGeometry?
            // My shader assumes XY plane (PlaneGeometry default).
            // RingGeometry is usually perpendicular to Z axis? No, RingGeometry creates flat ring in XY.
            // But we often rotate X by -90 to lie flat on XZ.

            // Let's assume standardized orientation:
            // PlaneGeometry is XY.
            // We want it visually flat (XZ) if tilt is 0.
            // So rotate X by -90 deg (-Pi/2) as base.
            // Then apply Axial Tilt (rotate X by tilt).
            // Total X rot = -Pi/2 + Tilt.

            dummy.rotation.x = -Math.PI / 2 + planet.tiltGroup.rotation.x;

            // Apply other axes if planet precesses (SolarSystem doesn't simulate precession yet).

            dummy.scale.set(scale, scale, 1);
            dummy.updateMatrix();

            this.mesh.setMatrixAt(index, dummy.matrix);
        });

        this.mesh.instanceMatrix.needsUpdate = true;

        // === PHASE 6: LOD PARTICLE SYSTEM UPDATE ===
        if (camera) {
            this.updateParticleLOD(camera);
        }
    }

    /**
     * Initialize the LOD particle system for close-up ring detail
     * Called lazily when camera first approaches rings
     */
    initParticleSystem() {
        if (this.particleSystem) return; // Already initialized

        const particleCount = 5000; // Number of individual ring particles

        // Create particle geometry
        const positions = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const colors = new Float32Array(particleCount * 3);
        const angles = new Float32Array(particleCount); // Orbital angle
        const radii = new Float32Array(particleCount); // Normalized 0-1

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const rNormalized = Math.random(); // 0 to 1

            // Initial positions (will be updated by updateParticleLOD)
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.02; // Z is height (XY plane)

            // Random particle size (ice chunks vary from pebbles to boulders)
            sizes[i] = 0.002 + Math.random() * 0.008; // 0.002 to 0.01

            // Ice color with slight variation
            colors[i * 3] = 0.9 + Math.random() * 0.1;
            colors[i * 3 + 1] = 0.92 + Math.random() * 0.08;
            colors[i * 3 + 2] = 0.95 + Math.random() * 0.05;

            // Store orbital data
            angles[i] = angle;
            radii[i] = rNormalized;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Store orbital data for animation
        this.particleAngles = angles;
        this.particleRadii = radii;
        this.currentParticlePlanet = null; // Track which planet the particles are currently set to

        // Particle shader material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: this.createParticleTexture() },
                opacity: { value: 0.0 },
                time: { value: 0.0 }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                
                varying vec3 vColor;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                uniform float opacity;
                
                varying vec3 vColor;
                
                void main() {
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    if (texColor.a < 0.1) discard;
                    gl_FragColor = vec4(vColor * texColor.rgb, texColor.a * opacity);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.particleSystem.visible = false; // Hidden by default
        this.particleSystem.frustumCulled = false;
        this.scene.add(this.particleSystem);

        Logger.info('UnifiedRingSystem', 'Particle system initialized with', particleCount, 'particles');
    }

    /**
     * Create a soft circular texture for particles
     */
    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Radial gradient for soft particle
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.6, 'rgba(220, 230, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(200, 220, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Update particle LOD based on camera distance
     */
    updateParticleLOD(camera) {
        // Find closest ringed planet
        let closestPlanetData = null;
        let closestDistance = Infinity;
        let closestKey = null;

        this.instances.forEach((data, key) => {
            const { planet, scale } = data;
            const distance = camera.position.distanceTo(planet.group.position);
            const normalizedDistance = distance / scale;

            if (normalizedDistance < closestDistance) {
                closestDistance = normalizedDistance;
                closestPlanetData = data;
                closestKey = key;
            }
        });

        // LOD threshold: show particles when camera is within 3x ring radius
        const lodThreshold = 3.0;
        const fadeStart = 2.5;
        const fadeEnd = 1.5;

        if (closestPlanetData && closestDistance < lodThreshold) {
            // Initialize particle system if needed
            if (!this.particleSystem) {
                this.initParticleSystem();
            }

            if (this.particleSystem) {
                const planet = closestPlanetData.planet;

                // Update geometry if planet changed
                if (this.currentParticlePlanet !== closestKey) {
                    this.currentParticlePlanet = closestKey;

                    // Get Ring Dimensions from our instance storage
                    const index = closestPlanetData.index;
                    const innerRadius = this.radii[index * 2];
                    const outerRadius = this.radii[index * 2 + 1];

                    // Update positions
                    const positions = this.particleSystem.geometry.attributes.position.array;

                    for (let i = 0; i < this.particleAngles.length; i++) {
                        const angle = this.particleAngles[i];
                        const rNorm = this.particleRadii[i];

                        // Map 0..1 to Inner..Outer with 10% padding to match texture visibility likely
                        // This fixes the "Balance" issue where points extend beyond the visible ring texture
                        const padding = 0.1;
                        const r = innerRadius + (padding + rNorm * (1.0 - padding * 2.0)) * (outerRadius - innerRadius);

                        // Height variation (thin disk)
                        const h = positions[i * 3 + 2]; // Z is height

                        positions[i * 3] = Math.cos(angle) * r;
                        positions[i * 3 + 1] = Math.sin(angle) * r;
                        positions[i * 3 + 2] = h;
                    }
                    this.particleSystem.geometry.attributes.position.needsUpdate = true;
                }

                // Calculate opacity based on distance
                let opacity = 0;
                if (closestDistance < fadeEnd) {
                    opacity = 1.0;
                } else if (closestDistance < fadeStart) {
                    opacity = 1.0 - (closestDistance - fadeEnd) / (fadeStart - fadeEnd);
                }

                this.particleSystem.visible = opacity > 0.01;
                this.particleSystem.material.uniforms.opacity.value = opacity;

                if (this.particleSystem.visible) {
                    // Position particle system at planet's ring location
                    this.particleSystem.position.copy(planet.group.position);

                    // Match ring rotation (Standardized logic from update())
                    this.particleSystem.rotation.x = -Math.PI / 2 + planet.tiltGroup.rotation.x;

                    // Reset scale to 1 because we baked the radius into the positions
                    this.particleSystem.scale.set(1, 1, 1);

                    // Animate particles (rotate them slowly)
                    // We can rotate the entire system around Y (local up) which is Z (visual up)
                    // But geometry isn't rotating, the Mesh object is.
                    // Let's add orbital rotation logic later if needed.
                }
            }
        } else if (this.particleSystem) {
            this.particleSystem.visible = false;
        }
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        if (this.atlasTexture) {
            this.atlasTexture.dispose();
        }
        if (this.particleSystem) {
            this.scene.remove(this.particleSystem);
            this.particleSystem.geometry.dispose();
            this.particleSystem.material.dispose();
        }
    }
}
