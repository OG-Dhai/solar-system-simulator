/**
 * @fileoverview Atmosphären-Streuungs-Shader
 * 
 * Implementiert Rayleigh-Streuung für realistische Erdatmosphären-Darstellung.
 * Erzeugt das blaue Himmelsleuchten auf der beleuchteten Seite, orange am Terminator,
 * und dunkel auf der Nachtseite.
 * 
 * @module shaders/AtmosphereShader
 * 
 * @theorie
 * Rayleigh-Streuung beschreibt, wie Licht streut wenn es mit Partikeln interagiert,
 * die kleiner als die Wellenlänge des Lichts sind (Luftmoleküle).
 * 
 * Kürzere Wellenlängen (blau) streuen stärker als längere Wellenlängen (rot):
 *   I_streuung ∝ 1/λ⁴
 * 
 * Dies erzeugt:
 *   - Blauen Himmel auf der beleuchteten Seite (gestreutes blaues Licht)
 *   - Orange/rot am Terminator (Pfad durch mehr Atmosphäre)
 *   - Dunkel auf der Nachtseite (keine Sonne zum Streuen)
 * 
 * @referenzen
 * - Nishita, T. et al. "Display of The Earth Taking into Account Atmospheric Scattering"
 * - GPU Gems 2, Kapitel 16: Accurate Atmospheric Scattering
 */

import * as THREE from 'three';

/**
 * Vertex-Shader für Atmosphäre
 * Übergibt Weltposition und Normale an Fragment-Shader
 */
const atmosphereVertexShader = /* glsl */`
    #include <common>

    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;

    void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

/**
 * Fragment-Shader für Atmosphäre
 * Berechnet Rayleigh-Streuung basierend auf Blickwinkel und Sonnenrichtung
 */
const atmosphereFragmentShader = /* glsl */`
    #include <common>

    uniform vec3 sunPosition;
    uniform vec3 planetCenter;
    uniform float planetRadius;
    uniform float atmosphereRadius;

    // Rayleigh-Streuungskoeffizienten (wellenlängenabhängig)
    // Blau streut mehr als rot: λ_blau < λ_rot → 1/λ⁴ höher für blau
    uniform vec3 rayleighCoefficients;

    // Farben für atmosphärisches Leuchten
    uniform vec3 sunColor;
    // uniform vec3 cameraPosition; // Redundant: Wird von Three.js ShaderMaterial bereitgestellt

    // Ambient-Licht-Unterstützung
    uniform vec3 ambientLightColor;
    uniform float ambientIntensity;

    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;

    void main() {
        // Richtung vom Planetenzentrum zu diesem Atmosphärenpunkt
        vec3 toAtmosphere = normalize(vWorldPosition - planetCenter);

        // Richtung vom Atmosphärenpunkt zur Sonne
        vec3 toSun = normalize(sunPosition - vWorldPosition);

        // Blickrichtung (von Kamera zu Punkt)
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        // === Rayleigh-Phasenfunktion ===
        // Streuung ist stärker bei 0° und 180° von der Lichtquelle
        float cosTheta = dot(toSun, viewDir);
        float rayleighPhase = 0.75 * (1.0 + cosTheta * cosTheta);

        // === Limben-Abdunklung / -Aufhellung ===
        // Fresnel-ähnlicher Effekt: Atmosphäre ist bei streifenden Winkeln sichtbarer
        float viewDotNormal = dot(viewDir, vWorldNormal);
        float limbFactor = 1.0 - abs(viewDotNormal);
        limbFactor = pow(limbFactor, 1.5); // Limben-Effekt schärfen

        // === Tag/Nacht-Faktor ===
        // Wie sehr dieser Punkt der Sonne zugewandt ist
        float sunFacing = dot(vWorldNormal, toSun);

        // Sanfter Übergang am Terminator (-0.2 bis 0.3 gibt schöne Dämmerung)
        float dayFactor = smoothstep(-0.2, 0.3, sunFacing);

        // === Atmosphärische Weglänge ===
        // Licht durchquert mehr Atmosphäre an den Rändern
        float atmosphericDepth = atmosphereRadius - planetRadius;
        // Epsilon relativ zum Planetenradius verwenden um kleine Monde wie Titan zu unterstützen
        float epsilon = max(planetRadius * 0.001, 0.00001);
        float pathMultiplier = atmosphericDepth / max(abs(viewDotNormal) * planetRadius, epsilon);
        pathMultiplier = clamp(pathMultiplier, 0.0, 4.0);

        // === Farbberechnung ===
        // Rayleigh-Koeffizienten anwenden (mehr blaue Streuung)
        vec3 scatterColor = rayleighCoefficients * rayleighPhase;

        // Mit Sonnenfarbe für Gesamtton mischen
        vec3 atmosphereColor = sunColor * scatterColor;

        // === Terminator-Verstärkung ===
        // Am Terminator durchquert Licht maximale Atmosphäre
        // Dies erzeugt das orange/rote "Sonnenuntergangs"-Leuchten
        float terminatorFactor = 1.0 - abs(sunFacing);
        terminatorFactor = smoothstep(0.0, 0.5, terminatorFactor);

        // Warme Farben am Terminator hinzufügen (rot/orange von Rayleigh)
        vec3 terminatorColor = vec3(1.0, 0.6, 0.3) * terminatorFactor * 0.5;

        // === Ambient-Licht-Beitrag ===
        // Sicherstellen dass Nachtseite nicht pechschwarz ist durch Ambient-Licht
        vec3 ambientTerm = ambientLightColor * ambientIntensity * rayleighCoefficients * 0.5;

        // === Endkomposition ===
        float intensity = limbFactor * pathMultiplier * dayFactor;
        intensity = clamp(intensity, 0.0, 1.0);

        // Direkte Sonnenstreuung + Ambient mischen
        // Ambient wird unabhängig von Tag/Nacht hinzugefügt, aber durch Limbenfaktor skaliert für gasiges Aussehen
        vec3 finalColor = (atmosphereColor * intensity) + (terminatorColor * dayFactor * limbFactor) + (ambientTerm * limbFactor * 0.3);

        // Alpha: sichtbar am Limb, verblasst zur Mitte.
        // Modifiziert um Ambient-Sichtbarkeit auf Nachtseite zu erlauben
        float alpha = limbFactor * (0.3 + dayFactor * 0.7 + ambientIntensity * 0.2);
        alpha = clamp(alpha, 0.05, 1.0); // Erhöhte minimale und maximale Opazität

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

/**
 * Erstellt ein atmosphärisches Streuungsmaterial für Planeten
 * 
 * @param {Object} options - Konfigurationsoptionen
 * @param {number} options.planetRadius - Radius des Planeten
 * @param {number} [options.atmosphereScale=1.025] - Größe der Atmosphäre relativ zum Planeten
 * @param {THREE.Color} [options.sunColor] - Farbe der Sonne
 * @returns {THREE.ShaderMaterial} Konfiguriertes Shader-Material
 * 
 * @example
 * const atmosphereMaterial = createAtmosphereMaterial({
 *     planetRadius: 6.371, // Erdradius in Szeneneinheiten
 *     atmosphereScale: 1.025
 * });
 */
export function createAtmosphereMaterial(options = {}) {
    const {
        planetRadius = 1,
        atmosphereScale = 1.025,
        sunColor = new THREE.Color(1.0, 0.98, 0.9), // Leicht warme Sonne
        rayleighCoefficients = new THREE.Vector3(0.5, 0.7, 1.0) // Standard: Erdblau
    } = options;

    const atmosphereRadius = planetRadius * atmosphereScale;

    // Bereitgestellte Koeffizienten oder Standards verwenden
    // Blau (B) > Grün (G) > Rot (R) erzeugt blauen Himmel (Erde)
    // Rot (R) > Grün (G) > Blau (B) erzeugt orange/goldenen Himmel (Venus/Titan)

    return new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            sunPosition: { value: new THREE.Vector3(0, 0, 0) },
            planetCenter: { value: new THREE.Vector3(0, 0, 0) },
            planetRadius: { value: planetRadius },
            atmosphereRadius: { value: atmosphereRadius },
            rayleighCoefficients: { value: rayleighCoefficients },
            sunColor: { value: sunColor },
            cameraPosition: { value: new THREE.Vector3() },
            ambientLightColor: { value: new THREE.Color(0x404050) }, // Standard-Ambient
            ambientIntensity: { value: 0.5 }
        },
        transparent: true,
        side: THREE.BackSide, // Innenseite der Kugel rendern
        depthWrite: false,
        blending: THREE.NormalBlending  // Von Additiv zu Normal für bessere Kontrolle
    });
}

/**
 * Erstellt Venus-spezifisches atmosphärisches Streuungsmaterial.
 * 
 * Venus hat grundlegend andere Streuungsphysik als die Erde:
 * - Dichte Schwefelsäure (H2SO4) Wolken statt Wasserdampf
 * - 92 atm Oberflächendruck (vs 1 atm auf der Erde)
 * - 96% CO2-Atmosphäre streut Rot-/Gelbtöne statt Blau
 * 
 * @param {Object} options - Konfigurationsoptionen
 * @param {number} options.planetRadius - Radius der Venus
 * @param {number} [options.atmosphereScale=1.03] - Größe der Atmosphäre relativ zum Planeten
 * @returns {THREE.ShaderMaterial} Venus-Atmosphären-Shader-Material
 * 
 * @theorie
 * Venus Rayleigh-Streuungskoeffizienten sind INVERTIERT gegenüber der Erde:
 * - Erde: Blau > Grün > Rot (erzeugt blauen Himmel)
 * - Venus: Rot > Grün > Blau (erzeugt goldene/gelbe Atmosphäre)
 * 
 * Dies entspricht Beobachtungen von Bepicrolombo, Akatsuki und Venus Express.
 */
export function createVenusAtmosphereMaterial(options = {}) {
    const {
        planetRadius = 1,
        atmosphereScale = 1.03, // Venus hat dickere Atmosphäre als Erde
        sunColor = new THREE.Color(1.0, 0.95, 0.8), // Warme Sonne durch SO2
    } = options;

    const atmosphereRadius = planetRadius * atmosphereScale;

    // VENUS Rayleigh-Streuungskoeffizienten - INVERTIERT gegenüber Erde
    // Dichte Schwefelsäurewolken streuen Rot-/Gelbtöne statt Blau
    // Angepasst für 'Blass-Creme' Aussehen: Hoch R/G, Niedrig B, aber ausbalanciert um Neon-Orange zu vermeiden
    const rayleighCoefficients = new THREE.Vector3(
        0.9,  // Rot (Hohe Streuung)
        0.85, // Grün (Hohe Streuung -> Gelb/Creme-Mischung)
        0.2   // Blau (Niedrige Streuung, aber nicht null für Entsättigung)
    );

    // Venus-Material
    return new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            sunPosition: { value: new THREE.Vector3(0, 0, 0) },
            planetCenter: { value: new THREE.Vector3(0, 0, 0) },
            planetRadius: { value: planetRadius },
            atmosphereRadius: { value: atmosphereRadius },
            rayleighCoefficients: { value: rayleighCoefficients },
            sunColor: { value: sunColor },
            cameraPosition: { value: new THREE.Vector3() },
            ambientLightColor: { value: new THREE.Color(0x404050) },
            ambientIntensity: { value: 0.5 }
        },
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.NormalBlending
    });
}

/**
 * Erstellt ein vollständiges Venus-Atmosphären-Mesh mit goldener Streuung.
 */
export function createVenusAtmosphereMesh(planetRadius, options = {}) {
    const { segments = 48, atmosphereScale = 1.03 } = options;
    const atmosphereRadius = planetRadius * atmosphereScale;
    const geometry = new THREE.SphereGeometry(atmosphereRadius, segments, segments);
    const material = createVenusAtmosphereMaterial({ planetRadius, atmosphereScale });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.name = 'venus_atmosphere';
    return mesh;
}

/**
 * Erstellt ein vollständiges Atmosphären-Mesh für einen Planeten
 */
export function createAtmosphereMesh(planetRadius, options = {}) {
    const { segments = 48, atmosphereScale = 1.025, rayleighCoefficients } = options;
    const atmosphereRadius = planetRadius * atmosphereScale;
    const geometry = new THREE.SphereGeometry(atmosphereRadius, segments, segments);
    const material = createAtmosphereMaterial({ planetRadius, atmosphereScale, rayleighCoefficients });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.name = 'atmosphere';
    return mesh;
}

/**
 * Aktualisiert Atmosphären-Shader-Uniforms
 */
export function updateAtmosphereUniforms(atmosphereMesh, sunPosition, planetPosition) {
    if (!atmosphereMesh?.material?.uniforms) return;
    atmosphereMesh.material.uniforms.sunPosition.value.copy(sunPosition);
    atmosphereMesh.material.uniforms.planetCenter.value.copy(planetPosition);
    if (atmosphereMesh.material.uniforms.cameraPosition && window.camera) {
        atmosphereMesh.material.uniforms.cameraPosition.value.copy(window.camera.position);
    }
}

/**
 * Erstellt Mars-spezifisches dünnes Atmosphären-Material.
 */
export function createMarsAtmosphereMaterial(options = {}) {
    const {
        planetRadius = 1,
        atmosphereScale = 1.008,
        sunColor = new THREE.Color(1.0, 0.95, 0.85),
    } = options;
    const atmosphereRadius = planetRadius * atmosphereScale;
    const rayleighCoefficients = new THREE.Vector3(0.8, 0.4, 0.15);

    return new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            sunPosition: { value: new THREE.Vector3(0, 0, 0) },
            planetCenter: { value: new THREE.Vector3(0, 0, 0) },
            planetRadius: { value: planetRadius },
            atmosphereRadius: { value: atmosphereRadius },
            rayleighCoefficients: { value: rayleighCoefficients },
            sunColor: { value: sunColor },
            cameraPosition: { value: new THREE.Vector3() },
            ambientLightColor: { value: new THREE.Color(0x404050) },
            ambientIntensity: { value: 0.5 }
        },
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.NormalBlending
    });
}

/**
 * Erstellt Mars-Atmosphären-Mesh
 */
export function createMarsAtmosphereMesh(planetRadius, options = {}) {
    const { segments = 48, atmosphereScale = 1.008 } = options;
    const atmosphereRadius = planetRadius * atmosphereScale;
    const geometry = new THREE.SphereGeometry(atmosphereRadius, segments, segments);
    const material = createMarsAtmosphereMaterial({ planetRadius, atmosphereScale });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.name = 'mars_atmosphere';
    return mesh;
}

/**
 * Erstellt Uranus-spezifisches atmosphärisches Dunst-Material.
 */
export function createUranusAtmosphereMaterial(options = {}) {
    const {
        planetRadius = 1,
        atmosphereScale = 1.02,
        sunColor = new THREE.Color(0.9, 0.95, 1.0),
    } = options;
    const atmosphereRadius = planetRadius * atmosphereScale;
    const rayleighCoefficients = new THREE.Vector3(0.2, 0.7, 0.9);

    return new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            sunPosition: { value: new THREE.Vector3(0, 0, 0) },
            planetCenter: { value: new THREE.Vector3(0, 0, 0) },
            planetRadius: { value: planetRadius },
            atmosphereRadius: { value: atmosphereRadius },
            rayleighCoefficients: { value: rayleighCoefficients },
            sunColor: { value: sunColor },
            cameraPosition: { value: new THREE.Vector3() },
            ambientLightColor: { value: new THREE.Color(0x404050) },
            ambientIntensity: { value: 0.5 }
        },
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.NormalBlending
    });
}

/**
 * Erstellt Uranus-Atmosphären-Mesh
 */
export function createUranusAtmosphereMesh(planetRadius, options = {}) {
    const { segments = 48, atmosphereScale = 1.02 } = options;
    const atmosphereRadius = planetRadius * atmosphereScale;
    const geometry = new THREE.SphereGeometry(atmosphereRadius, segments, segments);
    const material = createUranusAtmosphereMaterial({ planetRadius, atmosphereScale });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.name = 'uranus_atmosphere';
    return mesh;
}

/**
 * Erstellt Neptun-spezifisches atmosphärisches Dunst-Material.
 */
export function createNeptuneAtmosphereMaterial(options = {}) {
    const {
        planetRadius = 1,
        atmosphereScale = 1.025,
        sunColor = new THREE.Color(0.85, 0.9, 1.0),
    } = options;
    const atmosphereRadius = planetRadius * atmosphereScale;
    const rayleighCoefficients = new THREE.Vector3(0.1, 0.5, 1.0);

    return new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            sunPosition: { value: new THREE.Vector3(0, 0, 0) },
            planetCenter: { value: new THREE.Vector3(0, 0, 0) },
            planetRadius: { value: planetRadius },
            atmosphereRadius: { value: atmosphereRadius },
            rayleighCoefficients: { value: rayleighCoefficients },
            sunColor: { value: sunColor },
            cameraPosition: { value: new THREE.Vector3() },
            ambientLightColor: { value: new THREE.Color(0x404050) },
            ambientIntensity: { value: 0.5 }
        },
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.NormalBlending
    });
}

/**
 * Erstellt Neptun-Atmosphären-Mesh mit tiefblauem Dunst.
 *
 * @param {number} planetRadius - Radius von Neptun in Szeneneinheiten
 * @param {Object} [options] - Zusätzliche Optionen
 * @returns {THREE.Mesh} Neptun-Atmosphären-Mesh
 */
export function createNeptuneAtmosphereMesh(planetRadius, options = {}) {
    const {
        segments = 48,
        atmosphereScale = 1.025
    } = options;

    const atmosphereRadius = planetRadius * atmosphereScale;
    const geometry = new THREE.SphereGeometry(atmosphereRadius, segments, segments);
    const material = createNeptuneAtmosphereMaterial({
        planetRadius,
        atmosphereScale
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.name = 'neptune_atmosphere';

    return mesh;
}

export default {
    createAtmosphereMaterial,
    createAtmosphereMesh,
    createVenusAtmosphereMaterial,
    createVenusAtmosphereMesh,
    createMarsAtmosphereMaterial,
    createMarsAtmosphereMesh,
    createUranusAtmosphereMaterial,
    createUranusAtmosphereMesh,
    createNeptuneAtmosphereMaterial,
    createNeptuneAtmosphereMesh,
    updateAtmosphereUniforms,
    // Shader für fortgeschrittene Verwendung exportieren
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader
};
