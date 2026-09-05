/* Rezo's original type/delete rhythm, with cancellable lifecycle timers. */
(() => {
  const phrase = document.querySelector('.switch-phrase');
  if (!phrase) return;
  const phrases = ['CAPITAL COMPOUNDS.', 'DISCIPLINE COMPOUNDS.', 'I BUIDL', 'I HODL...'];
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let value = phrases[0];
  let prefix = 0;
  let stage = 'hold';
  let delay = 1450;
  let timer;
  let suspended = false;
  function stop() {
    window.clearTimeout(timer);
    timer = undefined;
  }
  function schedule() {
    stop();
    if (preference.matches || document.hidden || suspended) return;
    timer = window.setTimeout(step, delay);
  }
  function step() {
    if (stage === 'hold') {
      index = (index + 1) % phrases.length;
      prefix = 0;
      while (prefix < value.length && prefix < phrases[index].length && value[prefix] === phrases[index][prefix]) prefix += 1;
      stage = 'erase';
    }
    if (stage === 'erase') {
      if (value.length > prefix) {
        value = value.slice(0, -1);
        delay = 46;
      } else {
        stage = 'type';
        delay = 150;
      }
    } else if (value.length < phrases[index].length) {
      value = phrases[index].slice(0, value.length + 1);
      delay = 68;
    } else {
      stage = 'hold';
      delay = 1450;
    }
    phrase.textContent = value;
    schedule();
  }
  preference.addEventListener('change', () => {
    if (preference.matches) {
      index = 0;
      value = phrases[0];
      phrase.textContent = value;
      stage = 'hold';
      delay = 1450;
    }
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pagehide', () => { suspended = true; stop(); });
  window.addEventListener('pageshow', () => { suspended = false; schedule(); });
  phrase.textContent = value;
  schedule();
})();
