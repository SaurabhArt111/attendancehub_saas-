'use strict';
const sharp = require('sharp');

const TARGET_MAX_BYTES = 200 * 1024; // 200 KB — hard ceiling we aim to stay under
const TARGET_MIN_BYTES = 100 * 1024; // 100 KB — informal target floor (smaller is fine)
const MAX_DIMENSION     = 1600;      // px, longest side — plenty for an ID proof photo
const MIN_QUALITY        = 35;
const MAX_ITERATIONS      = 12;

/**
 * Converts any supported input image (png/jpg/webp/heic/etc.) to a compressed
 * JPEG buffer, targeting 100–200 KB (or smaller, if that's achievable without
 * dropping below a usable quality floor). Runs entirely in-memory — nothing
 * ever touches disk, and the original buffer is never persisted.
 *
 * @param {Buffer} inputBuffer  Raw uploaded file bytes.
 * @returns {Promise<{ buffer: Buffer, size: number, quality: number, width: number, height: number }>}
 */
async function compressToJpeg(inputBuffer) {
  // Auto-orient using EXIF, then strip metadata (also drops the EXIF orientation
  // tag itself since we've already applied it) to keep the output lean.
  let pipeline = sharp(inputBuffer, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();

  let width = meta.width || null;
  if (width && width > MAX_DIMENSION) width = MAX_DIMENSION;

  let quality = 82;
  let buffer = await sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  let iterations = 0;
  while (buffer.length > TARGET_MAX_BYTES && iterations < MAX_ITERATIONS) {
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 10);
    } else {
      // Quality floor reached — shrink dimensions instead and reset quality a bit.
      width = Math.round((width || meta.width) * 0.85);
      quality = 60;
    }
    buffer = await sharp(inputBuffer, { failOn: 'none' })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    iterations++;
  }

  const finalMeta = await sharp(buffer).metadata();
  return {
    buffer,
    size: buffer.length,
    quality,
    width: finalMeta.width,
    height: finalMeta.height
  };
}

module.exports = { compressToJpeg, TARGET_MAX_BYTES, TARGET_MIN_BYTES };
