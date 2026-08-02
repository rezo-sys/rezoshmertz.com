(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const typed = document.querySelector('#typed-text');

  if (!reduceMotion && typed) {
    const phrases = ['CAPITAL COMPOUNDS.', 'DISCIPLINE COMPOUNDS.', 'I BUIDL', 'I HODL...'];
    let phraseIndex = 0;
    let value = phrases[0];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const play = async () => {
      await wait(1450);
      while (true) {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        const next = phrases[phraseIndex];
        let prefix = 0;
        while (prefix < value.length && prefix < next.length && value[prefix] === next[prefix]) prefix += 1;
        while (value.length > prefix) {
          value = value.slice(0, -1);
          typed.textContent = value;
          await wait(46);
        }
        await wait(150);
        while (value.length < next.length) {
          value = next.slice(0, value.length + 1);
          typed.textContent = value;
          await wait(68);
        }
        await wait(1450);
      }
    };
    play();
  }

  if (reduceMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cards = [...document.querySelectorAll('.card, .social-card, .bento-card')];
  let pointerX = -1000;
  let pointerY = -1000;
  let frame = 0;
  const paint = () => {
    frame = 0;
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = pointerX - rect.left;
      const y = pointerY - rect.top;
      const dx = Math.max(rect.left - pointerX, 0, pointerX - rect.right);
      const dy = Math.max(rect.top - pointerY, 0, pointerY - rect.bottom);
      const distance = Math.hypot(dx, dy);
      const intensity = Math.max(0, 1 - distance / 240);
      card.style.setProperty('--glow-x', `${x}px`);
      card.style.setProperty('--glow-y', `${y}px`);
      card.style.setProperty('--glow-intensity', intensity.toFixed(3));
    });
  };
  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
})();
