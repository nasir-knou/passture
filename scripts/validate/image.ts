import fs from 'node:fs';
import path from 'node:path';

import { expectKnownKeys, expectRecord, expectString } from './expect';

const IMAGE_KEYS = ['path', 'alt'];

/**
 * 이미지 경로는 public/ 기준 상대 경로여야 한다. 화면은 경로를 그대로 src로 쓰므로
 * 절대 경로·URL·`..`은 배포 위치(서브 경로)에 따라 깨지거나 public/ 밖을 가리킨다.
 */
export function validateImage(value: unknown, fieldPath: string, root: string): void {
  const image = expectRecord(value, fieldPath);
  expectKnownKeys(image, IMAGE_KEYS, fieldPath);
  const imagePath = expectString(image.path, `${fieldPath}.path`);
  expectString(image.alt, `${fieldPath}.alt`);

  if (imagePath.startsWith('/') || imagePath.startsWith('\\') || path.isAbsolute(imagePath)) {
    throw new Error(`${fieldPath}.path must be relative to public/ (no leading /): ${imagePath}`);
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(imagePath)) {
    throw new Error(`${fieldPath}.path must be a relative file path, not a URL: ${imagePath}`);
  }

  if (imagePath.split(/[/\\]/).includes('..')) {
    throw new Error(`${fieldPath}.path must not contain ..: ${imagePath}`);
  }

  const publicDir = path.resolve(root, 'public');
  const resolved = path.resolve(publicDir, imagePath);
  if (!resolved.startsWith(publicDir + path.sep)) {
    throw new Error(`${fieldPath}.path must resolve under public/: ${imagePath}`);
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${fieldPath}.path file does not exist under public/: ${imagePath}`);
  }
}
