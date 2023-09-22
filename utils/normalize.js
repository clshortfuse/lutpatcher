/**
 * @param {number} input
 * @param {number} min
 * @param {number} max
 * @param {number} newMin
 * @param {number} newMax
 */
export function linearNormalization(input, min, max, newMin = min, newMax = max) {
  return newMin
    + (
      ((input - min) * (newMax - newMin))
        / (max - min)
    );
}

/**
 * Used to upscale a range of values to a new range while keeping
 * values somewhat in the same place (eg: unclamping values)
 * @param {number} input
 * @param {number} min
 * @param {number} max
 * @param {number} newMin
 * @param {number} newMax
 * @param {number} average (based on input)
 * @param {number} deviation
 */
export function biasedScaling(input, min, max, newMin, newMax, average, deviation = 0) {
  if (min === newMin && max === newMax) {
    return input;
  }
  if (newMin === newMax) return newMin;

  if (input === average) return average;

  if (average < newMin || average > newMax) {
    throw new Error(`Downscale range: [${newMin}, ${newMax}]`);
  }

  if (deviation) {
    const buffer = deviation * (max - min);
    if (input > average && input < (average + buffer)) return input;
    if (input < average && input > (average - buffer)) return input;
  }

  if (input < average) {
    return linearNormalization(input, min, average, newMin, average);
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
