import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePng, encodePng } from '../tools/lib/png.mjs';

test('decodes a real render.albiononline.com icon', () => {
  const img = decodePng(readFileSync(new URL('./fixture-bag.png', import.meta.url)));
  assert.equal(img.width, 128);
  assert.equal(img.height, 128);
  assert.equal(img.data.length, 128 * 128 * 4);
  assert.equal(img.data[3], 0); // угол иконки прозрачный
  const c = (64 * 128 + 64) * 4;
  assert.equal(img.data[c + 3], 255); // центр непрозрачный
});

test('encode → decode roundtrip keeps pixels', () => {
  const data = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) % 256);
  const back = decodePng(encodePng({ width: 3, height: 2, data }));
  assert.deepEqual([...back.data], [...data]);
});
