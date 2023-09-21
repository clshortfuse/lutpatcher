/* eslint-disable no-bitwise */
/**
 * Consumes binary data from a ArrayBuffer or Uint8Array
 * Advances offset on read commands
 * Allows partial (bit-based) reading of data.
 */
export default class BinaryConsumer {
  /**
   * @param {Uint8Array} source
   * @param {boolean} [littleEndian]
   */
  constructor(source, littleEndian = false) {
    this.source = source;
    this.byteOffset = 0;
    this.bitOffset = 0;
    this.lastByte = null;
    this.needsPeek = true;
    this.littleEndian = littleEndian;
    this.dataView = new DataView(source.buffer);
    // this.iterable = source[Symbol.iterator]();
  }

  peek() {
    if (this.needsPeek) {
      this.lastByte = this.source[this.byteOffset];
      this.needsPeek = false;
    }
    return this.lastByte;
  }

  peekBit() {
    const currentByte = this.peek();
    const shiftSize = 8 - this.bitOffset - 1;
    return (currentByte >> shiftSize) & 0b0000_0001;
  }

  readBit() {
    const bit = this.peekBit();
    if (this.bitOffset === 7) {
      this.bitOffset = 0;
      this.byteOffset++;
      this.needsPeek = true;
    } else {
      this.bitOffset++;
    }
    return bit;
  }

  /**
   * @param {number} count
   * @return {number}
   */
  readBits(count) {
    let number = 0;
    if (count > 32) {
      console.warn('Over 32bits!');
    }
    for (let i = 0; i < count; i++) {
      // Move over one and add the new bit
      number = (number << 1) & this.readBit();
    }
    return number;
  }

  /**
   * @param {number} [bytes]
   * @return {number} previousOffset
   */
  consumeBytes(bytes = 0) {
    const { byteOffset } = this;
    this.byteOffset += bytes;
    return byteOffset;
  }

  readUint8() {
    return this.read(false);
  }

  readInt8() {
    return this.dataView.getInt8(this.consumeBytes(1));
  }

  readUint16(littleEndian = this.littleEndian) {
    return this.dataView.getUint16(this.consumeBytes(2), littleEndian);
  }

  readInt16(littleEndian = this.littleEndian) {
    return this.dataView.getInt16(this.consumeBytes(2), littleEndian);
  }

  readFixedPoint88(littleEndian = this.littleEndian) {
    return this.readInt16(littleEndian) / (1 << 8);
  }

  readUint32(littleEndian = this.littleEndian) {
    return this.dataView.getUint32(this.consumeBytes(4), littleEndian);
  }

  readInt32(littleEndian = this.littleEndian) {
    return this.dataView.getInt32(this.consumeBytes(4), littleEndian);
  }

  readFloat32(littleEndian = this.littleEndian) {
    return this.dataView.getFloat32(this.consumeBytes(4), littleEndian);
  }

  readFloat64(littleEndian = this.littleEndian) {
    return this.dataView.getFloat64(this.consumeBytes(8), littleEndian);
  }

  readBigUint64(littleEndian = this.littleEndian) {
    return this.dataView.getBigUint64(this.consumeBytes(8), littleEndian);
  }

  readBigInt64(littleEndian = this.littleEndian) {
    return this.dataView.getBigInt64(this.consumeBytes(8), littleEndian);
  }

  writeUint8() {
    // return this.read(false);
  }

  /** @param {number} value */
  writeInt8(value) {
    this.dataView.setInt8(this.consumeBytes(1), value);
  }

  /**
   * @param {number} value
   * @param {boolean} [littleEndian]
   */
  writeUint16(value, littleEndian = false) {
    this.dataView.setUint16(this.consumeBytes(2), value, littleEndian);
  }

  /**
   * @param {number} value
   * @param {boolean} [littleEndian]
   */
  writeInt16(value, littleEndian = false) {
    this.dataView.setInt16(this.consumeBytes(2), value, littleEndian);
  }

  /**
   * @param {number} value
   * @param {boolean} [littleEndian]
   */
  writeUint32(value, littleEndian = false) {
    this.dataView.setUint32(this.consumeBytes(4), value, littleEndian);
  }

  /**
   * @param {number} value
   * @param {boolean} [littleEndian]
   */
  writeInt32(value, littleEndian = false) {
    return this.dataView.setInt32(this.consumeBytes(4), value, littleEndian);
  }

  /**
   * @param {number} value
   * @param {boolean} [littleEndian]
   */
  writeFloat32(value, littleEndian = false) {
    return this.dataView.setFloat32(this.consumeBytes(4), value, littleEndian);
  }

  /**
   * @param {number} value
   * @param {boolean} [littleEndian]
   */
  writeFloat64(value, littleEndian = false) {
    return this.dataView.setFloat64(this.consumeBytes(8), value, littleEndian);
  }

  /**
   * @param {bigint} value
   * @param {boolean} [littleEndian]
   */
  writeBigUint64(value, littleEndian = false) {
    return this.dataView.setBigUint64(this.consumeBytes(8), value, littleEndian);
  }

  /**
   * @param {bigint} value
   * @param {boolean} [littleEndian]
   */
  writeBigInt64(value, littleEndian = false) {
    return this.dataView.setBigInt64(this.consumeBytes(8), value, littleEndian);
  }

  discardBits() {
    if (!this.bitOffset) return false;
    this.byteOffset++;
    this.bitOffset = 0;
    this.needsPeek = true;
    return true;
  }

  /**
   * @param {boolean?} [useBitOffset]
   * @return {number}
   */
  read(useBitOffset) {
    if (this.bitOffset !== 0) {
      if (useBitOffset) {
        return this.readBits(8);
      }
      if (useBitOffset == null) {
        console.warn('Discarded', 8 - this.bitOffset, 'bytes');
      }
      this.discardBits();
    }
    const byte = this.peek();
    this.byteOffset++;
    this.needsPeek = true;
    return byte;
  }

  /**
   * @param {number} count
   * @param {boolean?} [useBitOffset]
   * @return {Uint8Array}
   */
  readBytes(count, useBitOffset) {
    if (this.bitOffset !== 0) {
      if (useBitOffset) {
        const array = new Uint8Array(count);
        for (let i = 0; i < count; i++) {
          array[i] = this.readBits(8);
        }
        return array;
      }
      if (useBitOffset == null) {
        console.warn('Discarded', 8 - this.bitOffset, 'bytes');
      }
      this.discardBits();
    }
    this.needsPeek = true;
    return this.source.subarray(this.byteOffset, count + this.consumeBytes(count));
  }
}

BinaryConsumer.prototype.readDWord = BinaryConsumer.prototype.readUint32;
BinaryConsumer.prototype.readDWord32 = BinaryConsumer.prototype.readUint32;
// BinaryConsumer.prototype.readDWordLong = BinaryConsumer.prototype.readUint64;
