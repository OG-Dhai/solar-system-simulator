/**
 * @fileoverview Base class for all celestial bodies.
 * @module CelestialBody
 */

import * as THREE from 'three';
import { degToRad } from '../utils/MathHelpers.js';
import { GAS_GIANTS, SECONDS_PER_DAY, ROTATION_VISUAL_MULTIPLIER } from '../utils/Constants.js';
import { Logger } from '../utils/Logger.js';

/**
 * Base class for celestial bodies (Sun, planets, moons).
 */
export class CelestialBody {
    constructor(data, key) {
        if (!data || !key) Logger.error('CelestialBody', 'Missing required data or key');
        this.key = key;
        this.data = data;
        this.name = data.name || 'Unknown';
        this.type = data.type || 'unknown';
        this.radius = data.radius || 1;
        this.physicalRadius = data.physical?.radius || data.radius || 1; // Store physical radius in km
        this.color = data.color;
        this.rotationPeriod = data.rotationPeriod || 1;
        this.axialTilt = data.axialTilt || 0;
        this.mesh = null;
        this.group = new THREE.Group();
        this.group.name = this.name;
        this.group.userData = { key, type: this.type, body: this };
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.rotationAngle = 0;
        this._worldPosCache = new THREE.Vector3();
        this.lodLevels = { HIGH: 64, MEDIUM: 32, LOW: 16 };
        this.lodThresholdsSq = { HIGH: 1000 * 1000, MEDIUM: 5000 * 5000 };
        this.currentLODLevel = 'MEDIUM';
        this.geometryCache = {};
        this.createLODGeometries();
        this.createMesh();
    }

    createMesh() {
        const geometry = this.geometryCache[this.currentLODLevel];
        const material = this.createMaterial();
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData = { key: this.key, type: this.type, body: this };
        this.mesh.rotation.z = degToRad(this.axialTilt);
        this.group.add(this.mesh);
    }

    createLODGeometries() {
        const levels = ['HIGH', 'MEDIUM', 'LOW'];
        for (const level of levels) {
            const segments = this.lodLevels[level];
            const geometry = new THREE.SphereGeometry(this.radius, segments, segments);
            geometry.computeBoundingSphere();
            this.geometryCache[level] = geometry;
        }
    }

    updateLOD(distance) {
        this.updateLODSquared(distance * distance);
    }

    updateLODSquared(distanceSq) {
        let newLODLevel;
        if (distanceSq < this.lodThresholdsSq.HIGH) newLODLevel = 'HIGH';
        else if (distanceSq < this.lodThresholdsSq.MEDIUM) newLODLevel = 'MEDIUM';
        else newLODLevel = 'LOW';

        if (newLODLevel !== this.currentLODLevel && this.mesh) {
            this.currentLODLevel = newLODLevel;
            this.mesh.geometry = this.geometryCache[newLODLevel];
        }
    }

    /**
     * Convenience method to update LOD using camera position directly.
     * @param {THREE.Camera} camera - The camera to calculate distance from
     */
    updateLODWithCamera(camera) {
        if (!camera || !this.group) return;
        const distSq = this.group.position.distanceToSquared(camera.position);
        this.updateLODSquared(distSq);
    }

    /**
     * Get the physical radius in kilometers
     * @returns {number} Physical radius in km
     */
    getPhysicalRadius() {
        return this.physicalRadius || this.radius;
    }

    createMaterial() {
        const isGasGiant = GAS_GIANTS.includes(this.name);
        const baseColor = this.color ?? 0xffffff;
        const material = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: isGasGiant ? 1.0 : 0.4,
            metalness: isGasGiant ? 0.0 : 0.2,
            emissive: 0x000000,
            emissiveIntensity: 0
        });
        if (this.name === "Earth") {
            material.roughness = 0.5;
            material.metalness = 0.1;
        }
        return material;
    }

    update(deltaTime, timeSpeed) {
        if (!this.mesh) return;
        // Check if PHYSICS_CONSTANTS is available, otherwise allow for safe fallback/import check
        const secondsPerDay = SECONDS_PER_DAY || 86400;
        const rotationMult = ROTATION_VISUAL_MULTIPLIER || 1000;

        const rotationSpeed = (2 * Math.PI) / (Math.abs(this.rotationPeriod) * secondsPerDay);
        const direction = this.rotationPeriod < 0 ? -1 : 1;
        this.rotationAngle += rotationSpeed * deltaTime * timeSpeed * direction * rotationMult;
        this.rotationAngle %= (Math.PI * 2);
        this.mesh.rotation.y = this.rotationAngle;
    }

    getPosition() {
        this.group.getWorldPosition(this._worldPosCache);
        return this._worldPosCache;
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }

    getGroup() { return this.group; }
    getMesh() { return this.mesh; }

    dispose() {
        if (this.mesh) {
            Object.values(this.geometryCache).forEach(geometry => geometry.dispose());
            this.geometryCache = {};
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) this.mesh.material.forEach(mat => this.disposeMaterial(mat));
                else this.disposeMaterial(this.mesh.material);
            }
        }
        if (this.group.parent) this.group.parent.remove(this.group);
    }

    disposeMaterial(material) {
        if (!material) return;
        const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'bumpMap', 'aoMap', 'alphaMap'];
        textureProps.forEach(prop => {
            if (material[prop]) material[prop].dispose();
        });
        material.dispose();
    }

    setOrbitVisible(visible) {
        if (this.orbitLine) this.orbitLine.visible = visible;
    }
}
export default CelestialBody;
