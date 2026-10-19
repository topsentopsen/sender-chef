// Sender-Chef: Start und Spielschleife
'use strict';
(function (SC) {
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    const s = SC.S, UI = SC.ui;
    if (s && s.phase === 'tag' && !UI.paused && !UI.overlayOpen()) {
      s.minute += dt * SC.MIN_PER_SEC * UI.speed;
      const ev = SC.sim.auctionTick(s);
      if (ev) { UI.toast(ev, s.auction && s.auction.bidder > 0); UI.refresh(); }
      if (s.minute >= SC.EVENING) UI.startEvening();
    }
    if (!UI.overlayOpen()) SC.building.update(dt, UI.openRoom);
    SC.building.draw(s ? s.minute : 12 * 60);
    UI.hud(dt);
    requestAnimationFrame(frame);
  }
  window.addEventListener('DOMContentLoaded', () => {
    SC.building.init(document.getElementById('cv'));
    SC.ui.init();
    SC.ui.showTitle();
    requestAnimationFrame(frame);
  });
  // Für Tests und Neugierige
  SC.debug = {
    state: () => SC.S,
    newGame: seed => SC.ui.newGame(seed),
    evening: () => SC.ui.startEvening()
  };
})(window.SC);
