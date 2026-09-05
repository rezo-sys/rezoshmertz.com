
(() => {
 const dialog = document.querySelector('#media-dialog');
 if (!dialog) return;
 const player = document.querySelector('#player-area');
 const title = document.querySelector('#dialog-title');
 const source = document.querySelector('#media-source-link');
 const credit = document.querySelector('#media-credit');
 let opener, generation = 0, widgetsPromise;
 const media = {
  podcast: {title:'BR Labs Ep. 07: Bitcoin at $80K, Market Triggers & Wrappers vs Native Assets', credit:'BR Labs · Full episode · 23:01'},
  panel: {title:'Stablecoins Under the Hood: Architecture for Global Liquidity', credit:'Epic Web3 · Panel recording · 42:47'},
  event: {title:"What's Next for Stablecoins in the Region", credit:'Photo: Global Finance & Technology Network (GFTN) · Tbilisi Finance Summit'}
 };
 function loadX() {
  if (window.twttr?.widgets) return Promise.resolve(window.twttr);
  if (widgetsPromise) return widgetsPromise;
  widgetsPromise = new Promise((resolve, reject) => {
   const script = document.createElement('script');
   const timer = setTimeout(() => reject(new Error('X timed out')), 15000);
   script.src = 'https://platform.twitter.com/widgets.js'; script.async = true;
   script.onload = () => { clearTimeout(timer); window.twttr?.widgets ? resolve(window.twttr) : reject(new Error('X unavailable')); };
   script.onerror = () => { clearTimeout(timer); reject(new Error('X unavailable')); };
   document.head.append(script);
  });
  return widgetsPromise.catch(error => { widgetsPromise = undefined; throw error; });
 }
 document.querySelectorAll('[data-media]').forEach(link => {
  link.addEventListener('click', async event => {
   if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || typeof dialog.showModal !== 'function') return;
   const key = link.dataset.media, item = media[key];
   if (!item) return;
   event.preventDefault(); opener = link; const token = ++generation;
   title.textContent = item.title; credit.textContent = item.credit; source.href = link.href;
   document.querySelector('#player-help').hidden = key === 'event';
   player.replaceChildren(); dialog.showModal(); document.body.classList.add('media-open');
   if (key === 'event') {
    const img = document.createElement('img');
    const thumb = document.querySelector('[data-media="event"] img');
    img.src = thumb.src; img.alt = thumb.alt; player.append(img);
   } else if (key === 'panel') {
    const iframe = document.createElement('iframe');
    iframe.title = item.title;
    iframe.src = 'https://www.youtube-nocookie.com/embed/OH33Er6q3KA?playsinline=1&rel=0';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin'; player.append(iframe);
   } else {
    const status = document.createElement('p'); status.className = 'player-status'; status.setAttribute('role','status');
    status.textContent = 'Loading the full episode from X…';
    const host = document.createElement('div'); host.className = 'x-host'; player.append(status, host);
    try {
     const x = await loadX();
     if (token !== generation || !dialog.open) return;
     const embedded = await Promise.race([
      x.widgets.createTweet('2094493882885263659', host, {theme:'dark',dnt:true,conversation:'none',align:'center'}),
      new Promise((_,reject) => setTimeout(() => reject(new Error('Embed timeout')),15000))
     ]);
     if (token !== generation || !dialog.open) {host.replaceChildren(); return;}
     status.textContent = embedded ? '' : 'The X player is unavailable here. Use the original source below.';
    } catch {
     if (token === generation && dialog.open) status.textContent = 'The X player is unavailable here. Use the original source below.';
    }
   }
  });
 });
 document.querySelector('.close-media').addEventListener('click', () => dialog.close());
 dialog.addEventListener('close', () => {generation++; player.replaceChildren(); document.body.classList.remove('media-open'); opener?.focus();});
})();
