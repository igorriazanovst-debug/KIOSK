import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { convertIcoToPng } from './iconConvert.js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Builds a real, valid solid-color PNG (RGB, no compression tricks beyond zlib deflate).
function makeSolidPng(width, height) {
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  const rowBytes = width * 3;
  const raw = Buffer.alloc((rowBytes + 1) * height, 200);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter type: none
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Builds a real ICO container embedding the given PNG-encoded frames
// (the "PNG-compressed ICO" format used by Windows Vista+ for large icons).
function makeIco(frames) {
  const dirEntrySize = 16;
  let offset = 6 + dirEntrySize * frames.length;
  const dirEntries = [];
  const dataBuffers = [];

  for (const frame of frames) {
    const entry = Buffer.alloc(dirEntrySize);
    entry[0] = frame.width >= 256 ? 0 : frame.width;
    entry[1] = frame.height >= 256 ? 0 : frame.height;
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(frame.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    dataBuffers.push(frame.png);
    offset += frame.png.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  return Buffer.concat([header, ...dirEntries, ...dataBuffers]);
}

test('convertIcoToPng returns the largest frame as a PNG buffer when it meets the minimum size', async () => {
  const small = makeSolidPng(48, 48);
  const large = makeSolidPng(256, 256);
  const ico = makeIco([
    { width: 48, height: 48, png: small },
    { width: 256, height: 256, png: large },
  ]);

  const result = await convertIcoToPng(ico);

  assert.ok(result);
  assert.deepEqual(result.subarray(0, 8), PNG_SIGNATURE);
  assert.equal(result.readUInt32BE(16), 256); // IHDR width field
});

test('convertIcoToPng returns null when no frame meets the minimum size', async () => {
  const ico = makeIco([{ width: 48, height: 48, png: makeSolidPng(48, 48) }]);

  const result = await convertIcoToPng(ico);

  assert.equal(result, null);
});

test('convertIcoToPng returns null instead of throwing on a corrupt buffer', async () => {
  const result = await convertIcoToPng(Buffer.from('not an ico file'));

  assert.equal(result, null);
});

test('convertIcoToPng skips a large frame that is not PNG-encoded (legacy BMP-in-ICO)', async () => {
  const bmpLikeData = Buffer.concat([Buffer.from('BM'), Buffer.alloc(62, 0)]); // not PNG magic
  const ico = makeIco([{ width: 256, height: 256, png: bmpLikeData }]);

  const result = await convertIcoToPng(ico);

  assert.equal(result, null);
});

test('convertIcoToPng ignores a directory entry whose declared data range exceeds the buffer, without throwing', async () => {
  // A malicious .ico could declare an oversized dataSize/dataOffset to try to
  // force a large read; the parser must bound-check against the real buffer
  // length rather than trust the header, and never decode pixels at all.
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width byte 0 => 256
  entry[1] = 0; // height byte 0 => 256
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(0xffffffff, 8); // dataSize: absurdly large
  entry.writeUInt32LE(6 + 16, 12); // dataOffset: right after the single dir entry
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const ico = Buffer.concat([header, entry, Buffer.from([0x89, 0x50, 0x4e, 0x47])]);

  const result = await convertIcoToPng(ico);

  assert.equal(result, null);
});
