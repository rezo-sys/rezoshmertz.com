// The archive and all source links work without JavaScript.
export function activeSection(tops, readingLine, atBottom = false) {
  if (!tops.length) return -1;
  if (atBottom) return tops.length - 1;
  let active = 0;
  for (let i = 0; i < tops.length; i++) {
    // Native anchor scrolling can round the target position to a fraction of a pixel.
    if (tops[i] > readingLine + 1) break;
    active = i;
  }
  return active;
}

export function initArchive(root, win = window) {
  const nav = root?.querySelector('.year-nav');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#year-"]')];
  const sections = links.map(link => root.querySelector(link.hash));
  if (!links.length || sections.some(section => !section)) return;
  let scheduled = false;
  function sync() {
    scheduled = false;
    const offset = nav.getBoundingClientRect().height + 24;
    const readingLine = win.matchMedia('(max-width: 600px)').matches ? offset : 48;
    root.style.setProperty('--archive-reading-offset', `${offset}px`);
    const atBottom = win.scrollY > 0 && win.scrollY + win.innerHeight >= root.ownerDocument.documentElement.scrollHeight - 3;
    const active = activeSection(sections.map(section => section.getBoundingClientRect().top), readingLine, atBottom);
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    win.requestAnimationFrame(sync);
  }
  win.addEventListener('scroll', schedule, { passive: true });
  for (const event of ['resize', 'hashchange', 'pageshow', 'load']) win.addEventListener(event, schedule);
  // Handles font resizing and the existing expanding About header.
  if (win.ResizeObserver) {
    const observer = new win.ResizeObserver(schedule);
    observer.observe(root);
    observer.observe(nav);
  }
  sync();
}

if (typeof document !== 'undefined') initArchive(document.querySelector('.writing-archive'));
