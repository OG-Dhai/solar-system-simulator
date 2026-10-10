/**
 * @fileoverview Mission Control UI for Solar System Simulation
 * @module SolarSystemUI
 */

import { NASA_PLANETS, NASA_MOONS } from '../utils/NASAOrbitalData.js';

const MOON_DATA = {
    sun: [],
    mercury: [],
    venus: [],
    earth: [{ id: 'moon', name: 'Moon' }],
    mars: [{ id: 'phobos', name: 'Phobos' }, { id: 'deimos', name: 'Deimos' }],
    jupiter: [{ id: 'io', name: 'Io' }, { id: 'europa', name: 'Europa' }, { id: 'ganymede', name: 'Ganymede' }, { id: 'callisto', name: 'Callisto' }],
    saturn: [{ id: 'titan', name: 'Titan' }, { id: 'rhea', name: 'Rhea' }, { id: 'dione', name: 'Dione' }, { id: 'tethys', name: 'Tethys' }, { id: 'enceladus', name: 'Enceladus' }, { id: 'mimas', name: 'Mimas' }],
    uranus: [{ id: 'titania', name: 'Titania' }, { id: 'oberon', name: 'Oberon' }, { id: 'umbriel', name: 'Umbriel' }, { id: 'ariel', name: 'Ariel' }, { id: 'miranda', name: 'Miranda' }],
    neptune: [{ id: 'triton', name: 'Triton' }, { id: 'proteus', name: 'Proteus' }, { id: 'nereid', name: 'Nereid' }, { id: 'larissa', name: 'Larissa' }],
    pluto: [{ id: 'charon', name: 'Charon' }]
};

export class SolarSystemUI {
    constructor(options = {}) {
        this.inputController = options.inputController;
        this.solarSystem = options.solarSystem;
        this.panel = null;
        this.planetSelect = null;
        this.moonSelect = null;
        this.moonSelectorGroup = null;
        this.timeWarpSlider = null;
        this.timeWarpDisplay = null;
        this.infoPanel = null;
        this.selectedPlanet = 'sun';
        this.selectedMoon = null;
        this.timeWarp = 86400;
        this.isAnimating = false;
        this.elements = [];
        this.fpsCounter = null;
        this.helpOverlay = null;
        this.moonScaleSlider = null;
        this.isMobilePanelExpanded = false;
        this.dateTimeDisplay = null;
        this.liveIndicator = null;
        this.isLive = true;
        this._init();
    }

    _init() {
        this._createMissionControlPanel();
        this._createDateTimeDisplay();
        this._createFPSCounter();
        this._createHelpOverlay();
        this._setupResponsiveBehavior();
        this._updateMoonDropdown('sun');
        this._updateInfoPanel('sun', 'planet');
        this._startDateTimeUpdate();
    }

    _createMissionControlPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'mission-control-panel';
        this.panel.className = 'mission-control-panel glass-panel'; // Added glass-panel class

        // Open by default on desktop
        if (window.innerWidth >= 800) this.panel.classList.add('open');

        const isMobile = window.innerWidth < 800;
        // Use an SVG arrow for desktop, hamburger for mobile
        const toggleIcon = isMobile ? '☰' : `
        <svg class="arrow-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>`;

        this.panel.innerHTML = `
            <button id="panel-toggle-btn" class="panel-toggle" aria-label="Toggle Menu">${toggleIcon}</button>
            <div class="mission-control-header">
                <h2>Mission Control</h2>
            </div>
        `;

        const content = document.createElement('div');
        content.id = 'mission-control-content';
        content.className = 'mission-control-content show';

        content.appendChild(this._createSimulationControls());
        content.appendChild(this._createPlanetSelector());
        content.appendChild(this._createMoonSelector());
        content.appendChild(this._createTimeWarpControl());


        this.infoPanel = this._createInfoPanel();
        content.appendChild(this.infoPanel);

        // Add VR & Recording Controls Section
        content.appendChild(this._createVRControls());

        this.panel.appendChild(content);
        document.body.appendChild(this.panel);
        this.elements.push(this.panel);

        const toggleBtn = this.panel.querySelector('#panel-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (window.innerWidth >= 800) {
                    this.panel.classList.toggle('open');
                } else {
                    this._toggleMobilePanel();
                }
            });
        }
    }

    _createSimulationControls() {
        const div = document.createElement('div');
        div.className = 'control-group sim-controls-group';

        const row = document.createElement('div');
        row.className = 'sim-button-row';

        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'btn-pause';
        pauseBtn.className = 'sim-button';
        pauseBtn.textContent = 'Pause';
        pauseBtn.addEventListener('click', () => {
            if (this.solarSystem) {
                const isPaused = this.solarSystem.togglePause();
                pauseBtn.textContent = isPaused ? 'Play' : 'Pause';
            }
        });

        const orbitsBtn = document.createElement('button');
        orbitsBtn.id = 'btn-orbits';
        orbitsBtn.className = 'sim-button';
        orbitsBtn.textContent = 'Orbit Lines: ON';
        orbitsBtn.classList.add('active');
        orbitsBtn.style.display = 'block';

        // Initialize state assumption
        let orbitsVisible = true;
        if (this.solarSystem) {
            this.solarSystem.orbitsVisible = true;
            this.solarSystem.setOrbitsVisible(true);
        }

        orbitsBtn.addEventListener('click', () => {
            if (this.solarSystem) {
                orbitsVisible = !orbitsVisible;
                this.solarSystem.setOrbitsVisible(orbitsVisible);
                orbitsBtn.textContent = orbitsVisible ? 'Orbit Lines: ON' : 'Orbit Lines: OFF';
                orbitsBtn.classList.toggle('active', orbitsVisible);
            }
        });

        row.appendChild(pauseBtn);
        row.appendChild(orbitsBtn);

        // Removed L-Points and Go Live (Redundant/Noise)

        div.appendChild(row);

        return div;
    }

    _createPlanetSelector() {
        const div = document.createElement('div');
        div.className = 'control-group';
        div.style.marginBottom = '5px'; // Compact
        div.innerHTML = `<label class="control-label" for="planet-selector" style="font-size:12px; margin-bottom:2px;">Select Body</label>`;

        const select = document.createElement('select');
        select.id = 'planet-selector';
        select.className = 'planet-selector';

        // Added 'pluto' and 'halley'
        ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'halley'].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p === 'halley' ? "Halley's Comet" : p.charAt(0).toUpperCase() + p.slice(1);
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
            const planet = e.target.value;
            this.selectedPlanet = planet;
            this.selectedMoon = null;
            this._updateMoonDropdown(planet);
            this._updateInfoPanel(planet, planet === 'halley' ? 'comet' : 'planet');
            this._animateToPlanet(planet);
            if (window.innerWidth < 800) this._mobileCollapse();
        });

        div.appendChild(select);
        this.planetSelect = select;
        return div;
    }

    _createMoonSelector() {
        const div = document.createElement('div');
        div.id = 'moon-selector-group';
        div.className = 'control-group moon-selector-group';
        div.style.display = 'none';

        div.innerHTML = `<label class="control-label" for="moon-selector" style="font-size:12px; margin-bottom:2px;">Natural Moons</label>`;
        const select = document.createElement('select');
        select.id = 'moon-selector';
        select.className = 'moon-selector';

        select.addEventListener('change', (e) => {
            const moon = e.target.value;
            if (moon && moon !== 'none') {
                this.selectedMoon = moon;
                this._updateInfoPanel(moon, 'moon');
                this._animateToMoon(moon);
                if (window.innerWidth < 800) this._mobileCollapse();
            }
        });

        div.appendChild(select);
        this.moonSelectorGroup = div;
        this.moonSelect = select;
        return div;
    }

    _createTimeWarpControl() {
        const div = document.createElement('div');
        div.className = 'control-group time-warp-group';
        div.style.marginBottom = '5px'; // Compact spacing

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '2px';

        const label = document.createElement('label');
        label.className = 'control-label';
        label.textContent = 'Time Speed';
        label.style.marginBottom = '0';
        label.style.fontSize = '12px'; // Smaller font

        this.timeWarpDisplay = document.createElement('div');
        this.timeWarpDisplay.className = 'time-warp-display';
        this.timeWarpDisplay.textContent = '1 Day/s';
        this.timeWarpDisplay.style.fontSize = '12px';
        this.timeWarpDisplay.style.color = '#00ffff';

        header.appendChild(label);
        header.appendChild(this.timeWarpDisplay);
        div.appendChild(header);

        // SLIDER CONTAINER
        const sliderContainer = document.createElement('div');
        sliderContainer.style.display = 'flex';
        sliderContainer.style.alignItems = 'center';
        sliderContainer.style.gap = '8px';

        // THE SLIDER (Range 0 - 100)
        // 0-10: Slow/Realtime. 10-100: Logarithmic Speed up to ~10 Million x
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = '25'; // Default approx 1 day/sec
        slider.className = 'speed-slider';
        slider.style.width = '100%';
        slider.style.height = '4px';
        slider.style.accentColor = '#00ffff';

        this.timeWarpSlider = slider;

        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            let speed = 0;

            if (val === 0) {
                speed = 0; // Paused
            } else if (val <= 10) {
                // Fine adjustments near real-time (0 to 10 mapped to 0.1x to 10x)
                speed = val / 5.0;
            } else {
                // Logarithmic growth
                // val 10 -> speed 1
                // val 100 -> speed ~30,000,000 (1 year/sec)
                // Formula: base * 10 ^ ((val-10) / factor)
                // We want max to be approx 31,536,000 (1 year/sec)
                // log10(31,536,000) ~= 7.5
                // so 90 steps cover 7.5 orders of magnitude -> factor = 90/7.5 = 12
                const factor = 12.0;
                speed = Math.pow(10, (val - 10) / factor);
            }

            this._updateTimeWarp(speed, true); // true = fromSlider
        });

        sliderContainer.appendChild(slider);
        div.appendChild(sliderContainer);

        // PRESET BUTTONS (Compacted)
        const btnGroup = document.createElement('div');
        btnGroup.className = 'speed-button-group';
        btnGroup.style.marginTop = '4px';
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '4px';

        const speeds = [
            { label: 'Real Time', val: 1 },
            { label: 'Cinematic', val: 'cinematic' }
        ];

        speeds.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'speed-btn compact-btn'; // Add compact class in CSS or inline
            btn.textContent = s.label;
            btn.dataset.speed = s.val;
            btn.style.flex = '1';
            btn.style.padding = '4px 8px';
            btn.style.fontSize = '11px';

            if (s.val === this.timeWarp) btn.classList.add('active');

            btn.addEventListener('click', () => {
                this._updateTimeWarp(s.val);
            });

            btnGroup.appendChild(btn);
        });

        div.appendChild(btnGroup);

        return div;
    }

    _createInfoPanel() {
        const div = document.createElement('div');
        div.className = 'mission-info-panel';
        return div;
    }

    /**
     * Creates VR & Recording Controls Section
     * Contains VR Enter button and Video Recording button
     */
    _createVRControls() {
        const div = document.createElement('div');
        div.className = 'control-group vr-controls-group';

        // Section Label
        const label = document.createElement('label');
        label.className = 'control-label';
        label.textContent = 'VR & Recording';
        label.style.fontSize = '12px';
        label.style.marginBottom = '8px';
        label.style.display = 'block';
        label.style.color = '#00d4ff';
        label.style.borderTop = '1px solid rgba(0, 212, 255, 0.2)';
        label.style.paddingTop = '12px';
        label.style.marginTop = '8px';
        div.appendChild(label);

        // Button Row
        const row = document.createElement('div');
        row.className = 'vr-button-row';
        row.style.display = 'flex';
        row.style.gap = '8px';

        // VR Button
        const vrBtn = document.createElement('button');
        vrBtn.id = 'vr-enter-btn';
        vrBtn.className = 'sim-button vr-btn';
        vrBtn.innerHTML = '🥽 Enter VR';
        vrBtn.style.flex = '1';
        vrBtn.disabled = true; // Disabled until XR is available
        vrBtn.title = 'Checking VR availability...';

        // Track VR state
        this.isInVR = false;
        this.currentXRSession = null;

        // Check WebXR availability
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
                if (supported) {
                    vrBtn.disabled = false;
                    vrBtn.title = 'Enter VR Mode';
                    vrBtn.addEventListener('click', async () => {
                        if (this.isInVR && this.currentXRSession) {
                            // Exit VR
                            await this.currentXRSession.end();
                            this.isInVR = false;
                            this.currentXRSession = null;
                            vrBtn.innerHTML = '🥽 Enter VR';
                            vrBtn.classList.remove('vr-active');
                        } else {
                            // Enter VR
                            await this._startVRSession(vrBtn);
                        }
                    });
                } else {
                    vrBtn.innerHTML = '🥽 VR N/A';
                    vrBtn.title = 'VR not supported on this device';
                }
            }).catch(() => {
                vrBtn.innerHTML = '🥽 VR N/A';
                vrBtn.title = 'VR not available';
            });
        } else {
            vrBtn.innerHTML = '🥽 VR N/A';
            vrBtn.title = 'WebXR not supported';
        }

        // Recording Button
        const recordBtn = document.createElement('button');
        recordBtn.id = 'record-btn';
        recordBtn.className = 'sim-button record-btn-panel';
        recordBtn.innerHTML = '🎥 Record';
        recordBtn.style.flex = '1';
        recordBtn.title = 'Start/Stop Video Recording';

        row.appendChild(vrBtn);
        row.appendChild(recordBtn);
        div.appendChild(row);

        return div;
    }

    /**
     * Start VR session with proper state management
     */
    async _startVRSession(vrBtn) {
        try {
            if (!navigator.xr || !window.appInstance?.renderer) {
                alert('VR not available');
                return;
            }

            const renderer = window.appInstance.renderer;

            // Request new session (no optional features for max compatibility)
            const session = await navigator.xr.requestSession('immersive-vr');

            // Set the session on the renderer
            await renderer.xr.setSession(session);

            this.currentXRSession = session;
            this.isInVR = true;

            // Update button
            if (vrBtn) {
                vrBtn.innerHTML = '🥽 Exit VR';
                vrBtn.classList.add('vr-active');
            }

            // Handle session end
            session.addEventListener('end', () => {
                this.isInVR = false;
                this.currentXRSession = null;
                if (vrBtn) {
                    vrBtn.innerHTML = '🥽 Enter VR';
                    vrBtn.classList.remove('vr-active');
                }
            });

        } catch (err) {
            console.warn('Failed to start VR session:', err);
            this.isInVR = false;
            this.currentXRSession = null;
        }
    }



    _updateMoonDropdown(planet) {
        const moons = MOON_DATA[planet] || [];
        this.moonSelect.innerHTML = '';
        if (moons.length === 0) {
            this.moonSelectorGroup.style.display = 'none';
            this.moonSelect.innerHTML = '<option value="none">No Moons</option>';
        } else {
            this.moonSelectorGroup.style.display = 'block';
            this.moonSelect.innerHTML = `<option value="">-- Choose Moon (${moons.length}) --</option>`;
            moons.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id; opt.textContent = m.name;
                this.moonSelect.appendChild(opt);
            });
        }
    }

    _updateInfoPanel(key, type) {
        let data;
        if (type === 'planet') {
            if (key === 'sun') data = { name: 'Sun', physical: { radius: 696342 }, description: 'The Star.' };
            else data = NASA_PLANETS[key];
        } else if (key === 'halley' || type === 'comet') {
            data = {
                name: "Halley's Comet",
                physical: { radius: 11 },
                description: "A famous short-period comet visible from Earth every 75-76 years."
            };
        } else {
            data = NASA_MOONS[key];
        }

        if (!data) return;
        const name = data.name || key;
        const radius = data.physical?.radius || 0;

        this.infoPanel.innerHTML = `
            <div class="info-title">${name}</div>
            <div class="info-details">
                <div class="info-row"><span class="info-label">Radius:</span><span class="info-value">${radius} km</span></div>
                <div class="info-desc">${(data.description || '').split('.')[0]}.</div>
            </div>
        `;
    }

    _updateTimeWarp(val, fromSlider = false) {
        this.timeWarp = val;

        // Update Buttons Interface
        const buttons = this.panel.querySelectorAll('.speed-btn');
        buttons.forEach(b => {
            b.classList.remove('active');
            if (b.dataset.speed == val) b.classList.add('active'); // Exact match
        });

        // Handle special modes
        if (val === 'cinematic') {
            this.timeWarpDisplay.textContent = 'Cinematic';
            if (this.solarSystem) this.solarSystem.setCinematicMode(true);
            if (this.inputController) this.inputController.setCinematic(true);

            // Set slider to a visual position representing cinematic (approx middle)
            if (!fromSlider && this.timeWarpSlider) this.timeWarpSlider.value = '55'; // Arbitrary "fast" pos

        } else {
            // Numeric Speed
            if (this.solarSystem) {
                this.solarSystem.setCinematicMode(false);
                if (val === 1) this.solarSystem.setRealTime();
                this.solarSystem.setTimeSpeed(val);
            }
            if (this.inputController) this.inputController.setCinematic(false);

            // Update Text Display
            if (val === 0) {
                this.timeWarpDisplay.textContent = 'PAUSED';
            } else if (val === 1) {
                this.timeWarpDisplay.textContent = 'Real-Time';
            } else {
                // Format nicely
                if (val >= 31536000) this.timeWarpDisplay.textContent = `${(val / 31536000).toFixed(1)} Year/s`;
                else if (val >= 2592000) this.timeWarpDisplay.textContent = `${(val / 2592000).toFixed(1)} Month/s`;
                else if (val >= 86400) this.timeWarpDisplay.textContent = `${(val / 86400).toFixed(1)} Day/s`;
                else if (val >= 3600) this.timeWarpDisplay.textContent = `${(val / 3600).toFixed(1)} Hr/s`;
                else this.timeWarpDisplay.textContent = `${val.toFixed(1)}x`;
            }

            // Sync Slider if updated from button/external
            if (!fromSlider && this.timeWarpSlider) {
                if (val === 0) this.timeWarpSlider.value = '0';
                else if (val <= 2.0) this.timeWarpSlider.value = (val * 5).toString();
                else {
                    // Reverse log calculation: value = 10 + 12 * log10(val)
                    const sliderVal = 10 + 12 * Math.log10(val);
                    this.timeWarpSlider.value = Math.min(100, Math.max(0, sliderVal));
                }
            }
        }
    }

    _resetToRealTime() {
        this._updateTimeWarp(1);
        // Slider removed
    }

    _animateToPlanet(key) {
        if (this.isAnimating || !this.inputController) return;

        // Auto-throttle: Switch to cinematic when flying to a planet
        if (this.timeWarp !== 'cinematic' && this.timeWarp !== 1) {
            this._updateTimeWarp('cinematic');
            const buttons = this.panel.querySelectorAll('.speed-btn');
            buttons.forEach(b => {
                b.classList.toggle('active', b.dataset.speed === 'cinematic');
            });
        }

        // Optimize speed for this body if in cinematic mode
        if (this.timeWarp === 'cinematic' && this.solarSystem) {
            this.solarSystem.setCinematicFocus(key);
        }

        this.isAnimating = true;
        if (this.inputController.flyTo) this.inputController.flyTo(key, 2000).finally(() => this.isAnimating = false);
        else if (this.inputController.focusOnBody) { this.inputController.focusOnBody(key); this.isAnimating = false; }
    }

    _animateToMoon(key) {
        if (this.isAnimating || !this.inputController) return;

        // Auto-throttle: Switch to cinematic when flying to a moon
        if (this.timeWarp !== 'cinematic' && this.timeWarp !== 1) {
            this._updateTimeWarp('cinematic');
            const buttons = this.panel.querySelectorAll('.speed-btn');
            buttons.forEach(b => {
                b.classList.toggle('active', b.dataset.speed === 'cinematic');
            });
        }

        // Optimize speed for this body if in cinematic mode
        if (this.timeWarp === 'cinematic' && this.solarSystem) {
            this.solarSystem.setCinematicFocus(key);
        }

        this.isAnimating = true;
        // Use a longer flight duration for moons to ensure smoother animation to smaller targets
        if (this.inputController.flyTo) this.inputController.flyTo(key, 2000).finally(() => this.isAnimating = false);
        else if (this.inputController.focusOnBody) { this.inputController.focusOnBody(key); this.isAnimating = false; }
    }

    _toggleMobilePanel() {
        const content = this.panel.querySelector('#mission-control-content');
        this.isMobilePanelExpanded = content.classList.toggle('show');
    }

    _mobileCollapse() {
        const content = this.panel.querySelector('#mission-control-content');
        content.classList.remove('show');
        this.isMobilePanelExpanded = false;
    }

    _createFPSCounter() {
        const div = document.createElement('div');
        div.id = 'fps-counter';
        div.className = 'mission-fps-counter';
        div.textContent = 'FPS: --';
        document.body.appendChild(div);
        this.elements.push(div);
        this.fpsCounter = div;
    }

    _createHelpOverlay() {
        const div = document.createElement('div');
        div.id = 'mission-help-overlay';
        div.className = 'mission-help-overlay';
        div.innerHTML = '<div>Controls: Click/Drag/Scroll</div>';
        document.body.appendChild(div);
        this.elements.push(div);
    }

    _setupResponsiveBehavior() {
        window.addEventListener('resize', () => {
            const content = this.panel.querySelector('#mission-control-content');
            const toggleBtn = this.panel.querySelector('#panel-toggle-btn');

            if (window.innerWidth >= 800) {
                // Desktop: Content always block (handled by CSS), Arrow shows
                content.classList.add('show');
                if (toggleBtn) toggleBtn.textContent = ''; // CSS Arrow takes over
            } else {
                // Mobile: Hamburger shows
                if (toggleBtn) toggleBtn.textContent = '☰';
            }
        });
    }

    updateFPS(fps) {
        if (this.fpsCounter) {
            this.fpsCounter.textContent = `FPS: ${fps}`;
            this.fpsCounter.style.color = fps > 30 ? '#00FF88' : '#FF6B6B';
        }
    }

    dispose() {
        if (this._dateTimeInterval) clearInterval(this._dateTimeInterval);
        this.elements.forEach(e => e.remove());
    }

    _createDateTimeDisplay() {
        // NASA-style date/time display at bottom center
        const container = document.createElement('div');
        container.id = 'datetime-display';
        container.className = 'datetime-display';
        container.innerHTML = `
            <span class="live-indicator" id="live-indicator">● LIVE</span>
            <span class="datetime-date" id="datetime-date">JAN 26, 2026</span>
            <span class="datetime-rate" id="datetime-rate">REAL RATE</span>
            <span class="datetime-time" id="datetime-time">04:42:00 AM</span>
        `;
        document.body.appendChild(container);
        this.elements.push(container);
        this.dateTimeDisplay = container;
        this.liveIndicator = container.querySelector('#live-indicator');
    }

    _startDateTimeUpdate() {
        // Update date/time display every 100ms for smooth animation
        this._dateTimeInterval = setInterval(() => {
            if (!this.solarSystem) return;

            const simTime = this.solarSystem.getSimulationTime?.() || Date.now();
            const date = new Date(simTime);

            const dateEl = document.getElementById('datetime-date');
            const timeEl = document.getElementById('datetime-time');
            const rateEl = document.getElementById('datetime-rate');
            const liveEl = document.getElementById('live-indicator');

            if (dateEl) {
                const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                dateEl.textContent = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
            }

            if (timeEl) {
                const hours = date.getHours();
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const h12 = hours % 12 || 12;
                const mins = String(date.getMinutes()).padStart(2, '0');
                const secs = String(date.getSeconds()).padStart(2, '0');
                timeEl.textContent = `${String(h12).padStart(2, '0')}:${mins}:${secs} ${ampm}`;
            }

            if (rateEl && liveEl) {
                const speed = this.timeWarp || 1;
                if (speed === 1) {
                    rateEl.textContent = 'REAL RATE';
                    liveEl.style.display = 'inline';
                    liveEl.style.color = '#00FF88';
                } else if (speed === 'cinematic') {
                    rateEl.textContent = 'CINEMATIC';
                    liveEl.style.display = 'inline';
                    liveEl.style.color = '#FFD700'; // Gold color for cinematic
                } else if (speed === 0) {
                    rateEl.textContent = 'PAUSED';
                    liveEl.style.display = 'none';
                } else {
                    rateEl.textContent = `${speed.toLocaleString()}x`;
                    liveEl.style.display = 'none';
                }
            }
        }, 100);
    }
}
