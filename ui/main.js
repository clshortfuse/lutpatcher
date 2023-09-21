import { parseDDS } from '../utils/dds.js';

// Lazy refs
const refs = {
  sourceList: /** @type {HTMLSelectElement} */ (document.getElementById('source-list')),
  source: /** @type {HTMLInputElement} */ (document.getElementById('source')),
  inputPicker: document.getElementById('input-picker'),
  surface: /** @type {HTMLCanvasElement} */ (document.getElementById('surface')),
};

const state = {
  /** @type {Map<string,FileSystemFileHandle>} */
  files: new Map(),
  gl: refs.surface.getContext('webgl2'),
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
 *
 */
function updateSurface() {
  const { gl } = state;
  gl.clearColor(0, 0, 0, 1); // Opaque black
  gl.clear(gl.COLOR_BUFFER_BIT);
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
  updateSurface();
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
refs.sourceList.addEventListener('change', () => selectFile(refs.source.value));
