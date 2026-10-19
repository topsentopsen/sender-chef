'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
globalThis.window = globalThis;
require('../js/data.js');
require('../js/audio.js');

describe('audio tracks', () => {
  it('Notenlängen und Percussion stimmen für alle Stücke', () => {
    const issues = SC.audio._validateTracks();
    assert.deepEqual(issues, []);
  });
  it('alle erwarteten Stücke und Jingles existieren', () => {
    for (const id of ['title', 'tower', 'evening', 'balance']) assert.ok(SC.audio.TRACKS[id], id);
  });
  it('Aufrufe ohne AudioContext werfen nicht', () => {
    assert.doesNotThrow(() => {
      SC.audio.play('title');
      SC.audio.jingle('door');
      SC.audio.setMuted(true);
      SC.audio.setVolume(0.3);
      SC.audio.stop();
      SC.audio.state();
    });
  });
});
