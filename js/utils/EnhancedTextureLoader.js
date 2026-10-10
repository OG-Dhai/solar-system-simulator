/**
 * @fileoverview Erweiterter Texturlader mit Fallback-Kette
 * 
 * Bietet robustes Texturladen mit:
 * - Primär: Solar System Scope 2K CDN-Texturen
 * - Fallback: Lokale Texturdateien
 * - Finaler Fallback: Prozedural generierte Farbtexturen
 * 
 * Bietet Promise-basierte API und Textur-Caching.
 * 
 * @module EnhancedTextureLoader
 * @author Sonnensystem-Simulation
 * @version 1.0.0
 * 
 * @quellen
 * - Solar System Scope Texturen: https://www.solarsystemscope.com/textures/
 * - NASA Visible Earth: https://visibleearth.nasa.gov/
 */

import * as THREE from 'three';
import { getAutoQuality } from './PerformanceConfig.js';
import { Logger } from './Logger.js';

/**
 * Solar System Scope CDN Textur-URLs (Hohe Auflösung 8K)
 * @constant {Object}
 */
export const TEXTURE_CDN_URLS_8K = {
    sun: 'https://www.solarsystemscope.com/textures/download/8k_sun.jpg',
    mercury: 'https://www.solarsystemscope.com/textures/download/8k_mercury.jpg',
    venus: 'https://www.solarsystemscope.com/textures/download/8k_venus_surface.jpg', // No 8k atmosphere known
    earth: 'https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg',
    earth_night: 'https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg',
    earth_clouds: 'https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg',
    mars: 'https://www.solarsystemscope.com/textures/download/8k_mars.jpg',
    jupiter: 'https://www.solarsystemscope.com/textures/download/8k_jupiter.jpg', // Often available
    saturn: 'https://www.solarsystemscope.com/textures/download/8k_saturn.jpg',
    moon: 'https://www.solarsystemscope.com/textures/download/8k_moon.jpg',
    stars: 'https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg'
};

/**
 * Solar System Scope CDN Textur-URLs (Standard 2K)
 * Wird als Fallback verwendet wenn 8K fehlschlägt oder für kleinere Körper
 * @constant {Object}
 */
export const TEXTURE_CDN_URLS_2K = {
    // Star
    sun: 'https://www.solarsystemscope.com/textures/download/2k_sun.jpg',

    // Planets
    mercury: 'https://www.solarsystemscope.com/textures/download/2k_mercury.jpg',
    venus: 'https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg',
    venus_surface: 'https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg',
    earth: 'https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg',
    earth_night: 'https://www.solarsystemscope.com/textures/download/2k_earth_nightmap.jpg',
    earth_clouds: 'https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg',
    earth_specular: 'https://www.solarsystemscope.com/textures/download/2k_earth_specular_map.tif',
    earth_normal: 'https://www.solarsystemscope.com/textures/download/2k_earth_normal_map.tif',
    mars: 'https://www.solarsystemscope.com/textures/download/2k_mars.jpg',
    jupiter: 'https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg',
    saturn: 'https://www.solarsystemscope.com/textures/download/2k_saturn.jpg',
    saturn_ring: 'https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png',
    uranus: 'https://www.solarsystemscope.com/textures/download/2k_uranus.jpg',
    neptune: 'https://www.solarsystemscope.com/textures/download/2k_neptune.jpg',
    pluto: 'https://www.solarsystemscope.com/textures/download/2k_makemake_fictional.jpg',  // No official Pluto texture

    // Moons
    moon: 'https://www.solarsystemscope.com/textures/download/2k_moon.jpg',

    // Hintergrund
    stars: 'https://www.solarsystemscope.com/textures/download/2k_stars_milky_way.jpg'
};

/**
 * Lokale Texturpfade (relativ zum Projektstamm)
 * Verwendet WebP-Format für ~73% kleinere Dateigrößen
 * @constant {Object}
 */
export const LOCAL_TEXTURE_PATHS = {
    sun: '/textures/sun.webp',
    mercury: '/textures/mercury.webp',
    venus: '/textures/venus_atmosphere.webp',
    venus_surface: '/textures/venus_surface.webp',
    earth: '/textures/earth_daymap.webp',
    earth_night: '/textures/earth_nightmap.webp',
    earth_clouds: '/textures/earth_clouds.webp',
    earth_specular: '/textures/earth_specular.webp',
    earth_normal: '/textures/earth_normal.webp',
    mars: '/textures/mars.webp',
    jupiter: '/textures/jupiter.webp',
    jupiter_ring: '/textures/jupiter_ring.webp',
    saturn: '/textures/saturn.webp',
    saturn_ring: '/textures/saturn_ring_alpha.png',
    saturn_ring_alpha: '/textures/saturn_ring_alpha.png',
    uranus: '/textures/uranus.webp',
    uranus_ring: '/textures/uranus_ring.png',
    neptune: '/textures/neptune.webp',
    neptune_ring: '/textures/neptune_ring.webp',
    pluto: '/textures/pluto.webp',
    moon: '/textures/moon.webp',
    phobos: '/textures/phobos.webp',
    deimos: '/textures/deimos.webp',
    io: '/textures/io.webp',
    europa: '/textures/europa.webp',
    ganymede: '/textures/ganymede.webp',
    callisto: '/textures/callisto.webp',
    titan: '/textures/titan.webp',
    enceladus: '/textures/enceladus.webp',
    mimas: '/textures/mimas.webp',
    rhea: '/textures/rhea.webp',
    dione: '/textures/dione.webp',
    tethys: '/textures/tethys.webp',
    triton: '/textures/triton.webp',
    charon: '/textures/charon.webp',
    halley: '/textures/halley.webp',
    stars: '/textures/stars.webp',
    stars_milky_way: '/textures/stars_milky_way.webp',
    // Uranusmonde
    miranda: '/textures/miranda.webp',
    ariel: '/textures/ariel.webp',
    umbriel: '/textures/umbriel.webp',
    titania: '/textures/titania.webp',
    oberon: '/textures/oberon.webp',
    // Neptunmonde
    proteus: '/textures/proteus.webp',
    nereid: '/textures/nereid.webp',
    larissa: '/textures/larissa.webp'
};

/**
 * JPG-Fallback-Pfade für Browser ohne WebP-Unterstützung
 * @constant {Object}
 */
export const LOCAL_TEXTURE_PATHS_FALLBACK = {
    sun: '/textures/raw/sun.jpg',
    mercury: '/textures/raw/mercury.jpg',
    venus: '/textures/raw/venus_atmosphere.jpg',
    earth: '/textures/raw/earth_daymap.jpg',
    earth_night: '/textures/raw/earth_nightmap.jpg',
    earth_clouds: '/textures/raw/earth_clouds.jpg',
    earth_specular: '/textures/raw/earth_specular.jpg',
    earth_normal: '/textures/raw/earth_normal.jpg',
    mars: '/textures/raw/mars.jpg',
    jupiter: '/textures/raw/jupiter.jpg',
    saturn: '/textures/raw/saturn.jpg',
    saturn_ring: '/textures/raw/saturn_ring_alpha.png',
    uranus: '/textures/raw/uranus.jpg',
    neptune: '/textures/raw/neptune.jpg',
    pluto: '/textures/raw/pluto.jpg',
    moon: '/textures/raw/moon.jpg',
    phobos: '/textures/raw/phobos.jpg',
    io: '/textures/raw/io.jpg',
    europa: '/textures/raw/europa.jpg',
    ganymede: '/textures/raw/ganymede.jpg',
    callisto: '/textures/raw/callisto.jpg',
    titan: '/textures/raw/titan.jpg',
    triton: '/textures/raw/triton.jpg',
    charon: '/textures/raw/charon.jpg',
    halley: '/textures/raw/halley.jpg',
    stars: '/textures/raw/stars_milky_way.jpg',
    galaxy_spiral: '/textures/galaxy_spiral.webp'
};

/**
 * Fallback-Farben für prozedurale Texturgenerierung
 * Basierend auf ungefähren Planetenfarben
 * @constant {Object}
 */
export const FALLBACK_COLORS = {
    sun: 0xffdd44,
    mercury: 0x8c8c8c,
    venus: 0xe6c35c,
    venus_surface: 0xb06020,  // Braune vulkanische Oberfläche
    earth: 0x4169e1,
    earth_night: 0x111122,
    earth_clouds: 0xffffff,
    mars: 0xcd5c5c,
    jupiter: 0xd4a574,
    saturn: 0xf4d58d,
    saturn_ring: 0xc4b59d,
    uranus: 0x85d4e3,
    neptune: 0x4169e1,
    pluto: 0xdeb887,
    moon: 0xc0c0c0,
    phobos: 0x888888,
    deimos: 0x666666,  // Leicht anderes Grau als Phobos
    io: 0xffff66,
    europa: 0xf5f5dc,
    ganymede: 0xa0a0a0,
    callisto: 0x696969,
    titan: 0xffa500,
    enceladus: 0xffffff,  // Helles weißes Eis
    mimas: 0xaaaaaa,      // Graue Krateroberfläche
    rhea: 0xbbbbbb,       // Hellgraue Krater
    dione: 0xcccccc,      // Blassgraue Schlieren
    tethys: 0xeeeeff,     // Eisweiß
    triton: 0xe0ffff,
    charon: 0x808080,
    halley: 0x444444,
    stars: 0x000011,
    // Uranusmonde
    miranda: 0x9999aa,    // Grau-bläuliches Eis
    ariel: 0xbbbbcc,      // Hellgraues Eis
    umbriel: 0x555566,    // Dunkelgrau (dunkelster Uranusmond)
    titania: 0xaaaaaa,    // Mittelgraues Eis
    oberon: 0x888899,     // Grau mit leichtem Blau
    // Neptunmonde
    proteus: 0x666677,    // Dunkelgrau irregulär
    nereid: 0x777788,     // Grau irregulär
    larissa: 0x555566     // Dunkelgrau irregulär
};

/**
 * Textur-Cache zur Vermeidung doppelten Ladens
 * @type {Map<string, THREE.Texture>}
 */
const textureCache = new Map();
const MAX_CACHE_SIZE = 50; // Cache-Größe begrenzen um Speicherprobleme zu vermeiden

/**
 * Ausstehende Lade-Promises zur Vermeidung doppelter Anfragen
 * @type {Map<string, Promise<THREE.Texture>>}
 */
const pendingLoads = new Map();

/**
 * Erweiterte Texturlader-Klasse
 */
export class EnhancedTextureLoader {
    constructor() {
        /** @type {THREE.TextureLoader} */
        this.loader = new THREE.TextureLoader();

        /** @type {boolean} CDN-Laden aktivieren */
        this.useCDN = false;

        /** @type {boolean} Caching aktivieren */
        this.useCache = true;

        /** @type {boolean} CORS für CDN aktivieren */
        this.loader.setCrossOrigin('anonymous');
    }

    /**
     * Load a texture with fallback chain
     * 
     * Loading order:
     * 1. Check cache
     * 2. Try CDN (if enabled)
     * 3. Try local file
     * 4. Generate procedural texture
     * 
     * @param {string} name - Texture name (e.g., 'earth', 'saturn_ring')
     * @param {Object} [options] - Load options
     * @param {boolean} [options.useCDN=true] - Whether to try CDN first
     * @param {boolean} [options.sRGB=true] - Apply sRGB color space
     * @returns {Promise<THREE.Texture>} Loaded texture
     */
    async loadTexture(name, options = {}) {
        const { useCDN = this.useCDN, sRGB = true, signal } = options;

        // Check cache first
        if (this.useCache && textureCache.has(name)) {
            // Cache hit
            return textureCache.get(name);
        }

        // Check if already loading
        if (pendingLoads.has(name)) {
            // Waiting for pending load
            return pendingLoads.get(name);
        }

        // Create load promise
        const loadPromise = this._loadWithFallback(name, useCDN, sRGB, signal);
        pendingLoads.set(name, loadPromise);

        try {
            const texture = await loadPromise;
            pendingLoads.delete(name);
            return texture;
        } catch (error) {
            pendingLoads.delete(name);
            throw error;
        }
    }

    /**
     * Internal method to load with fallback chain
     * @private
     */
    async _loadWithFallback(name, useCDN, sRGB, signal) {
        const cdnUrl8k = TEXTURE_CDN_URLS_8K[name];
        const cdnUrl2k = TEXTURE_CDN_URLS_2K[name];
        const localPath = LOCAL_TEXTURE_PATHS[name];
        const localFallbackPath = LOCAL_TEXTURE_PATHS_FALLBACK[name];
        const fallbackColor = FALLBACK_COLORS[name] || 0x808080;

        // Get current quality level
        const qualityStruct = getAutoQuality();
        const sphereSegments = qualityStruct.sphereSegments || 48; // Proxy for quality level

        // Determine Max Texture Size based on Quality
        // Low (32 segs) -> 2048, Medium (48 segs) -> 4096, High -> 8192
        let maxTextureSize = 4096;
        let allow8K = false;

        if (sphereSegments <= 32) {
            maxTextureSize = 2048;
            allow8K = false;
        } else if (sphereSegments <= 48) {
            maxTextureSize = 4096;
            allow8K = false;
        } else {
            maxTextureSize = 8192;
            allow8K = true;
        }

        // 1. Try CDN 8K (High Resolution Priority - Only if allowed)
        if (useCDN && cdnUrl8k && allow8K) {
            try {
                // Logger.debug('Texture', `Attempting 8K CDN load for ${name}`);
                const texture = await this._loadFromUrl(cdnUrl8k, sRGB, signal);
                this._enforceMaxTextureSize(texture, maxTextureSize);
                this._cacheTexture(name, texture);
                return texture;
            } catch (error) {
                Logger.warn('EnhancedTextureLoader', `8K CDN failed for "${name}", trying 2K...`);
            }
        }

        // 2. Try CDN 2K (Standard Resolution Fallback)
        if (useCDN && cdnUrl2k) {
            try {
                const texture = await this._loadFromUrl(cdnUrl2k, sRGB, signal);
                this._enforceMaxTextureSize(texture, maxTextureSize);
                this._cacheTexture(name, texture);
                return texture;
            } catch (error) {
                Logger.warn('EnhancedTextureLoader', `2K CDN failed for "${name}", trying local...`);
            }
        }

        // 3. Try local WebP file (Preferred local format)
        if (localPath) {
            try {
                const texture = await this._loadFromUrl(localPath, sRGB, signal);
                this._enforceMaxTextureSize(texture, maxTextureSize);
                this._cacheTexture(name, texture);
                return texture;
            } catch (error) {
                Logger.warn('EnhancedTextureLoader', `WebP failed for "${name}", trying JPG fallback...`);
            }
        }

        // 4. Try local JPG fallback
        if (localFallbackPath) {
            try {
                const texture = await this._loadFromUrl(localFallbackPath, sRGB, signal);
                this._enforceMaxTextureSize(texture, maxTextureSize);
                this._cacheTexture(name, texture);
                return texture;
            } catch (error) {
                Logger.warn('EnhancedTextureLoader', `JPG fallback failed for "${name}", generating procedural...`);
            }
        }

        // 5. Generate procedural texture as final fallback
        const texture = this._generateProceduralTexture(name, fallbackColor);
        this._cacheTexture(name, texture);
        return texture;
    }

    /**
     * Enforce maximum texture size by downscaling if necessary
     * @private
     * @param {THREE.Texture} texture - The loaded texture
     * @param {number} maxSize - Maximum allowed dimension (width/height)
     */
    _enforceMaxTextureSize(texture, maxSize) {
        if (!texture.image) return;

        const width = texture.image.width;
        const height = texture.image.height;

        if (width > maxSize || height > maxSize) {
            // Calculate new dimensions maintaining aspect ratio
            const aspect = width / height;
            let newWidth = width;
            let newHeight = height;

            if (width > maxSize) {
                newWidth = maxSize;
                newHeight = Math.round(newWidth / aspect);
            }
            if (newHeight > maxSize) {
                newHeight = maxSize;
                newWidth = Math.round(newHeight * aspect);
            }

            // Create canvas for resizing
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');

            // Draw resized image
            ctx.drawImage(texture.image, 0, 0, newWidth, newHeight);

            // Replace texture image with canvas
            texture.image = canvas;
            texture.needsUpdate = true;
        }
    }

    /**
     * Load texture from URL with AbortSignal support
     * Uses fetch + blob for true network cancellation
     * @private
     * @param {string} url - Texture URL
     * @param {boolean} sRGB - Apply sRGB color space
     * @param {AbortSignal} [signal] - Signal to abort the request
     * @returns {Promise<THREE.Texture>}
     */
    async _loadFromUrl(url, sRGB, signal) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        try {
            // Use fetch to allow true network cancellation
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            return new Promise((resolve, reject) => {
                this.loader.load(
                    objectUrl,
                    (texture) => {
                        URL.revokeObjectURL(objectUrl);
                        if (signal?.aborted) {
                            texture.dispose();
                            reject(new DOMException('Aborted', 'AbortError'));
                            return;
                        }
                        if (sRGB) {
                            texture.colorSpace = THREE.SRGBColorSpace;
                        }

                        // Set proper filtering for ring textures to reduce aliasing
                        if (name.includes('ring')) {
                            texture.minFilter = THREE.LinearMipmapLinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            texture.generateMipmaps = true;
                        }

                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        URL.revokeObjectURL(objectUrl);
                        reject(error);
                    }
                );
            });
        } catch (err) {
            // Propagate AbortError or standard Error
            throw err;
        }
    }

    /**
     * Generate a procedural fallback texture
     * @private
     * @param {string} name - Texture name
     * @param {number} color - Hex color
     * @returns {THREE.Texture}
     */
    _generateProceduralTexture(name, color) {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Convert hex to RGB
        const r = (color >> 16) & 255;
        const g = (color >> 8) & 255;
        const b = color & 255;

        // Fill with base color
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(0, 0, size, size);

        // Add some procedural detail based on texture type
        if (name.includes('earth')) {
            this._addEarthLikeDetail(ctx, size, r, g, b);
        } else if (name === 'sun') {
            this._addSunLikeDetail(ctx, size);
        } else if (name === 'jupiter' || name === 'saturn') {
            this._addGasGiantDetail(ctx, size, r, g, b);
        } else if (name === 'stars') {
            this._addStarFieldDetail(ctx, size);
        } else if (name.includes('ring')) {
            return this._generateRingTexture(size);
        } else {
            this._addGenericDetail(ctx, size, r, g, b);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        return texture;
    }

    /**
     * Add Earth-like procedural detail
     * @private
     */
    _addEarthLikeDetail(ctx, size, r, g, b) {
        // Water base is already set, add some "continents"
        ctx.fillStyle = 'rgb(34, 139, 34)';  // Forest green

        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            const x = Math.random() * size;
            const y = Math.random() * size;
            const w = 20 + Math.random() * 30;
            const h = 10 + Math.random() * 20;
            ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Add white cloud patches
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * size, Math.random() * size, 5 + Math.random() * 15, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Add Sun-like procedural detail
     * @private
     */
    _addSunLikeDetail(ctx, size) {
        // Radial gradient for sun glow
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, '#ffdd44');
        gradient.addColorStop(0.7, '#ff9900');
        gradient.addColorStop(1, '#ff6600');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add noise for plasma effect
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const brightness = 200 + Math.floor(Math.random() * 55);
            ctx.fillStyle = `rgb(${brightness}, ${brightness * 0.7}, 0)`;
            ctx.fillRect(x, y, 2, 2);
        }
    }

    /**
     * Add gas giant detail (bands)
     * @private
     */
    _addGasGiantDetail(ctx, size, r, g, b) {
        // Horizontal bands
        const bandCount = 8 + Math.floor(Math.random() * 5);
        const bandHeight = size / bandCount;

        for (let i = 0; i < bandCount; i++) {
            const variation = (Math.random() - 0.5) * 60;
            const nr = Math.max(0, Math.min(255, r + variation));
            const ng = Math.max(0, Math.min(255, g + variation * 0.8));
            const nb = Math.max(0, Math.min(255, b + variation * 0.6));

            ctx.fillStyle = `rgb(${nr}, ${ng}, ${nb})`;
            ctx.fillRect(0, i * bandHeight, size, bandHeight + 1);
        }
    }

    /**
     * Add star field detail
     * @private
     */
    _addStarFieldDetail(ctx, size) {
        // Black background
        ctx.fillStyle = '#000011';
        ctx.fillRect(0, 0, size, size);

        // Random stars
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const brightness = 150 + Math.floor(Math.random() * 105);
            const starSize = Math.random() < 0.1 ? 2 : 1;

            ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness + 20})`;
            ctx.fillRect(x, y, starSize, starSize);
        }
    }

    /**
     * Add generic planetary detail
     * @private
     */
    _addGenericDetail(ctx, size, r, g, b) {
        // Add noise for surface detail
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const variation = (Math.random() - 0.5) * 40;
            const nr = Math.max(0, Math.min(255, r + variation));
            const ng = Math.max(0, Math.min(255, g + variation));
            const nb = Math.max(0, Math.min(255, b + variation));

            ctx.fillStyle = `rgb(${nr}, ${ng}, ${nb})`;
            ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
        }

        // Add crater-like circles for rocky bodies
        ctx.strokeStyle = `rgba(${r * 0.7}, ${g * 0.7}, ${b * 0.7}, 0.3)`;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * size, Math.random() * size, 3 + Math.random() * 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    /**
     * Generate ring texture (for Saturn, etc.)
     * @private
     * @param {number} size - Texture size
     * @returns {THREE.Texture}
     */
    _generateRingTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = 32;  // Thin for radial stretch
        const ctx = canvas.getContext('2d');

        // Enable smoothing for anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Gradient from inner to outer edge
        const gradient = ctx.createLinearGradient(0, 0, size, 0);
        gradient.addColorStop(0, 'rgba(180, 160, 140, 0.1)');     // Inner - faint
        gradient.addColorStop(0.15, 'rgba(200, 180, 160, 0.3)');  // C Ring
        gradient.addColorStop(0.25, 'rgba(220, 200, 180, 0.9)');  // B Ring - brightest
        gradient.addColorStop(0.4, 'rgba(50, 50, 50, 0.1)');      // Cassini Division - dark
        gradient.addColorStop(0.45, 'rgba(200, 180, 160, 0.7)');  // A Ring
        gradient.addColorStop(0.85, 'rgba(180, 160, 140, 0.2)');  // Outer - faint
        gradient.addColorStop(1, 'rgba(100, 90, 80, 0)');         // Edge - transparent

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;

        return texture;
    }

    /**
     * Cache a loaded texture
     * @private
     */
    _cacheTexture(name, texture) {
        if (this.useCache) {
            // Implement LRU-like cache size management
            if (textureCache.size >= MAX_CACHE_SIZE) {
                // Remove the first entry (oldest) to maintain size limit
                const firstKey = textureCache.keys().next().value;
                if (firstKey) {
                    const oldTexture = textureCache.get(firstKey);
                    if (oldTexture) {
                        oldTexture.dispose();
                    }
                    textureCache.delete(firstKey);
                }
            }
            textureCache.set(name, texture);
        }
    }

    /**
     * Clear the texture cache
     */
    clearCache() {
        textureCache.forEach((texture, name) => {
            texture.dispose();
        });
        textureCache.clear();
        // Cache cleared
    }

    /**
     * Preload multiple textures
     * @param {string[]} names - Array of texture names
     * @param {Function} [onProgress] - Progress callback (loaded, total)
     * @returns {Promise<Map<string, THREE.Texture>>}
     */
    async preloadTextures(names, onProgress) {
        const results = new Map();
        let loaded = 0;

        for (const name of names) {
            try {
                const texture = await this.loadTexture(name);
                results.set(name, texture);
            } catch (error) {
                Logger.error('EnhancedTextureLoader', `Failed to preload "${name}"`, error);
            }

            loaded++;
            if (onProgress) {
                onProgress(loaded, names.length);
            }
        }

        return results;
    }

    /**
     * Dispose of a specific cached texture
     * @param {string} name - Texture name
     */
    disposeTexture(name) {
        if (textureCache.has(name)) {
            textureCache.get(name).dispose();
            textureCache.delete(name);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            cachedCount: textureCache.size,
            cachedNames: Array.from(textureCache.keys()),
            pendingCount: pendingLoads.size
        };
    }

    /**
     * Enable/disable CDN loading
     * @param {boolean} enabled - Whether to use CDN
     */
    setCDNEnabled(enabled) {
        this.useCDN = enabled;
    }

    /**
     * Enable/disable caching
     * @param {boolean} enabled - Whether to use cache
     */
    setCacheEnabled(enabled) {
        this.useCache = enabled;
    }
}

// Create singleton instance
const enhancedTextureLoader = new EnhancedTextureLoader();

/**
 * Load a texture with fallback (convenience function)
 * @param {string} name - Texture name
 * @param {Object} [options] - Load options
 * @returns {Promise<THREE.Texture>}
 */
export function loadTexture(name, options) {
    return enhancedTextureLoader.loadTexture(name, options);
}

/**
 * Preload multiple textures (convenience function)
 * @param {string[]} names - Texture names
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<Map<string, THREE.Texture>>}
 */
export function preloadTextures(names, onProgress) {
    return enhancedTextureLoader.preloadTextures(names, onProgress);
}

/**
 * Clear texture cache (convenience function)
 */
export function clearTextureCache() {
    enhancedTextureLoader.clearCache();
}

export default {
    EnhancedTextureLoader,
    loadTexture,
    preloadTextures,
    clearTextureCache,
    TEXTURE_CDN_URLS_8K,
    TEXTURE_CDN_URLS_2K,
    LOCAL_TEXTURE_PATHS,
    FALLBACK_COLORS
};
