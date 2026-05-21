'use strict';

// Unit tests for settings.js — the defensive settings parser. Run with
// `node --test`. These verify the degradation promises of ADR-0005.

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, parseSettings } = require('../settings.js');

test('parseSettings: absent storage (null) yields the defaults', () => {
  assert.deepEqual(parseSettings(null, DEFAULTS), DEFAULTS);
});

test('parseSettings: returns a fresh object, never the defaults themselves', () => {
  const s = parseSettings(null, DEFAULTS);
  assert.notEqual(s, DEFAULTS);
  assert.notEqual(s.cues, DEFAULTS.cues);          // the nested object is fresh too
  s.cues.n50 = false;
  assert.equal(DEFAULTS.cues.n50, true);           // mutating the result cannot leak back
});

test('parseSettings: corrupt or empty JSON degrades to defaults', () => {
  assert.deepEqual(parseSettings('{not valid', DEFAULTS), DEFAULTS);
  assert.deepEqual(parseSettings('', DEFAULTS), DEFAULTS);
});

test('parseSettings: a non-object blob degrades to defaults', () => {
  assert.deepEqual(parseSettings('null', DEFAULTS), DEFAULTS);
  assert.deepEqual(parseSettings('42', DEFAULTS), DEFAULTS);
  assert.deepEqual(parseSettings('"a string"', DEFAULTS), DEFAULTS);
  assert.deepEqual(parseSettings('[1,2]', DEFAULTS), DEFAULTS);
});

test('parseSettings: a recognised field overrides, the rest stay default', () => {
  const s = parseSettings('{"voice":"british_female"}', DEFAULTS);
  assert.equal(s.voice, 'british_female');
  assert.equal(s.keepAwake, DEFAULTS.keepAwake);
  assert.deepEqual(s.cues, DEFAULTS.cues);
});

test('parseSettings: wrong-typed fields are ignored', () => {
  const s = parseSettings('{"keepAwake":"yes","nudge":1,"voice":123}', DEFAULTS);
  assert.equal(s.keepAwake, DEFAULTS.keepAwake);   // string, not boolean
  assert.equal(s.nudge, DEFAULTS.nudge);           // number, not boolean
  assert.equal(s.voice, DEFAULTS.voice);           // number, not string
});

test('parseSettings: a partial cues object merges over the defaults', () => {
  const s = parseSettings('{"cues":{"n50":false,"final":false}}', DEFAULTS);
  assert.equal(s.cues.n50, false);
  assert.equal(s.cues.final, false);
  assert.equal(s.cues.n40, true);                  // an untouched key keeps its default
});

test('parseSettings: unknown cue keys and non-boolean cue values are dropped', () => {
  const s = parseSettings('{"cues":{"n50":"on","bogus":true}}', DEFAULTS);
  assert.equal(s.cues.n50, true);                  // "on" is not a boolean — ignored
  assert.equal('bogus' in s.cues, false);          // unknown key not carried over
});

test('parseSettings: an older blob missing fields fills the gaps from defaults', () => {
  // A hypothetical earlier shape carrying only the fields that existed then.
  const s = parseSettings('{"voice":"australian_female","keepAwake":false}', DEFAULTS);
  assert.equal(s.voice, 'australian_female');
  assert.equal(s.keepAwake, false);
  assert.equal(s.nudge, DEFAULTS.nudge);
  assert.equal(s.showCredit, DEFAULTS.showCredit);
  assert.deepEqual(s.cues, DEFAULTS.cues);
});

test('parseSettings: holdToReset overrides when boolean, falls back otherwise', () => {
  assert.equal(parseSettings('{"holdToReset":false}', DEFAULTS).holdToReset, false);
  assert.equal(parseSettings('{"holdToReset":"no"}', DEFAULTS).holdToReset, DEFAULTS.holdToReset);
  // An older blob predating the field keeps the default (on).
  assert.equal(parseSettings('{"voice":"british_female"}', DEFAULTS).holdToReset, true);
});
