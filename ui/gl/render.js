/**
 *
 * @param {WebGL2RenderingContext} gl
 */
export function renderCube(gl) {
  // X Y Z
  const front = [
    0, 0, 1,
    1, 0, 1,
    1, 1, 1,
    0, 1, 1,
  ];
  const back = [
    0, 0, 0,
    0, 1, 0,
    1, 1, 0,
    1, 0, 0,
  ];

  const top = [
    0, 1, 0,
    0, 1, 1,
    1, 1, 1,
    1, 1, 0,
  ];

  const bottom = [
    0, 0, 0,
    1, 0, 0,
    1, 0, 1,
    0, 0, 1,

  ];
  const right = [
    1, 0, 0,
    1, 1, 0,
    1, 1, 1,
    1, 0, 1,
  ];
  const left = [
    0, 0, 0,
    0, 0, 1,
    0, 1, 1,
    0, 1, 0,
  ];
}
