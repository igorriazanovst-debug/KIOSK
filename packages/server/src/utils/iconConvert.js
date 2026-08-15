// Linux packaging (deb/rpm/AppImage) wants a square PNG icon, ideally 256px+.
// Windows .ico uploads may only contain small legacy frames (16/32/48px) —
// those aren't usable for Linux, so we skip the custom icon rather than ship
// a blurry one.
const MIN_ICON_SIZE = 256;

const ICO_HEADER_SIZE = 6;
const ICO_DIR_ENTRY_SIZE = 16;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Extracts the largest embedded frame from an uploaded .ico as a PNG buffer,
// for reuse as the Linux app icon. Returns null (never throws) when the file
// can't be parsed or has no frame large enough — callers should fall back to
// electron-builder's default icon in that case.
//
// Deliberately hand-parses the ICO directory instead of fully decoding every
// frame to pixels: since Windows Vista+, large ICO frames are stored as a
// complete embedded PNG file, so the wanted frame can just be sliced out by
// its declared (offset, size) — no pixel expansion, no risk of an attacker
// declaring a huge width/height to force a large allocation. Frames stored
// in the legacy BMP encoding (rare for 256px+ icons) aren't decoded — we
// skip them rather than take on that cost for an untrusted upload.
export async function convertIcoToPng(icoBuffer) {
  try {
    if (icoBuffer.length < ICO_HEADER_SIZE) return null;

    const reserved = icoBuffer.readUInt16LE(0);
    const type = icoBuffer.readUInt16LE(2);
    const count = icoBuffer.readUInt16LE(4);
    if (reserved !== 0 || type !== 1 || count === 0) return null;

    let best = null;

    for (let i = 0; i < count; i++) {
      const entryOffset = ICO_HEADER_SIZE + i * ICO_DIR_ENTRY_SIZE;
      if (entryOffset + ICO_DIR_ENTRY_SIZE > icoBuffer.length) break;

      const widthByte = icoBuffer.readUInt8(entryOffset);
      const heightByte = icoBuffer.readUInt8(entryOffset + 1);
      const width = widthByte === 0 ? 256 : widthByte; // 0 means 256 per the ICO spec
      const height = heightByte === 0 ? 256 : heightByte;
      if (width < MIN_ICON_SIZE || height < MIN_ICON_SIZE) continue;
      if (best && width <= best.width) continue;

      const dataSize = icoBuffer.readUInt32LE(entryOffset + 8);
      const dataOffset = icoBuffer.readUInt32LE(entryOffset + 12);
      if (dataSize < PNG_MAGIC.length || dataOffset + dataSize > icoBuffer.length) continue;

      const frameData = icoBuffer.subarray(dataOffset, dataOffset + dataSize);
      if (!frameData.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) continue; // skip legacy BMP-encoded frames

      best = { width, buffer: Buffer.from(frameData) };
    }

    return best ? best.buffer : null;
  } catch (e) {
    console.error('[iconConvert] failed to parse .ico:', e.message);
    return null;
  }
}
