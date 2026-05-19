'use strict';

// Unit tests for voices.js — the voice-pack manifest. Run with `node --test`.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SPAWN_SOUND, CLIP_KEYS, VOICES, clipPaths, allClipPaths,
} = require('../voices.js');

test('every voice pack provides all six clip keys as .mp3 paths', () => {
  for (const [name, pack] of Object.entries(VOICES)) {
    for (const key of CLIP_KEYS) {
      assert.equal(typeof pack[key], 'string', `${name} is missing ${key}`);
      assert.match(pack[key], /\.mp3$/, `${name}.${key} is not an .mp3 path`);
    }
  }
});

test("clipPaths returns the pack's six clips plus the spawn beep", () => {
  const paths = clipPaths('american_female');
  assert.equal(paths.length, CLIP_KEYS.length + 1);
  assert.ok(paths.includes(SPAWN_SOUND));
  assert.ok(paths.includes(VOICES.american_female.n50));
});

test('clipPaths falls back to the American pack for an unknown voice', () => {
  assert.deepEqual(clipPaths('does_not_exist'), clipPaths('american_female'));
});

test('allClipPaths covers every clip of every pack plus the spawn beep', () => {
  const all = allClipPaths();
  const packCount = Object.keys(VOICES).length;
  assert.equal(all.length, 1 + packCount * CLIP_KEYS.length);
  assert.ok(all.includes(SPAWN_SOUND));
  for (const pack of Object.values(VOICES)) {
    for (const key of CLIP_KEYS) {
      assert.ok(all.includes(pack[key]), `allClipPaths missing ${pack[key]}`);
    }
  }
});

test('allClipPaths lists every path once — no duplicates', () => {
  const all = allClipPaths();
  assert.equal(new Set(all).size, all.length);
  assert.equal(all.filter((p) => p === SPAWN_SOUND).length, 1);
});
