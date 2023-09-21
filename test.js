import { biasedScaling, histogramEqualize, linearNormalization } from './utils/normalize.js';

// /** @type {number[]} */
// const values = [];
// for (let i = 20; i <= 80; i += 5) {
//   values.push(i);
// }

const values = [
  52, 55, 61, 59, 79, 61, 76, 61,
  62, 59, 55, 104, 94, 85, 59, 71,
  63, 65, 66, 113, 144, 104, 63, 72,
  64, 70, 70, 126, 154, 109, 71, 69,
  67, 73, 68, 106, 122, 88, 68, 68,
  68, 79, 60, 70, 77, 66, 58, 75,
  69, 85, 64, 58, 55, 61, 65, 83,
  70, 87, 69, 68, 65, 73, 78, 90,
];

const min = Math.min(...values);
const max = Math.max(...values);

// const values = [10, 12, 15, 18, 20];
// const expected = [0, 6, 15, 24, 30];
// const values2 = [0, 6, 15, 20.5, 40];

/**
 * @param {number[]} array
 */
function computeAverage(array) {
  return array.reduce((sum, curr) => (sum + curr), 0) / array.length;
}

console.log('raw', values, computeAverage(values));

const mapped = values
  .map((value) => biasedScaling(value, min, max, 0, 255, computeAverage(values), 0.125));

console.log('biased', mapped, computeAverage(mapped));

const mapped2 = values
  .map((value) => linearNormalization(value, min, max, 0, 255));

console.log('normalized', mapped2, computeAverage(mapped2));

const histogrammed = histogramEqualize(values);

console.log('equalized', histogrammed, computeAverage(histogrammed));

// const zeroBased = values.map((n) => n - computeAverage(values));
// console.log(zeroBased);

// const stretched = zeroBased.map;
// for (const value of zeroBased) {
//   console.log(value, linearNormalization(value, -2.5, 2.5, -1, 1));
// }
