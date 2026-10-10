/**
 * Vite plugin for JPL Horizons API proxy
 * Bypasses CORS restrictions by routing requests through the development server
 */

export function jplHorizonsProxy() {
    return {
        name: 'jpl-horizons-proxy',
        configureServer(server) {
            server.middlewares.use('/api/jpl-horizons-proxy', async (req, res, next) => {
                try {
                    // Extract query parameters from the request
                    const params = new URLSearchParams(req.url.split('?')[1]);
                    
                    // Construct the JPL Horizons API URL
                    const horizonsUrl = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
                    
                    // Copy all parameters from the original request
                    for (const [key, value] of params) {
                        horizonsUrl.searchParams.append(key, value);
                    }
                    
                    // Make the request to JPL Horizons
                    const horizonsResponse = await fetch(horizonsUrl.toString(), {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Solar-System-Simulation/2.1.0 (contact: developer@example.com)'
                        }
                    });
                    
                    if (!horizonsResponse.ok) {
                        throw new Error(`JPL Horizons API responded with status ${horizonsResponse.status}`);
                    }
                    
                    // Get the response text
                    const data = await horizonsResponse.text();
                    
                    // Set appropriate headers and send the response
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    
                    res.end(JSON.stringify({ result: data }));
                } catch (error) {
                    console.error('JPL Horizons proxy error:', error);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            
            // Handle preflight requests
            server.middlewares.use('/api/jpl-horizons-proxy', (req, res, next) => {
                if (req.method === 'OPTIONS') {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    res.statusCode = 200;
                    res.end();
                    return;
                }
                next();
            });
        }
    };
}