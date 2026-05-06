import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function cropPng(inputPath, outputPath, crop) {
  const image = readPng(inputPath);

  if (image.bitDepth !== 8 || image.colorType !== 3) {
    throw new Error(`Only 8-bit indexed PNG is supported: ${inputPath}`);
  }

  const x = clamp(crop.x, 0, image.width - 1);
  const y = clamp(crop.y, 0, image.height - 1);
  const width = clamp(crop.width, 1, image.width - x);
  const height = clamp(crop.height, 1, image.height - y);
  const rows = image.rows.slice(y, y + height).map((row) => row.subarray(x, x + width));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, writePng({ ...image, width, height, rows }));
}

function readPng(filePath) {
  const file = fs.readFileSync(filePath);
  if (!file.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Invalid PNG signature: ${filePath}`);
  }

  let offset = 8;
  let ihdr;
  let palette;
  let transparency;
  const idatParts = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;

    if (type === 'IHDR') {
      ihdr = Buffer.from(data);
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'tRNS') {
      transparency = Buffer.from(data);
    } else if (type === 'IDAT') {
      idatParts.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!ihdr) {
    throw new Error(`Missing IHDR: ${filePath}`);
  }

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const rows = [];
  let previous = Buffer.alloc(width);
  let cursor = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const row = Buffer.from(inflated.subarray(cursor, cursor + width));
    cursor += width;
    unfilterRow(row, previous, filter);
    rows.push(row);
    previous = row;
  }

  return {
    width,
    height,
    bitDepth,
    colorType,
    ihdrRest: Buffer.from(ihdr.subarray(8)),
    palette,
    transparency,
    rows,
  };
}

function unfilterRow(row, previous, filter) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index > 0 ? row[index - 1] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index > 0 ? previous[index - 1] : 0;

    if (filter === 1) {
      row[index] = (row[index] + left) & 0xff;
    } else if (filter === 2) {
      row[index] = (row[index] + up) & 0xff;
    } else if (filter === 3) {
      row[index] = (row[index] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filter === 4) {
      row[index] = (row[index] + paeth(left, up, upLeft)) & 0xff;
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG filter: ${filter}`);
    }
  }
}

function writePng(image) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  image.ihdrRest.copy(ihdr, 8);

  const rawRows = Buffer.concat(image.rows.map((row) => Buffer.concat([Buffer.from([0]), row])));
  const chunks = [chunk('IHDR', ihdr)];

  if (image.palette) {
    chunks.push(chunk('PLTE', image.palette));
  }

  if (image.transparency) {
    chunks.push(chunk('tRNS', image.transparency));
  }

  chunks.push(chunk('IDAT', zlib.deflateSync(rawRows)));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat([pngSignature, ...chunks]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left, up, upLeft) {
  const predictor = left + up - upLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const upLeftDistance = Math.abs(predictor - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  return upDistance <= upLeftDistance ? up : upLeft;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }

  return parsed;
}

if (process.argv.length !== 8) {
  throw new Error('Usage: node scripts/crop-png.mjs <input> <output> <x> <y> <width> <height>');
}

cropPng(process.argv[2], process.argv[3], {
  x: parseNumber(process.argv[4], 'x'),
  y: parseNumber(process.argv[5], 'y'),
  width: parseNumber(process.argv[6], 'width'),
  height: parseNumber(process.argv[7], 'height'),
});
