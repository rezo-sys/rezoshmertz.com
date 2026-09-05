/* Progressive enhancement: original phrases, stable measure, explicit pause. */
(() => {
  const phrase = document.querySelector('.switch-phrase');
  const toggle = document.querySelector('.motion-toggle');
  if (!phrase || !toggle) return;
  const phrases = ['DISCIPLINE COMPOUNDS.', 'I BUIDL', 'I HODL...', 'CAPITAL COMPOUNDS.'];
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let paused = false;
  let timer;
  function stop() {
    window.clearTimeout(timer);
    timer = undefined;
  }
  function schedule() {
    stop();
    if (paused || preference.matches || document.hidden) return;
    timer = window.setTimeout(() => {
      index = (index + 1) % phrases.length;
      phrase.textContent = phrases[index];
      schedule();
    }, 4000);
  }
  function reflect() {
    toggle.hidden = preference.matches;
    toggle.textContent = paused ? 'Play' : 'Pause';
    toggle.setAttribute('aria-label', paused ? 'Play headline rotation' : 'Pause headline rotation');
  }
  toggle.addEventListener('click', () => {
    paused = !paused;
    reflect();
    schedule();
  });
  preference.addEventListener('change', () => {
    if (preference.matches) {
      index = 0;
      phrase.textContent = phrases[0];
    }
    reflect();
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', schedule);
  reflect();
  schedule();
})();
