import { linearRGBFromSRGB, sRGBFromLinearRGB } from './color.js';

/**
 * @param {ReturnType<import('./dds.js').parseDDS>} dds
 * @param {number} x [0 - 1]
 * @param {number} y [0 - 1]
 * @param {number} z [0 - 1]
 */
function getDataOffset(dds, x, y, z) {
  const squares = Math.cbrt(dds.pixels);
  const max = squares - 1;

  let pixelOffset = 0;
  if (dds.header.depth <= 1) {
    // Roll into 2D
    const squareNumber = Math.round((z * max));

    const ddsY = Math.round((y * max));
    const ddsX = (squares * squareNumber) + Math.round(x * max);

    pixelOffset = (ddsY * dds.header.width + ddsX);
  } else {
    const ddsZ = Math.round((z * max));
    let ddsY = Math.round((y * max));
    const ddsX = Math.round(x * max);

    ddsY = max - ddsY; // flip Y

    pixelOffset = (ddsZ * (dds.header.width * dds.header.height))
     + (ddsY * dds.header.width)
     + ddsX;
  }
  return pixelOffset * dds.bytesPerPixel;
}

/**
 * @param {Uint8Array|[number,number,number,number?]} bytes
 * @return {[number,number,number]}
 */
function linearRGBFromBytes(bytes) {
  return [
    linearRGBFromSRGB(bytes[0] / 255),
    linearRGBFromSRGB(bytes[1] / 255),
    linearRGBFromSRGB(bytes[2] / 255),
  ];
}

/**
 * @param {ReturnType<import('./dds.js').parseDDS>} dds
 */
export function parseLUT(dds) {
  const bytesPerPixel = dds.bytesPerPixel;

  const squares = Math.cbrt(dds.pixels);
  /**
   * @typedef {Object} LutPoint
   * @prop {number} x
   * @prop {number} y
   * @prop {number} z
   * @prop {number} offset
   * @prop {Uint8Array|[number,number,number,number?]} raw
   * @prop {[number,number,number]} linear
   * @prop {[number,number,number]} srgb8
   */
  /** @type {LutPoint[]} */
  const points = [];

  const bytesPerChannel = bytesPerPixel / 4;
  const dataView = new DataView(dds.surface.buffer);

  for (let z = 0; z < squares; z++) {
    for (let y = 0; y < squares; y++) {
      for (let x = 0; x < squares; x++) {
        const relativeX = x / (squares - 1);
        const relativeY = y / (squares - 1);
        const relativeZ = z / (squares - 1);
        let linear;
        let srgb;
        let srgb8;
        const dataOffset = getDataOffset(dds, relativeX, relativeY, relativeZ);
        const offset = dds.surface.byteOffset + dataOffset;
        switch (dds.header10.dxgiFormat) {
          case 28: // DXGI_FORMAT_R8G8B8A8_UNORM
          case 29: // DXGI_FORMAT_R8G8B8A8_UNORM_SRGB
            srgb8 = [
              dataView.getUint8(offset),
              dataView.getUint8(offset + bytesPerChannel),
              dataView.getUint8(offset + bytesPerChannel + bytesPerChannel),
            ];
            break;
          case 11: // DXGI_FORMAT_R16G16B16A16_UNORM
            srgb = [
              dataView.getUint16(offset, true) / 65_535,
              dataView.getUint16(offset + bytesPerChannel, true) / 65_535,
              dataView.getUint16(offset + bytesPerChannel + bytesPerChannel, true) / 65_535,
            ];
            break;
          case 2: // DXGI_FORMAT_R32G32B32A32_FLOAT:
            linear = [
              dataView.getFloat32(offset, true),
              dataView.getFloat32(offset + bytesPerChannel, true),
              dataView.getFloat32(offset + bytesPerChannel + bytesPerChannel, true),
            ];
            break;
          default:
            throw new Error(`Unsupported format: ${dds.header10.dxgiFormat}`);
        }

        const raw = dds.surface.subarray(dataOffset, dataOffset + dds.bytesPerPixel);
        if (linear) {
          srgb = linear.map((c) => sRGBFromLinearRGB(c));
          srgb8 = srgb.map((c) => Math.round(c * 255));
        } else {
          if (srgb8) {
            srgb = srgb8.map((c) => c / 255);
          } else {
            srgb8 = srgb.map((c) => Math.round(c * 255));
          }
          linear = srgb.map((c) => linearRGBFromSRGB(c));
        }

        points.push({
          x: relativeX,
          y: relativeY,
          z: relativeZ,
          offset,
          raw,
          linear,
          srgb8,
        });
      }
    }
  }

  const black = points[0].linear;
  const white = points.at(-1).linear;

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @return {LutPoint}
   */
  function atExact(x, y, z) {
    const offset = (z * squares * squares) + (y * squares) + x;
    return points[offset];
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @return {LutPoint}
   */
  function at(x, y, z) {
    const max = squares - 1;

    const roundedX = Math.round(x * max);
    const roundedY = Math.round(y * max);
    const roundedZ = Math.round(z * max);

    return atExact(roundedX, roundedY, roundedZ);
  }

  return { black, white, points, at, atExact, squares };
}
