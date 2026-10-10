/**
 * Bitmask utility for fast O(1) component signature matching.
 * Currently limited to 31 components (JS bitwise operations work on 32-bit signed integers).
 * For >31 components, this should be refactored to use a Uint32Array chunking system.
 */
export class Bitmask {
  constructor() {
    this.mask = 0;
  }

  /**
   * Adds a component bit to the mask.
   * @param {number} bit - The bit index (0 to 30)
   */
  add(bit) {
    this.mask |= (1 << bit);
  }

  /**
   * Removes a component bit from the mask.
   * @param {number} bit - The bit index (0 to 30)
   */
  remove(bit) {
    this.mask &= ~(1 << bit);
  }

  /**
   * Checks if this mask contains all bits of another mask.
   * @param {number} otherMask - The mask to check against
   * @returns {boolean}
   */
  contains(otherMask) {
    return (this.mask & otherMask) === otherMask;
  }

  /**
   * Checks if this mask contains ANY bits of another mask.
   * @param {number} otherMask 
   * @returns {boolean}
   */
  intersects(otherMask) {
    return (this.mask & otherMask) > 0;
  }

  clear() {
    this.mask = 0;
  }
}
