/* eslint-disable max-len */

import { channelAsRGB8, linearRGBFromSRGB, retargetYFromLinearRGB, sRGBFromLinearRGB, yFromLinearRGB } from '../utils/color.js';
import { parseDDS } from '../utils/dds.js';
import { parseLUT } from '../utils/lut.js';
import { biasedScaling, linearNormalization } from '../utils/normalize.js';

const SQRT_3 = Math.sqrt(3);

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
  let blackCount = 0;
  let whiteCount = 0;

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

    if (red === 0 && green === 0 && blue === 0) {
      blackCount++;
    } else if (red === 1 && green === 1 && blue === 1) {
      whiteCount++;
    }

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

  return { minY, maxY, averageY, range, blackY, whiteY, medianY, minChannel, averageChannel, maxChannel, averageRed, averageGreen, averageBlue, whiteCount, blackCount };
}

/**
 *
 * @param {ReturnType<import('../utils/lut.js').parseLUT} lut
 */
export function analyzeLUT(lut) {
  const grayScaleTints = [];
  // Use grayscale to detect tint
  for (let i = 0; i < lut.squares; i++) {
    const coord = i / (lut.squares - 1);
    const point = lut.at(coord, coord, coord);
    // Coord is neutral value
    const [red, green, blue] = point.linear;
    const delta = point.linear.map((n) => (coord ? n / coord : 0));
    grayScaleTints.push(delta);
  }
  const average = grayScaleTints
    .reduce((sums, color) => sums
      .map(
        (s, index) => s + (color[index] / lut.squares),
      ));
  return average;
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
  const crushCount = 0;
  const clipCount = 0;

  const levels = getLevels(surface, bytesPerPixel);
  const luts = parseLUT(dds);
  const scaleDown = (0 - levels.minChannel);
  const scaleUp = (1 - levels.maxChannel);
  // Black will be scaled by min channel
  const scaledBlack = luts.black.map((n) => 1 - ((1 - n) * (1 / (1 - levels.minChannel))));

  // White will be scaled up by max channel
  const scaledWhite = luts.white.map((n) => n / levels.maxChannel);

  const scaledBlackY = yFromLinearRGB(...scaledBlack);
  const scaledWhiteY = yFromLinearRGB(...scaledWhite);

  const oldYRange = levels.maxY - levels.minY;
  const rescaledYRange = scaledWhiteY - scaledBlackY;
  const newYRange = 1 - 0;

  const whiteYDelta = 1 / scaledWhiteY;

  for (const point of luts.points) {
    const { x, y, z } = point;

    if (scaleDown || scaleUp || scaledBlackY || scaledWhiteY !== 1) {
      const { raw, linear } = point;

      const linearX = linearRGBFromSRGB(x);
      const linearY = linearRGBFromSRGB(y);
      const linearZ = linearRGBFromSRGB(z);

      const [red, green, blue] = linear;

      // Scale down to real shape

      // const reshapedX = linearNormalization(linearX, 0, 1, levels.minChannel, levels.maxChannel);
      // const reshapedY = linearNormalization(linearY, 0, 1, levels.minChannel, levels.maxChannel);
      // const reshapedZ = linearNormalization(linearZ, 0, 1, levels.minChannel, levels.maxChannel);

      // Scale up biased to center
      // const rescaledX = biasedScaling(reshapedX, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);
      // const rescaledY = biasedScaling(reshapedY, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);
      // const rescaledZ = biasedScaling(reshapedZ, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);

      // Remove black tint
      // Reapply black tint after normalization (convert additive tint to multiplicative)

      const reduceRed = linearNormalization(linearX, 0, 1, 1 / (1 - luts.black[0]), 1);
      const blackTintedRed = linearNormalization(linearX, 0, 1, 1 + luts.black[0], 1);

      const reduceGreen = linearNormalization(linearY, 0, 1, 1 / (1 - luts.black[1]), 1);
      const blackTintedGreen = linearNormalization(linearY, 0, 1, 1 + luts.black[1], 1);

      const blackTintedBlue = linearNormalization(linearZ, 0, 1, 1 + luts.black[2], 1);
      const reduceBlue = linearNormalization(linearZ, 0, 1, 1 / (1 - luts.black[2]), 1);

      // channel * reduceRed = [0,1]
      // result *= black tint
      const blackScaledRed = (1 - ((1 - red) * reduceRed)) * blackTintedRed;
      const blackScaledGreen = (1 - ((1 - green) * reduceGreen)) * blackTintedGreen;
      const blackScaledBlue = (1 - ((1 - blue) * reduceBlue)) * blackTintedBlue;

      const blackRed = blackScaledRed;
      const blackGreen = blackScaledGreen;
      const blackBlue = blackScaledBlue;

      // Remove white tint by increasing
      // Reapply white tint after normalization
      // const increaseRed = linearNormalization(linearX, 0, 1, 1, 1 / luts.white[0]);
      // const increaseGreen = linearNormalization(linearY, 0, 1, 1, 1 / luts.white[1]);
      // const increaseBlue = linearNormalization(linearZ, 0, 1, 1, 1 / luts.white[2]);

      // Reduce factor (tinted dim)
      // const whiteTintedRed = linearNormalization(linearX, 0, 1, 1, luts.white[0]);
      // const whiteTintedGreen = linearNormalization(linearY, 0, 1, 1, luts.white[1]);
      // const whiteTintedBlue = linearNormalization(linearZ, 0, 1, 1, luts.white[2]);

      // const whiteRed = (blackRed) * (1 + ((1 - (blackRed)) * whiteTintedRed));
      // const whiteGreen = (blackGreen) * (1 + (1 - (blackGreen)) * (whiteTintedGreen));
      // const whiteBlue = (blackBlue) * (1 + (1 - (blackBlue)) * whiteTintedBlue);

      const scaledRed = blackRed;
      const scaledGreen = blackGreen;
      const scaledBlue = blackBlue;

      // channel * increaseRed = [0,1]

      // Remove tint that came from white
      // Reapply white tint after normalization

      // const scaledRed = linearNormalization(linearX, 0, 1, scaleDown, scaleUp);
      // const scaledGreen = linearNormalization(linearY, 0, 1, scaleDown, scaleUp);
      // const scaledBlue = linearNormalization(linearZ, 0, 1, scaleDown, scaleUp);

      const blackDistance = Math.hypot(linearX, linearY, linearZ);
      const whiteDistance = Math.hypot(1 - linearX, 1 - linearY, 1 - linearZ);
      const totalRange = (blackDistance + whiteDistance);

      // const scaledY = linearNormalization(blackDistance, 0, totalRange, scaledBlackY, scaledWhiteY);
      // const yChange2 = biasedScaling(scaledY, scaledBlackY, scaledWhiteY, 0, 1, levels.averageY);
      // const yChange = linearNormalization(yChange2, 0, 1, -scaledBlackY, 1 - scaledWhiteY);

      // const [red, green, blue] = linear;

      let newRed = scaledRed;
      let newGreen = scaledGreen;
      let newBlue = scaledBlue;

      const currentY = yFromLinearRGB(newRed, newGreen, newBlue);

      // Linear scaling
      const decreaseY = linearNormalization(blackDistance, 0, totalRange, 1, 1);
      const increaseY = linearNormalization(whiteDistance, 0, totalRange, 1 / levels.whiteY, 1);
      const targetY = (1 - ((1 - currentY) * decreaseY)) * increaseY;

      // Debug points
      if (targetY < 0) {
        const isnegative = true;
        if (x === 0 && y === 0 && z === 0) {
          const isBlack = true;
        } else {
          const isClip = true;
        }
      }
      if (x === 0 && y === 0 && z === 0) {
        const isBlack = true;
        if (currentY !== scaledBlackY) {
          if (Math.abs(currentY - scaledBlackY) >= Number.EPSILON * 6) {
            const isWrong = true;
          } else {
            const isFloatingPointError = true;
          }
        }
        if (targetY !== 0) {
          const badY = true;
        }
      } else if (x === 1 && y === 1 && z === 1) {
        const isWhite = true;
        if (currentY !== scaledWhiteY) {
          if (Math.abs(currentY - scaledWhiteY) >= Number.EPSILON * 6) {
            const isWrong = true;
          } else {
            const isFloatingPointError = true;
          }
        }
        if (targetY !== 1) {
          const badY = true;
        }
      }

      if (currentY) {
        if (targetY >= (254.5 / 255) && targetY < (255.5 / 255)) {
          // If targetting 1.000 exactly, always return white
          // (A channel may clip past 1.0, but still have Y at 1.0)
          newRed = 1;
          newBlue = 1;
          newGreen = 1;
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

        if (clipping) {
          // Revert to scaled instead (clipped after Y change)
          newRed = scaledRed;
          newGreen = scaledGreen;
          newBlue = scaledBlue;
        } else {
          newRed = Math.min(newRed, 1);
          newGreen = Math.min(newGreen, 1);
          newBlue = Math.min(newBlue, 1);
        }
      } else if (newRed < 0 || newGreen < 0 || newBlue < 0) {
        crushing = (newRed < 0 && red !== 0)
            && (newGreen < 0 && green !== 0)
            && (newBlue < 0 && blue !== 0);
        if (crushing) {
          // Revert to scaled instead (crushed after Y change)
          newRed = scaledRed;
          newGreen = scaledGreen;
          newBlue = scaledBlue;
        } else {
          newRed = Math.max(0, newRed);
          newGreen = Math.max(0, newGreen);
          newBlue = Math.max(0, newBlue);
        }
      }

      if (newRed !== (red) || newGreen !== green || newBlue !== blue) {
        // Write change
        const srgbRed = sRGBFromLinearRGB(newRed);
        const srgbGreen = sRGBFromLinearRGB(newGreen);
        const srgbBlue = sRGBFromLinearRGB(newBlue);

        raw[0] = channelAsRGB8(srgbRed);
        raw[1] = channelAsRGB8(srgbGreen);
        raw[2] = channelAsRGB8(srgbBlue);

        if (crushing || clipping) {
          console.warn(
            // filename,
            crushing ? 'Crush:' : 'Clip:',
            x.toFixed(2),
            y.toFixed(2),
            z.toFixed(2),
            `rgb(${[red, green, blue].map(channelAsRGB8).join(',')})`,
            '=>',
            // `rgb(${[scaledRed, scaledGreen, scaledBlue].map(channelAsRGB8).join(',')})`,
            '=>',
            'x',
            targetY / currentY,
            '=>',
            `rgb(${[newRed, newGreen, newBlue].map(channelAsRGB8).join(',')})`,

          );
        }

        pixelsChanged++;
      }
    }
  }
  return pixelsChanged;
}
