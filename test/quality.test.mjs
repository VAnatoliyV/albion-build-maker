import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverlay } from '../tools/lib/quality.mjs';

const px = (...rgba) => new Uint8Array(rgba);

test('pixel changed in most refs → median of their quality pixels', () => {
  const base = [px(10, 10, 10, 255), px(20, 20, 20, 255), px(30, 30, 30, 255), px(40, 40, 40, 255), px(50, 50, 50, 255)];
  const q = [px(200, 0, 0, 255), px(210, 0, 0, 255), px(220, 0, 0, 255), px(40, 40, 40, 255), px(250, 0, 0, 255)];
  assert.deepEqual([...buildOverlay(base, q)], [220, 0, 0, 255]);
});

test('pixel changed in a minority of refs (their own artwork) → transparent', () => {
  const base = [px(1, 1, 1, 255), px(1, 1, 1, 255), px(1, 1, 1, 255), px(1, 1, 1, 255), px(1, 1, 1, 255)];
  const q = [px(99, 99, 99, 255), px(99, 99, 99, 255), px(1, 1, 1, 255), px(1, 1, 1, 255), px(1, 1, 1, 255)];
  assert.deepEqual([...buildOverlay(base, q)], [0, 0, 0, 0]);
});
