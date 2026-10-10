export const Opcodes = {
    INIT: 0,
    READY: 1,
    TICK_SYNC: 2,
    RETURN_BUFFER: 3,
    HEARTBEAT: 4,
    SPAWN_ENTITY: 5,
    ERROR: 6
};

// Physics constants
export const PHYSICS_TICK_RATE = 60;
export const FIXED_TIMESTEP = 1000 / PHYSICS_TICK_RATE;
export const MAX_ENTITIES = 10000;
// We'll store Position (x,y,z), Velocity (x,y,z), Mass (m) etc. in the buffer
// Let's say 10 floats per entity = 40 bytes.
// With tick ID and timestamp at the beginning.
