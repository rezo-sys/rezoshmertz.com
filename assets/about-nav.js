/* Native details/summary also works without JavaScript. */
(() => {
  const disclosure = document.querySelector('.about-nav');
  if (!disclosure) return;
  const trigger = disclosure.querySelector('summary');
  const header = disclosure.closest('.site-header');
  const row = disclosure.querySelector('.about-links');
  // Reserve the actual row height when larger text or narrower screens wrap links.
  const measureRow = () => {
    if (disclosure.open) {
      header.style.setProperty('--about-row-height', `${Math.ceil(row.getBoundingClientRect().height)}px`);
    }
  };
  disclosure.addEventListener('toggle', measureRow);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measureRow);
    observer.observe(row);
  } else {
    window.addEventListener('resize', measureRow);
  }
  measureRow();
  const close = () => { disclosure.open = false; };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && disclosure.open) {
      event.preventDefault();
      close();
      trigger.focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!disclosure.contains(event.target)) close();
  });
  disclosure.addEventListener('focusout', event => {
    if (!disclosure.contains(event.relatedTarget)) close();
  });
  disclosure.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  window.addEventListener('pagehide', close);
})();
