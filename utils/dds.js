import BinaryConsumer from './BinaryConsumer.js';
import { utf8FromUint8Array } from './binary.js';
import { linearRGBFromSRGB } from './color.js';

/** @param {BinaryConsumer} consumer */
function parsePixelFormat(consumer) {
  return {
    /** Structure size; set to 32 (bytes). */
    size: consumer.readDWord(),
    /**
     * Values which indicate what type of data is in the surface.
     *
     * Flag | Description | Value
     * :--- | :---------- | ----:
     * `DDPF_ALPHAPIXELS` | Texture contains alpha data; dwRGBAlphaBitMask contains valid data. | 0x1
     * `DDPF_ALPHA` | Used in some older DDS files for alpha channel only uncompressed data (dwRGBBitCount contains the alpha channel bitcount; dwABitMask contains valid data) | 0x2
     * `DDPF_FOURCC` | Texture contains compressed RGB data; dwFourCC contains valid data. | 0x4
     * `DDPF_RGB` | Texture contains uncompressed RGB data; dwRGBBitCount and the RGB masks (dwRBitMask, dwGBitMask, dwBBitMask) contain valid data. | 0x40
     * `DDPF_YUV` | Used in some older DDS files for YUV uncompressed data (dwRGBBitCount contains the YUV bit count; dwRBitMask contains the Y mask, dwGBitMask contains the U mask, dwBBitMask contains the V mask) | 0x200
     * `DDPF_LUMINANCE` | Used in some older DDS files for single channel color uncompressed data (dwRGBBitCount contains the luminance channel bit count; dwRBitMask contains the channel mask). Can be combined with DDPF_ALPHAPIXELS for a two channel DDS file. | 0x20000
     */
    flags: consumer.readDWord(),
    /**
     * Four-character codes for specifying compressed or custom formats.
     * Possible values include: DXT1, DXT2, DXT3, DXT4, or DXT5.
     * A FourCC of DX10 indicates the prescense of the DDS_HEADER_DXT10 extended
     * header, and the dxgiFormat member of that structure indicates the true
     * format. When using a four-character code, dwFlags must include
     * DDPF_FOURCC.
     * @type {'DXT1'|'DXT2'|'DXT3'|'DXT4'|'DXT5'|'DX10'}
     */
    fourCC: /** @type {any} */ (utf8FromUint8Array(consumer.readBytes(4))),
    /** Number of bits in an RGB (possibly including alpha) format. Valid when dwFlags includes DDPF_RGB, DDPF_LUMINANCE, or DDPF_YUV. */
    rgbBitCount: consumer.readDWord(),
    /** Red (or luminance or Y) mask for reading color data. For instance, given the A8R8G8B8 format, the red mask would be 0x00ff0000. */
    rBitMask: consumer.readDWord(),
    /** Green (or U) mask for reading color data. For instance, given the A8R8G8B8 format, the green mask would be 0x0000ff00. */
    gBitMask: consumer.readDWord(),
    /** Blue (or V) mask for reading color data. For instance, given the A8R8G8B8 format, the blue mask would be 0x000000ff. */
    bBitMask: consumer.readDWord(),
    /** Alpha mask for reading alpha data. dwFlags must include DDPF_ALPHAPIXELS or DDPF_ALPHA. For instance, given the A8R8G8B8 format, the alpha mask would be 0xff000000. */
    aBitMask: consumer.readDWord(),
  };
}

/**
 *
 * @param {Uint8Array} uint8Array
 */
export function parseDDS(uint8Array) {
  const consumer = new BinaryConsumer(uint8Array, true);
  const signature = utf8FromUint8Array(consumer.readBytes(4));
  if (signature !== 'DDS ') throw new Error('invalid');
  const header = {
    size: consumer.readDWord(),
    /**
     * Flags to indicate which members contain valid data.
     *
     * | Flag | Description | Value
     * | :--- | :---------- | -----:
     * | DDSD_CAPS | Required in every .dds file. | 0x1
     * | DDSD_HEIGHT | Required in every .dds file. | 0x2
     * | DDSD_WIDTH | Required in every .dds file. | 0x4
     * | DDSD_PITCH | Required when pitch is provided for an uncompressed texture. | 0x8
     * | DDSD_PIXELFORMAT | Required in every .dds file. | 0x1000
     * | DDSD_MIPMAPCOUNT | Required in a mipmapped texture. | 0x20000
     * | DDSD_LINEARSIZE | Required when pitch is provided for a compressed texture. | 0x80000
     * | DDSD_DEPTH | Required in a depth texture. | 0x800000
     *
     * Note:
     *
     *  - When you write `.dds` files, you should set the `DDSD_CAPS` and `DDSD_PIXELFORMAT` flags,
     *   and for mipmapped textures you should also set the `DDSD_MIPMAPCOUNT` flag.
     *   However, when you read a `.dds` file, you should not rely on the `DDSD_CAPS`,
     *   `DDSD_PIXELFORMAT`, and `DDSD_MIPMAPCOUNT` flags being set because some
     *   writers of such a file might not set these flags.
     *
     * The `DDS_HEADER_FLAGS_TEXTURE` flag, which is defined in Dds.h, is a bitwise-OR combination of the `DDSD_CAPS`,
     * `DDSD_HEIGHT`, `DDSD_WIDTH`, and `DDSD_PIXELFORMAT` flags.
     *
     * The `DDS_HEADER_FLAGS_MIPMAP` flag, which is defined in Dds.h, is equal to the `DDSD_MIPMAPCOUNT` flag.
     *
     * The `DDS_HEADER_FLAGS_VOLUME` flag, which is defined in Dds.h, is equal to the `DDSD_DEPTH` flag.
     *
     * The `DDS_HEADER_FLAGS_PITCH` flag, which is defined in Dds.h, is equal to the `DDSD_PITCH` flag.
     *
     * The `DDS_HEADER_FLAGS_LINEARSIZE` flag, which is defined in Dds.h, is equal to the `DDSD_LINEARSIZE` flag.
     */
    flags: consumer.readDWord(),
    /** Surface height (in pixels) */
    height: consumer.readDWord(),
    /** Surface width (in pixels). */
    width: consumer.readDWord(),
    /**
     * The pitch or number of bytes per scan line in an uncompressed texture;
     * the total number of bytes in the top level texture for a compressed texture.
     * For information about how to compute the pitch, see the DDS File Layout section
     * of theProgramming Guide for DDS.
     */
    pitchOrLinearSize: consumer.readDWord(),
    /** Depth of a volume texture (in pixels), otherwise unused. */
    depth: consumer.readDWord(),
    /** Number of mipmap levels, otherwise unused. */
    mipMapCount: consumer.readDWord(),
    /** Unused. */
    reserved1: consumer.readBytes(4 * 11),
    /** The Pixel Format. */
    spf: parsePixelFormat(consumer),
    /**
     * Specifies the complexity of the surfaces stored.
     *
     * | Flag | Description | Value
     * | :--- | :---------- | ----:
     * | DDSCAPS_COMPLEX | Optional; must be used on any file that contains more than one surface (a mipmap, a cubic environment map, or mipmapped volume texture). | 0x8
     * | DDSCAPS_MIPMAP | Optional; should be used for a mipmap. | 0x400000
     * | DDSCAPS_TEXTURE | Required | 0x1000
     *
     * Note
     *
     *  - When you write .dds files, you should set the DDSCAPS_TEXTURE flag, and for multiple surfaces you should also set the DDSCAPS_COMPLEX flag. However, when you read a .dds file, you should not rely on the DDSCAPS_TEXTURE and DDSCAPS_COMPLEX flags being set because some writers of such a file might not set these flags.
     *
     * The DDS_SURFACE_FLAGS_MIPMAP flag, which is defined in Dds.h, is a bitwise-OR combination of the DDSCAPS_COMPLEX and DDSCAPS_MIPMAP flags.
     *
     * The DDS_SURFACE_FLAGS_TEXTURE flag, which is defined in Dds.h, is equal to the DDSCAPS_TEXTURE flag.
     *
     * The DDS_SURFACE_FLAGS_CUBEMAP flag, which is defined in Dds.h, is equal to the DDSCAPS_COMPLEX flag.
     */
    caps: consumer.readDWord(),
    /**
     * Additional detail about the surfaces stored.
     *
     * | Flag | Description | Value
     * | :--- | :---------- | ----:
     * | DDSCAPS2_CUBEMAP | Required for a cube map. | 0x200
     * | DDSCAPS2_CUBEMAP_POSITIVEX | Required when these surfaces are stored in a cube map. | 0x400
     * | DDSCAPS2_CUBEMAP_NEGATIVEX | Required when these surfaces are stored in a cube map. | 0x800
     * | DDSCAPS2_CUBEMAP_POSITIVEY | Required when these surfaces are stored in a cube map. | 0x1000
     * | DDSCAPS2_CUBEMAP_NEGATIVEY | Required when these surfaces are stored in a cube map. | 0x2000
     * | DDSCAPS2_CUBEMAP_POSITIVEZ | Required when these surfaces are stored in a cube map. | 0x4000
     * | DDSCAPS2_CUBEMAP_NEGATIVEZ | Required when these surfaces are stored in a cube map. | 0x8000
     * | DDSCAPS2_VOLUME | Required for a volume texture. | 0x200000
     *
     * The DDS_CUBEMAP_POSITIVEX flag, which is defined in Dds.h, is a bitwise-OR combination of the DDSCAPS2_CUBEMAP and DDSCAPS2_CUBEMAP_POSITIVEX flags.
     *
     * The DDS_CUBEMAP_NEGATIVEX flag, which is defined in Dds.h, is a bitwise-OR combination of the DDSCAPS2_CUBEMAP and DDSCAPS2_CUBEMAP_NEGATIVEX flags.
     *
     * The DDS_CUBEMAP_POSITIVEY flag, which is defined in Dds.h, is a bitwise-OR combination of the DDSCAPS2_CUBEMAP and DDSCAPS2_CUBEMAP_POSITIVEY flags.
     *
     * The DDS_CUBEMAP_NEGATIVEY flag, which is defined in Dds.h, is a bitwise-OR combination of the DDSCAPS2_CUBEMAP and DDSCAPS2_CUBEMAP_NEGATIVEY flags.
     *
     * The DDS_CUBEMAP_POSITIVEZ flag, which is defined in Dds.h, is a bitwise-OR combination of the DDSCAPS2_CUBEMAP and DDSCAPS2_CUBEMAP_POSITIVEZ flags.
     *
     * The DDS_CUBEMAP_NEGATIVEZ flag, which is defined in Dds.h, is a bitwise-OR combination of the DDSCAPS2_CUBEMAP and DDSCAPS2_CUBEMAP_NEGATIVEZ flags.
     *
     * The DDS_CUBEMAP_ALLFACES flag, which is defined in Dds.h, is a bitwise-OR combination of the DDS_CUBEMAP_POSITIVEX, DDS_CUBEMAP_NEGATIVEX, DDS_CUBEMAP_POSITIVEY, DDS_CUBEMAP_NEGATIVEY, DDS_CUBEMAP_POSITIVEZ, and DDSCAPS2_CUBEMAP_NEGATIVEZ flags.
     *
     * The DDS_FLAGS_VOLUME flag, which is defined in Dds.h, is equal to the DDSCAPS2_VOLUME flag.
     *
     * Note
     *
     * - Although Direct3D 9 supports partial cube-maps, Direct3D 10, 10.1, and 11 require that you define all six cube-map faces (that is, you must set DDS_CUBEMAP_ALLFACES).
     */
    caps2: consumer.readDWord(),
    caps3: consumer.readDWord(),
    caps4: consumer.readDWord(),
    reserved2: consumer.readDWord(),
  };

  const header10 = (header.spf.fourCC === 'DX10') ? {
    /** The surface pixel format (see DXGI_FORMAT). */
    dxgiFormat: consumer.readDWord(),
    resourceDimension: consumer.readDWord(),
    miscFlag: consumer.readDWord(),
    arraySize: consumer.readDWord(),
    miscFlag2: consumer.readDWord(),
  } : null;

  const bytesLeft = uint8Array.length - consumer.byteOffset;
  const bytesPerPixel = bytesLeft / (header.width * header.height);

  const surface = consumer.readBytes(bytesLeft);
  const extraSurfaces = consumer.readBytes(uint8Array.length - consumer.byteOffset);

  return { signature, header, header10, surface, extraSurfaces, bytesPerPixel };
}
