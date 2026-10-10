/**
 * Comet Visualization Layer
 * "NASA-Level" Realistic Visuals for Halley's Comet
 * Uses procedural volumetric shaders for Coma, Ion Tail, and Dust Tail.
 */

import * as THREE from 'three';
import { calculateWaterProductionRate } from './OrbitalMechanics.js';

// ===============================================================================================================
// SHADERS (High Fidelity)
// ===============================================================================================================

/**
 * COMA SHADER (Vertex)
 * Standard billboard sprite vertex shader
 */
const comaVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    
    void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

/**
 * COMA SHADER (Fragment)
 * Simulates a volumetric glowing gas ball with internal turbulence
 */
const comaFragmentShader = `
    uniform float time;
    uniform vec3 coreColor;
    uniform vec3 outerColor;
    uniform float opacity;
    uniform float turbulenceScale;
    
    varying vec2 vUv;
    
    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        // Distance from center (0.5, 0.5)
        vec2 center = vec2(0.5);
        float dist = length(vUv - center) * 2.0; // 0 at center, 1 at edge
        
        // Discard outer edges
        if (dist > 1.0) discard;
        
        // Generate dynamic noise
        // Warping the coordinates slightly over time to simulate gas flow
        float n = snoise(vUv * 3.0 + time * 0.5);
        
        // Radial falloff (Glow profile)
        // 1.0 / (dist^2) looks very physically accurate for light/gas density but needs clamping
        float glow = 1.0 - pow(dist, 1.5);
        glow += n * 0.1 * glow; // Add turbulence to the glow
        
        // Intensity core
        float coreIntensity = smoothstep(0.8, 0.0, dist);
        
        // Color mixing
        vec3 finalColor = mix(outerColor, coreColor, coreIntensity * coreIntensity);
        
        // Alpha calculation
        // High opacity at center, very transparent at edges
        float alpha = glow * opacity;
        alpha = clamp(alpha, 0.0, 1.0);
        
        // Premultiplied alpha-ish look (additive blending handled by material settings)
        gl_FragColor = vec4(finalColor, alpha);
    }
`;

/**
 * ION TAIL SHADER (Fragment)
 * Electric, flowing plasma
 */
const ionTailFragmentShader = `
    uniform float time;
    uniform vec3 color;
    uniform float opacity;
    varying vec2 vUv;
    
    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        // High frequency noise for "streamers"
        // Flowing along Y (along the tail length)
        float noise1 = snoise(vec2(vUv.x * 10.0, vUv.y * 2.0 - time * 3.0));
        float noise2 = snoise(vec2(vUv.x * 5.0, vUv.y * 1.5 - time * 2.0));
        
        float combinedNoise = (noise1 + noise2) * 0.5;
        
        // Intensity fades out towards the end (bottom of texture)
        // Harder falloff for ion tail (it disconnects sometimes)
        float tailFade = 1.0 - smoothstep(0.1, 1.0, vUv.y);
        
        // Intensity fades out at the edges (sides of cylinder) to mimic a volumetric beam
        float sideFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
        sideFade = pow(sideFade, 2.0); // Sharper beam
        
        // Core brightening
        float coreBeam = 1.0 - abs(vUv.x - 0.5) * 4.0;
        coreBeam = max(0.0, coreBeam);

        // Combine for alpha
        float alpha = (0.2 + 0.8 * combinedNoise) * tailFade * sideFade;
        alpha += coreBeam * 0.5 * tailFade; // Add solid core
        
        // Color variation: Core is white/cyan, edges are deep blue
        vec3 finalColor = mix(color, vec3(0.8, 0.9, 1.0), coreBeam);

        gl_FragColor = vec4(finalColor, alpha * opacity);
    }
`;

/**
 * DUST TAIL SHADER (Fragment)
 * Diffuse, particulate, billowing dust
 */
const dustTailFragmentShader = `
    uniform float time;
    uniform vec3 color;
    uniform float opacity;
    varying vec2 vUv;

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        // Dust moves slower and is cloudy (low frequency noise)
        float noise = snoise(vec2(vUv.x * 2.5, vUv.y * 0.8 - time * 0.2));
        float detailNoise = snoise(vec2(vUv.x * 8.0, vUv.y * 3.0 - time * 0.4));
        
        // Soft edges
        float sideFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
        sideFade = smoothstep(0.0, 0.5, sideFade);
        
        // Length fade
        float lengthFade = 1.0 - smoothstep(0.4, 1.0, vUv.y); 
        
        // Combine: Base opacity + noise variation
        float alpha = sideFade * lengthFade;
        
        // Add "clumping"
        alpha *= (0.7 + 0.3 * noise + 0.1 * detailNoise);
        
        // Reduce overall opacity for dust (it's diffuse)
        gl_FragColor = vec4(color, alpha * opacity * 0.8);
    }
`;

/**
 * Standard Vertex Shader for tails
 */
const tailVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;


// ===============================================================================================================
// CREATION FUNCTIONS
// ===============================================================================================================

/**
 * Creates a realistic comet nucleus
 * Updated to be an irregular "peanut" shape (not a sphere) based on Giotto data
 * @param {number} radius - Base visual radius of the nucleus
 * @returns {THREE.Mesh} The nucleus mesh
 */
// FINAL VISIBILITY FIX: SCALED PEANUT GEOMETRY
export function createCometNucleus(radius = 0.1) {
    // VISIBILITY FIX: Bright Self-Illuminated Peanut (Bi-Lobed)

    // We use a Group to hold the two lobes
    const nucleusGroup = new THREE.Group();
    nucleusGroup.name = 'nucleus'; // Important for retrieval
    nucleusGroup.userData.rotationSpeed = { x: 0.005, y: 0.015, z: 0.002 };

    // Load Official Texture (halley.webp)
    const textureLoader = new THREE.TextureLoader();
    const cometTexture = textureLoader.load('textures/halley.webp'); // Switched to correct asset
    // Ensure accurate color rendering
    cometTexture.colorSpace = THREE.SRGBColorSpace;
    // Fix orientation if needed (webp often needs flipY depending on source)
    // cometTexture.flipY = false;

    // VISIBILITY FIX: Use Basic Material for direct image visibility
    // Standard/Emissive was causing "glitchy black" look due to lighting calculations
    const material = new THREE.MeshBasicMaterial({
        map: cometTexture,
        color: 0xffffff, // Pure white to show exact texture colors
        side: THREE.DoubleSide
    });

    // Helper to create a distorted lobe
    // Helper to create a smooth lobe
    function createLobe(rad, xOffset, scaleVec) {
        // Use SphereGeometry for smooth surface and correct texture UVs
        const geometry = new THREE.SphereGeometry(rad, 64, 64);

        // No manual noise distortion to prevent "spiky" artifacts
        // The texture itself will provide the detail

        geometry.scale(scaleVec.x, scaleVec.y, scaleVec.z);
        geometry.translate(xOffset, 0, 0);

        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 999;
        return mesh;
    }

    // LOBE 1: The Big Body (Radius ~1.1)
    // User requested "Increase size a bit". Increased from 0.8 to 1.1 (+37%).
    const lobe1 = createLobe(1.1, -0.4, new THREE.Vector3(1.2, 1.0, 1.0));
    nucleusGroup.add(lobe1);

    // LOBE 2: The Smaller Head (Radius ~0.7)
    // Increased from 0.5 to 0.7 (+40%).
    const lobe2 = createLobe(0.7, 0.5, new THREE.Vector3(1.1, 0.9, 0.9));
    nucleusGroup.add(lobe2);

    // Initial orientation tilt
    nucleusGroup.rotation.z = Math.PI / 6;

    return nucleusGroup;
}

/**
 * Creates a volumetric comet coma
 * @param {number} size - Size of the coma
 * @returns {THREE.Sprite} The coma sprite
 */
export function createCometComa(size = 1.0) {
    // VISIBILITY FIX: 3D HALF-EGG (Hemisphere)
    // User requested "Half Egg covering the front" and "Aligned" (Centered).
    // 0 to PI/2 creates a Hemisphere (Dome).
    const geometry = new THREE.SphereGeometry(1.0, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);

    // ALIGNMENT FIX: Shift flat face BACK so Nucleus (at 0,0,0) is INSIDE the dome.
    // Originally Y=0 is base. Shift Y down by 0.3.
    geometry.translate(0, -0.3, 0);

    // Rotate so the Dome (originally +Y) points to +Z (Forward/Look Direction)
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            coreColor: { value: new THREE.Color(0xccffff) }, // Cyan-White center
            outerColor: { value: new THREE.Color(0x0066aa) }, // Deep Blue edge
            opacity: { value: 1.0 },
            turbulenceScale: { value: 1.0 }
        },
        vertexShader: comaVertexShader,
        fragmentShader: comaFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide // To see the curves from inside/outside correctly with shaders? 
        // Using DoubleSide to be safe for a shell.
    });
    material.side = THREE.DoubleSide;

    // Mesh instead of Sprite
    const coma = new THREE.Mesh(geometry, material);

    // Scale to be HALF-EGG (Smaller & Aligned):
    // Radius ~ size, Length ~ size * 2.0
    // Reduced default size to avoid "huge" look if passed raw.
    coma.scale.set(size, size, size * 2.0);

    coma.name = 'coma';
    coma.visible = true;

    return coma;
}

/**
 * Creates a comet's ion tail (plasma tail)
 * @param {number} length - Length of the tail
 * @param {number} width - Width of the tail
 * @returns {THREE.Mesh} The ion tail mesh
 */
export function createIonTail(length = 25, width = 1.0) { // Increased default length
    // Open ended cylinder, slightly tapered
    const geometry = new THREE.CylinderGeometry(width * 0.2, width * 1.5, length, 32, 20, true);

    // Orientation: Points +Z
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, length / 2);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0x4488ff) }, // Standard Plasma Blue
            opacity: { value: 1.0 }
        },
        vertexShader: tailVertexShader,
        fragmentShader: ionTailFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const ionTail = new THREE.Mesh(geometry, material);
    ionTail.name = 'ionTail';
    ionTail.userData.isVolumetric = true;

    return ionTail;
}

/**
 * Creates a comet's dust tail
 * @param {number} length - Length of the tail
 * @param {number} width - Width of the tail
 * @returns {THREE.Mesh} The dust tail mesh
 */
export function createDustTail(length = 60, width = 0.5) {
    // Seamless Integration: Start width matches Nucleus (approx 0.8 diameter visually)
    // CylinderGeometry(radiusTop, radiusBottom, height...)
    // RadiusTop = width * 0.8 (Matches nucleus) -> Fades out to width * 3.0 (Fan)
    const geometry = new THREE.CylinderGeometry(width * 0.8, width * 3.0, length, 32, 20, true);

    // Orientation: Points +Z
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, length / 2);

    // Flatten it to look more like a fan
    geometry.scale(1.8, 0.4, 1.0);

    // Bend the geometry slightly to simulate orbital lag? 
    // This is hard to do statically without complex vertex shader.
    // We'll rely on rotation in the update loop for the main "curve".

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0xffddaa) }, // Golden/Yellowish
            opacity: { value: 0.8 }
        },
        vertexShader: tailVertexShader,
        fragmentShader: dustTailFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending // Dust reflects light, but additive looks "glowy"
        // Standard blending might block objects behind, Additive is better for "haze"
    });

    const dustTail = new THREE.Mesh(geometry, material);
    dustTail.name = 'dustTail';

    return dustTail;
}

/**
 * Creates a particle system for dust trail
 * @param {number} particleCount - Number of particles
 * @returns {THREE.Points} The dust trail particle system
 */
export function createDustTrail(particleCount = 1000) { // More particles
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    // Add velocity/randomness attribute?

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

        sizes[i] = 0.05 + Math.random() * 0.1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        color: 0xffeeaa,
        size: 0.1,
        sizeAttenuation: true, // Particles shrink with distance
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const dustTrail = new THREE.Points(geometry, material);
    dustTrail.name = 'dustTrail';

    return dustTrail;
}

/**
 * Creates a complete comet visualization group
 * @param {number} nucleusRadius - Radius of the nucleus
 * @returns {THREE.Group} The complete comet visualization group
 */
export function createCometVisualization(nucleusRadius) {
    const cometGroup = new THREE.Group();
    cometGroup.name = 'CometVisuals';

    // 1. Nucleus (The "Peanut")
    // Note: createCometNucleus ignores the radius arg and uses hardcoded visual scale
    const nucleus = createCometNucleus(nucleusRadius);
    cometGroup.add(nucleus);

    // 2. Coma (The "Cloud") - Re-enabled and Scaled
    // Nucleus radius is ~1.5. Coma should be ~30-50 visual size.
    const coma = createCometComa(30.0);
    cometGroup.add(coma);

    // 3. Ion Tail (The "Beam") - Significantly Shortened per user request
    // Length: 25. Width: 0.4.
    const ionTail = createIonTail(25, 0.4);
    cometGroup.add(ionTail);

    // 4. Dust Tail (The "Fan") - Significantly Shortened per user request
    // Length: 20. Width: 0.5.
    const dustTail = createDustTail(20, 0.5);
    cometGroup.add(dustTail);

    return cometGroup;
}

// ===============================================================================================================
// LOGIC/UPDATE FUNCTIONS
// ===============================================================================================================

/**
 * Updates the visual properties of a comet based on its physical state
 * @param {THREE.Group} cometGroup - The comet group containing all visual elements
 * @param {Object} state - The physical state of the comet {position, velocity, distanceFromSun}
 * @param {number} simulationTime - Current simulation time
 * @param {boolean} isOutbound - Whether the comet is outbound from perihelion
 */
export function updateCometVisuals(cometGroup, state, simulationTime, isOutbound) {
    // 1. Update Nucleus Rotation
    const nucleus = cometGroup.getObjectByName('nucleus');
    if (nucleus) {
        nucleus.rotation.x += nucleus.userData.rotationSpeed.x;
        nucleus.rotation.y += nucleus.userData.rotationSpeed.y;
        nucleus.rotation.z += nucleus.userData.rotationSpeed.z;
        nucleus.visible = true; // FORCE ON
    }

    const distanceFromSunAU = state.distanceFromSun || 10.0;

    // RADICAL FIX v5: GEOMETRY ALIGNMENT - FLIPPED
    // User requested EXACT OPPOSITE of previous state.
    // Previous: velocity.normalize().negate() -> Resulted in Tail Pointing Front (Wrong).
    // New: velocity.normalize() (No Negate) -> Should point Tail Behind.

    const worldPos = new THREE.Vector3();
    cometGroup.getWorldPosition(worldPos);

    // MATRIX 1: MOVEMENT DIRECTION (For the Head/Coma)
    // The Nucleus/Coma should face where it is going.
    const velocity = state.velocity ? state.velocity.clone() : new THREE.Vector3(0, 0, 1);
    const moveDir = velocity.clone().normalize();
    // const headTarget = worldPos.clone().add(moveDir.multiplyScalar(10000.0)); // Original headTarget

    // MATRIX 2: TAIL DIRECTION (Visual Preference: TRAIL BEHIND)
    // User requested "Tail Behind, Head Front".
    // Diagnosis: state.velocity appears to be REARWARD relative to the screen visual motion.
    // So we FLIP everything 180 degrees to align with visual reality.

    // Previous: Head -> Velocity (Result: Backwards)
    // New: Head -> -Velocity (Should be Forward)
    const moveDirScale = -10000.0; // Negate to flip

    const headDirection = velocity.clone().normalize();
    const headTarget = worldPos.clone().add(headDirection.multiplyScalar(moveDirScale));

    // Previous: Tail -> -Velocity
    // New: Tail -> Velocity (Should be Backward if Velocity is Backward)
    const tailTarget = worldPos.clone().add(headDirection.multiplyScalar(-moveDirScale));

    // 2. COMA (The Head) -> Faces Visual Front
    const coma = cometGroup.getObjectByName('coma');
    if (coma) {
        coma.visible = true;

        // VISIBILITY FIX: Apply 3D Scaling for "Half-Egg Shape"
        const scale = Math.max(12.0, 40.0 / (distanceFromSunAU + 0.1));
        coma.scale.set(scale, scale, scale * 2.0);

        // Orientation
        coma.lookAt(headTarget);

        if (coma.material.uniforms) {
            coma.material.uniforms.time.value = simulationTime;
            coma.material.uniforms.opacity.value = Math.max(0.4, 1.0 - distanceFromSunAU / 20.0);
        }
    }

    // 3. ION TAIL (Blue) -> Trails Behind
    const ionTail = cometGroup.getObjectByName('ionTail');
    if (ionTail) {
        ionTail.visible = true;
        ionTail.lookAt(tailTarget);

        if (ionTail.material.uniforms) {
            ionTail.material.uniforms.time.value = simulationTime * 2.0;
            ionTail.material.uniforms.opacity.value = Math.max(0.5, 1.0 - distanceFromSunAU / 15.0);
        }
    }

    // 4. DUST TAIL (Yellow)
    const dustTail = cometGroup.getObjectByName('dustTail');
    if (dustTail) {
        dustTail.visible = true;
        // Visual Preference: Trail behind the head
        dustTail.lookAt(tailTarget);

        if (dustTail.material.uniforms) {
            dustTail.material.uniforms.time.value = simulationTime * 0.5;
            dustTail.material.uniforms.opacity.value = Math.max(0.4, 1.0 - distanceFromSunAU / 15.0);
        }
    }
}

/**
 * Creates a trail of past positions for the comet
 * @param {number} maxPoints - Maximum number of points to store
 * @returns {THREE.Line} The orbit trail line
 */
export function createCometOrbitTrail(maxPoints = 500) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.5
    });

    const trail = new THREE.Line(geometry, material);
    trail.name = 'cometOrbitTrail';
    trail.userData.maxPoints = maxPoints;
    trail.userData.currentCount = 0;

    return trail;
}

/**
 * Updates the comet's orbit trail with a new position
 * @param {THREE.Line} trail - The orbit trail line
 * @param {THREE.Vector3} position - New position to add to the trail
 */
export function updateCometOrbitTrail(trail, position) {
    const geometry = trail.geometry;
    const positions = geometry.attributes.position.array;
    const maxPoints = trail.userData.maxPoints;
    let currentCount = trail.userData.currentCount || 0;

    if (currentCount < maxPoints) {
        positions[currentCount * 3] = position.x;
        positions[currentCount * 3 + 1] = position.y;
        positions[currentCount * 3 + 2] = position.z;
        currentCount++;
        trail.userData.currentCount = currentCount;
        geometry.setDrawRange(0, currentCount);
    } else {
        positions.copyWithin(0, 3, maxPoints * 3);
        const lastIndex = (maxPoints - 1) * 3;
        positions[lastIndex] = position.x;
        positions[lastIndex + 1] = position.y;
        positions[lastIndex + 2] = position.z;
        geometry.setDrawRange(0, maxPoints);
    }

    geometry.attributes.position.needsUpdate = true;
    if (currentCount % 60 === 0) geometry.computeBoundingSphere();
}
