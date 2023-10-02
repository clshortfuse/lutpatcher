/* eslint-disable max-len */

import { LabfromRGB, RGBfromLab, channelAsRGB8, linearRGBFromSRGB, okLchFromRGB, retargetYFromLinearRGB, rgbFromOKLch, sRGBFromLinearRGB, yFromLinearRGB } from '../utils/color.js';
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
  // const scaledBlack = luts.black.map((n) => 1 - ((1 - n) * (1 / (1 - levels.minChannel))));

  // White will be scaled up by max channel
  // const scaledWhite = luts.white.map((n) => n / levels.maxChannel);

  // const scaledBlackY = yFromLinearRGB(...scaledBlack);
  // const scaledWhiteY = yFromLinearRGB(...scaledWhite);

  const blackY = yFromLinearRGB(...luts.black);
  const [blackL] = okLchFromRGB(...luts.black);

  const whiteY = yFromLinearRGB(...luts.white);
  const [whiteL] = okLchFromRGB(...luts.white);

  // const oldYRange = levels.maxY - levels.minY;
  // const rescaledYRange = scaledWhiteY - scaledBlackY;
  // const newYRange = 1 - 0;

  // const whiteYDelta = 1 / scaledWhiteY;

  // const clampedNegatives = 0;

  for (const point of luts.points) {
    const { x, y, z } = point;

    if (scaleDown || scaleUp || blackY || whiteY !== 1) {
      const { raw, linear } = point;

      const linearX = linearRGBFromSRGB(x);
      const linearY = linearRGBFromSRGB(y);
      const linearZ = linearRGBFromSRGB(z);

      const [red, green, blue] = linear;

      let newRed = red;
      let newGreen = green;
      let newBlue = blue;

      if (linearX === 1 && linearY === 1 && linearZ === 1) {
        newRed = 1;
        newGreen = 1;
        newBlue = 1;
      } else if (linearX === 0 && linearY === 0 && linearZ === 0) {
        newRed = 0;
        newGreen = 0;
        newBlue = 0;
      } else {
        // Raise highlights first. This makes things easier when reducing later (less likely to clip below 0)

        const blackDistance = Math.hypot(linearX, linearY, linearZ);
        const whiteDistance = Math.hypot(1 - linearX, 1 - linearY, 1 - linearZ);
        const totalRange = (blackDistance + whiteDistance);

        // Black floor raise probably comes from shifting colors.
        // While not perfect, we can use the values of the raised black point
        // to compute how much the colors were raised.
        // This was probably raised in sRGB not linear, but we can compute new
        // starting values for each texel.

        // const reduceL = linearNormalization(blackDistance, 0, totalRange, 1 / (1 - (blackL / 100)), 1);
        // const increaseL = linearNormalization(blackDistance, 0, totalRange, 1 + (blackL / 100), 1);
        // const newL = 100 * Math.max(0, (1 - ((1 - (currentLab[0] / 100)) * (reduceL))) * (increaseL));

        const reduceRed = linearNormalization(linearX, 0, 1, 1 / (1 - luts.black[0]), 1);
        const reduceGreen = linearNormalization(linearY, 0, 1, 1 / (1 - luts.black[1]), 1);
        const reduceBlue = linearNormalization(linearZ, 0, 1, 1 / (1 - luts.black[2]), 1);

        // Detinting will give the the correct chroma (saturation), but wrong Lightness and Hue
        const detintedRed = Math.max(0, 1 - ((1 - red) * (reduceRed)));
        const detintedGreen = Math.max(0, 1 - ((1 - green) * (reduceGreen)));
        const detintedBlue = Math.max(0, 1 - ((1 - blue) * (reduceBlue)));

        const [, targetChroma] = okLchFromRGB(detintedRed, detintedGreen, detintedBlue);

        // Retinting will boost lightness properly back up, but still break chroma and still wrong hue
        const increaseRed = linearNormalization(linearX, 0, 1, 1 + luts.black[0], 1);
        const increaseGreen = linearNormalization(linearY, 0, 1, 1 + luts.black[1], 1);
        const increaseBlue = linearNormalization(linearZ, 0, 1, 1 + luts.black[2], 1);

        const retintedRed = detintedRed * increaseRed;
        const retintedGreen = detintedGreen * increaseGreen;
        const retintedBlue = detintedBlue * increaseBlue;

        let [targetL] = okLchFromRGB(retintedRed, retintedGreen, retintedBlue);

        // Take correct hue from LUT
        const [lutL, lutChroma, targetHue] = okLchFromRGB(red, green, blue);

        // Boost lightness by how much white is reduced
        const raiseL = linearNormalization(whiteDistance, 0, totalRange, 1 / whiteL, 1);
        targetL *= raiseL;

        const newRGB = rgbFromOKLch(targetL, targetChroma, targetHue);

        newRed = Math.max(0, newRGB[0]);
        newGreen = Math.max(0, newRGB[1]);
        newBlue = Math.max(0, newRGB[2]);

        // Chroma fix
      }

      let clipping = false;
      let crushing = false;
      if (newRed > 1 || newGreen > 1 || newBlue > 1) {
        clipping = (newRed > 1 && red !== 1)
          && (newGreen > 1 && green !== 1)
          && (newBlue > 1 && blue !== 1);

        if (clipping) {
          newRed = red;
          newGreen = green;
          newBlue = blue;
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
          // throw new Error('CRUSH!');
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
