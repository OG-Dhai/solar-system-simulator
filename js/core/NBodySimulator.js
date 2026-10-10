/**
 * @fileoverview N-Körper-Physik-Simulator für Kometenverfolgung
 * 
 * Implementiert gravitationelle und nicht-gravitative Kräfte
 * für präzise Kometenbahnberechnungen.
 * 
 * @module NBodySimulator
 * @author Sonnensystem-Simulation
 */

import * as THREE from 'three';
import { GM_SUN } from '../utils/Constants.js';
import { calculateTotalAcceleration } from './OrbitalMechanics.js';

/** Gravitationskonstante in SI-Einheiten (m³⋅kg⁻¹⋅s⁻²) */
const G = 6.67430e-11;

/**
 * Repräsentiert einen Himmelskörper in der N-Körper-Simulation
 */
export class CelestialBody {
    constructor(name, mass, position, velocity, radius = 0) {
        this.name = name;
        this.mass = mass;           // kg
        this.position = position;   // THREE.Vector3 in Metern
        this.velocity = velocity;   // THREE.Vector3 in m/s
        this.radius = radius;       // Meter
        this.acceleration = new THREE.Vector3(); // m/s²
        this.previousAcceleration = new THREE.Vector3(); // Für Verlet-Integration
    }
    
    /**
     * Berechnet die gravitative Beschleunigung durch einen anderen Körper
     * @param {CelestialBody} other - Der andere Himmelskörper
     * @returns {THREE.Vector3} Beschleunigungsvektor
     */
    calculateGravitationalAcceleration(other) {
        if (other === this) return new THREE.Vector3();
        
        const direction = new THREE.Vector3().subVectors(other.position, this.position);
        const distanceSquared = direction.lengthSq();
        const distance = Math.sqrt(distanceSquared);
        
        // Division durch Null vermeiden bei Kollision
        if (distance < this.radius + other.radius) {
            return new THREE.Vector3();
        }
        
        // Gravitationskraft-Magnitude berechnen
        const forceMagnitude = G * other.mass / distanceSquared;
        
        // Richtungsvektor normalisieren und mit Kraft multiplizieren
        return direction.normalize().multiplyScalar(forceMagnitude);
    }
    
    /**
     * Aktualisiert den Zustand des Körpers mit gegebenem Zeitschritt
     * @param {number} dt - Zeitschritt in Sekunden
     */
    update(dt) {
        // Position mit Geschwindigkeit und Beschleunigung aktualisieren
        this.position.addScaledVector(this.velocity, dt)
                     .addScaledVector(this.acceleration, 0.5 * dt * dt);
        
        // Aktuelle Beschleunigung für nächste Iteration speichern
        this.previousAcceleration.copy(this.acceleration);
    }
    
    /**
     * Aktualisiert Geschwindigkeit nach Beschleunigungsberechnung
     * @param {THREE.Vector3} newAcceleration - Neuer Beschleunigungsvektor
     * @param {number} dt - Zeitschritt in Sekunden
     */
    updateVelocity(newAcceleration, dt) {
        // Durchschnitt von vorheriger und aktueller Beschleunigung
        const avgAcceleration = new THREE.Vector3()
            .addVectors(this.previousAcceleration, newAcceleration)
            .multiplyScalar(0.5);
            
        this.velocity.addScaledVector(avgAcceleration, dt);
        this.acceleration.copy(newAcceleration);
    }
}

/**
 * N-Körper-Physik-Simulator
 * 
 * Unterstützt verschiedene Integrationsverfahren:
 * - Euler (einfach, weniger genau)
 * - Velocity-Verlet (optimal für Orbitalmechanik)
 * - Runge-Kutta 4. Ordnung (höchste Genauigkeit)
 */
export class NBodySimulator {
    constructor() {
        this.bodies = [];
        this.time = 0; // Simulationszeit in Sekunden
        this.G = G;
        this.integrationMethod = 'verlet'; // Optionen: 'euler', 'verlet', 'rk4'
        
        // Für adaptive Zeitschrittsteuerung
        this.baseTimeStep = 86400; // 1 Tag in Sekunden
        this.minTimeStep = 3600;   // 1 Stunde
        this.maxTimeStep = 86400 * 7; // 1 Woche
    }
    
    /**
     * Fügt einen Himmelskörper zur Simulation hinzu
     * @param {CelestialBody} body - Der hinzuzufügende Himmelskörper
     */
    addBody(body) {
        this.bodies.push(body);
    }
    
    /**
     * Entfernt einen Himmelskörper aus der Simulation
     * @param {string} name - Name des zu entfernenden Körpers
     */
    removeBody(name) {
        this.bodies = this.bodies.filter(body => body.name !== name);
    }
    
    /**
     * Findet einen Körper nach Namen
     * @param {string} name - Name des Körpers
     * @returns {CelestialBody|null} Der Himmelskörper oder null
     */
    getBodyByName(name) {
        return this.bodies.find(body => body.name === name) || null;
    }
    
    /**
     * Berechnet Beschleunigungen für alle Körper
     * Berücksichtigt gravitative Wechselwirkungen und nicht-gravitative Kräfte
     */
    calculateAccelerations() {
        // Alle Beschleunigungen zurücksetzen
        for (const body of this.bodies) {
            body.acceleration.set(0, 0, 0);
        }
        
        // Gravitative Wechselwirkungen zwischen allen Paaren berechnen
        for (let i = 0; i < this.bodies.length; i++) {
            for (let j = i + 1; j < this.bodies.length; j++) {
                const body1 = this.bodies[i];
                const body2 = this.bodies[j];
                
                // Gegenseitige gravitative Beschleunigung berechnen
                const acc1_on_2 = body1.calculateGravitationalAcceleration(body2);
                const acc2_on_1 = body2.calculateGravitationalAcceleration(body1);
                
                // Beschleunigungen anwenden
                body2.acceleration.add(acc1_on_2);
                body1.acceleration.add(acc2_on_1);
            }
        }
        
        // Nicht-gravitative Kräfte für Kometen hinzufügen
        for (const body of this.bodies) {
            if (body.isComet) {
                const ngAccel = calculateTotalAcceleration(
                    body.position, 
                    body.velocity, 
                    body.nonGravParams || { A1: 0, A2: 0, A3: 0 }
                );
                
                body.acceleration.add(ngAccel);
            }
        }
    }
    
    /**
     * Führt einen einzelnen Integrationsschritt durch
     * @param {number} dt - Zeitschritt in Sekunden
     */
    integrate(dt) {
        this.calculateAccelerations();
        
        switch (this.integrationMethod) {
            case 'euler':
                this.integrateEuler(dt);
                break;
            case 'verlet':
                this.integrateVerlet(dt);
                break;
            case 'rk4':
                this.integrateRK4(dt);
                break;
            default:
                this.integrateVerlet(dt);
        }
        
        this.time += dt;
    }
    
    /**
     * Euler-Integrationsverfahren (einfach, weniger genau)
     * @param {number} dt - Zeitschritt in Sekunden
     */
    integrateEuler(dt) {
        for (const body of this.bodies) {
            // Position aktualisieren: r_neu = r_alt + v_alt * dt
            body.position.addScaledVector(body.velocity, dt);
            
            // Geschwindigkeit aktualisieren: v_neu = v_alt + a_alt * dt
            body.velocity.addScaledVector(body.acceleration, dt);
        }
    }
    
    /**
     * Velocity-Verlet-Integrationsverfahren (optimal für Orbitalmechanik)
     * @param {number} dt - Zeitschritt in Sekunden
     */
    integrateVerlet(dt) {
        for (const body of this.bodies) {
            const currentAccel = body.acceleration.clone();
            
            // Position: r_neu = r_alt + v_alt * dt + 0.5 * a_alt * dt²
            body.position.addScaledVector(body.velocity, dt)
                         .addScaledVector(currentAccel, 0.5 * dt * dt);
            
            // Geschwindigkeit: v_neu = v_alt + 0.5 * (a_alt + a_neu) * dt
            body.velocity.addScaledVector(
                new THREE.Vector3().addVectors(body.previousAcceleration, currentAccel).multiplyScalar(0.5), 
                dt
            );
            
            body.previousAcceleration.copy(currentAccel);
        }
    }
    
    /**
     * Runge-Kutta 4. Ordnung (höchste Genauigkeit, rechenintensiv)
     * @param {number} dt - Zeitschritt in Sekunden
     */
    integrateRK4(dt) {
        // Anfangszustand speichern
        const initialState = this.bodies.map(body => ({
            position: body.position.clone(),
            velocity: body.velocity.clone()
        }));
        
        // k1 berechnen
        const k1_velocities = [];
        const k1_positions = [];
        
        for (const body of this.bodies) {
            k1_velocities.push(body.velocity.clone());
            k1_positions.push(body.acceleration.clone());
        }
        
        // Temporäre Aktualisierung für k2
        for (let i = 0; i < this.bodies.length; i++) {
            this.bodies[i].position.addScaledVector(k1_velocities[i], dt / 2);
            this.bodies[i].velocity.addScaledVector(k1_positions[i], dt / 2);
        }
        
        this.calculateAccelerations();
        
        // k2 berechnen
        const k2_velocities = [];
        const k2_positions = [];
        
        for (let i = 0; i < this.bodies.length; i++) {
            k2_velocities.push(this.bodies[i].velocity.clone().sub(initialState[i].velocity));
            k2_positions.push(this.bodies[i].acceleration.clone());
        }
        
        // Für k3 zurücksetzen
        for (let i = 0; i < this.bodies.length; i++) {
            this.bodies[i].position.copy(initialState[i].position)
                           .addScaledVector(k1_velocities[i], dt / 2);
            this.bodies[i].velocity.copy(initialState[i].velocity)
                           .addScaledVector(k1_positions[i], dt / 2);
        }
        
        this.calculateAccelerations();
        
        // k3 berechnen
        const k3_velocities = [];
        const k3_positions = [];
        
        for (let i = 0; i < this.bodies.length; i++) {
            k3_velocities.push(this.bodies[i].velocity.clone().sub(initialState[i].velocity));
            k3_positions.push(this.bodies[i].acceleration.clone());
        }
        
        // Für k4 aktualisieren
        for (let i = 0; i < this.bodies.length; i++) {
            this.bodies[i].position.copy(initialState[i].position)
                           .addScaledVector(k2_velocities[i], dt);
            this.bodies[i].velocity.copy(initialState[i].velocity)
                           .addScaledVector(k2_positions[i], dt);
        }
        
        this.calculateAccelerations();
        
        // k4 berechnen
        const k4_velocities = [];
        const k4_positions = [];
        
        for (let i = 0; i < this.bodies.length; i++) {
            k4_velocities.push(this.bodies[i].velocity.clone().sub(initialState[i].velocity));
            k4_positions.push(this.bodies[i].acceleration.clone());
        }
        
        // Anfangszustand wiederherstellen und RK4-Formel anwenden
        for (let i = 0; i < this.bodies.length; i++) {
            this.bodies[i].position.copy(initialState[i].position);
            this.bodies[i].velocity.copy(initialState[i].velocity);
            
            // RK4-Formel anwenden
            this.bodies[i].position.addScaledVector(k1_velocities[i], dt / 6)
                                  .addScaledVector(k2_velocities[i], dt / 3)
                                  .addScaledVector(k3_velocities[i], dt / 3)
                                  .addScaledVector(k4_velocities[i], dt / 6);
                                  
            this.bodies[i].velocity.addScaledVector(k1_positions[i], dt / 6)
                                  .addScaledVector(k2_positions[i], dt / 3)
                                  .addScaledVector(k3_positions[i], dt / 3)
                                  .addScaledVector(k4_positions[i], dt / 6);
        }
    }
    
    /**
     * Simulation um ein Zeitintervall fortschreiten lassen
     * @param {number} duration - Zu simulierende Dauer in Sekunden
     * @param {number} stepSize - Zeitschritt in Sekunden (optional)
     */
    advance(duration, stepSize = null) {
        const step = stepSize || this.baseTimeStep;
        const steps = Math.ceil(duration / step);
        const actualStep = duration / steps;
        
        for (let i = 0; i < steps; i++) {
            this.integrate(actualStep);
        }
    }
    
    /**
     * Gibt die aktuelle Simulationszeit zurück
     * @returns {number} Aktuelle Simulationszeit in Sekunden
     */
    getTime() {
        return this.time;
    }
    
    /**
     * Setzt die Simulation auf den Anfangszustand zurück
     */
    reset() {
        this.time = 0;
        for (const body of this.bodies) {
            body.acceleration.set(0, 0, 0);
            body.previousAcceleration.set(0, 0, 0);
        }
    }
    
    /**
     * Setzt das Integrationsverfahren
     * @param {string} method - Integrationsverfahren ('euler', 'verlet', 'rk4')
     */
    setIntegrationMethod(method) {
        if (['euler', 'verlet', 'rk4'].includes(method)) {
            this.integrationMethod = method;
        } else {
            this.integrationMethod = 'verlet';
        }
    }
    
    /**
     * Gibt Statistiken über die Simulation zurück
     * @returns {Object} Statistik-Objekt
     */
    getStats() {
        return {
            bodyCount: this.bodies.length,
            time: this.time,
            integrationMethod: this.integrationMethod,
            totalMass: this.bodies.reduce((sum, body) => sum + body.mass, 0)
        };
    }
    
    /**
     * Serialisiert den aktuellen Simulationszustand
     * @returns {Object} Serialisierter Zustand
     */
    serialize() {
        return {
            time: this.time,
            integrationMethod: this.integrationMethod,
            bodies: this.bodies.map(body => ({
                name: body.name,
                mass: body.mass,
                position: { x: body.position.x, y: body.position.y, z: body.position.z },
                velocity: { x: body.velocity.x, y: body.velocity.y, z: body.velocity.z },
                radius: body.radius,
                isComet: body.isComet,
                nonGravParams: body.nonGravParams
            }))
        };
    }
    
    /**
     * Deserialisiert einen gespeicherten Zustand
     * @param {Object} state - Serialisiertes Zustandsobjekt
     */
    deserialize(state) {
        this.time = state.time;
        this.integrationMethod = state.integrationMethod;
        
        this.bodies = state.bodies.map(bodyData => {
            const body = new CelestialBody(
                bodyData.name,
                bodyData.mass,
                new THREE.Vector3(bodyData.position.x, bodyData.position.y, bodyData.position.z),
                new THREE.Vector3(bodyData.velocity.x, bodyData.velocity.y, bodyData.velocity.z),
                bodyData.radius
            );
            
            if (bodyData.isComet) {
                body.isComet = true;
                body.nonGravParams = bodyData.nonGravParams || { A1: 0, A2: 0, A3: 0 };
            }
            
            return body;
        });
    }
}

/**
 * Erstellt ein Sonnensystem-Modell mit Planeten für Störungsberechnungen
 * @returns {NBodySimulator} Vorkonfigurierter Simulator mit Sonnensystemkörpern
 */
export function createSolarSystemModel() {
    const simulator = new NBodySimulator();
    
    // Sonne hinzufügen
    const sun = new CelestialBody(
        'Sonne',
        1.98847e30, // kg
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        696340000   // Meter (Radius)
    );
    simulator.addBody(sun);
    
    // Hauptplaneten hinzufügen (vereinfacht für Störungsberechnungen)
    
    // Merkur
    const mercury = new CelestialBody(
        'Merkur',
        3.3011e23,
        new THREE.Vector3(57.9e9, 0, 0),
        new THREE.Vector3(0, 47.4e3, 0),
        2439700
    );
    simulator.addBody(mercury);
    
    // Venus
    const venus = new CelestialBody(
        'Venus',
        4.8675e24,
        new THREE.Vector3(0, 108.2e9, 0),
        new THREE.Vector3(-35.0e3, 0, 0),
        6051800
    );
    simulator.addBody(venus);
    
    // Erde
    const earth = new CelestialBody(
        'Erde',
        5.972e24,
        new THREE.Vector3(149.6e9, 0, 0),
        new THREE.Vector3(0, 29.8e3, 0),
        6371000
    );
    simulator.addBody(earth);
    
    // Mars
    const mars = new CelestialBody(
        'Mars',
        6.4171e23,
        new THREE.Vector3(0, 227.9e9, 0),
        new THREE.Vector3(-24.1e3, 0, 0),
        3389500
    );
    simulator.addBody(mars);
    
    // Jupiter (Hauptstörer für Kometen)
    const jupiter = new CelestialBody(
        'Jupiter',
        1.8982e27,
        new THREE.Vector3(778.5e9, 0, 0),
        new THREE.Vector3(0, 13.1e3, 0),
        69911000
    );
    simulator.addBody(jupiter);
    
    // Saturn
    const saturn = new CelestialBody(
        'Saturn',
        5.6834e26,
        new THREE.Vector3(0, 1432e9, 0),
        new THREE.Vector3(-9.7e3, 0, 0),
        58232000
    );
    simulator.addBody(saturn);
    
    // Uranus
    const uranus = new CelestialBody(
        'Uranus',
        8.6810e25,
        new THREE.Vector3(-2867e9, 0, 0),
        new THREE.Vector3(0, 6.8e3, 0),
        25362000
    );
    simulator.addBody(uranus);
    
    // Neptun
    const neptune = new CelestialBody(
        'Neptun',
        1.02413e26,
        new THREE.Vector3(0, -4515e9, 0),
        new THREE.Vector3(5.4e3, 0, 0),
        24622000
    );
    simulator.addBody(neptune);
    
    return simulator;
}
