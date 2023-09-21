import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { parseDDS } from '../utils/dds.js';

import { getLevels, patchDDS } from './patcher.js';
/**
 * @param {string} inputPath
 * @param {string} outputPath
 */
export async function runPatches(inputPath, outputPath) {
  const filename = path.basename(inputPath);

  const mods = [];

  const buffer = readFileSync(inputPath);
  const dds = parseDDS(buffer);
  const pixelsChanged = patchDDS(dds);

  if (pixelsChanged) {
    const newLevels = getLevels(dds.surface, dds.bytesPerPixel);
    if (newLevels.minY !== 0 || newLevels.maxY !== 1) {
      console.warn(filename, `[${newLevels.minY.toFixed(2)}, ${newLevels.maxY.toFixed(2)}]`);
    }
    console.log([
      filename,
      // `[${levels.minY.toFixed(2)}, ${levels.maxY.toFixed(2)}]`,
      // `${(100 * (newLevels.averageY - levels.averageY)).toFixed(2)}%`,
      `${newLevels.averageY.toFixed(2)}Y`,
      pixelsChanged,
      // crushCount,
      // clipCount,
    ].join(' | '));
    writeFileSync(outputPath, buffer);
    mods.push(`lut: ${pixelsChanged}`);
  }

  return { filename, mods, global };
}
