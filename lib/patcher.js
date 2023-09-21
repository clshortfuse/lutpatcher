/* eslint-disable max-len */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { linearRGBFromSRGB, retargetYFromGrayscale, retargetYFromLinearRGB, sRGBFromLinearRGB, yFromGrayscale, yFromLinearRGB, yFromSRGB } from '../utils/color.js';
import { parseDDS } from '../utils/dds.js';
import { parseLUT } from '../utils/lut.js';
import { biasedScaling, equalizedNormalization, linearNormalization } from '../utils/normalize.js';

const uncrushBlacks = false;
const cdfBins = 256;
const SQRT3 = Math.sqrt(3);
const tintScale = 1;
const LINEAR_GRAY = linearRGBFromSRGB(0.5);

/**
 * @param {string} command
 * @param  {string[]} [args]
 * @param {import('child_process').SpawnOptions} [options]
 * @return {Promise<string>}
 */
async function waitForProcess(command, args, options) {
  const process = spawn(command, args, options);
  let stdout = '';
  let stderr = '';

  await new Promise((resolve, reject) => {
    process.on('error', reject);
    process.on('exit', resolve);
    process.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    process.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
  });
  if (process.exitCode !== 0) {
    console.warn(command, args, options);
    console.warn(`Exitcode: ${process.exitCode}`);
    console.error(stderr);
    throw new Error(stderr);
  }

  return stdout;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} stdin
 * @param {import('child_process').SpawnOptions} [options]
 * @return {Promise<string>}
 */
async function waitForPipedProcess(command, args, stdin, options) {
  const process = spawn(command, args, options);
  let stdout = '';
  let stderr = '';

  await new Promise((resolve, reject) => {
    process.stdin.end(stdin);
    process.on('error', reject);
    process.on('exit', resolve);
    process.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    process.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
  });
  if (process.exitCode !== 0) {
    console.warn(command, args, options);
    console.warn(`Exitcode: ${process.exitCode}`);
    console.error(stderr);
    throw new Error(stderr);
  }

  return stdout;
}

const global = {};

/** @type {number[]} */
let yValues;
/** @type {Uint8Array} */
let baseLut;
let referenceLevels;

/**
 *
 */
function getYValues() {
  baseLut = readFileSync('./baselut.dds');
  const dds = parseDDS(baseLut);
  const lut = parseLUT(dds);
  const { surface, bytesPerPixel } = dds;
  const computedValues = [];
  const pixelCount = surface.length / bytesPerPixel;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let totalY = 0;
  for (let index = 0; index < pixelCount; index++) {
    const offset = index * bytesPerPixel;
    // R8 G8 B8
    const sRed = surface[offset];
    const sGreen = surface[offset + 1];
    const sBlue = surface[offset + 2];
    // const alpha = data[offset + 3];

    const red = linearRGBFromSRGB(sRed / 255);
    const green = linearRGBFromSRGB(sGreen / 255);
    const blue = linearRGBFromSRGB(sBlue / 255);

    const y = yFromLinearRGB(red, green, blue);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    totalY += y;
    computedValues.push(y);
  }
  const averageY = totalY / pixelCount;
  console.log('reference', minY, maxY, averageY);
  referenceLevels = getLevels(surface, bytesPerPixel);
  return computedValues;
}

/**
 * @param {Uint8Array} surface
 * @param {number} [bytesPerPixel=4]
 */
function getLevels(surface, bytesPerPixel) {
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
    const sRed = surface[offset];
    const sGreen = surface[offset + 1];
    const sBlue = surface[offset + 2];
    // const alpha = data[offset + 3];

    const red = linearRGBFromSRGB(sRed / 255);
    const green = linearRGBFromSRGB(sGreen / 255);
    const blue = linearRGBFromSRGB(sBlue / 255);

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
  const cdfs = new Map();
  let lastCdfValue = 0;
  for (const y of allYs) {
    lastCdfValue += 1;
    cdfs.set(Math.ceil(y * (cdfBins - 1)), lastCdfValue);
  }
  const medianY = ((allYs[Math.floor(allYs.length / 2)]) + (allYs[Math.ceil(allYs.length / 2)])) / 2;

  const range = maxY - minY;

  return { minY, maxY, averageY, range, blackY, whiteY, medianY, cdfs, minChannel, averageChannel, maxChannel, averageRed, averageGreen, averageBlue };
}

/**
 * @param {string} inputPath
 * @param {string} outputPath
 */
export async function runPatches(inputPath, outputPath) {
  const filename = path.basename(inputPath);

  const mods = [];

  // console.log('reading', filename);
  const buffer = readFileSync(inputPath);
  const dds = parseDDS(buffer);
  const { surface, bytesPerPixel, header10 } = dds;
  if (header10?.dxgiFormat !== 28) {
    // console.warn(filename, 'Only DXGI_FORMAT_R8G8B8A8_UNORM supported');
    return { filename, mods, global };
  }

  yValues ??= getYValues();

  let pixelsChanged = 0;
  let crushCount = 0;
  let clipCount = 0;

  const levels = getLevels(surface, bytesPerPixel);
  const luts = parseLUT(dds);
  // console.log(filename, luts);
  // console.log(levels);
  const pixelCount = surface.length / bytesPerPixel;
  if (pixelCount !== yValues.length) {
    console.warn(filename, `No reference for ${pixelCount} image`);
    return { filename, mods, global };
  }

  const allYs = [];
  const blackFloor = 0;
  const cdfMin = levels.cdfs.get(Math.ceil(levels.minY * (cdfBins - 1)));

  // const averagePoint = (averageWhite - averageBlack) / 2;

  // Black <=> White
  // Red <=> Blue
  // Green <=> Magenta
  // Yellow <=> Cyan

  // const redDelta = [255 - luts.red[0], 0 - luts.red[1], 0 - luts.red[2]];
  // const greenDelta = [0 - luts.green[0], 255 - luts.green[1], 0 - luts.green[2]];
  // const blueDelta = [0 - luts.blue[0], 0 - luts.blue[1], 255 - luts.blue[2]];
  // const cyanDelta = [0 - luts.cyan[0], 255 - luts.cyan[1], 255 - luts.cyan[2]];
  // const magentaDelta = [255 - luts.magenta[0], 0 - luts.magenta[1], 255 - luts.magenta[2]];
  // const yellowDelta = [255 - luts.yellow[0], 255 - luts.yellow[1], 0 - luts.yellow[2]];

  // const minDelta = Math.min(
  //   Math.max(...redDelta),
  //   Math.max(...greenDelta),
  //   Math.max(...blueDelta),
  //   Math.max(...cyanDelta),
  //   Math.max(...magentaDelta),
  //   Math.max(...yellowDelta),
  // );

  // Scale uniformly by
  const scaleDown = (0 - levels.minChannel);
  const scaleUp = (1 - levels.maxChannel);
  const realScale = levels.maxChannel - levels.minChannel;
  const totalScale = 1 / (levels.maxChannel - levels.minChannel);
  const compared = (2 - levels.maxChannel) - (-levels.minChannel);
  // Black will be scaled by min channel
  const scaledBlack = luts.black.map((n) => n - levels.minChannel);
  // White will be scaled up by max channel
  const scaledWhite = luts.white.map((n) => n + (1 - levels.maxChannel));

  let [blackRed, blackGreen, blackBlue] = scaledBlack;
  let [whiteRed, whiteGreen, whiteBlue] = scaledWhite;

  // const averageBlack = (blackRed + blackGreen + blackBlue) / 3;
  // const averageWhite = (whiteRed + whiteGreen + whiteBlue) / 3;

  if (tintScale) {
    const blackMax = Math.max(...scaledBlack.slice(0, 3));
    const whiteMin = Math.min(...scaledWhite.slice(0, 3));
    blackRed = ((blackMax - blackRed) * tintScale) + blackRed;
    blackGreen = ((blackMax - blackGreen) * tintScale) + blackGreen;
    blackBlue = ((blackMax - blackBlue) * tintScale) + blackBlue;
    whiteRed = ((whiteRed - whiteMin) * (1 - tintScale)) + whiteMin;
    whiteGreen = ((whiteGreen - whiteMin) * (1 - tintScale)) + whiteMin;
    whiteBlue = ((whiteBlue - whiteMin) * (1 - tintScale)) + whiteMin;
    // blackRed = blackGreen = blackBlue = Math.max(blackRed, blackGreen, blackBlue);
    // whiteRed = whiteGreen = whiteBlue = Math.min(whiteRed, whiteGreen, whiteBlue);
  }

  const blackDelta = [0 - blackRed, 0 - blackGreen, 0 - blackBlue];
  const whiteDelta = [1 - whiteRed, 1 - whiteGreen, 1 - whiteBlue];

  const blackY = yFromLinearRGB(...luts.black);
  const whiteY = yFromLinearRGB(...luts.white);
  const scaledBlackY = yFromLinearRGB(...scaledBlack);
  const scaledWhiteY = yFromLinearRGB(...scaledWhite);
  const midPointDelta = (1 / 2) - levels.averageChannel;

  const shadowsRed = 0 - blackRed;
  const shadowsGreen = 0 - blackGreen;
  const shadowsBlue = 0 - blackBlue;

  const tintRed = levels.averageRed - (1 / 2);
  const tintGreen = levels.averageGreen - (1 / 2);
  const tintBlue = levels.averageBlue - (1 / 2);

  const highlightsRed = 1 - whiteRed;
  const highlightsGreen = 1 - whiteGreen;
  const highlightsBlue = 1 - whiteBlue;

  for (const point of luts.points) {
    // if (!scaleDown && !scaleUp) continue;
    const { x, y, z } = point;
    if (x === 1 && y === 1 && z === 1) {
      const writePoint = true;
    }
    if (shadowsRed || shadowsGreen || shadowsBlue || highlightsRed || highlightsGreen || highlightsBlue || scaleDown || scaleUp) {
      const { raw, linear } = point;
      // Point has to be stretched to black;

      // const allDistances = (blackDistance + whiteDistance + redDistance + greenDistance + blueDistance + magentaDistance + yellowDistance);
      // const netRed = biasedScaling(blackDistance, 0, totalRange, -blackRed, 255 - whiteRed, averagePoint / 255 * SQRT3);
      // const netGreen = biasedScaling(blackDistance, 0, totalRange, -blackGreen, 255 - whiteGreen, averagePoint / 255 * SQRT3);
      // const netBlue = biasedScaling(blackDistance, 0, totalRange, -blackBlue, 255 - whiteBlue, averagePoint / 255 * SQRT3);

      // Scale up first uniformingly

      const linearX = linearRGBFromSRGB(x);
      const linearY = linearRGBFromSRGB(y);
      const linearZ = linearRGBFromSRGB(z);
      const blackDistance = Math.hypot(linearX, linearY, linearZ);
      const whiteDistance = Math.hypot(1 - linearX, 1 - linearY, 1 - linearZ);
      const totalRange = (blackDistance + whiteDistance);

      const scaledRed = linearNormalization(linearX, 0, 1, scaleDown, scaleUp);
      const scaledGreen = linearNormalization(linearY, 0, 1, scaleDown, scaleUp);
      const scaledBlue = linearNormalization(linearZ, 0, 1, scaleDown, scaleUp);

      const averageLinear = linearRGBFromSRGB(levels.averageChannel);
      // Scale up first, biased to original shape center
      // Reconfigure a new cube built around old one, centered by old center
      
      // Represent as scaled down
      // const realRed = linearNormalization(linearX, 0, 1, levels.minChannel, levels.maxChannel);
      // const realGreen = linearNormalization(linearY, 0, 1, levels.minChannel, levels.maxChannel);
      // const realBlue = linearNormalization(linearZ, 0, 1, levels.minChannel, levels.maxChannel);

      // Scale back up with upscaler biased around center

      // const newScaledRed = biasedScaling(realRed, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);
      // const newScaledGreen = biasedScaling(realGreen, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);
      // const newScaledBlue = biasedScaling(realBlue, levels.minChannel, levels.maxChannel, 0, 1, levels.averageChannel);

      // Second pass (linear)
      // const targetY = linearNormalization(blackDistance, 0, totalRange, 0, 1);

      // [0.25 , 5 0.75]
      // [0 , 5, 1]
      // [0.25, 5, 1]

      const oldRange = levels.maxY - levels.minY;
      const newRange = 1 - 0;
      const scaling = newRange / oldRange;

      // const yChange = increateY;

      // const yChange = linearNormalization(blackDistance, 0, totalRange, -blackY, 1 - whiteY);
      // const yChange = linearNormalization(blackDistance, 0, totalRange, -scaledBlackY, 1 - scaledWhiteY);

      const yChange = linearNormalization(blackDistance, 0, totalRange, -scaledBlackY, 1 - scaledWhiteY);

      // const yChange = biasedScaling(blackDistance, 0, totalRange, -scaledBlackY, 1 - scaledWhiteY, levels.averageY * totalRange);

      // const lumRed = linearNormalization(blackDistance, 0, totalRange, shadowsRed, highlightsRed);
      // const lumGreen = linearNormalization(blackDistance, 0, totalRange, shadowsGreen, highlightsGreen);
      // const lumBlue = linearNormalization(blackDistance, 0, totalRange, shadowsBlue, highlightsBlue);

      // Second pass (luminance) and maybe detint
      // const lumRed = biasedScaling(blackDistance, 0, totalRange, shadowsRed, highlightsRed, levels.averageChannel * SQRT3);
      // const lumGreen = biasedScaling(blackDistance, 0, totalRange, shadowsGreen, highlightsGreen, levels.averageChannel / 255 * totalRange);
      // const lumBlue = biasedScaling(blackDistance, 0, totalRange, shadowsBlue, highlightsBlue, levels.averageChannel / 255 * totalRange);

      // Third pass

      /**
       *
       * @param distance
       * @param total
       * @param color
       */
      // function shift(distance, total, color) {
      //   netRed += linearNormalization(distance, 0, total, color, 0);
      //   netGreen += linearNormalization(distance, 0, total, color, 0);
      //   netBlue += linearNormalization(distance, 0, total, color, 0);
      // }

      // shift(blackDistance, blackDistance + whiteDistance, newBlack);
      // shift(whiteDistance, blackDistance + whiteDistance, newWhite);

      // shift(greenDistance, greenDistance + magentaDistance, greenDelta);
      // shift(magentaDistance, greenDistance + magentaDistance, magentaDelta);

      // shift(cyanDistance, cyanDistance + yellowDistance, yellowDelta);
      // shift(yellowDistance, cyanDistance + yellowDistance, cyanDelta);

      // shift(redDistance, redDelta);
      // shift(greenDistance, greenDelta);
      // shift(blueDistance, blueDelta);
      // shift(cyanDistance, cyanDelta);
      // shift(magentaDistance, magentaDelta);
      // shift(yellowDistance, yellowDelta);

      // let netRed += linearNormalization(point.redDistance, 0, point.redDistance + point.blueDistance, -blackRed, 255 - whiteRed, averagePoint / 255 * SQRT3);

      const [red, green, blue] = linear;

      let newRed = red + scaledRed + lumRed;
      let newGreen = green + scaledGreen + lumGreen;
      let newBlue = blue + scaledBlue + lumBlue;

      // const newRed = red + scaledRed + lumRed;
      // const newGreen = green + scaledGreen + lumGreen;
      // const newBlue = blue + scaledBlue + lumBlue;

      // let newRed = Math.round(red + scaledRed);
      // let newGreen = Math.round(green + scaledGreen);
      // let newBlue = Math.round(blue + scaledBlue);

      const currentY = yFromLinearRGB(newRed, newGreen, newBlue);

      if (currentY) {
        const targetY = currentY + yChange;
        const delta = (currentY + yChange) / currentY;// targetY / currentY;
        newRed *= delta;
        newBlue *= delta;
        newGreen *= delta;
        const newY = yFromLinearRGB(newRed, newBlue, newGreen);
        if (targetY >= 1) {
          // Retarget to white
          newRed = 1;
          newGreen = 1;
          newBlue = 1;
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

        // color[0] = newRed;
        // color[1] = newGreen;
        // color[2] = newBlue;
        if (crushing) {
          crushCount++;
          console.warn(
            filename,
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
            filename,
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

  const average = false;
  if (average) {
    for (let index = 0; index < pixelCount; index++) {
      const offset = index * bytesPerPixel;
      // R8 G8 B8
      const red = surface[offset];
      const green = surface[offset + 1];
      const blue = surface[offset + 2];
      // const alpha = data[offset + 3];

      const y = yFromLinearRGB(
        (red / 255),
        (green / 255),
        (blue / 255),
      );
      const referenceY = yValues[index];
      // const normalizedY = referenceY;
      const normalizedY = linearNormalization(y, minY, maxY, 0, 1);
      // const normalizedY = biasedScaling(y, levels.minY, levels.maxY, 0, 1, levels.averageY);
      // const normalizedY = equalizedNormalization(
      //   levels.cdfs.get(Math.ceil(y * (cdfBins - 1))),
      //   cdfMin,
      //   pixelCount,
      //   cdfBins,
      // ) / (cdfBins - 1);
      // levels.push(normalizedY);
      // const normalizedY = referenceY;
      // const normalizedY = (y - levels.blackY) / (levels.whiteY - levels.blackY);
      // if (y === 0 || referenceY === 0 || normalizedY === 0) {
      //   // Debug magenta
      //   surface[offset] = 255;
      //   surface[offset + 1] = 0;
      //   surface[offset + 2] = 255;
      //   pixelsChanged++;
      //   continue;
      // }
      // if (Math.floor(normalizedY * 255) < 4) {
      //   // Debug magenta
      //   surface[offset] = 255;
      //   surface[offset + 1] = 255;
      //   surface[offset + 2] = 0;
      //   pixelsChanged++;
      //   continue;
      // }
      if (y !== normalizedY || y !== referenceY) {
        if (y === 0) {
          if (uncrushBlacks) {
          // console.warn('uncrushed black', referenceY);
            surface[offset] = baseLut[offset];
            surface[offset + 1] = baseLut[offset + 1];
            surface[offset + 2] = baseLut[offset + 2];
          } else if (referenceY !== 0) {
          // console.warn('keeping crushed black');
            crushCount++;
          }
        } else if (y === 1) {
        // console.warn('keeping clipped white');
          if (referenceY !== 1) {
            clipCount++;
          }
        } else if (referenceY === 0) {
        // console.warn('reverting black');
          surface[offset] = 0;
          surface[offset + 1] = 0;
          surface[offset + 2] = 0;
          pixelsChanged++;
        } else if (normalizedY === 1) {
          surface[offset] = 255;
          surface[offset + 1] = 255;
          surface[offset + 2] = 255;
          pixelsChanged++;
        } else {
          const newRGB = retargetYFromLinearRGB(red / 255, green / 255, blue / 255, normalizedY);
          if (!newRGB) {
          // console.warn('unchanged: rgba(', red, green, blue, ')', y, '=>', normalizedY);
            continue;
          }

          const newRed = Math.round((newRGB[0] * 255));
          const newGreen = Math.round((newRGB[1] * 255));
          const newBlue = Math.round((newRGB[2] * 255));

          if (newRed > 255 || newGreen > 255 || newBlue > 255) {
            console.warn('clipping: rgba(', red, green, blue, ')', y, '=>', normalizedY);
          } else if (newRed < 0 || newGreen < 0 || newBlue < 0) {
            console.warn('crushing');
          }

          if (newRed === red && newGreen === green && newBlue === blue) continue;
          // console.log('b: rgba(', red, green, blue, ')', y);
          // console.log('a: rgba(', newRed, newGreen, newBlue, ')', normalizedY);

          surface[offset] = Math.max(0, Math.min(newRed, 255));
          surface[offset + 1] = Math.max(0, Math.min(newGreen, 255));
          surface[offset + 2] = Math.max(0, Math.min(newBlue, 255));
          pixelsChanged++;
        // console.log('y', y, '=>', correctY);
        }
      }
    }
  }

  if (pixelsChanged) {
    const newLevels = getLevels(surface, bytesPerPixel);
    if (newLevels.minY !== 0 || newLevels.maxY !== 1) {
      console.warn(filename, `[${newLevels.minY.toFixed(2)}, ${newLevels.maxY.toFixed(2)}]`);
    }
    console.log([
      filename,
      `[${levels.minY.toFixed(2)}, ${levels.maxY.toFixed(2)}]`,
      `${(100 * (newLevels.averageY - levels.averageY)).toFixed(2)}%`,
      `${newLevels.averageY.toFixed(2)}Y`,
      pixelsChanged,
      crushCount,
      clipCount,
    ].join(' | '));
    writeFileSync(outputPath, buffer);
    mods.push(`lut: ${pixelsChanged}`);
  }

  // console.log('FINISHED', filename);
  return { filename, mods, global };
}
