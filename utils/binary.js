/* eslint-disable no-bitwise */

/**
 * @param {number} number
 * @return {string}
 */
export function hexFromNumber(number) {
  return number.toString(16).padStart(2, '0');
}

/**
 * @param {string} hex
 * @return {number}
 */
export function numberFromHex(hex) {
  return Number.parseInt(hex, 16);
}

/**
 * @param {number} number
 * @return {string}
 */
export function u32HexFromNumber(number) {
  let hex = '';

  while (number >= 0b100_0000) {
    // Take last 7 bits of number and shift
    hex += hexFromNumber((0b0111_1111 & number) | (0b1000_0000));
    number >>= 7;
  }
  return hex + hexFromNumber(number);
}

/**
 * @param {number} number
 * @return {string}
 */
export function u30HexFromNumber(number) {
  return u32HexFromNumber(number & 0x3F_FF_FF_FF);
}

/**
 * @param {string} hex
 * @return {Uint8Array}
 */
export function Uint8ArrayFromHex(hex) {
  const length = hex.length / 2;
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const offset = i * 2;
    array[i] = numberFromHex(hex.slice(offset, offset + 2));
  }
  return array;
}

/**
 * @param {Uint8Array} uint8Array
 * @return {string}
 */
export function hexFromUint8Array(uint8Array) {
  let hex = '';
  const length = uint8Array.length;
  for (let i = 0; i < length; i++) {
    hex += hexFromNumber(uint8Array[i]);
  }
  return hex;
}

/** @type {TextDecoder} */
let utf8Decoder;

/**
 *
 * @param {Uint8Array} uint8Array
 * @param {number} [start]
 * @param {number} [end]
 * @return {string}
 */
export function utf8FromUint8Array(uint8Array, start, end) {
  utf8Decoder ??= new TextDecoder();
  return utf8Decoder.decode((start || end) ? uint8Array.subarray(start, end) : uint8Array);
}
