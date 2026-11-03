const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../js/guitar-analysis.js');
const { validState } = require('../js/state-validation.js');
test('Guitar estimator recognizes a synthetic G–D–Em–C progression and ignores silence', () => {
  const rate = 22050;
  const expected = [[7, false], [2, false], [4, true], [0, false]];
  const pcm = new Float32Array(rate * 8);
  expected.forEach(([root, minor], segment) => {
    for (let i = 0; i < rate * 2; i++) {
      for (const interval of [0, minor ? 3 : 4, 7]) {
        const f = 440 * 2 ** ((48 + root + interval - 69) / 12);
        pcm[segment * rate * 2 + i] += .12 * Math.sin(2 * Math.PI * f * i / rate);
      }
    }
  });
  const changes = analyze(pcm, rate);
  assert.deepEqual(changes.map(c => [c.root, c.minor]), expected);
  assert.deepEqual(changes.map(c => [c.start, c.end]), [[0,2],[2,4],[4,6],[6,8]]);
  assert.equal(analyze(new Float32Array(rate * 2), rate).length, 0);
});
test('Chord charts use the existing campus song schema and survive backup normalization', () => {
  const chart = { title: 'Guitar practice', stage: 'Idea', body: 'Practice tempo: 84 BPM\nSuggested strum: ↓ · ↓ ↑ · ↑ ↓ ↑\n0:00 — G\n0:02 — D' };
  assert.deepEqual(validState({ songs: [chart] }).songs, [chart]);
});
