import { linearRGBFromSRGB } from './color.js';
import { readRGBAFromBytes, writeRGBABytes } from './pixel.js';

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
 * @param {[number,number,number,number?]} bytes
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
 * @param {number} x1
 * @param {number} y1
 * @param {number} z1
 * @param {number} x2
 * @param {number} y2
 * @param {number} z2
 */
function distance3d(x1, y1, z1, x2, y2, z2) {
  return Math.hypot(
    x2 - x1,
    y2 - y1,
    z2 - z1,
  );
}

/**
 * @param {ReturnType<import('./dds.js').parseDDS>} dds
 */
export function parseLUT(dds) {
  const black = linearRGBFromBytes(parseLUTColorFromDDS(dds, 0, 0, 0));
  const red = linearRGBFromBytes(parseLUTColorFromDDS(dds, 1, 0, 0));
  const green = linearRGBFromBytes(parseLUTColorFromDDS(dds, 0, 1, 0));
  const blue = linearRGBFromBytes(parseLUTColorFromDDS(dds, 0, 0, 1));
  const cyan = linearRGBFromBytes(parseLUTColorFromDDS(dds, 0, 1, 1));
  const magenta = linearRGBFromBytes(parseLUTColorFromDDS(dds, 1, 0, 1));
  const yellow = linearRGBFromBytes(parseLUTColorFromDDS(dds, 1, 1, 0));
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
          blackDistance: distance3d(relativeX, relativeY, relativeZ, 0, 0, 0),
          redDistance: distance3d(relativeX, relativeY, relativeZ, 1, 0, 0),
          greenDistance: distance3d(relativeX, relativeY, relativeZ, 0, 1, 0),
          blueDistance: distance3d(relativeX, relativeY, relativeZ, 0, 0, 1),
          cyanDistance: distance3d(relativeX, relativeY, relativeZ, 0, 1, 1),
          magentaDistance: distance3d(relativeX, relativeY, relativeZ, 1, 0, 1),
          yellowDistance: distance3d(relativeX, relativeY, relativeZ, 1, 1, 0),
          whiteDistance: distance3d(relativeX, relativeY, relativeZ, 1, 1, 1),
        });
      }
    }
  }

  return { black, white, red, green, blue, cyan, magenta, yellow, points };
  // const totalPixels = dds.surface.length / dds.bytesPerPixel;
  // const totalSquares = 16;
  // const squareSize = dds.header.height;
  // const squares = [];
  // for (let square = 0; square < totalSquares; square++) {
  //   const data = new Uint8Array(squareSize * squareSize * dds.bytesPerPixel);

  //   for (let row = 0; row < squareSize; row++) {
  //     const rowStart = (dds.header.width) * row;
  //     for (let column = 0; column < squareSize; column++) {
  //       const columnOffset = square * squareSize;
  //       const pixelPosition = rowStart + columnOffset + column;
  //       const offset = pixelPosition * dds.bytesPerPixel;
  //       // R8 G8 B8
  //       const slicedOffset = (row * squareSize + column) * dds.bytesPerPixel;
  //       writeRGBABytes(data, slicedOffset, ...readRGBAFromBytes(dds.surface, offset));
  //     }
  //   }
  //   squares.push(data);
  //   console.log(data);
  // }

  // const black = readRGBAFromBytes(squares[0], 0);
  // const peakRed = readRGBAFromBytes(squares[0], 15);
  // const peakGreen = readRGBAFromBytes(squares[0]);
}
