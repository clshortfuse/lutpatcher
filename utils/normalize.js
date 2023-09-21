/**
 * @param {number} input
 * @param {number} min
 * @param {number} max
 * @param {number} newMin
 * @param {number} newMax
 */
export function linearNormalization(input, min, max, newMin = min, newMax = max) {
  return (input - min) * ((newMax - newMin) / (max - min)) + newMin;
}

/**
 * @param {number} input
 * @param {number} min
 * @param {number} max
 * @param {number} newMin
 * @param {number} newMax
 * @param {number} average (based on input)
 */
export function biasedScaling(input, min, max, newMin, newMax, average) {
  if (min === newMin && max === newMax) {
    return input;
  }
  if (newMin === newMax) return newMin;

  if (input === average) return average;

  if (input < average) {
    if (average < newMin) {
      // Downscaling...
      throw new Error(`Invalid min: ${newMin}`);
    }
    return linearNormalization(input, min, average, newMin, average);
  }
  if (average > newMax) {
    // Downscaling...
    throw new Error(`Invalid max: ${newMax}`);
  }
  return linearNormalization(input, average, max, average, newMax);
}

/**
 * @param {number} cdfValue
 * @param {number} cdfMin
 * @param {number} size
 * @param {number} bins
 */
export function equalizedNormalization(cdfValue, cdfMin, size, bins) {
  return Math.round(
    (
      (cdfValue - cdfMin)
      / ((size) - cdfMin)
    ) * (
      bins - 1
    ),
  );
}

/**
 * @param {number[]} array
 * @return {number[]}
 */
export function histogramEqualize(array) {
  const cdfs = new Map();
  const sorted = array.slice().sort((a, b) => a - b);
  let lastCdfValue = 0;
  for (const value of sorted) {
    lastCdfValue += 1;
    cdfs.set(value, lastCdfValue);
  }
  const cdfMin = cdfs.get(sorted[0]);
  const size = array.length;
  return array.map((value) => equalizedNormalization(cdfs.get(value), cdfMin, size, 256));
}
