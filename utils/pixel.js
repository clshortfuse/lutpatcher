/**
 * @param {Uint8Array} array
 * @param {number} offset
 * @return {[number,number,number,number]}
 */
export function readRGBAFromBytes(array, offset = 0) {
  return array.subarray(offset, offset + 4);
}

/**
 *
 * @param {Uint8Array} array
 * @param {number} offset
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {number} alpha
 */
export function writeRGBABytes(array, offset, red, green, blue, alpha = 255) {
  array[offset] = red;
  array[offset + 1] = green;
  array[offset + 2] = blue;
  array[offset + 3] = alpha;
}
