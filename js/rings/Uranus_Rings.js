import * as THREE from 'three';
import { RingsBase } from './RingsBase.js';

export class Uranus_Rings extends RingsBase {
    constructor(planetRadius, config) {
        super(config, planetRadius);
        this.name = "Uranus_Rings";
        // Update to webp
        this.texturePath = 'textures/uranus_ring.webp';
        this.init();
    }

    createGeometry() {
        return new THREE.RingGeometry(this.planetRadius * 1.5, this.planetRadius * 2.8, 128, 1);
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
                uColor: { value: new THREE.Color(0x333333) }
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
                    float forward = pow(0.5 + 0.5 * dotVL, 4.0) * 1.5; 
                    float backward = 0.5 + 0.5 * dotVL;
                    return 0.1 + backward * 0.3 + forward * 0.4;
                }

                void main() {
                    vec4 texColor = texture2D(uTexture, vec2(vUv.x, 0.5));
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    vec3 lightDir = normalize(uSunPosition - vWorldPosition);
                    
                    float shadow = getShadow();
                    float scattering = getScattering(viewDir, lightDir);

                    vec3 finalColor = texColor.rgb * uColor * scattering * shadow * 2.0;
                    gl_FragColor = vec4(finalColor, texColor.a);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.NormalBlending
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
