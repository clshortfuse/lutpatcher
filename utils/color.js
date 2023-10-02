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

/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 */
export function XYZfromRGB(red, green, blue) {
  const X = 100 * productSum(
    [0.4124, red],
    [0.3576, green],
    [0.1805, blue],
  );

  const Y = 100 * productSum(
    [0.2126, red],
    [0.7152, green],
    [0.0722, blue],
  );

  const Z = 100 * productSum(
    [0.0193, red],
    [0.1192, green],
    [0.9505, blue],
  );

  return [X, Y, Z];
}

/**
 * @param {number} X
 * @param {number} Y
 * @param {number} Z
 */
export function xyYFromXYZ(X, Y, Z) {
  const sum = X + Y + Z;
  const x = X / sum;
  const y = Y / sum;
  return [x, y, Y];
}

/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 */
export function xyYFromRGB(red, green, blue) {
  const [X, Y, Z] = XYZfromRGB(red, green, blue);
  return xyYFromXYZ(X, Y, Z);
}

/**
 * @param {number} X
 * @param {number} Y
 * @param {number} Z
 */
export function LabfromXYZ(X, Y, Z) {
  const fFunction = (input) => ((input > 0.008_856)
    ? Math.cbrt(input)
    : (7.787 * input) + (16 / 116));

  // TODO: Change illuminants to [0-1]
  const newX = fFunction(X / 95.0489);
  const newY = fFunction(Y / 100);
  const newZ = fFunction(Z / 108.884);

  const L = 116 * newY - 16;
  const a = 500 * (newX - newY);
  const b = 200 * (newY - newZ);
  return [L, a, b];
}

/**
 * @param {number} X
 * @param {number} Y
 * @param {number} Z
 * @param L
 * @param a
 * @param b
 */
export function XYZfromLab(L, a, b) {
  const fFunction = (input) => ((input > (6 / 29))
    ? input ** 3
    : 3 * ((6 / 29) ** 2) * (input - (4 / 29)));

  const newL = (L + 16) / 116;
  const X = 95.0489 * fFunction(newL + (a / 500));
  const Y = 100 * fFunction(newL);
  const Z = 108.884 * fFunction(newL - (b / 200));

  return [X, Y, Z];
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} Y
 */
export function XYZfromxyY(x, y, Y) {
  const X = (x * y) / Y;
  const Z = ((1 - x - y) * Y) / y;
  return [X, Y, Z];
}

/**
 * @param {number} X
 * @param {number} Y
 * @param {number} Z
 */
export function rgbFromXYZ(X, Y, Z) {
  const R = productSum(
    [+3.2406, X],
    [-1.5372, Y],
    [-0.4986, Z],
  ) / 100;

  const G = productSum(
    [-0.9689, X],
    [+1.8758, Y],
    [+0.0415, Z],
  ) / 100;

  const B = productSum(
    [+0.0557, X],
    [-0.204, Y],
    [+1.057, Z],
  ) / 100;

  return [R, G, B];
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function LabfromRGB(r, g, b) {
  const [X, Y, Z] = XYZfromRGB(r, g, b);
  return LabfromXYZ(X, Y, Z);
}

/**
 * @param {number} L
 * @param {number} a
 * @param {number} b
 */
export function RGBfromLab(L, a, b) {
  const [X, Y, Z] = XYZfromLab(L, a, b);
  return rgbFromXYZ(X, Y, Z);
}

/**
 *
 * @param r
 * @param g
 * @param b
 */
export function okLabFromRGB(r, g, b) {
  const l = (0.412_221_470_8 * r) + (0.536_332_536_3 * g) + (0.051_445_992_9 * b);
  const m = (0.211_903_498_2 * r) + (0.680_699_545_1 * g) + (0.107_396_956_6 * b);
  const s = (0.088_302_461_9 * r) + (0.281_718_837_6 * g) + (0.629_978_700_5 * b);

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    (0.210_454_255_3 * l_) + (0.793_617_785 * m_) - (0.004_072_046_8 * s_),
    (1.977_998_495_1 * l_) - (2.428_592_205 * m_) + (0.450_593_709_9 * s_),
    (0.025_904_037_1 * l_) + (0.782_771_766_2 * m_) - (0.808_675_766 * s_),
  ];
}

/**
 * @param {number} L
 * @param {number} a
 * @param {number} b
 */
export function rgbFromOKLab(L, a, b) {
  const l_ = L + (0.396_337_777_4 * a) + (0.215_803_757_3 * b);
  const m_ = L - (0.105_561_345_8 * a) - (0.063_854_172_8 * b);
  const s_ = L - (0.089_484_177_5 * a) - (1.291_485_548 * b);

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    (+4.076_741_662_1 * l) - (3.307_711_591_3 * m) + (0.230_969_929_2 * s),
    (-1.268_438_004_6 * l) + (2.609_757_401_1 * m) - (0.341_319_396_5 * s),
    (-0.004_196_086_3 * l) - (0.703_418_614_7 * m) + (1.707_614_701 * s),
  ];
}

/**
 *
 * @param {number} L
 * @param {number} a
 * @param {number} b
 */
export function okLCHFromOKLab(L, a, b) {
  return [
    L,
    Math.hypot(a, b),
    Math.atan2(b, a),
  ];
}

/**
 *
 * @param {number} L
 * @param {number} a
 * @param {number} b
 * @param c
 * @param h
 */
export function okLabFromOKLch(L, c, h) {
  return [
    L,
    c * Math.cos(h),
    c * Math.sin(h),
  ];
}

/**
 * @param {number} L
 * @param {number} c
 * @param {number} h
 */
export function rgbFromOKLch(L, c, h) {
  return rgbFromOKLab(...okLabFromOKLch(L, c, h));
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function okLchFromRGB(r, g, b) {
  return okLCHFromOKLab(...okLabFromRGB(r, g, b));
}
