import * as THREE from 'three';
import { RingsBase } from './RingsBase.js';

export class Jupiter_Rings extends RingsBase {
    constructor(planetRadius, config) {
        super(config, planetRadius);
        this.name = "Jupiter_Rings";
        // Update to webp
        this.texturePath = 'textures/jupiter_ring.webp';
        this.init();
    }

    createGeometry() {
        const innerRadius = this.planetRadius * 1.4;
        const outerRadius = this.planetRadius * 2.3;
        return new THREE.RingGeometry(innerRadius, outerRadius, 128, 1);
    }

    createMaterial() {
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(this.texturePath);
        texture.rotation = Math.PI / 2;

        return new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: texture },
                uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
                uPlanetPosition: { value: new THREE.Vector3(0, 0, 0) },
                uPlanetRadius: { value: this.planetRadius },
                uColor: { value: new THREE.Color(0xccbba0) }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vWorldPosition;
                void main() {
                    vUv = uv;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                uniform vec3 uSunPosition;
                uniform vec3 uPlanetPosition;
                uniform float uPlanetRadius;
                uniform vec3 uColor;
                varying vec2 vUv;
                varying vec3 vWorldPosition;

                float getShadow() {
                    vec3 toSun = normalize(uSunPosition - vWorldPosition);
                    vec3 toPlanet = uPlanetPosition - vWorldPosition;
                    float projection = dot(toPlanet, toSun);
                    if (projection < 0.0) return 1.0;
                    vec3 closestPoint = vWorldPosition + toSun * projection;
                    float dist = distance(closestPoint, uPlanetPosition);
                    return smoothstep(uPlanetRadius * 0.95, uPlanetRadius, dist);
                }

                float getScattering(vec3 viewDir, vec3 lightDir) {
                    float dotVL = dot(viewDir, lightDir);
                    float forward = pow(0.5 + 0.5 * dotVL, 6.0) * 3.0;
                    float backward = 0.5 + 0.5 * dotVL;
                    return 0.2 + backward * 0.4 + forward * 0.6;
                }

                void main() {
                    vec4 texColor = texture2D(uTexture, vec2(vUv.x, 0.5));
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    vec3 lightDir = normalize(uSunPosition - vWorldPosition);
                    
                    float shadow = getShadow();
                    float scattering = getScattering(viewDir, lightDir);

                    vec3 finalColor = texColor.rgb * uColor * scattering * shadow;
                    gl_FragColor = vec4(finalColor, texColor.a * 0.8);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
    }

    update(dt) {
        if (this.mesh && this.mesh.material.uniforms) {
            this.mesh.material.uniforms.uSunPosition.value.set(0, 0, 0);
            const worldPos = new THREE.Vector3();
            if (this.mesh.parent) this.mesh.parent.getWorldPosition(worldPos);
            this.mesh.material.uniforms.uPlanetPosition.value.copy(worldPos);
            this.mesh.rotation.z += 0.0001;
        }
    }
}
