import { getLevels, patchDDS } from '../lib/patcher.js';
import { sRGBFromLinearRGB } from '../utils/color.js';
import { parseDDS } from '../utils/dds.js';
import { parseLUT } from '../utils/lut.js';

const byId = document.getElementById.bind(document);

/** @param {number} channel */
function clamp8(channel) {
  return Math.max(0, Math.min(Math.round(channel * 255), 255));
}

/** @param {number[]} rgb */
function asRGB8(rgb) {
  return `rgb(${rgb.map(clamp8).join(',')})`;
}

/** @param {number[]} rgb */
function asRGB8FromLinear(rgb) {
  return `rgb(${rgb.map(sRGBFromLinearRGB).map(clamp8).join(',')})`;
}

// Lazy refs
const refs = {
  sourceList: /** @type {HTMLSelectElement} */ (byId('source-list')),
  source: /** @type {HTMLInputElement} */ (byId('source')),
  surfaceBefore: /** @type {HTMLCanvasElement} */ (byId('surface-before')),
  surfaceAfter: /** @type {HTMLCanvasElement} */ (byId('surface-after')),
  inputPicker: byId('input-picker'),
  black: byId('black'),
  white: byId('white'),
  tint: byId('tint'),
  blackCircle: byId('black-circle'),
  whiteCircle: byId('white-circle'),
  tintCircle: byId('tint-circle'),
  min: byId('min'),
  max: byId('max'),
  // surface: /** @type {HTMLCanvasElement} */ (document.getElementById('surface')),
};

const state = {
  /** @type {Map<string,FileSystemFileHandle>} */
  files: new Map(),
};

/** @return {void} */
function refreshFiles() {
  const disabled = !state.files.size;
  refs.sourceList.replaceChildren();
  refs.source.disabled = disabled;
  if (disabled) {
    source.placeholder = '0 files found.';
    return;
  }
  for (const file of state.files.keys()) {
    /** @type {HTMLOptionElement} */
    const child = (document.createElement('mdw-list-option'));
    child.textContent = file;
    child.value = file;
    refs.sourceList.add(child);
  }
  const firstItem = refs.sourceList.item(0).value;
  refs.source.value = firstItem;
  selectFile(firstItem);
}

/**
 * @param {ReturnType<import('../utils/lut.js').parseLUT>} lut
 * @param {HTMLCanvasElement} canvas
 */
function renderLutSquare(lut, canvas) {
  const size = Math.cbrt(lut.points.length);

  const ctx = canvas.getContext('2d');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.canvas.width = size;
  ctx.canvas.height = size;

  ctx.clearRect(0, 0, size, size); // clear frame
  ctx.reset();
  ctx.imageSmoothingEnabled = false;
  const unitSize = 1;
  for (const point of lut.points) {
    if (point.z !== 0) continue;
    const x = (point.x * (size - 1)) * unitSize;
    const y = (point.y * (size - 1)) * unitSize;
    const color = `rgb(${point.raw.slice(0, 3).join(',')})`;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(x, y, unitSize, unitSize);
    ctx.fill();
  }
}

/**
 *
 * @param ctx
 * @param rgb
 * @param x
 * @param y
 */
function drawPoint(ctx, rgb, x, y) {
  const color = `rgb(${rgb.slice(0, 3).join(',')})`;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.rect(x, y, 1, 1);
  ctx.fill();
}

/**
 * @param {ReturnType<import('../utils/lut.js').parseLUT>} lut
 * @param {HTMLCanvasElement} canvas
 */
function renderLut(lut, canvas) {
  const size = Math.cbrt(lut.points.length);

  const ctx = canvas.getContext('2d');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.canvas.width = size;
  ctx.canvas.height = size;

  ctx.clearRect(0, 0, size, size); // clear frame
  ctx.reset();
  ctx.imageSmoothingEnabled = false;
  const unitSize = 1;

  const max = size - 1;
  for (let i = 0; i < size; i++) {
    const coord = i / max;
    const inverse = (size - 1 - i) / max;
    let y = 0;

    // Grayscale
    drawPoint(ctx, lut.at(coord, coord, coord).raw, i, y++);

    drawPoint(ctx, lut.at(coord, 0, 0).raw, i, y++);

    drawPoint(ctx, lut.at(0, coord, 0).raw, i, y++);

    drawPoint(ctx, lut.at(0, 0, coord).raw, i, y++);

    drawPoint(ctx, lut.at(0, coord, coord).raw, i, y++); // Cyan
    drawPoint(ctx, lut.at(coord, coord, 0).raw, i, y++); // Yellow
    drawPoint(ctx, lut.at(coord, 0, coord).raw, i, y++); // Magenta

    drawPoint(ctx, lut.at(1, coord, coord).raw, i, y++);
    drawPoint(ctx, lut.at(coord, 1, coord).raw, i, y++);
    drawPoint(ctx, lut.at(coord, coord, 1).raw, i, y++);

    drawPoint(ctx, lut.at(coord, 1, 1).raw, i, y++);
    drawPoint(ctx, lut.at(1, 1, coord).raw, i, y++);
    drawPoint(ctx, lut.at(1, coord, 1).raw, i, y++);

    drawPoint(ctx, lut.at(inverse, coord, coord).raw, i, y++);
    drawPoint(ctx, lut.at(coord, inverse, coord).raw, i, y++);
    drawPoint(ctx, lut.at(coord, coord, inverse).raw, i, y++);
  }
}

/**
 *
 * @param {string} filename
 */
async function selectFile(filename) {
  console.log('selectFile', filename);
  const resource = state.files.get(filename);
  if (!resource) return;

  const file = await resource.getFile();
  const data = await file.arrayBuffer();
  const array = new Uint8Array(data);
  const dds = parseDDS(array);
  console.log(dds);
  const lut = parseLUT(dds);
  const black = asRGB8FromLinear(lut.black);
  refs.black.textContent = black;
  refs.blackCircle.style.backgroundColor = black;
  const white = asRGB8FromLinear(lut.white);
  refs.white.textContent = white;
  refs.whiteCircle.style.backgroundColor = white;

  const levels = getLevels(dds.surface, dds.bytesPerPixel);
  refs.min.textContent = Math.round(levels.minChannel * 255);
  refs.max.textContent = Math.round(levels.maxChannel * 255);

  const tint = asRGB8FromLinear([
    levels.averageRed,
    levels.averageGreen,
    levels.averageBlue,
  ]);
  refs.tint.textContent = tint;
  refs.tintCircle.style.backgroundColor = tint;

  renderLut(lut, refs.surfaceBefore);

  const patched = parseDDS(array.slice());

  const changes = patchDDS(patched);
  console.log({ changes });
  renderLut(parseLUT(patched), refs.surfaceAfter);
}

/**
 *
 * @param event
 */
async function selectInput(event) {
  /** @type {FileSystemDirectoryHandle} */
  let directoryhandle;
  try {
    directoryhandle = await window.showDirectoryPicker();
  } catch {
    return; // User abort
  }
  let count = 0;
  state.files.clear();
  for await (const [key, value] of directoryhandle.entries()) {
    if (!key.endsWith('.dds')) continue;
    state.files.set(key, value);
    count++;
  }
  refs.inputPicker.textContent = `Files: ${count}`;
  refreshFiles();
}

// Binds

refs.inputPicker.addEventListener('click', selectInput);
refs.source.addEventListener('input', () => selectFile(refs.source.value));
refs.source.addEventListener('change', () => selectFile(refs.source.value));
refs.sourceList.addEventListener('change', () => selectFile(refs.source.value));
