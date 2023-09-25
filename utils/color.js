/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @return {number}
 */
export function yFromLinearRGB(red, green, blue) {
  return (red * 0.2126)
    + (green * 0.7152)
    + (blue * 0.0722);
}

/**
 * @param {number} valueOrRed
 * @param {number} green
 * @param {number} blue
 * @return {number}
 */
export function yFromGrayscale(valueOrRed, green = valueOrRed, blue = green) {
  return (valueOrRed + green + blue) / 3;
}

export const lumaFromSRGB = yFromLinearRGB;
export const lumaFromRec709 = yFromLinearRGB;

/**
 * @param {number} channel
 * @return {number}
 */
export function linearRGBFromSRGB(channel) {
  if (channel <= 0.040_45) {
    return channel / 12.92;
  }
  return ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {number} channel
 * @return {number}
 */
export function sRGBFromLinearRGB(channel) {
  if (channel <= 0.003_130_8) {
    return 12.92 * channel;
  }
  return 1.055 * (channel ** (1 / 2.4)) - 0.055;
}

/**
 * Returns Y according to Rec 709
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @return {number} From 0-1
 */
export function lumaFromSRGB8(red, green, blue) {
  return lumaFromSRGB(
    linearRGBFromSRGB(red / 255),
    linearRGBFromSRGB(green / 255),
    linearRGBFromSRGB(blue / 255),
  );
}

/**
 *
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {number} yMax
 */
export function linearRGBYClamped(red, green, blue, yMax) {
  const y = yFromLinearRGB(red, green, blue);
  if (y <= yMax) return null;
  const delta = yMax / y;
  return [red * delta, green * delta, blue * delta];
}

/**
 * @param {number[][]} tuples
 * @return {number}
 */
function productSum(...tuples) {
  return tuples
    .reduce((prevSum, currentTuple) => prevSum + currentTuple
      .reduce((product, number) => product * number, 1), 0);
}

/**
 *
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {number} lumaMax
 * @return {[number,number,number]|null}
 */
export function rec709LumaClamped(red, green, blue, lumaMax) {
  // Compute Y' from R'G'B'
  const luma = productSum(
    [0.2126, red],
    [0.7152, green],
    [0.0722, blue],
  );
  if (luma <= lumaMax) return null;

  // Y'CC

  // const cb = productSum(
  //   [-0.1146, red],
  //   [-0.3854, green],
  //   [0.5, blue],
  // );

  // const cr = productSum(
  //   [0.5, red],
  //   [-0.4542, green],
  //   [-0.0458, blue],
  // );

  // const newRed = productSum(
  //   [1, lumaMax],
  //   [0, cb],
  //   [1.5748, cr],
  // );

  // const newGreen = productSum(
  //   [1, lumaMax],
  //   [-0.1873, cb],
  //   [-0.4681, cr],
  // );

  // const newBlue = productSum(
  //   [1, lumaMax],
  //   [1.8556, cb],
  //   [0, cr],
  // );

  // Y'UV

  const u = productSum(
    [-0.099_91, red],
    [-0.336_09, green],
    [0.436, blue],
  );

  const v = productSum(
    [0.615, red],
    [-0.558_61, green],
    [-0.056_39, blue],
  );

  const newRed = productSum(
    [1, lumaMax],
    [0, u],
    [1.280_33, v],
  );

  const newGreen = productSum(
    [1, lumaMax],
    [-0.214_82, u],
    [-0.380_59, v],
  );

  const newBlue = productSum(
    [1, lumaMax],
    [2.127_98, u],
    [0, v],
  );

  return [newRed, newGreen, newBlue];
}

/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 */
export function yFromSRGB(red, green, blue) {
  const linRed = linearRGBFromSRGB(red);
  const linGreen = linearRGBFromSRGB(green);
  const linBlue = linearRGBFromSRGB(blue);
  return productSum(
    [0.2126, linRed],
    [0.7152, linGreen],
    [0.0722, linBlue],
  );
}

/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {number} yMax
 * @return {[number,number,number]|null}
 */
export function rec709YClamped(red, green, blue, yMax) {
  // Compute Y from R'G'B'
  const linRed = linearRGBFromSRGB(red);
  const linGreen = linearRGBFromSRGB(green);
  const linBlue = linearRGBFromSRGB(blue);

  const y = yFromSRGB(red, green, blue);
  if (y <= yMax) return null;

  let newLinRed;
  let newLinGreen;
  let newLinBlue;
  const delta = yMax / y;
  if (linRed === linGreen && linGreen === linBlue) {
    // eslint-disable-next-line no-multi-assign
    newLinRed = newLinGreen = newLinBlue = (linRed * delta);
  } else {
    newLinRed = linRed * delta;
    newLinGreen = linGreen * delta;
    newLinBlue = linBlue * delta;
  }

  // const x = productSum(
  //   [0.4124, linRed],
  //   [0.3576, linGreen],
  //   [0.1805, linBlue],
  // );

  // const z = productSum(
  //   [0.0193, linRed],
  //   [0.1192, linGreen],
  //   [0.9505, linBlue],
  // );

  // newLinRed = productSum(
  //   [+3.240_625_5, x],
  //   [-1.537_208, yMax],
  //   [-0.498_628_6, z],
  // );

  // newLinGreen = productSum(
  //   [-0.968_989_307, x],
  //   [+1.875_756_1, yMax],
  //   [+0.041_517_5, z],
  // );

  // newLinBlue = productSum(
  //   [+0.055_710_1, x],
  //   [-0.204_021_1, yMax],
  //   [+1.056_995_9, z],
  // );

  const newRed = Math.max(0, Math.min(sRGBFromLinearRGB(newLinRed), 1));
  const newGreen = Math.max(0, Math.min(sRGBFromLinearRGB(newLinGreen), 1));
  const newBlue = Math.max(0, Math.min(sRGBFromLinearRGB(newLinBlue), 1));

  if (newRed === red && newGreen === green && newBlue === blue) {
    return null;
  }
  return [newRed, newGreen, newBlue];
}

/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {number} yTarget
 * @return {[number,number,number]|null}
 */
export function retargetYFromLinearRGB(red, green, blue, yTarget) {
  // Compute Y from RGB

  const y = yFromLinearRGB(red, green, blue);
  if (y === yTarget) return null;

  let newLinRed;
  let newLinGreen;
  let newLinBlue;
  const delta = yTarget / y;
  if (red === green && green === blue) {
    // eslint-disable-next-line no-multi-assign
    newLinRed = newLinGreen = newLinBlue = (red * delta);
  } else {
    newLinRed = red * delta;
    newLinGreen = green * delta;
    newLinBlue = blue * delta;
  }

  const newRed = Math.max(0, Math.min(newLinRed, 1));
  const newGreen = Math.max(0, Math.min(newLinGreen, 1));
  const newBlue = Math.max(0, Math.min(newLinBlue, 1));

  if (newRed === red && newGreen === green && newBlue === blue) {
    return null;
  }
  return [newRed, newGreen, newBlue];
}

/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {number} yTarget
 * @return {[number,number,number]|null}
 */
export function retargetYFromGrayscale(red, green, blue, yTarget) {
  // Compute Y from RGB

  const y = yFromGrayscale(red, green, blue);
  if (y === yTarget) return null;

  let newLinRed;
  let newLinGreen;
  let newLinBlue;
  const delta = yTarget / y;
  if (red === green && green === blue) {
    // eslint-disable-next-line no-multi-assign
    newLinRed = newLinGreen = newLinBlue = (red * delta);
  } else {
    newLinRed = red * delta;
    newLinGreen = green * delta;
    newLinBlue = blue * delta;
  }

  const newRed = Math.max(0, Math.min(newLinRed, 1));
  const newGreen = Math.max(0, Math.min(newLinGreen, 1));
  const newBlue = Math.max(0, Math.min(newLinBlue, 1));

  if (newRed === red && newGreen === green && newBlue === blue) {
    return null;
  }
  return [newRed, newGreen, newBlue];
}

/**
 * Round and clamps [0-1] value to [0-255]
 * @param {number} channel
 */
export function channelAsRGB8(channel) {
  return Math.max(0, Math.min(Math.round(channel * 255), 255));
}
