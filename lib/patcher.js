/* eslint-disable max-len */

import { linearRGBFromSRGB, retargetYFromLinearRGB, sRGBFromLinearRGB, yFromLinearRGB } from '../utils/color.js';
import { parseDDS } from '../utils/dds.js';
import { parseLUT } from '../utils/lut.js';
import { biasedScaling, linearNormalization } from '../utils/normalize.js';

/**
 * @param {Uint8Array} surface
 * @param {number} [bytesPerPixel=4]
 */
export function getLevels(surface, bytesPerPixel) {
  const pixelCount = surface.length / bytesPerPixel;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let totalY = 0;
  let blackY;
  let whiteY;
  const allYs = [];
  let minRed = Number.POSITIVE_INFINITY;
  let minBlue = Number.POSITIVE_INFINITY;
  let minGreen = Number.POSITIVE_INFINITY;
  let maxRed = Number.NEGATIVE_INFINITY;
  let maxBlue = Number.NEGATIVE_INFINITY;
  let maxGreen = Number.NEGATIVE_INFINITY;
  let allReds = 0;
  let allGreens = 0;
  let allBlues = 0;

  for (let index = 0; index < pixelCount; index++) {
    const offset = index * bytesPerPixel;
    // R8 G8 B8
    const sRed = surface[offset] / 255;
    const sGreen = surface[offset + 1] / 255;
    const sBlue = surface[offset + 2] / 255;
    // const alpha = data[offset + 3];

    const red = linearRGBFromSRGB(sRed);
    const green = linearRGBFromSRGB(sGreen);
    const blue = linearRGBFromSRGB(sBlue);

    const y = yFromLinearRGB(red, green, blue);
    if (index === 0) {
      blackY = y;
    } else if (index === pixelCount - 1) {
      whiteY = y;
    }
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    totalY += y;
    minRed = Math.min(minRed, red);
    minGreen = Math.min(minGreen, green);
    minBlue = Math.min(minBlue, blue);

    maxRed = Math.max(maxRed, red);
    maxGreen = Math.max(maxGreen, green);
    maxBlue = Math.max(maxBlue, blue);
    allReds += red;
    allGreens += green;
    allBlues += blue;

    allYs.push(y);
  }

  const averageY = allYs.reduce((sum, curr) => (sum + curr), 0) / allYs.length;
  const minChannel = Math.min(minRed, minGreen, minBlue);
  const maxChannel = Math.max(maxRed, maxGreen, maxBlue);
  const averageRed = allReds / allYs.length;
  const averageGreen = allGreens / allYs.length;
  const averageBlue = allBlues / allYs.length;

  const averageChannel = (allReds + allGreens + allBlues) / allYs.length / 3;

  allYs.sort((a, b) => a - b);
  const medianY = ((allYs[Math.floor(allYs.length / 2)]) + (allYs[Math.ceil(allYs.length / 2)])) / 2;

  const range = maxY - minY;

  return { minY, maxY, averageY, range, blackY, whiteY, medianY, minChannel, averageChannel, maxChannel, averageRed, averageGreen, averageBlue };
}

/**
 *
 * @param {ReturnType<import('./utils/dds.js').parseDDS} dds
 * @return {number}
 */
export function patchDDS(dds) {
  const { surface, bytesPerPixel, header10 } = dds;
  if (header10?.dxgiFormat !== 28) {
    // console.warn(filename, 'Only DXGI_FORMAT_R8G8B8A8_UNORM supported');
    return 0;
  }

  let pixelsChanged = 0;
  let crushCount = 0;
  let clipCount = 0;

  const levels = getLevels(surface, bytesPerPixel);
  const luts = parseLUT(dds);
  const scaleDown = (0 - levels.minChannel);
  const scaleUp = (1 - levels.maxChannel);
  // Black will be scaled by min channel
  const scaledBlack = luts.black.map((n) => n - levels.minChannel);
  // White will be scaled up by max channel
  const scaledWhite = luts.white.map((n) => n + (1 - levels.maxChannel));

  const scaledBlackY = yFromLinearRGB(...scaledBlack);
  const scaledWhiteY = yFromLinearRGB(...scaledWhite);

  for (const point of luts.points) {
    const { x, y, z } = point;

    if (scaleDown || scaleUp || scaledBlackY || scaledWhiteY !== 1) {
      const { raw, linear } = point;

      const linearX = linearRGBFromSRGB(x);
      const linearY = linearRGBFromSRGB(y);
      const linearZ = linearRGBFromSRGB(z);

      // Scale down to real shape

      const reshapedX = linearNormalization(linearX, 0, 1, levels.minChannel, levels.maxChannel);
      const reshapedY = linearNormalization(linearY, 0, 1, levels.minChannel, levels.maxChannel);
      const reshapedZ = linearNormalization(linearZ, 0, 1, levels.minChannel, levels.maxChannel);

      // Scale up biased to center
      const rescaledX = biasedScaling(reshapedX, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);
      const rescaledY = biasedScaling(reshapedY, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);
      const rescaledZ = biasedScaling(reshapedZ, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);

      const scaledRed = linearNormalization(rescaledX, 0, 1, scaleDown, scaleUp);
      const scaledGreen = linearNormalization(rescaledY, 0, 1, scaleDown, scaleUp);
      const scaledBlue = linearNormalization(rescaledZ, 0, 1, scaleDown, scaleUp);

      const blackDistance = Math.hypot(linearX, linearY, linearZ);
      const whiteDistance = Math.hypot(1 - linearX, 1 - linearY, 1 - linearZ);
      const totalRange = (blackDistance + whiteDistance);

      // const yChange = linearNormalization(blackDistance, 0, totalRange, -scaledBlackY, 1 - scaledWhiteY);
      const scaledY = linearNormalization(blackDistance, 0, totalRange, scaledBlackY, scaledWhiteY);
      const yChange2 = biasedScaling(scaledY, scaledBlackY, scaledWhiteY, 0, 1, levels.averageY);
      const yChange = linearNormalization(yChange2, 0, 1, -scaledBlackY, 1 - scaledWhiteY);

      const [red, green, blue] = linear;

      let newRed = red + scaledRed;
      let newGreen = green + scaledGreen;
      let newBlue = blue + scaledBlue;

      const currentY = yFromLinearRGB(newRed, newGreen, newBlue);

      if (currentY) {
        const targetY = currentY + yChange;
        if (targetY >= 1) {
          // Retarget to white
          newRed = 1;
          newGreen = 1;
          newBlue = 1;
        } else {
          const delta = (targetY) / currentY;
          newRed *= delta;
          newBlue *= delta;
          newGreen *= delta;
        }
      }

      let clipping = false;
      let crushing = false;
      if (newRed > 1 || newGreen > 1 || newBlue > 1) {
        clipping = (newRed > 1 && red !== 1)
          && (newGreen > 1 && green !== 1)
          && (newBlue > 1 && blue !== 1);

        newRed = Math.min(newRed, 1);
        newGreen = Math.min(newGreen, 1);
        newBlue = Math.min(newBlue, 1);
      } else if (newRed < 0 || newGreen < 0 || newBlue < 0) {
        crushing = (newRed < 0 && red !== 0)
            && (newGreen < 0 && green !== 0)
            && (newBlue < 0 && blue !== 0);
        newRed = Math.max(0, newRed);
        newGreen = Math.max(0, newGreen);
        newBlue = Math.max(0, newBlue);
      }

      if (newRed !== (red) || newGreen !== green || newBlue !== blue) {
        // Write change
        const srgbRed = sRGBFromLinearRGB(newRed);
        const srgbGreen = sRGBFromLinearRGB(newGreen);
        const srgbBlue = sRGBFromLinearRGB(newBlue);
        raw[0] = Math.max(0, Math.min(Math.round(srgbRed * 255), 255));
        raw[1] = Math.max(0, Math.min(Math.round(srgbGreen * 255), 255));
        raw[2] = Math.max(0, Math.min(Math.round(srgbBlue * 255), 255));

        if (crushing) {
          crushCount++;
          console.warn(
            // filename,
            'Crush:',
            `rgb(${[red, green, blue].join(',')})`,
            '=>',
            `rgb(${[Math.round(red + scaledRed), Math.round(green + scaledGreen), Math.round(blue + scaledBlue)].join(',')})`,
            '=>',
            `rgb(${[newRed, newGreen, newBlue].join(',')})`,
          );
        }
        if (clipping) {
          clipCount++;
          console.warn(
            // filename,
            'Clip:',
            `rgb(${[red, green, blue].join(',')})`,
            '=>',
            `rgb(${[Math.round(red + scaledRed), Math.round(green + scaledGreen), Math.round(blue + scaledBlue)].join(',')})`,
            '=>',
            `rgb(${[newRed, newGreen, newBlue].join(',')})`,
          );
        }
        pixelsChanged++;
      }
    }
  }
  return pixelsChanged;
}
