/**
 * JPL Horizons API Proxy Service
 * Handles CORS restrictions by acting as an intermediary between the browser and JPL servers
 */

class JPLHorizonsProxy {
    constructor(proxyUrl = null) {
        // If no proxy URL is provided, use a default one or the same origin
        this.proxyUrl = proxyUrl || '/api/jpl-horizons-proxy';
    }

    /**
     * Query JPL Horizons for ephemeris data
     * @param {Object} params - Query parameters for Horizons
     * @returns {Promise<Object>} Response from Horizons
     */
    async queryEphemeris(params) {
        // Format parameters for Horizons API
        const queryParams = new URLSearchParams({
            format: 'json',
            ...params
        });

        try {
            // If running on the same origin, we can make a direct request
            // Otherwise, route through our proxy
            const url = this.proxyUrl.startsWith('http') 
                ? `${this.proxyUrl}?${queryParams}`
                : `/api/jpl-horizons-proxy?${queryParams}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Solar-System-Simulation/2.1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`JPL Horizons API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error querying JPL Horizons:', error);
            throw error;
        }
    }

    /**
     * Get state vectors for a celestial body
     * @param {string} target - Target ID (e.g., '1P' for Halley's comet)
     * @param {Date|string} startDate - Start date for ephemeris
     * @param {Date|string} endDate - End date for ephemeris
     * @param {string} stepSize - Time step (e.g., '1d' for daily)
     * @returns {Promise<Object>} State vectors data
     */
    async getStateVectors(target, startDate, endDate, stepSize = '1d') {
        const params = {
            command: `'${target}'`,
            EPHEM_TYPE: 'VECTORS',
            CENTER: `'500@10'`, // Heliocentric (centered on Sun)
            START_TIME: typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0],
            STOP_TIME: typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0],
            STEP_SIZE: `'${stepSize}'`,
            CSV_FORMAT: 'YES',
            REF_PLANE: 'ECLIPTIC', // Use ecliptic plane for solar system simulations
            REF_SYSTEM: 'J2000',
            VECT_CORR: 'NONE',
            OUT_UNITS: 'KM-S',
            TIME_TYPE: 'TT', // Terrestrial Time
            ANG_RATE: 'NO'
        };

        return this.queryEphemeris(params);
    }

    /**
     * Get osculating elements for a celestial body
     * @param {string} target - Target ID (e.g., '1P' for Halley's comet)
     * @param {Date|string} epoch - Epoch date for elements
     * @returns {Promise<Object>} Osculating elements data
     */
    async getOsculatingElements(target, epoch) {
        const params = {
            command: `'${target};'`,
            EPHEM_TYPE: 'ELEMENTS',
            CENTER: `'500@10'`, // Heliocentric
            TLIST: typeof epoch === 'string' ? epoch : epoch.toISOString().split('T')[0],
            REF_PLANE: 'ECLIPTIC',
            REF_SYSTEM: 'J2000',
            TP_TYPE: 'ABSOLUTE',
            VECT_CORR: 'NONE',
            OUT_UNITS: 'KM-S',
            TIME_TYPE: 'TT'
        };

        return this.queryEphemeris(params);
    }

    /**
     * Parse state vectors from Horizons response
     * @param {Object} responseData - Raw response from Horizons
     * @returns {Array} Array of state vectors {jd, x, y, z, vx, vy, vz}
     */
    parseStateVectors(responseData) {
        if (!responseData || !responseData.result) {
            throw new Error('Invalid response from JPL Horizons');
        }

        // Extract the data portion between $$SOE and $$EOE markers
        const resultText = responseData.result;
        const startMarker = '$$SOE';
        const endMarker = '$$EOE';

        const startIndex = resultText.indexOf(startMarker);
        const endIndex = resultText.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) {
            throw new Error('Could not find state vector data in response');
        }

        const dataBlock = resultText.substring(
            startIndex + startMarker.length,
            endIndex
        ).trim();

        // Split into lines and parse each state vector
        const lines = dataBlock.split('\n');
        const vectors = [];

        for (const line of lines) {
            if (line.trim() === '') continue;

            // State vectors come in CSV format from Horizons
            // JD, X, Y, Z, VX, VY, VZ, LT, RG, RR
            const fields = line.trim().split(',');
            
            if (fields.length >= 7) {
                vectors.push({
                    jd: parseFloat(fields[0]),       // Julian day
                    x: parseFloat(fields[1]),        // X position (km)
                    y: parseFloat(fields[2]),        // Y position (km)
                    z: parseFloat(fields[3]),        // Z position (km)
                    vx: parseFloat(fields[4]),       // X velocity (km/s)
                    vy: parseFloat(fields[5]),       // Y velocity (km/s)
                    vz: parseFloat(fields[6])        // Z velocity (km/s)
                });
            }
        }

        return vectors;
    }

    /**
     * Parse osculating elements from Horizons response
     * @param {Object} responseData - Raw response from Horizons
     * @returns {Object} Osculating elements
     */
    parseOsculatingElements(responseData) {
        if (!responseData || !responseData.result) {
            throw new Error('Invalid response from JPL Horizons');
        }

        const resultText = responseData.result;
        const startMarker = '$$SOE';
        const endMarker = '$$EOE';

        const startIndex = resultText.indexOf(startMarker);
        const endIndex = resultText.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) {
            throw new Error('Could not find osculating elements in response');
        }

        const dataBlock = resultText.substring(
            startIndex + startMarker.length,
            endIndex
        ).trim();

        // Parse the elements from the data block
        const lines = dataBlock.split('\n');
        
        // Look for the element values in the response
        const elements = {};
        
        for (const line of lines) {
            if (line.includes('EC=')) {
                // Eccentricity
                const ecMatch = line.match(/EC\s*=\s*([0-9.+,-]+)/);
                if (ecMatch) elements.eccentricity = parseFloat(ecMatch[1]);
            }
            if (line.includes('QR=')) {
                // Perihelion distance (AU)
                const qrMatch = line.match(/QR\s*=\s*([0-9.+,-]+)/);
                if (qrMatch) elements.perihelionDistance = parseFloat(qrMatch[1]);
            }
            if (line.includes('TP=')) {
                // Time of perihelion passage (Julian Day)
                const tpMatch = line.match(/TP\s*=\s*([0-9.+,-]+)/);
                if (tpMatch) elements.timeOfPerihelion = parseFloat(tpMatch[1]);
            }
            if (line.includes('IN=')) {
                // Inclination (degrees)
                const inMatch = line.match(/IN\s*=\s*([0-9.+,-]+)/);
                if (inMatch) elements.inclination = parseFloat(inMatch[1]);
            }
            if (line.includes('OM=')) {
                // Longitude of Ascending Node (degrees)
                const omMatch = line.match(/OM\s*=\s*([0-9.+,-]+)/);
                if (omMatch) elements.longitudeAscendingNode = parseFloat(omMatch[1]);
            }
            if (line.includes('W=')) {
                // Argument of Perihelion (degrees)
                const wMatch = line.match(/W\s*=\s*([0-9.+,-]+)/);
                if (wMatch) elements.argumentOfPerihelion = parseFloat(wMatch[1]);
            }
            if (line.includes('A=')) {
                // Semi-major axis (AU)
                const aMatch = line.match(/A\s*=\s*([0-9.+,-]+)/);
                if (aMatch) elements.semiMajorAxis = parseFloat(aMatch[1]);
            }
            if (line.includes('AD=')) {
                // Aphelion distance (AU)
                const adMatch = line.match(/AD\s*=\s*([0-9.+,-]+)/);
                if (adMatch) elements.aphelionDistance = parseFloat(adMatch[1]);
            }
            if (line.includes('MA=')) {
                // Mean anomaly (degrees)
                const maMatch = line.match(/MA\s*=\s*([0-9.+,-]+)/);
                if (maMatch) elements.meanAnomaly = parseFloat(maMatch[1]);
            }
        }

        return elements;
    }
}

// Export for use in other modules
export { JPLHorizonsProxy };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JPLHorizonsProxy };
} else if (typeof window !== 'undefined') {
    window.JPLHorizonsProxy = JPLHorizonsProxy;
}