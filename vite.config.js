import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';
import { jplHorizonsProxy } from './scripts/api/viteJplPlugin.js';

export default defineConfig({
    // Development server
    server: {
        port: 5173,
        open: true,
        cors: true
    },

    // Build configuration
    build: {
        outDir: 'dist',
        sourcemap: true,
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: false, // Keep console for debugging
                drop_debugger: true
            }
        },
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            },
            output: {
                // Code splitting for better caching
                manualChunks: {
                    three: ['three'],
                    vendor: ['three/addons/controls/OrbitControls.js', 'three/addons/postprocessing/EffectComposer.js']
                },
                // Asset naming for cache busting
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
            }
        },
        // Chunk size warnings
        chunkSizeWarningLimit: 1000
    },

    // Plugins
    plugins: [
        // Legacy browser support (optional)
        legacy({
            targets: ['defaults', 'not IE 11']
        }),
        // JPL Horizons API proxy
        jplHorizonsProxy()
    ],

    // Resolve configuration
    resolve: {
        alias: {
            '@': resolve(__dirname, 'js'),
            '@textures': resolve(__dirname, 'public/textures'),
            '@css': resolve(__dirname, 'css'),
            '@api': resolve(__dirname, 'scripts/api')
        }
    },

    // Optimization
    optimizeDeps: {
        include: ['three']
    },

    // Preview server (production preview)
    preview: {
        port: 4173,
        open: true
    }
});
