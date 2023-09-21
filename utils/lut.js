import { linearRGBFromSRGB } from './color.js';
import { readRGBAFromBytes } from './pixel.js';

/**
 * @param {ReturnType<import('./dds.js').parseDDS>} dds
 * @param {number} x [0 - 1]
 * @param {number} y [0 - 1]
 * @param {number} z [0 - 1]
 */
function parseLUTColorFromDDS(dds, x, y, z) {
  const squares = dds.header.width / dds.header.height;
  const max = squares - 1;
  const squareNumber = Math.round((z * max));

  const ddsY = Math.round((y * max));
  const ddsX = (squares * squareNumber) + Math.round(x * max);

  const pixelPosition = (ddsY * dds.header.width + ddsX) * dds.bytesPerPixel;

  return readRGBAFromBytes(dds.surface, pixelPosition);
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
  const black = linearRGBFromBytes(parseLUTColorFromDDS(dds, 0, 0, 0));
  const white = linearRGBFromBytes(parseLUTColorFromDDS(dds, 1, 1, 1));

  const squares = dds.header.width / dds.header.height;
  const points = [];
  for (let z = 0; z < squares; z++) {
    for (let x = 0; x < squares; x++) {
      for (let y = 0; y < squares; y++) {
        const relativeX = x / (squares - 1);
        const relativeY = y / (squares - 1);
        const relativeZ = z / (squares - 1);
        const raw = parseLUTColorFromDDS(dds, relativeX, relativeY, relativeZ);
        const linear = linearRGBFromBytes(raw);

        points.push({
          x: relativeX,
          y: relativeY,
          z: relativeZ,
          raw,
          linear,
        });
      }
    }
  }

  return { black, white, points };
}
