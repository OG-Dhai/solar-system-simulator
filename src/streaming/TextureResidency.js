/**
 * Texture Residency System
 * A strict state machine tracking where the asset currently lives in the pipeline.
 * Skill activated: code-simplification
 */

export const ResidencyState = {
    UNLOADED: 'Unloaded',
    RAM_RESIDENT: 'RAM_Resident',
    UPLOADING: 'Uploading',
    VRAM_RESIDENT: 'VRAM_Resident',
    EVICTING: 'Evicting'
};

export class TextureResidency {
    constructor() {
        this.states = new Map(); // id -> ResidencyState
    }

    getState(id) {
        return this.states.get(id) || ResidencyState.UNLOADED;
    }

    transition(id, newState) {
        const currentState = this.getState(id);
        
        // Simplified state machine validation
        if (currentState === ResidencyState.UPLOADING && newState === ResidencyState.EVICTING) {
            console.warn(`Cannot evict asset ${id} while uploading. Must wait for VRAM_Resident.`);
            return false;
        }

        this.states.set(id, newState);
        return true;
    }

    restore(id, handle) {
        // If an asset was EVICTING or RAM_RESIDENT but not fully destroyed, 
        // we can restore it back to the active queue.
        const state = this.getState(id);
        if (state === ResidencyState.EVICTING || state === ResidencyState.RAM_RESIDENT) {
            this.transition(id, ResidencyState.UPLOADING);
            // Needs to be re-queued in the upload scheduler
            document.dispatchEvent(new CustomEvent('AssetRAMResident', { detail: { id, handle } }));
        }
    }
}
